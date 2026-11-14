import { supabase } from './supabase'
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
export async function uploadDocumentToCloud(file: File, document: DocumentRec): Promise<CloudDocumentRef | null> {
  if (!supabase) return null
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    throw new DocumentSyncError('Choose a valid PDF file before uploading.', 'validation', 'INVALID_PDF')
  }
  if (!file.size || file.size > 30 * 1024 * 1024) {
    throw new DocumentSyncError('This PDF must be between 1 byte and 30 MB.', 'validation', 'PDF_SIZE_LIMIT')
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
  if (!sessionData.session) return null

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

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, file, {
    contentType: 'application/pdf',
    upsert: isRetry,
    cacheControl: '3600',
  })
  if (uploadError) throw failure('storage-upload', 'PRIVATE_STORAGE_UPLOAD_FAILED', uploadError, true)

  try {
    const metadata = {
      id: remoteId, owner_id: userId, storage_path: storagePath,
      file_name: file.name.slice(0, 255), title: document.title.slice(0, 200),
      mime_type: 'application/pdf', size_bytes: file.size, page_count: document.pages.length,
      status: 'uploaded', error_message: null, updated_at: new Date().toISOString(),
    }
    const { error: metadataError } = await supabase.from('study_documents').upsert(metadata, { onConflict: 'id' })
    if (metadataError) throw failure('metadata', 'DOCUMENT_METADATA_WRITE_FAILED', metadataError, true)

    // Replace the previous page set atomically from the client's perspective.
    // Delete is scoped to this owner and document; a failed refresh is surfaced.
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

    return { remoteId, storagePath, syncStatus: 'indexed' }
  } catch (error) {
    if (isRetry) {
      // Keep the existing remote reference so the next retry can rebuild the
      // index against the same private object.
      await supabase.from('study_documents')
        .update({ status: 'failed', error_message: error instanceof Error ? error.message.slice(0, 240) : 'Indexing failed', updated_at: new Date().toISOString() })
        .eq('id', remoteId).eq('owner_id', userId)
    } else {
      // A first-time failure cannot return its generated remote ID to the
      // caller, so roll back the object and metadata instead of orphaning them.
      await supabase.from('study_document_pages').delete().eq('document_id', remoteId).eq('owner_id', userId)
      await supabase.from('study_documents').delete().eq('id', remoteId).eq('owner_id', userId)
      await supabase.storage.from(BUCKET).remove([storagePath])
    }
    throw error
  }
}
