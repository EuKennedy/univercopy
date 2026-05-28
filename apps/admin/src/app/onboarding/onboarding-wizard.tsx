'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { useTranslations } from 'next-intl'

import { StepIndicator } from '@/components/ui'

import type { OnboardingState as ApiState } from './actions'
import { StepDna } from './steps/step-dna'
import { StepDone } from './steps/step-done'
import { StepQa } from './steps/step-qa'
import { StepUrl } from './steps/step-url'

export type DnaDraft = {
  marca: string
  posicionamento: string
  tom: string
  publico: string
  consciencia: string
  valores: string[]
  produtos: string[]
  provas: string[]
  objecoes: string[]
  evitar: string[]
  source_url?: string
}

export type QaDraft = {
  publico_alvo: string
  faixa_etaria: string
  faixa_renda: string
  genero: string
  geografia: string
  interesses: string[]
}

export type Step = 'url' | 'dna' | 'qa' | 'done'

export type LocalState = {
  step: Step
  workspaceSlug: string | null
  jobId: string | null
  dna: DnaDraft | null
  qa: QaDraft | null
}

const STEP_ORDER: Step[] = ['url', 'dna', 'qa', 'done']

const STEP_VARIANTS = {
  initial: { opacity: 0, y: 24, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit:    { opacity: 0, y: -24, scale: 0.98 },
}

function pickInitialStep(initial: ApiState): Step {
  if (!initial.workspace) return 'url'
  switch (initial.workspace.onboarding_status) {
    case 'pending':    return 'url'
    case 'dna_loaded': return 'dna'
    case 'qa_done':    return 'done'
    case 'done':       return 'done'
    default:           return 'url'
  }
}

function dnaFromApi(api: ApiState['dna']): DnaDraft | null {
  if (!api) return null
  return {
    marca: api.marca ?? '',
    posicionamento: api.posicionamento ?? '',
    tom: api.tom ?? '',
    publico: api.publico ?? '',
    consciencia: api.consciencia ?? '',
    valores: api.valores ?? [],
    produtos: api.produtos ?? [],
    provas: api.provas ?? [],
    objecoes: api.objecoes ?? [],
    evitar: api.evitar ?? [],
    source_url: api.source_url ?? undefined,
  }
}

export function OnboardingWizard({ initial }: { initial: ApiState }) {
  const t = useTranslations('onboarding')

  const [state, setState] = useState<LocalState>({
    step: pickInitialStep(initial),
    workspaceSlug: initial.workspace?.slug ?? null,
    jobId: initial.job?.id ?? null,
    dna: dnaFromApi(initial.dna),
    qa: null,
  })

  const stepIdx = STEP_ORDER.indexOf(state.step)

  const labels = [
    t('step_url_title'),
    t('step_dna_title'),
    t('step_qa_title'),
    t('step_done_title'),
  ]

  function goTo(step: Step, patch?: Partial<LocalState>) {
    setState((prev) => ({ ...prev, ...patch, step }))
  }

  return (
    <main className="flex-1 flex flex-col">
      <div className="mx-auto w-full max-w-3xl px-6 py-10 sm:py-16 flex flex-col gap-10 flex-1">
        <header className="space-y-3">
          <p className="text-xs uppercase tracking-[0.18em] font-semibold text-[var(--uc-accent)]">
            UniverCopy · Onboarding
          </p>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-[var(--uc-text)] leading-[1.05]">
            {t('welcome_title')}
          </h1>
          <p className="text-[15px] sm:text-base leading-7 text-[var(--uc-text-soft)] max-w-2xl">
            {t('welcome_subtitle')}
          </p>
        </header>

        <StepIndicator steps={labels} current={stepIdx} />

        <section className="flex-1 flex items-stretch">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={state.step}
              variants={STEP_VARIANTS}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.48, ease: [0.16, 1, 0.3, 1] }}
              className="w-full"
            >
              {state.step === 'url' && (
                <StepUrl
                  onStarted={({ workspaceSlug, jobId }) =>
                    goTo('dna', { workspaceSlug, jobId })
                  }
                />
              )}
              {state.step === 'dna' && state.workspaceSlug && state.jobId && (
                <StepDna
                  workspaceSlug={state.workspaceSlug}
                  jobId={state.jobId}
                  initial={state.dna}
                  onContinue={(dna) => goTo('qa', { dna })}
                />
              )}
              {state.step === 'qa' && state.workspaceSlug && (
                <StepQa
                  workspaceSlug={state.workspaceSlug}
                  onContinue={(qa) => goTo('done', { qa })}
                />
              )}
              {state.step === 'done' && state.workspaceSlug && (
                <StepDone workspaceSlug={state.workspaceSlug} />
              )}
            </motion.div>
          </AnimatePresence>
        </section>
      </div>
    </main>
  )
}
