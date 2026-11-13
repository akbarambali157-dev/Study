import * as pdfjs from 'pdfjs-dist'
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { db } from './db'

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc

export interface ExtractedPdf {
  pages: string[]
  pageCount: number
  /** Fraction of pages with almost no text — high means it is probably a scan. */
  emptyRatio: number
  title?: string
}

export class PdfError extends Error {
  constructor(
    message: string,
    readonly code: 'corrupt' | 'encrypted' | 'scanned' | 'empty' | 'toolarge' | 'unknown',
  ) {
    super(message)
    this.name = 'PdfError'
  }
}

export const MAX_PAGES = 120

/**
 * Extracts text page by page. Pages are the unit of citation everywhere else in
 * the app, so this must never merge or renumber them.
 */
export async function extractPdf(
  file: File,
  onProgress?: (page: number, total: number) => void,
): Promise<ExtractedPdf> {
  if (file.size === 0) {
    throw new PdfError('This PDF file is empty. Choose a different file.', 'empty')
  }
  if (file.size > 30 * 1024 * 1024) {
    throw new PdfError('This PDF is larger than 30 MB. Compress it or split it into smaller files, then try again.', 'toolarge')
  }

  const buffer = await file.arrayBuffer()
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    isEvalSupported: false,
    useWorkerFetch: false,
  })

  try {
    let doc: pdfjs.PDFDocumentProxy
    try {
      doc = await loadingTask.promise
    } catch (error) {
      const name = (error as { name?: string })?.name ?? ''
      if (name === 'PasswordException') {
        throw new PdfError('This PDF is password-protected. Remove the password, then try again.', 'encrypted')
      }
      const detail = error instanceof Error ? error.message : ''
      throw new PdfError(
        detail ? `PDF reader could not open this file: ${detail.slice(0, 180)}` : 'This file could not be read as a PDF. It may be damaged.',
        'corrupt',
      )
    }

    if (!doc.numPages) {
      throw new PdfError('This PDF contains no pages.', 'empty')
    }
    if (doc.numPages > MAX_PAGES) {
      throw new PdfError(
        `This PDF has ${doc.numPages} pages. The limit is ${MAX_PAGES}, because a document this long would cost a lot to process and lose focus.`,
        'toolarge',
      )
    }

    const pages: string[] = []
    for (let i = 1; i <= doc.numPages; i++) {
      try {
        const page = await doc.getPage(i)
        const content = await page.getTextContent()
        pages.push(itemsToText(content.items))
        page.cleanup()
      } catch (error) {
        const detail = error instanceof Error ? error.message : 'Unknown page-reading error.'
        throw new PdfError(`Could not read page ${i}: ${detail.slice(0, 160)}`, 'corrupt')
      }
      onProgress?.(i, doc.numPages)
    }

    const metadata = await doc.getMetadata().catch(() => null)
    const meta = metadata?.info as { Title?: string } | undefined

    const emptyPages = pages.filter((p) => p.replace(/\\s/g, '').length < 40).length
    const emptyRatio = pages.length ? emptyPages / pages.length : 1

    if (pages.every((p) => p.trim().length === 0)) {
      throw new PdfError(
        'There is no selectable text in this PDF — it looks like a scan or a picture of a page. Image-only PDF reading is not supported yet.',
        'scanned',
      )
    }
    if (emptyRatio > 0.7) {
      throw new PdfError(
        'Most pages in this PDF have no selectable text. It is probably a scan, so notes built from it would be guesswork.',
        'scanned',
      )
    }

    return {
      pages,
      pageCount: doc.numPages,
      emptyRatio,
      title: meta?.Title?.trim() || undefined,
    }
  } finally {
    // Always release the worker, including when one page fails to parse.
    await loadingTask.destroy().catch(() => undefined)
  }
}

interface TextItem {
  str?: string
  hasEOL?: boolean
}

function itemsToText(items: unknown[]): string {
  let out = ''
  for (const raw of items) {
    const item = raw as TextItem
    if (typeof item.str !== 'string') continue
    out += item.str
    out += item.hasEOL ? '\n' : ' '
  }
  return out.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
}

/* ── local PDF storage, for "open at page" ───────────────────────────── */

/**
 * The PDF binary never leaves the device. It is kept in IndexedDB purely so a
 * citation can open the real page in the browser's PDF viewer.
 */
export async function cachePdfBlob(documentId: string, file: Blob): Promise<void> {
  try {
    await db.table('pdfBlobs').put({ id: documentId, blob: file, savedAt: Date.now() })
  } catch {
    // Storage quota is not worth failing an upload over.
  }
}

export async function openPdfAtPage(documentId: string, page: number): Promise<boolean> {
  try {
    const row = (await db.table('pdfBlobs').get(documentId)) as
      | { id: string; blob: Blob }
      | undefined
    if (!row?.blob) return false
    const url = URL.createObjectURL(row.blob)
    window.open(`${url}#page=${page}`, '_blank', 'noopener,noreferrer')
    // Give the new tab time to take the URL before revoking it.
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
    return true
  } catch {
    return false
  }
}

export async function hasPdfBlob(documentId: string): Promise<boolean> {
  const row = await db.table('pdfBlobs').get(documentId)
  return Boolean(row)
}
