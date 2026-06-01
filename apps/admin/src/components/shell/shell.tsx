import { cookies } from 'next/headers'
import type { ReactNode } from 'react'

import { ShellClient } from './shell-client'

type ShellProps = {
  workspaceSlug?: string
  user?: { name?: string; email: string; image?: string | null } | null
  workspaces?: { slug: string; name: string }[]
  children: ReactNode
}

// Lê preferência de collapse do cookie no server (sem flash) e delega a casca
// responsiva ao ShellClient (drawer mobile + rail desktop).
export async function Shell({ workspaceSlug, user, workspaces, children }: ShellProps) {
  const cookieStore = await cookies()
  const collapsed = cookieStore.get('uc_sidebar_collapsed')?.value === '1'

  return (
    <ShellClient
      workspaceSlug={workspaceSlug}
      user={user}
      workspaces={workspaces}
      initialCollapsed={collapsed}
    >
      {children}
    </ShellClient>
  )
}
