import { Fragment, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * A deliberately small markdown renderer.
 *
 * There is no HTML pass-through and no link rendering: notes come from a model
 * reading an untrusted PDF, so the safest renderer is one that can only produce
 * text, emphasis, lists and code. A prompt-injected `<script>` or `[click](…)`
 * simply appears as characters.
 */
export function Markdown({ text, className }: { text: string; className?: string }) {
  const blocks = parseBlocks(text ?? '')
  return <div className={cn('prose-note', className)}>{blocks}</div>
}

// One member per kind, rather than unions of kinds per member: TypeScript can
// only narrow `block.text` away after a `kind === 'ul' || kind === 'ol'` check
// when each member carries a single literal discriminant.
type Block =
  | { kind: 'h2'; text: string }
  | { kind: 'h3'; text: string }
  | { kind: 'p'; text: string }
  | { kind: 'ul'; items: string[] }
  | { kind: 'ol'; items: string[] }

function parseBlocks(raw: string): ReactNode[] {
  const lines = raw.replace(/\r\n/g, '\n').split('\n')
  const blocks: Block[] = []
  let list: { kind: 'ul' | 'ol'; items: string[] } | null = null
  let paragraph: string[] = []

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push({ kind: 'p', text: paragraph.join(' ') })
      paragraph = []
    }
  }
  const flushList = () => {
    if (list) {
      blocks.push(list)
      list = null
    }
  }

  for (const line of lines) {
    const trimmed = line.trim()

    if (!trimmed) {
      flushParagraph()
      flushList()
      continue
    }
    if (trimmed === '---' || trimmed === '***') {
      flushParagraph()
      flushList()
      blocks.push({ kind: 'p', text: ' ' })
      continue
    }
    const heading = /^(#{1,4})\s+(.*)$/.exec(trimmed)
    if (heading) {
      flushParagraph()
      flushList()
      blocks.push({ kind: heading[1].length <= 2 ? 'h2' : 'h3', text: heading[2] })
      continue
    }
    const bullet = /^[-*•]\s+(.*)$/.exec(trimmed)
    if (bullet) {
      flushParagraph()
      if (!list || list.kind !== 'ul') {
        flushList()
        list = { kind: 'ul', items: [] }
      }
      list.items.push(bullet[1])
      continue
    }
    const numbered = /^\d+[.)]\s+(.*)$/.exec(trimmed)
    if (numbered) {
      flushParagraph()
      if (!list || list.kind !== 'ol') {
        flushList()
        list = { kind: 'ol', items: [] }
      }
      list.items.push(numbered[1])
      continue
    }

    flushList()
    paragraph.push(trimmed)
  }

  flushParagraph()
  flushList()

  return blocks.map((block, index) => {
    if (block.kind === 'ul' || block.kind === 'ol') {
      const ListTag = block.kind
      return (
        <ListTag key={index}>
          {block.items.map((item, i) => (
            <li key={i}>{inline(item)}</li>
          ))}
        </ListTag>
      )
    }
    if (block.kind === 'h2') return <h3 key={index}>{inline(block.text)}</h3>
    if (block.kind === 'h3') return <h3 key={index}>{inline(block.text)}</h3>
    if (block.text === ' ') return <hr key={index} className="my-4 border-line" />
    return <p key={index}>{inline(block.text)}</p>
  })
}

/** Handles **bold**, *italic* and `code`. Everything else stays literal. */
function inline(text: string): ReactNode[] {
  // Flatten markdown links to their label — no anchors from generated text.
  const withoutLinks = text.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
  const tokens = withoutLinks.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g)

  return tokens.filter(Boolean).map((token, index) => {
    if (token.startsWith('**') && token.endsWith('**') && token.length > 4) {
      return <strong key={index}>{token.slice(2, -2)}</strong>
    }
    if (token.startsWith('*') && token.endsWith('*') && token.length > 2) {
      return <em key={index}>{token.slice(1, -1)}</em>
    }
    if (token.startsWith('`') && token.endsWith('`') && token.length > 2) {
      return <code key={index}>{token.slice(1, -1)}</code>
    }
    return <Fragment key={index}>{token}</Fragment>
  })
}
