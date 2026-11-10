import type { Card, Deck } from './types'

export interface ExportedDeck {
  version: 1
  deck: { title: string }
  cards: { front: string; back: string; example?: string; page?: number }[]
}

export function buildExport(deck: Deck, cards: Card[]): ExportedDeck {
  return {
    version: 1,
    deck: { title: deck.title },
    cards: cards.map((c) => ({
      front: c.front,
      back: c.back,
      example: c.example,
      page: c.page,
    })),
  }
}

export function toCsv(deck: Deck, cards: Card[]): string {
  const escape = (value: string | number | undefined) => {
    const text = value === undefined ? '' : String(value)
    return `"${text.replace(/"/g, '""')}"`
  }
  const rows = [
    ['front', 'back', 'example', 'page', 'deck'].map(escape).join(','),
    ...cards.map((c) =>
      [c.front, c.back, c.example, c.page, deck.title].map(escape).join(','),
    ),
  ]
  return rows.join('\n')
}

/**
 * Tab-separated, which is what Anki's "Import File" expects when you map the
 * columns yourself. Tabs and newlines inside a field are flattened so the
 * import never splits a card in half.
 */
export function toAnkiTsv(cards: Card[]): string {
  const clean = (value: string | undefined) =>
    (value ?? '').replace(/\t/g, ' ').replace(/\r?\n/g, '<br>')
  return cards
    .map((c) => {
      const back = c.example ? `${c.back}<br><br><i>e.g. ${clean(c.example)}</i>` : c.back
      return `${clean(c.front)}\t${clean(back)}`
    })
    .join('\n')
}

export function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export function safeFilename(title: string, extension: string): string {
  const base = title
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60)
    .toLowerCase()
  return `${base || 'deck'}.${extension}`
}

/* ── share links, with no server involved ─────────────────────────────── */

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(encoded: string): string {
  const padded = encoded.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, '='))
  const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

/** Rough limit so a share link stays pasteable in WhatsApp. */
const MAX_SHARE_LENGTH = 12_000

export function encodeShare(deck: Deck, cards: Card[]): string | null {
  const payload = buildExport(deck, cards)
  const encoded = toBase64Url(JSON.stringify(payload))
  if (encoded.length > MAX_SHARE_LENGTH) return null
  return encoded
}

export function decodeShare(encoded: string): ExportedDeck | null {
  try {
    const parsed = JSON.parse(fromBase64Url(encoded)) as ExportedDeck
    if (parsed?.version !== 1 || !Array.isArray(parsed.cards)) return null
    return parsed
  } catch {
    return null
  }
}

export function shareUrl(encoded: string): string {
  const { origin, pathname } = window.location
  return `${origin}${pathname}#/shared/${encoded}`
}
