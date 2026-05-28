'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

import { Wordmark } from '@/components/brand/wordmark'
import { cn } from '@/lib/cn'

import { Icon, type IconName } from './icon'

type NavItem = {
  href: string
  label: string
  icon: IconName
  badge?: string
}

type Props = {
  workspaceSlug?: string
  nav?: NavItem[]
  user?: { name?: string; email: string; image?: string | null } | null
  defaultCollapsed?: boolean
}

const COOKIE_NAME = 'uc_sidebar_collapsed'

function writeCookie(name: string, value: string) {
  if (typeof document === 'undefined') return
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`
}

export function Sidebar({ workspaceSlug, nav, user, defaultCollapsed = false }: Props) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(defaultCollapsed)

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev
      writeCookie(COOKIE_NAME, next ? '1' : '0')
      return next
    })
  }

  const items = nav ?? defaultNav(workspaceSlug)

  return (
    <aside
      data-collapsed={collapsed}
      className={cn(
        'uc-rail-w uc-glass-rail',
        'fixed left-0 top-0 bottom-0 z-40 flex flex-col px-3 py-4',
      )}
    >
      <div className="flex items-center gap-2 px-2 pb-5">
        <Link href={workspaceSlug ? `/${workspaceSlug}` : '/'} className="flex items-center gap-2 min-w-0 cursor-pointer">
          {collapsed ? (
            <span
              aria-hidden
              className="size-9 rounded-[10px] flex items-center justify-center text-white font-extrabold uc-transition shadow-[0_8px_24px_-8px_rgba(139,92,246,0.55)]"
              style={{ background: 'linear-gradient(135deg, var(--uc-brand-purple) 0%, var(--uc-brand-blue) 100%)' }}
            >
              u
            </span>
          ) : (
            <span className="uc-rail-content">
              <Wordmark size="sm" />
            </span>
          )}
        </Link>
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? 'Expandir sidebar' : 'Recolher sidebar'}
          className={cn(
            'ml-auto cursor-pointer uc-transition rounded-lg p-1.5 text-[var(--uc-text-muted)]',
            'hover:bg-[var(--uc-surface-soft)] hover:text-[var(--uc-text)]',
            collapsed && 'mx-auto ml-0',
          )}
        >
          <Icon name={collapsed ? 'chevron-right' : 'chevron-left'} />
        </button>
      </div>

      <nav className="flex-1 flex flex-col gap-0.5 mt-1" aria-label="Navegação principal">
        {items.map((item) => {
          const active = pathname?.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              data-active={active || undefined}
              className={cn(
                'group flex items-center gap-3 rounded-xl px-2.5 py-2.5 cursor-pointer uc-transition-fast',
                'text-[var(--uc-text-soft)] hover:text-[var(--uc-text)]',
                'hover:bg-[var(--uc-surface-soft)]',
                active && 'text-[var(--uc-text)] bg-[var(--uc-accent-soft)] shadow-[inset_0_0_0_1px_var(--uc-accent-soft-2)]',
              )}
            >
              <span
                className={cn(
                  'flex items-center justify-center size-9 rounded-lg uc-transition-fast',
                  active
                    ? 'text-white shadow-[0_6px_16px_-6px_rgba(139,92,246,0.5)]'
                    : 'text-[var(--uc-text-muted)] group-hover:text-[var(--uc-text)] bg-[var(--uc-bg-mute)]',
                )}
                style={active ? { background: 'linear-gradient(135deg, var(--uc-brand-purple) 0%, var(--uc-brand-blue) 100%)' } : undefined}
                aria-hidden
              >
                <Icon name={item.icon} />
              </span>
              <span className="uc-rail-content text-sm font-medium tracking-tight whitespace-nowrap">
                {item.label}
              </span>
              {item.badge && (
                <span className="uc-rail-content ml-auto text-xs font-semibold rounded-full px-2 py-0.5 bg-[var(--uc-accent-soft-2)] text-[var(--uc-accent)]">
                  {item.badge}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {user && (
        <div className="mt-4 pt-3 border-t border-[var(--uc-border)]">
          <div className="flex items-center gap-3 px-1.5">
            <Avatar name={user.name ?? user.email} image={user.image ?? undefined} />
            <div className="uc-rail-content min-w-0 flex-1">
              <p className="text-sm font-semibold text-[var(--uc-text)] truncate">{user.name ?? user.email.split('@')[0]}</p>
              <p className="text-xs text-[var(--uc-text-muted)] truncate">{user.email}</p>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}

function Avatar({ name, image }: { name: string; image?: string }) {
  const initials = name.split(/\s+/).slice(0, 2).map((s) => s[0]?.toUpperCase()).join('') || 'U'
  return (
    <span
      className="size-9 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-[0_6px_18px_-6px_rgba(139,92,246,0.5)]"
      style={{ background: image ? `center/cover url(${image})` : 'linear-gradient(135deg, var(--uc-brand-purple) 0%, var(--uc-brand-blue) 100%)' }}
      aria-hidden
    >
      {!image && initials}
    </span>
  )
}

function defaultNav(workspaceSlug?: string): NavItem[] {
  const base = workspaceSlug ? `/${workspaceSlug}` : ''
  return [
    { href: `${base || '/'}`,           label: 'Visão geral',     icon: 'dashboard' },
    { href: `${base}/copy`,             label: 'Acervo de Copy',  icon: 'copy' },
    { href: `${base}/generate`,         label: 'Gerador',         icon: 'spark', badge: 'AI' },
    { href: `${base}/campaigns`,        label: 'Campanhas',       icon: 'campaign' },
    { href: `${base}/products`,         label: 'Produtos',        icon: 'product' },
    { href: `${base}/audit`,            label: 'Análise de página', icon: 'audit' },
    { href: `${base}/intelligence`,     label: 'Inteligência',    icon: 'intelligence' },
    { href: `${base}/settings`,         label: 'Configurações',   icon: 'settings' },
  ]
}
