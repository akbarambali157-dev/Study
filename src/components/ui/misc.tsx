import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Card({
  children,
  className,
  as: Tag = 'div',
}: {
  children: ReactNode
  className?: string
  as?: 'div' | 'section' | 'article' | 'li'
}) {
  return <Tag className={cn('card-surface p-5', className)}>{children}</Tag>
}

export function Chip({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode
  tone?: 'neutral' | 'gold' | 'green' | 'clay'
  className?: string
}) {
  const tones = {
    neutral: 'bg-surface-2 text-muted border-line',
    gold: 'bg-gold/15 text-[#8a5a00] border-gold/40 dark:text-gold',
    green: 'bg-mint/60 text-forest border-forest-400/30 dark:bg-forest-500/25 dark:text-mint',
    clay: 'bg-clay-soft text-clay border-clay/30 dark:bg-clay/20',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

export function Progress({
  value,
  max = 100,
  className,
  tone = 'forest',
}: {
  value: number
  max?: number
  className?: string
  tone?: 'forest' | 'gold'
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
  return (
    <div
      className={cn('h-2 w-full overflow-hidden rounded-full bg-surface-2', className)}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn('h-full rounded-full transition-[width] duration-300', {
          'bg-forest-400': tone === 'forest',
          'bg-gold': tone === 'gold',
        })}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  body,
  action,
  className,
}: {
  icon?: ReactNode
  title: string
  body?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-surface/50 px-6 py-14 text-center',
        className,
      )}
    >
      {icon ? <div className="mb-3 text-muted">{icon}</div> : null}
      <h3 className="text-base font-semibold">{title}</h3>
      {body ? <p className="mt-1.5 max-w-sm text-sm text-muted">{body}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-surface-2', className)} />
}

export function StatTile({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string
  value: ReactNode
  hint?: string
  tone?: 'neutral' | 'gold'
}) {
  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-3">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</div>
      <div
        className={cn('tnum mt-1 font-display text-2xl font-semibold', {
          'text-gold': tone === 'gold',
          'text-body': tone !== 'gold',
        })}
      >
        {value}
      </div>
      {hint ? <div className="mt-0.5 text-[11px] text-muted">{hint}</div> : null}
    </div>
  )
}
