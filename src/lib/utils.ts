import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function uid(prefix = ''): string {
  const body =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  return prefix ? `${prefix}_${body}` : body
}

export function nowIso(): string {
  return new Date().toISOString()
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

export function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

export function formatRelative(iso: string): string {
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return ''
  const diff = Date.now() - then
  const mins = Math.round(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return n === 1 ? one : many
}

export function shuffle<T>(items: T[], seed = Math.random()): T[] {
  const out = [...items]
  // Deterministic when a seeded RNG is passed: handy for stable tests.
  let s = seed
  const rand = () => {
    s = (s * 9301 + 49297) % 233280
    return 1 - s / 233280
  }
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return `${text.slice(0, max - 1).trimEnd()}…`
}

/** First N words — used for citations that must be checkable at a glance. */
export function firstWords(text: string, n = 12): string {
  const words = text.replace(/\s+/g, ' ').trim().split(' ')
  return words.slice(0, n).join(' ')
}

export function titleCase(text: string): string {
  return text
    .toLowerCase()
    .replace(/\b[a-z]/g, (c) => c.toUpperCase())
    .replace(/\bOou\b/g, 'OOU')
}

export function stripExtension(name: string): string {
  return name.replace(/\.[^.]+$/, '')
}
