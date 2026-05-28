import { redirect } from 'next/navigation'
import { headers } from 'next/headers'

import { auth } from '@/lib/auth'
import { getOnboardingState } from './onboarding/actions'

// Router raiz. Decide pra onde mandar baseado em sessão + estado:
//   - sem sessão           → /login (proxy.ts já cobre, redundante mas explícito)
//   - sem workspace        → /onboarding
//   - workspace pendente   → /onboarding (resume no step certo)
//   - workspace done       → /[slug]
//
// Falha de API (rede/500) cai pro /onboarding como fallback safe — pior
// caso usuário re-vê wizard com estado vazio.
export default async function RootPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/login')

  let state
  try {
    state = await getOnboardingState()
  } catch {
    redirect('/onboarding')
  }

  if (!state.workspace || state.workspace.onboarding_status !== 'done') {
    redirect('/onboarding')
  }

  redirect(`/${state.workspace.slug}`)
}
