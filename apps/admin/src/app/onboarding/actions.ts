'use server'

import { apiFetch } from '@/lib/api-client'

// Server actions consumidas pelo OnboardingWizard. Toda chamada passa
// pelo cookie de sessão do Better Auth → Bearer token → Rails AuthBridge.

export type OnboardingWorkspace = {
  id: string
  slug: string
  name: string
  site_url: string | null
  plan: 'entry' | 'medium' | 'ultra'
  default_locale: string
  onboarding_status: 'pending' | 'dna_loaded' | 'qa_done' | 'done'
}

export type OnboardingJob = {
  id: string
  status: 'queued' | 'running' | 'done' | 'error' | 'cap_reached'
  task_kind: string
  model: string | null
  cost_usd: number | null
  error: string | null
  started_at: string | null
  finished_at: string | null
  result: { dna?: Record<string, unknown> } | null
}

export type OnboardingDna = {
  marca: string | null
  missao: string | null
  posicionamento: string | null
  tom: string | null
  publico: string | null
  consciencia: string | null
  valores: string[]
  produtos: string[]
  ofertas: string[]
  provas: string[]
  objecoes: string[]
  evitar: string[]
  publico_alvo_detalhado: Record<string, unknown> | null
  source_url: string | null
  updated_at: string
}

export type OnboardingState = {
  workspace: OnboardingWorkspace | null
  dna: OnboardingDna | null
  job: OnboardingJob | null
}

export async function getOnboardingState(): Promise<OnboardingState> {
  return apiFetch<OnboardingState>('/api/v1/onboarding/state')
}

export async function startOnboarding(url: string, model: string = 'auto'): Promise<{
  workspace: OnboardingWorkspace
  job: OnboardingJob
}> {
  return apiFetch('/api/v1/onboarding/start', {
    method: 'POST',
    body: JSON.stringify({ url, model }),
  })
}

export async function getJobStatus(id: string): Promise<OnboardingJob> {
  return apiFetch<OnboardingJob>(`/api/v1/onboarding/job/${id}`)
}

export async function saveDna(
  workspace_slug: string,
  dna: Partial<OnboardingDna>,
): Promise<{ ok: true }> {
  return apiFetch('/api/v1/onboarding/dna', {
    method: 'PATCH',
    body: JSON.stringify({ workspace_slug, dna }),
  })
}

export async function saveQa(
  workspace_slug: string,
  qa: {
    publico_alvo: string
    faixa_etaria: string
    faixa_renda: string
    genero: string
    geografia: string
    interesses: string[]
  },
): Promise<{ ok: true }> {
  return apiFetch('/api/v1/onboarding/qa', {
    method: 'PATCH',
    body: JSON.stringify({ workspace_slug, qa }),
  })
}

export async function completeOnboarding(workspace_slug: string): Promise<{
  ok: true
  workspace_slug: string
}> {
  return apiFetch('/api/v1/onboarding/complete', {
    method: 'POST',
    body: JSON.stringify({ workspace_slug }),
  })
}
