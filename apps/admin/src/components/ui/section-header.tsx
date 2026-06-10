import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

// Cabeçalho de seção padrão: eyebrow (uppercase) + título + ação à direita.
// Antes era remontado inline em campaign-workspace, copy-editor, billing, etc.
type SectionHeaderProps = {
  title: string
  eyebrow?: string
  description?: string
  action?: ReactNode
  className?: string
}

export function SectionHeader({ title, eyebrow, description, action, className }: SectionHeaderProps) {
  return (
    <div className={cn('flex items-end justify-between gap-3 flex-wrap', className)}>
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-[var(--uc-text-muted)] mb-1">
            {eyebrow}
          </p>
        )}
        <h2 className="text-lg font-bold tracking-tight text-[var(--uc-text)]">{title}</h2>
        {description && <p className="text-sm text-[var(--uc-text-soft)] mt-1">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
