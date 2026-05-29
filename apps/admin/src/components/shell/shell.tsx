import { cookies } from 'next/headers'
import type { ReactNode } from 'react'

import { Sidebar } from './sidebar'

type ShellProps = {
  workspaceSlug?: string
  user?: { name?: string; email: string; image?: string | null } | null
  workspaces?: { slug: string; name: string }[]
  children: ReactNode
}

// Lê preferência de collapse do cookie ANTES de renderizar — elimina
// hydration mismatch e flash de "expandida → recolhida" no primeiro paint.
export async function Shell({ workspaceSlug, user, workspaces, children }: ShellProps) {
  const cookieStore = await cookies()
  const collapsed = cookieStore.get('uc_sidebar_collapsed')?.value === '1'

  return (
    <div className="uc-mesh min-h-screen bg-[var(--uc-bg)]">
      <Sidebar workspaceSlug={workspaceSlug} user={user} workspaces={workspaces} defaultCollapsed={collapsed} />
      <main
        className="min-h-screen flex flex-col"
        style={{ paddingLeft: collapsed ? 'var(--uc-sidebar-w-collapsed)' : 'var(--uc-sidebar-w)' }}
      >
        {children}
      </main>
    </div>
  )
}
