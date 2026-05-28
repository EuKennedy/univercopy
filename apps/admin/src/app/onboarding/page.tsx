import { OnboardingWizard } from './onboarding-wizard'

// Server entry da rota. Na Fase 3.D busca workspace state do API Rails
// (GET /api/v1/onboarding/state) e passa pro client. Por agora, estado
// inicial vazio — o wizard começa do step 1.
export default function OnboardingPage() {
  return <OnboardingWizard />
}
