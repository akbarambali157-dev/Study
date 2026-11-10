import { create } from 'zustand'
import { cn } from '@/lib/utils'
import { uid } from '@/lib/utils'
import { X } from 'lucide-react'

type Tone = 'info' | 'success' | 'error'

interface ToastItem {
  id: string
  message: string
  tone: Tone
}

interface ToastStore {
  items: ToastItem[]
  push: (message: string, tone: Tone) => void
  dismiss: (id: string) => void
}

const useToasts = create<ToastStore>((set) => ({
  items: [],
  push: (message, tone) => {
    const id = uid('toast')
    set((s) => ({ items: [...s.items, { id, message, tone }] }))
    setTimeout(() => {
      set((s) => ({ items: s.items.filter((t) => t.id !== id) }))
    }, tone === 'error' ? 7000 : 4000)
  },
  dismiss: (id) => set((s) => ({ items: s.items.filter((t) => t.id !== id) })),
}))

export function toast(message: string, tone: Tone = 'info') {
  useToasts.getState().push(message, tone)
}

const TONES: Record<Tone, string> = {
  info: 'border-line bg-surface text-body',
  success: 'border-forest-400/40 bg-forest text-white',
  error: 'border-clay/40 bg-clay text-white',
}

export function Toaster() {
  const { items, dismiss } = useToasts()
  if (items.length === 0) return null

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 sm:bottom-6"
      role="status"
      aria-live="polite"
    >
      {items.map((item) => (
        <div
          key={item.id}
          className={cn(
            'pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg animate-card-enter',
            TONES[item.tone],
          )}
        >
          <span className="flex-1 leading-snug">{item.message}</span>
          <button
            type="button"
            onClick={() => dismiss(item.id)}
            aria-label="Dismiss"
            className="opacity-70 transition hover:opacity-100"
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
