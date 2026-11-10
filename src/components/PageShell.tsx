import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

export function PageHeading({
  title,
  subtitle,
  back,
  actions,
  className,
}: {
  title: ReactNode
  subtitle?: ReactNode
  back?: { to: string; label: string }
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('mb-6', className)}>
      {back ? (
        <Link
          to={back.to}
          className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-muted transition hover:text-body"
        >
          <ChevronLeft className="size-4" />
          {back.label}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            {title}
          </h1>
          {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  )
}

export function SectionTitle({
  children,
  hint,
  action,
}: {
  children: ReactNode
  hint?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <div>
        <h2 className="font-display text-lg font-semibold">{children}</h2>
        {hint ? <p className="mt-0.5 text-sm text-muted">{hint}</p> : null}
      </div>
      {action}
    </div>
  )
}
