import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

import { GlassCard } from './glass-card'

type EmptyStateProps = {
  eyebrow?: string
  title: string
  description?: string
  icon?: ReactNode
  primaryAction?: ReactNode
  secondaryAction?: ReactNode
  status?: 'wip' | 'empty' | 'locked'
  className?: string
}

// Empty state com personalidade — glow pulsante, ícone wrapper iridescent,
// dois CTAs opcionais. Variante `wip` traz badge "build em andamento" pra
// telas que ainda não saíram da fila do refactor.

export function EmptyState({
  eyebrow,
  title,
  description,
  icon,
  primaryAction,
  secondaryAction,
  status = 'empty',
  className,
}: EmptyStateProps) {
  return (
    <GlassCard
      variant="strong"
      iridescent={status !== 'locked'}
      glow={status === 'wip'}
      className={cn('p-10 sm:p-14 flex flex-col items-center text-center gap-6', className)}
    >
      {status === 'wip' && (
        <span className="inline-flex items-center gap-2 rounded-full border border-[var(--uc-accent-soft-3)] bg-[var(--uc-accent-soft)] px-3 py-1 text-[11px] font-semibold tracking-wide text-[var(--uc-accent-strong)]">
          <span className="size-1.5 rounded-full bg-[var(--uc-accent)] animate-pulse" />
          worldclass · build em andamento
        </span>
      )}

      {icon && (
        <span
          className={cn(
            'flex items-center justify-center size-16 rounded-2xl shadow-[0_10px_28px_-10px_var(--uc-accent-glow)]',
            'text-white',
          )}
          style={{ background: 'linear-gradient(135deg, var(--uc-brand-purple) 0%, var(--uc-brand-blue) 100%)' }}
          aria-hidden
        >
          {icon}
        </span>
      )}

      <div className="space-y-2 max-w-md">
        {eyebrow && (
          <p className="text-[10px] font-bold tracking-[0.22em] uppercase text-[var(--uc-text-muted)]">
            {eyebrow}
          </p>
        )}
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--uc-text)] leading-tight">
          {title}
        </h2>
        {description && (
          <p className="text-[15px] leading-7 text-[var(--uc-text-soft)]">
            {description}
          </p>
        )}
      </div>

      {(primaryAction || secondaryAction) && (
        <div className="flex flex-wrap gap-3 justify-center pt-1">
          {primaryAction}
          {secondaryAction}
        </div>
      )}
    </GlassCard>
  )
}
