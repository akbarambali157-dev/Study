import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold' | 'surface'
type Size = 'sm' | 'md' | 'lg'

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-forest text-white hover:bg-forest-600 active:bg-forest-700 shadow-sm disabled:bg-forest/40',
  secondary:
    'bg-surface text-body border border-line hover:bg-surface-2 active:bg-surface-2/80',
  ghost: 'text-muted hover:text-body hover:bg-surface-2',
  danger: 'bg-clay text-white hover:brightness-95 active:brightness-90',
  gold: 'bg-gold text-ink hover:bg-gold/90 active:bg-gold-strong font-semibold shadow-sm',
  surface:
    'bg-surface-2 text-body border border-line hover:bg-surface-3 hover:border-forest-400/50 active:bg-surface-3',
}

const SIZES: Record<Size, string> = {
  sm: 'h-9 px-3 text-[13px] gap-1.5 rounded-lg',
  md: 'h-11 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-13 px-6 text-base gap-2.5 rounded-xl',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: ReactNode
  block?: boolean
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  block,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex select-none items-center justify-center font-medium transition',
        'disabled:cursor-not-allowed disabled:opacity-60',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold',
        VARIANTS[variant],
        SIZES[size],
        block && 'w-full',
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  )
}

export function IconButton({
  label,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex size-10 items-center justify-center rounded-xl text-muted transition',
        'hover:bg-surface-2 hover:text-body',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}
