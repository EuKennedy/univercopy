import type { ButtonHTMLAttributes } from 'react'

import { cn } from '@/lib/cn'

type GlassButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

const base =
  'inline-flex items-center justify-center gap-2 rounded-2xl font-semibold ' +
  'uc-transition cursor-pointer select-none ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ' +
  'disabled:cursor-not-allowed disabled:opacity-50'

const sizes = {
  sm: 'h-10 px-4 text-sm min-w-[44px]',
  md: 'h-12 px-5 text-[15px] min-w-[44px]',
  lg: 'h-14 px-7 text-base min-w-[44px]',
}

const variants = {
  primary:
    'text-[var(--uc-text-on-accent)] bg-[var(--uc-accent)] ' +
    'shadow-[0_12px_40px_-12px_var(--uc-accent-glow)] ' +
    'hover:bg-[var(--uc-accent-strong)] hover:shadow-[0_24px_50px_-12px_var(--uc-accent-glow)] ' +
    'focus-visible:outline-[var(--uc-accent-ring)]',
  secondary:
    'text-[var(--uc-text)] uc-glass border-[var(--uc-border-strong)] ' +
    'hover:bg-[var(--uc-surface-overlay)]',
  ghost:
    'text-[var(--uc-text-soft)] hover:text-[var(--uc-text)] hover:bg-[var(--uc-surface-soft)]',
}

export function GlassButton({
  className,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  children,
  ...rest
}: GlassButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={cn(base, sizes[size], variants[variant], className)}
      {...rest}
    >
      {loading && (
        <span
          aria-hidden
          className="inline-block size-4 rounded-full border-2 border-current border-r-transparent animate-spin"
        />
      )}
      {children}
    </button>
  )
}
