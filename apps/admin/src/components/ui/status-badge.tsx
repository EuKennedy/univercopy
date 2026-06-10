import { cn } from '@/lib/cn'

// Badge de status com tom semântico via tokens (sem cor hardcoded). Antes cada
// tela usava bg-emerald-500/15 etc. à mão.
export type StatusTone = 'success' | 'warning' | 'info' | 'accent' | 'neutral' | 'danger'

const TONE: Record<StatusTone, string> = {
  success: 'bg-[var(--uc-success-bg)] text-[var(--uc-success)]',
  warning: 'bg-[color-mix(in_srgb,var(--uc-warn)_15%,transparent)] text-[var(--uc-warn)]',
  info:    'bg-[var(--uc-info-bg)] text-[var(--uc-info)]',
  accent:  'bg-[var(--uc-accent-soft-2)] text-[var(--uc-accent)]',
  danger:  'bg-[var(--uc-danger-bg)] text-[var(--uc-danger)]',
  neutral: 'bg-[var(--uc-surface-soft)] text-[var(--uc-text-muted)]',
}

export function StatusBadge({ label, tone = 'neutral', className }: { label: string; tone?: StatusTone; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap', TONE[tone], className)}>
      <span className="size-1.5 rounded-full bg-current opacity-80" aria-hidden />
      {label}
    </span>
  )
}
