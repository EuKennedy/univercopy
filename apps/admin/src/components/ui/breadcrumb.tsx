import Link from 'next/link'

import { Icon } from '@/components/shell/icon'

// Trilha de navegação para páginas de detalhe e sub-páginas de settings.
// Último item = atual (sem link).
export type Crumb = { label: string; href?: string }

export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="breadcrumb" className="flex items-center gap-1.5 text-xs text-[var(--uc-text-muted)] mb-3">
      {items.map((c, i) => {
        const last = i === items.length - 1
        return (
          <span key={`${c.label}-${i}`} className="flex items-center gap-1.5 min-w-0">
            {c.href && !last ? (
              <Link href={c.href} className="hover:text-[var(--uc-text)] uc-transition-fast truncate cursor-pointer rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--uc-accent-ring)]">
                {c.label}
              </Link>
            ) : (
              <span className={last ? 'text-[var(--uc-text-soft)] font-medium truncate' : 'truncate'}>{c.label}</span>
            )}
            {!last && <Icon name="chevron-right" size={13} className="text-[var(--uc-text-faint)] shrink-0" />}
          </span>
        )
      })}
    </nav>
  )
}
