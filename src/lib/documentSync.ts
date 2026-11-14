import { supabase } from './supabase'
import type { DocumentRec } from './types'

const BUCKET = 'study-documents'

export interface CloudDocumentRef {
  remoteId: string
  storagePath: string
  syncStatus: 'indexed'
}

/** Upload a private PDF and its extracted page text for the signed-in owner. */
export async function uploadDocumentToCloud(file: File, document: DocumentRec): Promise<CloudDocumentRef | null> {
  if (!supabase) return null
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    throw new Error('Choose a valid PDF file before uploading.')
  }
  if (!file.size || file.size > 30 * 1024 * 1024) {
    throw new Error('This PDF must be between 1 byte and 30 MB.')
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) throw new Error('Your sign-in session could not be checked. Sign in again.')
  if (!sessionData.session) return null

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) throw new Error('Your account could not be verified. Sign in again before uploading.')

  const userId = userData.user.id
  const remoteId = document.remoteId ?? crypto.randomUUID()
  const safeName = file.name.normalize('NFKC').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'document.pdf'
  const storagePath = document.storagePath ?? `${userId}/${remoteId}/${safeName}`
  const isRetry = Boolean(document.storagePath)

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, file, {
    contentType: 'application/pdf',
    upsert: isRetry,
    cacheControl: '3600',
  })
  if (uploadError) throw new Error(`Private PDF upload failed: ${uploadError.message}`)

  try {
    const metadata = {
      id: remoteId, owner_id: userId, storage_path: storagePath,
      file_name: file.name.slice(0, 255), title: document.title.slice(0, 200),
      mime_type: 'application/pdf', size_bytes: file.size, page_count: document.pages.length,
      status: 'uploaded', error_message: null, updated_at: new Date().toISOString(),
    }
    const { error: metadataError } = await supabase.from('study_documents').upsert(metadata, { onConflict: 'id' })
    if (metadataError) throw new Error(`Document record could not be saved: ${metadataError.message}`)

    if (isRetry) {
      const { error } = await supabase.from('study_document_pages').delete().eq('document_id', remoteId).eq('owner_id', userId)
      if (error) throw new Error(`The previous page index could not be refreshed: ${error.message}`)
    }

    for (let start = 0; start < document.pages.length; start += 20) {
      const rows = document.pages.slice(start, start + 20).map((page_text, index) => ({
        document_id: remoteId, owner_id: userId, page_number: start + index + 1, page_text,
      }))
      const { error } = await supabase.from('study_document_pages').insert(rows)
      if (error) throw new Error(`PDF text indexing failed on pages ${start + 1}–${start + rows.length}: ${error.message}`)
    }

    const { error: readyError } = await supabase.from('study_documents')
      .update({ status: 'indexed', updated_at: new Date().toISOString() })
      .eq('id', remoteId).eq('owner_id', userId)
    if (readyError) throw new Error(`PDF uploaded, but page indexing did not finish: ${readyError.message}`)

    return { remoteId, storagePath, syncStatus: 'indexed' }
  } catch (error) {
    if (isRetry) {
      await supabase.from('study_document_pages').delete().eq('document_id', remoteId).eq('owner_id', userId)
      await supabase.from('study_documents').update({ status: 'failed', error_message: 'Page indexing needs to be retried.' }).eq('id', remoteId).eq('owner_id', userId)
    } else {
      await supabase.storage.from(BUCKET).remove([storagePath]).catch(() => undefined)
      await supabase.from('study_documents').delete().eq('id', remoteId).eq('owner_id', userId)
    }
    throw error
  }
}
