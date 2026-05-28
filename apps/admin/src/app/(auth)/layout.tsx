import { redirect } from 'next/navigation'
import { headers } from 'next/headers'

import { auth } from '@/lib/auth'

// Guard reverso: usuário já logado tentando bater em /login causa footgun
// de UX (cria conta duplicada quando clica "registrar"). Sempre redireciona.
export default async function AuthGroupLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (session?.user) redirect('/')

  return (
    <div className="uc-mesh flex flex-col items-center justify-center min-h-screen px-6 py-12">
      {children}
    </div>
  )
}
