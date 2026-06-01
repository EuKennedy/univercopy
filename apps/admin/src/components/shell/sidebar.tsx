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

type WorkspaceOption = { slug: string; name: string }

type Props = {
  workspaceSlug?: string
  nav?: NavItem[]
  user?: { name?: string; email: string; image?: string | null } | null
  workspaces?: WorkspaceOption[]
  defaultCollapsed?: boolean
}

const COOKIE_NAME = 'uc_sidebar_collapsed'

function writeCookie(name: string, value: string) {
  if (typeof document === 'undefined') return
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`
}

export function Sidebar({ workspaceSlug, nav, user, workspaces, defaultCollapsed = false }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const t = useTranslations('nav')
  const [collapsed, setCollapsed] = useState(defaultCollapsed)

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev
      writeCookie(COOKIE_NAME, next ? '1' : '0')
      return next
    })
  }

  const items = nav ?? defaultNav(workspaceSlug, t)

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
          aria-label={collapsed ? t('expandSidebar') : t('collapseSidebar')}
          className={cn(
            'ml-auto cursor-pointer uc-transition rounded-lg p-1.5 text-[var(--uc-text-muted)]',
            'hover:bg-[var(--uc-surface-soft)] hover:text-[var(--uc-text)]',
            collapsed && 'mx-auto ml-0',
          )}
        >
          <Icon name={collapsed ? 'chevron-right' : 'chevron-left'} />
        </button>
      </div>

      <nav className="flex-1 flex flex-col gap-0.5 mt-1" aria-label={t('primaryNav')}>
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

      {workspaces && workspaces.length > 1 && (
        <div className="uc-rail-content mb-2">
          <label className="sr-only" htmlFor="ws-switch">{t('switchWorkspace')}</label>
          <select
            id="ws-switch"
            value={workspaceSlug ?? ''}
            onChange={(e) => router.push(`/${e.target.value}`)}
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
      className="size-9 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-[0_6px_18px_-6px_rgba(139,92,246,0.5)]"
      style={{ background: image ? `center/cover url(${image})` : 'linear-gradient(135deg, var(--uc-brand-purple) 0%, var(--uc-brand-blue) 100%)' }}
      aria-hidden
    >
      {!image && initials}
    </span>
  )
}

function defaultNav(workspaceSlug: string | undefined, t: (key: string) => string): NavItem[] {
  const base = workspaceSlug ? `/${workspaceSlug}` : ''
  return [
    { href: `${base || '/'}`,           label: t('overview'),     icon: 'dashboard' },
    { href: `${base}/copy`,             label: t('copy'),         icon: 'copy' },
    { href: `${base}/generate`,         label: t('generate'),     icon: 'spark', badge: 'AI' },
    { href: `${base}/campaigns`,        label: t('campaigns'),    icon: 'campaign' },
    { href: `${base}/products`,         label: t('products'),     icon: 'product' },
    { href: `${base}/audit`,            label: t('audit'),        icon: 'audit' },
    { href: `${base}/intelligence`,     label: t('intelligence'), icon: 'intelligence' },
    { href: `${base}/settings`,         label: t('settings'),     icon: 'settings' },
  ]
}
