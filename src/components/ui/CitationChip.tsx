import { FileText } from 'lucide-react'
import { openPdfAtPage } from '@/lib/pdf'
import { cn } from '@/lib/utils'
import { toast } from './toast'

/**
 * A page citation. Tapping it opens the original PDF at that page when the
 * file is still cached locally; otherwise it shows the verified snippet so the
 * claim is still checkable.
 */
export function CitationChip({
  documentId,
  page,
  snippet,
  confidence = 1,
  className,
}: {
  documentId: string
  page?: number
  snippet?: string
  confidence?: number
  className?: string
}) {
  if (!page) return null
  // A low-confidence page is not shown as a fact.
  if (confidence < 0.5) return null

  return (
    <button
      type="button"
      title={snippet ? `“${snippet}”` : undefined}
      onClick={async (event) => {
        event.stopPropagation()
        const opened = await openPdfAtPage(documentId, page)
        if (!opened) {
          toast(
            snippet
              ? `p. ${page} — “${snippet}”`
              : `Page ${page}. The original PDF is no longer cached on this device.`,
          )
        }
      }}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 py-1',
        'text-[11px] font-medium text-muted transition hover:border-forest-400 hover:text-forest',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold',
        className,
      )}
    >
      <FileText className="size-3" aria-hidden />
      <span className="tnum">p. {page}</span>
    </button>
  )
}
