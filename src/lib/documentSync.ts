import { supabase, supabaseUrl } from './supabase'
import { MAX_PDF_BYTES, MAX_PDF_SIZE_LABEL } from './pdfLimits'
import type { DocumentRec } from './types'

const BUCKET = 'study-documents'

export type DocumentSyncStage = 'configuration' | 'validation' | 'session' | 'identity' | 'storage-upload' | 'metadata' | 'page-index' | 'finalize'

export class DocumentSyncError extends Error {
  readonly diagnosticId: string
  constructor(
    message: string,
    readonly stage: DocumentSyncStage,
    readonly code: string,
    readonly retryable = false,
    readonly status?: number,
  ) {
    super(message)
    this.name = 'DocumentSyncError'
    this.diagnosticId = `DOC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`
  }
}

export interface CloudDocumentRef {
  remoteId: string
  storagePath: string
  syncStatus: 'indexed'
  remoteOwnerId: string
}

function failure(stage: DocumentSyncStage, code: string, error: unknown, retryable = false): DocumentSyncError {
  const message = error instanceof Error ? error.message : 'Unknown storage error'
  const status = typeof error === 'object' && error && 'status' in error ? Number((error as { status?: unknown }).status) || undefined : undefined
  return new DocumentSyncError(message.slice(0, 240), stage, code, retryable, status)
}

/**
 * Cloud sync is deliberately a separate operation from local PDF extraction
 * and AI generation. Callers can continue locally when cloud sync is down.
 */
