'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { Wordmark } from '@/components/brand/wordmark'
import { cn } from '@/lib/cn'
import { signOut } from '@/lib/auth-client'

import { Icon, type IconName } from './icon'

type NavItem = {
  href: string
  label: string
  icon: IconName
  badge?: string
}

type NavGroup = { label?: string; items: NavItem[] }

type WorkspaceOption = { slug: string; name: string }

type Props = {
  workspaceSlug?: string
  nav?: NavGroup[]
  user?: { name?: string; email: string; image?: string | null } | null
  workspaces?: WorkspaceOption[]
  collapsed: boolean
  onToggleCollapse: () => void
  mobileOpen: boolean
  onCloseMobile: () => void
}

export function Sidebar({
  workspaceSlug, nav, user, workspaces,
  collapsed, onToggleCollapse, mobileOpen, onCloseMobile,
}: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const t = useTranslations('nav')

  const base = workspaceSlug ? `/${workspaceSlug}` : ''
  const items = nav ?? defaultNav(workspaceSlug, t)

  return (
    <aside
      data-collapsed={collapsed}
      className={cn(
        'uc-rail-w uc-glass-rail fixed left-0 top-0 bottom-0 z-40 flex flex-col px-3 py-4',
        'max-lg:z-50 max-lg:transition-transform max-lg:duration-300 lg:translate-x-0',
        mobileOpen ? 'max-lg:translate-x-0' : 'max-lg:-translate-x-full',
      )}
    >
      <div className="flex items-center gap-2 px-2 pb-5">
        <Link href={workspaceSlug ? `/${workspaceSlug}` : '/'} onClick={onCloseMobile} className="flex items-center gap-2 min-w-0 cursor-pointer">
          {collapsed ? (
            <span
              aria-hidden
              className="hidden lg:flex size-9 rounded-[10px] items-center justify-center text-white font-extrabold uc-transition shadow-[0_8px_24px_-8px_rgba(139,92,246,0.55)]"
              style={{ background: 'linear-gradient(135deg, var(--uc-brand-purple) 0%, var(--uc-brand-blue) 100%)' }}
            >
              u
            </span>
          ) : null}
          <span className={cn('uc-rail-content', collapsed && 'lg:hidden')}>
            <Wordmark size="sm" />
          </span>
        </Link>

        {/* Colapsar (desktop) */}
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={collapsed ? t('expandSidebar') : t('collapseSidebar')}
          className={cn(
            'ml-auto hidden lg:block cursor-pointer uc-transition rounded-lg p-1.5 text-[var(--uc-text-muted)]',
            'hover:bg-[var(--uc-surface-soft)] hover:text-[var(--uc-text)]',
            collapsed && 'mx-auto ml-0',
          )}
        >
          <Icon name={collapsed ? 'chevron-right' : 'chevron-left'} />
        </button>

        {/* Fechar (mobile) */}
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Fechar menu"
          className="ml-auto lg:hidden cursor-pointer rounded-lg p-1.5 text-[var(--uc-text-muted)] hover:bg-[var(--uc-surface-soft)] hover:text-[var(--uc-text)]"
        >
          <Icon name="x" />
        </button>
      </div>

      <nav className="flex-1 flex flex-col gap-0.5 mt-1 overflow-y-auto" aria-label={t('primaryNav')}>
        {items.map((group, gi) => (
          <div key={group.label ?? `g${gi}`} className={cn(gi > 0 && 'mt-3')}>
            {group.label && (
              <p className="uc-rail-content px-2.5 mb-1 text-[10px] font-bold tracking-[0.18em] uppercase text-[var(--uc-text-faint)]">
                {group.label}
              </p>
            )}
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const active = isNavActive(pathname, item.href, base)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onCloseMobile}
                    data-active={active || undefined}
                    title={item.label}
                    className={cn(
                      'group flex items-center gap-3 rounded-xl px-2.5 py-2.5 cursor-pointer uc-transition-fast',
                      'text-[var(--uc-text-soft)] hover:text-[var(--uc-text)]',
                      'hover:bg-[var(--uc-surface-soft)]',
                      active && 'text-[var(--uc-text)] bg-[var(--uc-accent-soft)] shadow-[inset_0_0_0_1px_var(--uc-accent-soft-2)]',
                    )}
                  >
                    <span
                      className={cn(
                        'flex items-center justify-center size-9 rounded-lg uc-transition-fast shrink-0',
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
            </div>
          </div>
        ))}
      </nav>

      {workspaces && workspaces.length > 1 && (
        <div className="uc-rail-content mb-2">
          <label className="sr-only" htmlFor="ws-switch">{t('switchWorkspace')}</label>
          <select
            id="ws-switch"
            value={workspaceSlug ?? ''}
            onChange={(e) => { onCloseMobile(); router.push(`/${e.target.value}`) }}
            className="w-full h-10 px-3 rounded-xl uc-glass text-sm text-[var(--uc-text)] outline-none cursor-pointer focus:border-[var(--uc-accent-ring)]"
          >
            {workspaces.map((w) => <option key={w.slug} value={w.slug}>{w.name}</option>)}
          </select>
        </div>
      )}

      {user && (
        <UserMenu user={user} collapsed={collapsed} t={t} onLogout={async () => {
          await signOut()
          router.push('/login')
        }} />
      )}
    </aside>
  )
}

function UserMenu({
  user, collapsed, onLogout, t,
}: {
  user: { name?: string; email: string; image?: string | null }
  collapsed: boolean
  onLogout: () => Promise<void>
  t: (key: string) => string
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  return (
    <div className="mt-4 pt-3 border-t border-[var(--uc-border)] relative">
      {open && !collapsed && (
        <div className="absolute bottom-full left-0 right-0 mb-2 p-1.5 rounded-2xl uc-glass-strong shadow-[var(--uc-shadow-prisma)]">
          <button
            type="button"
            disabled={busy}
            onClick={async () => { setBusy(true); await onLogout() }}
            className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-[var(--uc-text-soft)] hover:text-[var(--uc-danger)] hover:bg-[var(--uc-surface-soft)] uc-transition-fast cursor-pointer"
          >
            <Icon name="logout" size={16} />
            {busy ? t('loggingOut') : t('logout')}
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-1.5 py-1 rounded-xl hover:bg-[var(--uc-surface-soft)] uc-transition-fast cursor-pointer"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Avatar name={user.name ?? user.email} image={user.image ?? undefined} />
        <div className="uc-rail-content min-w-0 flex-1 text-left">
          <p className="text-sm font-semibold text-[var(--uc-text)] truncate">{user.name ?? user.email.split('@')[0]}</p>
          <p className="text-xs text-[var(--uc-text-muted)] truncate">{user.email}</p>
        </div>
        <span className="uc-rail-content text-[var(--uc-text-faint)]"><Icon name={open ? 'chevron-left' : 'chevron-right'} size={16} /></span>
      </button>
    </div>
  )
}

function Avatar({ name, image }: { name: string; image?: string }) {
  const initials = name.split(/\s+/).slice(0, 2).map((s) => s[0]?.toUpperCase()).join('') || 'U'
  return (
    <span
      className="size-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-[0_6px_18px_-6px_rgba(139,92,246,0.5)]"
      style={{ background: image ? `center/cover url(${image})` : 'linear-gradient(135deg, var(--uc-brand-purple) 0%, var(--uc-brand-blue) 100%)' }}
      aria-hidden
    >
      {!image && initials}
    </span>
  )
}

// Item ativo: overview (base) só ativa em match exato; resto por prefixo.
function isNavActive(pathname: string | null | undefined, href: string, base: string): boolean {
  if (!pathname) return false
  const home = base || '/'
  if (href === home) return pathname === home
  return pathname === href || pathname.startsWith(`${href}/`)
}

// Nav agrupada: Visão geral solta no topo, depois Criar / Catálogo / Insights,
// e Configurações no fim. Inteligência fica em Insights (rotulada "em breve").
function defaultNav(workspaceSlug: string | undefined, t: (key: string) => string): NavGroup[] {
  const base = workspaceSlug ? `/${workspaceSlug}` : ''
  return [
    { items: [
      { href: `${base || '/'}`, label: t('overview'), icon: 'dashboard' },
    ] },
    { label: t('group_create'), items: [
      { href: `${base}/generate`,  label: t('generate'),  icon: 'spark', badge: 'AI' },
      { href: `${base}/campaigns`, label: t('campaigns'), icon: 'campaign' },
      { href: `${base}/copy`,      label: t('copy'),      icon: 'copy' },
    ] },
    { label: t('group_catalog'), items: [
      { href: `${base}/products`, label: t('products'), icon: 'product' },
    ] },
    { label: t('group_insights'), items: [
      { href: `${base}/audit`,        label: t('audit'),        icon: 'audit' },
      { href: `${base}/intelligence`, label: t('intelligence'), icon: 'intelligence' },
    ] },
    { items: [
      { href: `${base}/settings`, label: t('settings'), icon: 'settings' },
    ] },
  ]
}
