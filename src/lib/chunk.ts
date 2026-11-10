import { clamp, firstWords } from './utils'

export interface Chunk {
  index: number
  /** 1-indexed page numbers, inclusive. */
  fromPage: number
  toPage: number
  text: string
}

const DEFAULT_TARGET_CHARS = 20_000

/**
 * Groups pages into chunks that (a) never split a page in half, so every
 * citation can point at a real page, and (b) overlap by one page so a point
 * that straddles a boundary is not lost.
 */
export function chunkPages(
  pages: string[],
  targetChars = DEFAULT_TARGET_CHARS,
  overlapPages = 1,
): Chunk[] {
  const cleaned = pages.map((p) => p.replace(/\s+\n/g, '\n').trim())
  const chunks: Chunk[] = []

  let start = 0
  while (start < cleaned.length) {
    let end = start
    let size = 0
    while (end < cleaned.length) {
      const pageLen = cleaned[end].length
      // Always take at least one page, even if it alone blows the target.
      if (end > start && size + pageLen > targetChars) break
      size += pageLen
      end += 1
    }

    const text = cleaned
      .slice(start, end)
      .map((page, i) => `<page n="${start + i + 1}">\n${page}\n</page>`)
      .join('\n\n')

    chunks.push({ index: chunks.length, fromPage: start + 1, toPage: end, text })

    if (end >= cleaned.length) break
    // Step back for overlap, but always make forward progress.
    start = Math.max(start + 1, end - overlapPages)
  }

  return chunks
}

/** Rough token estimate; good enough for cost previews (≈4 chars/token). */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

export function estimatePdfTokens(pages: string[]): number {
  return estimateTokens(pages.join('\n'))
}

/**
 * Smallest page text that contains the cited words — lets us show a snippet
 * the student can verify in one glance instead of trusting a number.
 */
export function findSnippet(pages: string[], page: number | undefined, needle?: string): string | undefined {
  if (!page || page < 1 || page > pages.length) return undefined
  const text = pages[page - 1]?.replace(/\s+/g, ' ').trim()
  if (!text) return undefined
  if (!needle) return firstWords(text, 14)

  const normalisedNeedle = needle.toLowerCase().slice(0, 40)
  const idx = text.toLowerCase().indexOf(normalisedNeedle)
  if (idx === -1) return firstWords(text, 14)
  const start = Math.max(0, idx - 40)
  return `${start > 0 ? '…' : ''}${text.slice(start, idx + 120).trim()}…`
}

/**
 * A model can name a page outside the chunk it was given. Clamp it into the
 * chunk's real range so a wrong page is impossible — only an imprecise one.
 */
export function clampPage(page: unknown, fromPage: number, toPage: number): number {
  const n = typeof page === 'number' && Number.isFinite(page) ? Math.round(page) : fromPage
  return clamp(n, fromPage, toPage)
}
