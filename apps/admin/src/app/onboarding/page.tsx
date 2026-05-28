import { getOnboardingState } from './actions'
import { OnboardingWizard } from './onboarding-wizard'

// Server entry — busca o estado atual via API Rails (lê Better Auth session
// internamente) e passa pro wizard client. Wizard hidrata e decide o
// step inicial pela onboarding_status do workspace.
export default async function OnboardingPage() {
  const initial = await getOnboardingState().catch(() => ({
    workspace: null,
    dna: null,
    job: null,
  }))

  return <OnboardingWizard initial={initial} />
}
