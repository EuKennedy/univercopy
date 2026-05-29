import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

type TopbarProps = {
  title: string
  eyebrow?: string
  description?: string
  actions?: ReactNode
  className?: string
}

// Barra superior sticky com backdrop blur. Mostra eyebrow + título + descrição.
// Actions (botões CTA) à direita. Estrutura padrão pra todas páginas internas.

export function Topbar({ title, eyebrow, description, actions, className }: TopbarProps) {
  return (
    <header
      className={cn(
        'sticky top-0 z-30 px-8 py-6',
        'border-b border-[var(--uc-border-soft)] bg-[var(--uc-bg)]/72 backdrop-blur-xl',
        className,
      )}
    >
      {/* Inner wrapper alinha o header com o container das páginas (max-w-6xl). */}
      <div className="mx-auto w-full max-w-6xl flex flex-wrap items-end gap-4 justify-between">
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-[10px] font-bold tracking-[0.22em] uppercase text-[var(--uc-text-muted)] mb-2">
              {eyebrow}
            </p>
          )}
          <h1 className="text-3xl font-bold tracking-tight text-[var(--uc-text)] leading-[1.05] truncate">
            {title}
          </h1>
          {description && (
            <p className="text-sm leading-6 text-[var(--uc-text-soft)] mt-1.5 max-w-2xl">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </header>
  )
}
