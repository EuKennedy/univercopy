import { redirect } from 'next/navigation'
import { headers } from 'next/headers'

import { auth } from '@/lib/auth'

// Onboarding exige autenticação. Sem sessão → redirect com next= preservado.
// Estado do wizard é persistido no DB (workspace.onboarding_status) +
// resumível na mesma URL.
export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    redirect('/login?next=/onboarding')
  }

  return (
    <div className="uc-mesh min-h-screen flex flex-col">
      {children}
    </div>
  )
}
