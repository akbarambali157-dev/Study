import type * as pdfjsTypes from 'pdfjs-dist'
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { db } from './db'

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc

/**
 * PDF.js 6 uses Map.prototype.getOrInsertComputed, a newer Map upsert
 * method not yet present in some iOS Safari/WebKit releases. Install a small
 * spec-compatible fallback before loading PDF.js so its metadata cache works.
 */
function ensureMapUpsertSupport(): void {
  const mapPrototype = Map.prototype as Map<KnownKey, unknown> & {
    getOrInsertComputed?: (key: KnownKey, callback: (key: KnownKey) => unknown) => unknown
  }
  if (typeof mapPrototype.getOrInsertComputed === 'function') return

  Object.defineProperty(Map.prototype, 'getOrInsertComputed', {
    configurable: true,
    writable: true,
    value: function <K, V>(this: Map<K, V>, key: K, callback: (key: K) => V): V {
      if (this.has(key)) return this.get(key) as V
      const value = callback(key)
      this.set(key, value)
      return value
    },
  })
}

type KnownKey = string | number | symbol | object | null | undefined

export interface ExtractedPdf {
  pages: string[]
  pageCount: number
  /** Fraction of pages with almost no text — high means it is probably a scan. */
  emptyRatio: number
  title?: string
}

export type PdfStage = 'validate' | 'file-read' | 'pdf-open' | 'page-read' | 'metadata' | 'cleanup'

export class PdfError extends Error {
  constructor(
    message: string,
    readonly code: 'corrupt' | 'encrypted' | 'scanned' | 'empty' | 'toolarge' | 'unknown',
    readonly stage: PdfStage = 'validate',
    readonly originalName?: string,
  ) {
    super(message)
    this.name = 'PdfError'
  }
}

function errorDetail(error: unknown): { name: string; message: string } {
  if (error instanceof Error) return { name: error.name || 'Error', message: error.message || 'No error message was provided.' }
  return { name: typeof error, message: String(error) }
}

async function readFileBuffer(file: File): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === 'function') return file.arrayBuffer()
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error ?? new Error('The browser could not read the selected file.'))
    reader.onabort = () => reject(new Error('File reading was cancelled by the browser.'))
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) resolve(reader.result)
      else reject(new TypeError('The browser returned an unsupported file-read result.'))
    }
    reader.readAsArrayBuffer(file)
  })
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
  let stage: PdfStage = 'validate'
  let loadingTask: pdfjsTypes.PDFDocumentLoadingTask | null = null

  try {
    if (!file || typeof file !== 'object') {
      throw new PdfError('The selected file is not available to the PDF reader.', 'unknown', stage)
    }
    if (file.size === 0) {
      throw new PdfError('This PDF file is empty. Choose a different file.', 'empty', stage)
    }
    if (file.size > 30 * 1024 * 1024) {
      throw new PdfError('This PDF is larger than 30 MB. Compress it or split it into smaller files, then try again.', 'toolarge', stage)
    }

    const iteratorApi = (globalThis as typeof globalThis & {
      Iterator?: { from?: unknown; prototype?: { map?: unknown } }
    }).Iterator
    if (typeof iteratorApi?.from !== 'function' || typeof iteratorApi.prototype?.map !== 'function') {
      throw new PdfError(
        'This browser is missing JavaScript features required by the current PDF reader. Update the browser, or try another browser.',
        'unknown',
        'validate',
      )
    }

    stage = 'file-read'
    const buffer = await readFileBuffer(file)
    if (!(buffer instanceof ArrayBuffer) || buffer.byteLength === 0) {
      throw new PdfError('The browser returned an empty file buffer.', 'empty', stage)
    }

    stage = 'pdf-open'
    ensureMapUpsertSupport()
    const pdfjs = await import('pdfjs-dist')
    pdfjs.GlobalWorkerOptions.workerSrc = workerSrc
    loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer), useWorkerFetch: false })
    const doc = await loadingTask.promise

    if (!doc.numPages) throw new PdfError('This PDF contains no pages.', 'empty', stage)
    if (doc.numPages > MAX_PAGES) {
      throw new PdfError(
        `This PDF has ${doc.numPages} pages. The limit is ${MAX_PAGES}, because a document this long would cost a lot to process and lose focus.`,
        'toolarge',
        stage,
      )
    }

    const pages: string[] = []
    for (let i = 1; i <= doc.numPages; i++) {
      stage = 'page-read'
      try {
        const page = await doc.getPage(i)
        const content = await page.getTextContent()
        pages.push(itemsToText(content.items))
        page.cleanup()
      } catch (error) {
        const detail = errorDetail(error)
        throw new PdfError(`Could not read page ${i}: ${detail.message.slice(0, 160)}`, 'corrupt', stage, detail.name)
      }
      onProgress?.(i, doc.numPages)
    }

    stage = 'metadata'
    const metadata = await doc.getMetadata().catch(() => null)
    const meta = metadata?.info as { Title?: string } | undefined
    const emptyPages = pages.filter((p) => p.replace(/\s/g, '').length < 40).length
    const emptyRatio = pages.length ? emptyPages / pages.length : 1

    if (pages.every((p) => p.trim().length === 0)) {
      throw new PdfError(
        'There is no selectable text in this PDF — it looks like a scan or a picture of a page. Image-only PDF reading is not supported yet.',
        'scanned',
        stage,
      )
    }
    if (emptyRatio > 0.7) {
      throw new PdfError(
        'Most pages in this PDF have no selectable text. It is probably a scan, so notes built from it would be guesswork.',
        'scanned',
        stage,
      )
    }

    return { pages, pageCount: doc.numPages, emptyRatio, title: meta?.Title?.trim() || undefined }
  } catch (error) {
    if (error instanceof PdfError) throw error
    const detail = errorDetail(error)
    const message = detail.message.trim().slice(0, 220) || 'No error message was provided by the browser.'
    throw new PdfError(`PDF processing failed during ${stage}: ${message}`, 'unknown', stage, detail.name)
  } finally {
    if (loadingTask) {
      try {
        await loadingTask.destroy()
      } catch {
        // Cleanup must never replace the original PDF read error.
      }
    }
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
