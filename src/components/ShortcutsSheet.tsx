import { useEffect } from 'react'
import { SHORTCUTS, SCOPE_ORDER } from '@/lib/shortcuts'
import { IconButton } from './ui/Button'
import { X } from 'lucide-react'

export function ShortcutsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-line bg-surface p-5 shadow-2xl sm:rounded-2xl sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold">Keyboard shortcuts</h2>
            <p className="mt-0.5 text-sm text-muted">
              Every page can be driven without a mouse. Press{' '}
              <Kbd>?</Kbd> again to close.
            </p>
          </div>
          <IconButton label="Close" onClick={onClose}>
            <X className="size-4" />
          </IconButton>
        </div>

        <div className="space-y-5">
          {SCOPE_ORDER.map((scope) => {
            const items = SHORTCUTS.filter((s) => s.where === scope)
            if (!items.length) return null
            return (
              <section key={scope}>
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
                  {scope}
                </h3>
                <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
                  {items.map((item) => (
                    <li
                      key={`${item.where}-${item.label}`}
                      className="flex items-center justify-between gap-4 bg-surface px-3 py-2.5"
                    >
                      <span className="text-sm">{item.label}</span>
                      <span className="flex shrink-0 items-center gap-1">
                        {item.keys.map((key, index) => (
                          <span key={key} className="flex items-center gap-1">
                            {index > 0 ? <span className="text-[10px] text-muted">then</span> : null}
                            <Kbd>{key}</Kbd>
                          </span>
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex min-w-6 items-center justify-center rounded-md border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] font-medium text-muted">
      {children}
    </kbd>
  )
}
