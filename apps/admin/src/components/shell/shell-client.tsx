'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'

import { Wordmark } from '@/components/brand/wordmark'

import { Icon } from './icon'
import { Sidebar } from './sidebar'

type Props = {
  workspaceSlug?: string
  user?: { name?: string; email: string; image?: string | null } | null
  workspaces?: { slug: string; name: string }[]
  initialCollapsed?: boolean
  children: ReactNode
}

const COOKIE_NAME = 'uc_sidebar_collapsed'

function writeCookie(value: string) {
  if (typeof document === 'undefined') return
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(value)}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`
}

// Casca responsiva. Desktop (lg+): rail fixo colapsável + padding no main.
// Mobile (<lg): top bar com hambúrguer + sidebar como drawer off-canvas.
export function ShellClient({ workspaceSlug, user, workspaces, initialCollapsed = false, children }: Props) {
  const [collapsed, setCollapsed] = useState(initialCollapsed)
  const [mobileOpen, setMobileOpen] = useState(false)

  function toggleCollapse() {
    setCollapsed((prev) => {
      const next = !prev
      writeCookie(next ? '1' : '0')
      return next
    })
  }

  return (
    <div className="uc-mesh min-h-screen bg-[var(--uc-bg)]">
      {/* Top bar (só mobile) */}
      <header className="lg:hidden fixed top-0 inset-x-0 z-30 h-14 flex items-center gap-3 px-4 border-b border-[var(--uc-border-soft)] bg-[var(--uc-bg)]/85 backdrop-blur-xl">
        <button
          type="button"
          aria-label="Abrir menu"
          onClick={() => setMobileOpen(true)}
          className="size-9 grid place-items-center rounded-lg text-[var(--uc-text-soft)] hover:bg-[var(--uc-surface-soft)] hover:text-[var(--uc-text)] uc-transition-fast cursor-pointer"
        >
          <Icon name="menu" size={20} />
        </button>
        <Wordmark size="sm" />
      </header>

      {/* Backdrop (só mobile, quando drawer aberto) */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}

      <Sidebar
        workspaceSlug={workspaceSlug}
        user={user}
        workspaces={workspaces}
        collapsed={collapsed}
        onToggleCollapse={toggleCollapse}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <main
        data-collapsed={collapsed}
        className="uc-main min-h-screen flex flex-col pt-14 lg:pt-0"
      >
        {children}
      </main>
    </div>
  )
}
