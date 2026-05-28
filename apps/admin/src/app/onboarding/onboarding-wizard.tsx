'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { useTranslations } from 'next-intl'

import { StepIndicator } from '@/components/ui'

import { StepUrl } from './steps/step-url'
import { StepDna } from './steps/step-dna'
import { StepQa } from './steps/step-qa'
import { StepDone } from './steps/step-done'

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

export type OnboardingState = {
  step: 'url' | 'dna' | 'qa' | 'done'
  workspaceSlug: string | null
  dna: DnaDraft | null
  qa: QaDraft | null
}

const INITIAL: OnboardingState = {
  step: 'url',
  workspaceSlug: null,
  dna: null,
  qa: null,
}

const STEP_ORDER: OnboardingState['step'][] = ['url', 'dna', 'qa', 'done']

// Variants das transições — easing fluido (~480ms) consistente com .uc-transition.
// AnimatePresence mode="popLayout" evita o footgun de opacity:0 grudada que
// AnimatePresence mode="wait" provoca quando o child desmonta antes do exit.
const STEP_VARIANTS = {
  initial: { opacity: 0, y: 24, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit:    { opacity: 0, y: -24, scale: 0.98 },
}

export function OnboardingWizard() {
  const t = useTranslations('onboarding')
  const [state, setState] = useState<OnboardingState>(INITIAL)

  const stepIdx = STEP_ORDER.indexOf(state.step)

  const labels = [
    t('step_url_title'),
    t('step_dna_title'),
    t('step_qa_title'),
    t('step_done_title'),
  ]

  function goTo(step: OnboardingState['step'], patch?: Partial<OnboardingState>) {
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
                  onSubmit={(url, dnaDraft) =>
                    goTo('dna', { dna: dnaDraft, workspaceSlug: state.workspaceSlug ?? dnaDraft.marca })
                  }
                />
              )}
              {state.step === 'dna' && state.dna && (
                <StepDna
                  initial={state.dna}
                  onContinue={(dna) => goTo('qa', { dna })}
                />
              )}
              {state.step === 'qa' && (
                <StepQa
                  onContinue={(qa) => goTo('done', { qa })}
                />
              )}
              {state.step === 'done' && <StepDone />}
            </motion.div>
          </AnimatePresence>
        </section>
      </div>
    </main>
  )
}
