import { redirect } from 'next/navigation'
import { headers } from 'next/headers'

import { Shell } from '@/components/shell'
import { auth } from '@/lib/auth'
import { listWorkspaces } from '@/lib/api/queries'

type Props = {
  children: React.ReactNode
  params: Promise<{ workspace_slug: string }>
}

// Layout do workspace. Server-side: valida sessão + escolhe Shell com
// sidebar+content. Validação real de membership virá na Fase 4 (consulta
// Rails /workspaces/:slug). Por enquanto trust + redirect se não houver
// sessão.
export default async function WorkspaceLayout({ children, params }: Props) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/login?next=/')

  const { workspace_slug } = await params

  const user = {
    name: session.user.name,
    email: session.user.email,
    image: session.user.image ?? null,
  }

  const workspaces = await listWorkspaces().catch(() => [])

  return (
    <Shell
      workspaceSlug={workspace_slug}
      user={user}
      workspaces={workspaces.map((w) => ({ slug: w.slug, name: w.name }))}
    >
      {children}
    </Shell>
  )
}