function encodeTusMetadata(values: Record<string, string>): string {
  return Object.entries(values)
    .map(([key, value]) => `${key} ${btoa(value)}`)
    .join(',')
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Supabase recommends TUS for uploads over 6 MB. Use 6 MB chunks so a
 * connection interruption only requires resending the current chunk.
 */
async function uploadPdfResumable(
  file: File,
  storagePath: string,
  accessToken: string,
  signal?: AbortSignal,
): Promise<void> {
  const projectUrl = new URL(supabaseUrl)
  if (projectUrl.hostname.endsWith('.supabase.co')) {
    projectUrl.hostname = projectUrl.hostname.replace(/\.supabase\.co$/, '.storage.supabase.co')
  }
  const endpoint = `${projectUrl.origin}/storage/v1/upload/resumable`
  const headers = {
    apikey: (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ?? '',
    Authorization: `Bearer ${accessToken}`,
    'Tus-Resumable': '1.0.0',
  }
  const createResponse = await fetch(endpoint, {
    method: 'POST',
    headers: {
      ...headers,
      'Upload-Length': String(file.size),
      'Upload-Metadata': encodeTusMetadata({
        bucketName: BUCKET,
        objectName: storagePath,
        contentType: 'application/pdf',
        cacheControl: '3600',
      }),
      'x-upsert': 'true',
    },
    signal,
  })
  if (!createResponse.ok) {
    throw new DocumentSyncError(
      `Resumable upload could not start (HTTP ${createResponse.status}).`,
      'storage-upload',
      `TUS_CREATE_HTTP_${createResponse.status}`,
      createResponse.status >= 500,
      createResponse.status,
    )
  }
  const location = createResponse.headers.get('Location')
  if (!location) throw new DocumentSyncError('Storage did not return an upload session.', 'storage-upload', 'TUS_LOCATION_MISSING')
  const uploadUrl = new URL(location, endpoint)
  if (uploadUrl.origin !== new URL(endpoint).origin) {
    throw new DocumentSyncError('Storage returned an invalid upload session.', 'storage-upload', 'TUS_LOCATION_INVALID')
  }

  let offset = 0
  const chunkSize = 6 * 1024 * 1024
  const retryDelays = [1000, 3000, 6000]
  while (offset < file.size) {
    if (signal?.aborted) throw new DOMException('Upload cancelled.', 'AbortError')
    const end = Math.min(offset + chunkSize, file.size)
    try {
      const response = await fetch(uploadUrl, {
        method: 'PATCH',
        headers: {
          ...headers,
          'Content-Type': 'application/offset+octet-stream',
          'Upload-Offset': String(offset),
        },
        body: file.slice(offset, end),
        signal,
      })
      if (response.status === 409) {
        const head = await fetch(uploadUrl, { method: 'HEAD', headers, signal })
        if (!head.ok) throw new Error(`Could not resume upload (HTTP ${head.status}).`)
        offset = Number(head.headers.get('Upload-Offset') ?? offset)
        continue
      }
      if (response.status !== 204) {
        throw new DocumentSyncError(
          `Storage rejected an upload chunk (HTTP ${response.status}).`,
          'storage-upload',
          `TUS_PATCH_HTTP_${response.status}`,
          response.status >= 500,
          response.status,
        )
      }
      const nextOffset = Number(response.headers.get('Upload-Offset') ?? end)
      if (!Number.isFinite(nextOffset) || nextOffset <= offset || nextOffset > file.size) {
        throw new DocumentSyncError('Storage returned an invalid upload offset.', 'storage-upload', 'TUS_OFFSET_INVALID')
      }
      offset = nextOffset
    } catch (error) {
      if (signal?.aborted || (error instanceof DOMException && error.name === 'AbortError')) throw error
      if (error instanceof DocumentSyncError && !error.retryable) throw error
      const retry = retryDelays.shift()
      if (retry === undefined) throw error
      await wait(retry)
      const head = await fetch(uploadUrl, { method: 'HEAD', headers, signal })
      if (!head.ok) throw new Error(`Upload could not resume after a connection interruption (HTTP ${head.status}).`)
      offset = Number(head.headers.get('Upload-Offset') ?? offset)
    }
  }
}


type PendingSyncResult = { synced: number; skipped: number; failed: number; reason?: 'offline' | 'configuration' | 'signed-out' }
let pendingSync: Promise<PendingSyncResult> | null = null

/**
 * Upload private PDFs saved on this device when the student explicitly asks.
 * Its local syncStatus is the durable queue: retries reuse its remote ID/storage path,
 * and uploadDocumentToCloud rebuilds the page index idempotently.
 *
 * Generated notes/cards remain local-first; this only syncs the private
 * original PDF and its extracted page index.
 */
export function syncPendingDocuments(documentId?: string): Promise<PendingSyncResult> {
  if (pendingSync) return pendingSync
  const current = (async (): Promise<PendingSyncResult> => {
    const result = { synced: 0, skipped: 0, failed: 0 }
    if (typeof navigator !== 'undefined' && !navigator.onLine) return { ...result, reason: 'offline' }
    if (!supabase) return { ...result, reason: 'configuration' }

    const { data, error } = await supabase.auth.getSession()
    if (error || !data.session) return { ...result, reason: 'signed-out' }

    const documents = await (await import('./db')).db.documents
      .where('source').equals('upload').toArray()
    const pendingDocuments = documentId ? documents.filter((document) => document.id === documentId) : documents

    for (const document of pendingDocuments) {
      if (document.syncStatus === 'indexed' || document.status === 'extracting') {
        result.skipped++
        continue
      }
      if (typeof navigator !== 'undefined' && !navigator.onLine) break

      try {
        const database = (await import('./db')).db
        const cached = await database.pdfBlobs.get(document.id)
        if (!cached?.blob) {
          result.skipped++
          continue
        }
        const file = new File([cached.blob], document.fileName || 'document.pdf', {
          type: 'application/pdf',
          lastModified: cached.savedAt || Date.now(),
        })
        // Persist the idempotency key and storage path before network I/O.
        // If the app closes mid-upload, the next attempt targets the same
        // private object and metadata row instead of creating duplicates.
        const remoteId = document.remoteId ?? crypto.randomUUID()
        const safeName = file.name.normalize('NFKC').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'document.pdf'
        const storagePath = document.storagePath ?? `${data.session.user.id}/${remoteId}/${safeName}`
        await database.documents.update(document.id, { remoteId, storagePath, remoteOwnerId: data.session.user.id, syncStatus: 'local' })
        const remote = await uploadDocumentToCloud(file, { ...document, remoteId, storagePath, remoteOwnerId: data.session.user.id })
        if (!remote) {
          result.skipped++
          continue
        }
        await database.documents.update(document.id, { ...remote, syncStatus: 'indexed' })
        result.synced++
      } catch {
        await (await import('./db')).db.documents.update(document.id, { syncStatus: 'failed' }).catch(() => undefined)
        result.failed++
      }
    }
    return result
  })().finally(() => { pendingSync = null })
  pendingSync = current
  return current
}

export async function uploadDocumentToCloud(
  file: File,
  document: DocumentRec,
  signal?: AbortSignal,
): Promise<CloudDocumentRef | null> {
  if (!supabase) return null
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    throw new DocumentSyncError('Choose a valid PDF file before uploading.', 'validation', 'INVALID_PDF')
  }
  if (!file.size || file.size > MAX_PDF_BYTES) {
    throw new DocumentSyncError(`This PDF must be between 1 byte and ${MAX_PDF_SIZE_LABEL}.`, 'validation', 'PDF_SIZE_LIMIT')
  }
  if (!document.pages.length) {
    throw new DocumentSyncError('The PDF has no extracted page text to index.', 'validation', 'EMPTY_PAGE_INDEX')
  }

  let sessionData
  try {
    const result = await supabase.auth.getSession()
    if (result.error) throw result.error
    sessionData = result.data
  } catch (error) {
    throw failure('session', 'SESSION_LOOKUP_FAILED', error, true)
  }
  if (!sessionData.session?.access_token) return null

  let userId: string
  try {
    const { data, error } = await supabase.auth.getUser()
    if (error || !data.user) throw error ?? new Error('No authenticated user returned')
    userId = data.user.id
  } catch (error) {
    throw failure('identity', 'USER_VERIFICATION_FAILED', error, true)
  }

  const remoteId = document.remoteId ?? crypto.randomUUID()
  const safeName = file.name.normalize('NFKC').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'document.pdf'
  const storagePath = document.storagePath ?? `${userId}/${remoteId}/${safeName}`
  const isRetry = Boolean(document.storagePath)

  try {
    await uploadPdfResumable(file, storagePath, sessionData.session.access_token, signal)
  } catch (error) {
    if (error instanceof DocumentSyncError) throw error
    if (signal?.aborted || (error instanceof DOMException && error.name === 'AbortError')) throw error
    throw failure('storage-upload', 'PRIVATE_RESUMABLE_UPLOAD_FAILED', error, true)
  }

  try {
    const metadata = {
      id: remoteId, owner_id: userId, storage_path: storagePath,
      file_name: file.name.slice(0, 255), title: document.title.slice(0, 200),
      mime_type: 'application/pdf', size_bytes: file.size, page_count: document.pages.length,
      status: 'uploaded', error_message: null, updated_at: new Date().toISOString(),
    }
    const { error: metadataError } = await supabase.from('study_documents').upsert(metadata, { onConflict: 'id' })
    if (metadataError) throw failure('metadata', 'DOCUMENT_METADATA_WRITE_FAILED', metadataError, true)

    const { error: deleteError } = await supabase.from('study_document_pages')
      .delete().eq('document_id', remoteId).eq('owner_id', userId)
    if (deleteError) throw failure('page-index', 'OLD_PAGE_INDEX_CLEANUP_FAILED', deleteError, true)

    for (let start = 0; start < document.pages.length; start += 20) {
      const rows = document.pages.slice(start, start + 20).map((page_text, index) => ({
        document_id: remoteId, owner_id: userId, page_number: start + index + 1, page_text,
      }))
      const { error } = await supabase.from('study_document_pages').insert(rows)
      if (error) throw failure('page-index', `PAGE_INDEX_INSERT_FAILED_${start + 1}`, error, true)
    }

    const { error: readyError } = await supabase.from('study_documents')
      .update({ status: 'indexed', error_message: null, updated_at: new Date().toISOString() })
      .eq('id', remoteId).eq('owner_id', userId)
    if (readyError) throw failure('finalize', 'DOCUMENT_FINALIZE_FAILED', readyError, true)

    return { remoteId, storagePath, syncStatus: 'indexed', remoteOwnerId: userId }
  } catch (error) {
    if (isRetry) {
      await supabase.from('study_documents')
        .update({ status: 'failed', error_message: error instanceof Error ? error.message.slice(0, 240) : 'Indexing failed', updated_at: new Date().toISOString() })
        .eq('id', remoteId).eq('owner_id', userId)
    } else {
      await supabase.from('study_document_pages').delete().eq('document_id', remoteId).eq('owner_id', userId)
      await supabase.from('study_documents').delete().eq('id', remoteId).eq('owner_id', userId)
      await supabase.storage.from(BUCKET).remove([storagePath])
    }
    throw error
  }
}


export interface CloudDocumentSummary {
  id: string
  title: string
  file_name: string
  size_bytes: number
  page_count: number
  created_at: string
  status: string
}

export async function listCloudDocuments(): Promise<CloudDocumentSummary[]> {
  if (!supabase) return []
  const { data: auth, error: authError } = await supabase.auth.getUser()
  if (authError || !auth.user) throw new DocumentSyncError('Sign in to view your cloud documents.', 'session', 'AUTH_REQUIRED')
  const { data, error } = await supabase.from('study_documents')
    .select('id,title,file_name,size_bytes,page_count,created_at,status')
    .eq('owner_id', auth.user.id).eq('status', 'indexed')
    .order('created_at', { ascending: false }).limit(100)
  if (error) throw failure('metadata', 'CLOUD_DOCUMENT_LIST_FAILED', error, true)
  return (data ?? []) as CloudDocumentSummary[]
}

/** Restore the private source PDF and its extracted page index to this device. */
export async function restoreCloudDocument(remoteId: string): Promise<string> {
  if (!supabase) throw new DocumentSyncError('Cloud document restore needs an account connection.', 'configuration', 'SUPABASE_NOT_CONFIGURED')
  const { data: auth, error: authError } = await supabase.auth.getUser()
  if (authError || !auth.user) throw new DocumentSyncError('Sign in to restore this document.', 'session', 'AUTH_REQUIRED')
  const userId = auth.user.id

  const { data: metadata, error: metadataError } = await supabase.from('study_documents')
    .select('id,owner_id,storage_path,file_name,title,mime_type,size_bytes,page_count,created_at,status')
    .eq('id', remoteId).eq('owner_id', userId).maybeSingle()
  if (metadataError || !metadata) throw failure('metadata', 'CLOUD_DOCUMENT_NOT_FOUND', metadataError ?? new Error('Document not found.'))
  if (metadata.status !== 'indexed' || metadata.mime_type !== 'application/pdf') {
    throw new DocumentSyncError('This cloud document is not ready to restore yet.', 'metadata', 'CLOUD_DOCUMENT_NOT_READY')
  }
  if (!metadata.storage_path || Number(metadata.size_bytes) < 1 || Number(metadata.size_bytes) > MAX_PDF_BYTES) {
    throw new DocumentSyncError('The cloud document metadata is incomplete or outside the supported size limit.', 'validation', 'CLOUD_DOCUMENT_METADATA_INVALID')
  }

  const [{ data: blob, error: downloadError }, { data: pageRows, error: pageError }] = await Promise.all([
    supabase.storage.from(BUCKET).download(metadata.storage_path),
    supabase.from('study_document_pages').select('page_number,page_text')
      .eq('document_id', remoteId).eq('owner_id', userId).order('page_number', { ascending: true }),
  ])
  if (downloadError || !blob) throw failure('storage-upload', 'CLOUD_PDF_DOWNLOAD_FAILED', downloadError ?? new Error('PDF download returned no file.'), true)
  if (pageError) throw failure('page-index', 'CLOUD_PAGE_INDEX_READ_FAILED', pageError, true)
  const rows = pageRows ?? []
  if (rows.length !== Number(metadata.page_count) || rows.some((row, index) => Number(row.page_number) !== index + 1)) {
    throw new DocumentSyncError('The saved page index is incomplete. Keep the cloud copy and contact support before deleting it.', 'page-index', 'CLOUD_PAGE_INDEX_INCOMPLETE')
  }
  const pages = rows.map((row) => typeof row.page_text === 'string' ? row.page_text : '')
  if (!pages.length || pages.every((page) => !page.trim())) {
    throw new DocumentSyncError('No searchable text was saved for this PDF. Scanned/image-only PDFs need OCR before they can be restored for study.', 'page-index', 'CLOUD_PAGE_TEXT_EMPTY')
  }
  if (blob.size !== Number(metadata.size_bytes)) {
    throw new DocumentSyncError('The downloaded PDF size does not match its saved metadata.', 'storage-upload', 'CLOUD_PDF_SIZE_MISMATCH')
  }
  if (await blob.slice(0, 5).text() !== '%PDF-') {
    throw new DocumentSyncError('The cloud object is not a valid PDF file.', 'validation', 'CLOUD_OBJECT_NOT_PDF')
  }

  const { db } = await import('./db')
  const existing = await db.documents.where('remoteId').equals(remoteId).filter((item) => item.remoteOwnerId === userId).first()
  if (existing) return existing.id
  const localId = `cloud-${userId.slice(0, 8)}-${remoteId}`
  const fileName = String(metadata.file_name || 'restored-document.pdf').slice(0, 255)
  const document: DocumentRec = {
    id: localId,
    title: String(metadata.title || fileName.replace(/\.pdf$/i, '')).slice(0, 200),
    fileName,
    pageCount: pages.length,
    pages,
    createdAt: String(metadata.created_at || new Date().toISOString()),
    status: 'queued',
    source: 'upload',
    sizeBytes: blob.size,
    remoteId,
    storagePath: metadata.storage_path,
    remoteOwnerId: userId,
    syncStatus: 'indexed',
  }
  await db.transaction('rw', [db.documents, db.pdfBlobs], async () => {
    await db.documents.put(document)
    await db.pdfBlobs.put({ id: localId, blob, savedAt: Date.now() })
  })
  return localId
}

/** Remove the authenticated user's private PDF, page index and metadata. */
export async function deleteCloudDocument(remoteId: string): Promise<void> {
  if (!supabase) throw new DocumentSyncError('Cloud deletion needs an account connection.', 'configuration', 'SUPABASE_NOT_CONFIGURED')
  const { data: auth, error: authError } = await supabase.auth.getUser()
  if (authError || !auth.user) throw new DocumentSyncError('Sign in before deleting the cloud copy.', 'session', 'AUTH_REQUIRED')
  const { data: document, error: lookupError } = await supabase.from('study_documents')
    .select('id,storage_path').eq('id', remoteId).eq('owner_id', auth.user.id).maybeSingle()
  if (lookupError) throw failure('metadata', 'CLOUD_DELETE_LOOKUP_FAILED', lookupError, true)
  if (!document) return
  if (document.storage_path) {
    const { error: storageError } = await supabase.storage.from(BUCKET).remove([document.storage_path])
    if (storageError) throw failure('storage-upload', 'CLOUD_PDF_DELETE_FAILED', storageError, true)
  }
  const { error: pagesError } = await supabase.from('study_document_pages').delete()
    .eq('document_id', remoteId).eq('owner_id', auth.user.id)
  if (pagesError) throw failure('page-index', 'CLOUD_PAGE_INDEX_DELETE_FAILED', pagesError, true)
  const { error: metadataError } = await supabase.from('study_documents').delete()
    .eq('id', remoteId).eq('owner_id', auth.user.id)
  if (metadataError) throw failure('metadata', 'CLOUD_METADATA_DELETE_FAILED', metadataError, true)
}


export async function deleteRemoteDocument(input: { remoteId: string; storagePath?: string; ownerId: string }): Promise<boolean> {
  if (!supabase || (typeof navigator !== 'undefined' && !navigator.onLine)) return false
  const { data: auth, error: authError } = await supabase.auth.getUser()
  if (authError || !auth.user || auth.user.id !== input.ownerId) return false

  let storagePath = input.storagePath
  if (!storagePath) {
    const { data, error } = await supabase.from('study_documents')
      .select('storage_path').eq('id', input.remoteId).eq('owner_id', input.ownerId).maybeSingle()
    if (error) throw failure('metadata', 'DELETE_METADATA_LOOKUP_FAILED', error, true)
    storagePath = data?.storage_path
  }

  if (storagePath) {
    const { error } = await supabase.storage.from(BUCKET).remove([storagePath])
    if (error) throw failure('storage-upload', 'PRIVATE_OBJECT_DELETE_FAILED', error, true)
  }
  const { error: pagesError } = await supabase.from('study_document_pages')
    .delete().eq('document_id', input.remoteId).eq('owner_id', input.ownerId)
  if (pagesError) throw failure('page-index', 'PAGE_INDEX_DELETE_FAILED', pagesError, true)
  const { error: metadataError } = await supabase.from('study_documents')
    .delete().eq('id', input.remoteId).eq('owner_id', input.ownerId)
  if (metadataError) throw failure('metadata', 'DOCUMENT_METADATA_DELETE_FAILED', metadataError, true)
  return true
}

/** Flush only this signed-in account's durable remote-deletion queue. */
export async function flushPendingCloudDeletions(): Promise<{ deleted: number; pending: number }> {
  const result = { deleted: 0, pending: 0 }
  if (!supabase || (typeof navigator !== 'undefined' && !navigator.onLine)) return result
  const { data: auth, error } = await supabase.auth.getUser()
  if (error || !auth.user) return result
  const database = (await import('./db')).db
  const queue = await database.pendingCloudDeletions.where('ownerId').equals(auth.user.id).toArray()
  for (const item of queue) {
    try {
      const deleted = await deleteRemoteDocument({ remoteId: item.id, storagePath: item.storagePath, ownerId: item.ownerId })
      if (deleted) {
        await database.pendingCloudDeletions.delete(item.id)
        result.deleted++
      } else result.pending++
    } catch {
      result.pending++
    }
  }
  return result
}
