'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

import { GlassButton, GlassCard, GlassInput } from '@/components/ui'

import type { DnaDraft } from '../onboarding-wizard'

type Props = {
  initial: DnaDraft
  onContinue: (dna: DnaDraft) => void
}

// Step 2 — revisão do DNA gerado pela IA. Campos editáveis. Persiste no
// PATCH /api/v1/workspaces/:slug/dna/atual na Fase 3.D.
export function StepDna({ initial, onContinue }: Props) {
  const t = useTranslations()
  const [dna, setDna] = useState(initial)
  const [loading, setLoading] = useState(false)

  function update<K extends keyof DnaDraft>(k: K, v: DnaDraft[K]) {
    setDna((prev) => ({ ...prev, [k]: v }))
  }

  async function handle(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      // TODO Fase 3.D: PATCH /api/v1/workspaces/:slug/dna/atual
      await new Promise((r) => setTimeout(r, 600))
      onContinue(dna)
    } finally {
      setLoading(false)
    }
  }

  return (
    <GlassCard variant="strong" iridescent className="p-8 sm:p-10 space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight text-[var(--uc-text)]">
          {t('onboarding.step_dna_title')}
        </h2>
        <p className="text-[15px] leading-7 text-[var(--uc-text-soft)]">
          {t('onboarding.step_dna_subtitle')}
        </p>
      </div>

      <form onSubmit={handle} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <GlassInput
          label={t('dna.marca')}
          value={dna.marca}
          onChange={(e) => update('marca', e.target.value)}
          placeholder="Lizzon"
        />
        <GlassInput
          label={t('dna.tom')}
          value={dna.tom}
          onChange={(e) => update('tom', e.target.value)}
          placeholder="Acolhedor, técnico, confiante"
        />
        <div className="sm:col-span-2">
          <GlassInput
            label={t('dna.posicionamento')}
            value={dna.posicionamento}
            onChange={(e) => update('posicionamento', e.target.value)}
            placeholder="Cosmético profissional sem promessa milagrosa"
          />
        </div>
        <div className="sm:col-span-2">
          <GlassInput
            label={t('dna.publico')}
            value={dna.publico}
            onChange={(e) => update('publico', e.target.value)}
            placeholder="Profissionais cabeleireiros + consumidor final exigente"
          />
        </div>
        <div className="sm:col-span-2 flex justify-end pt-3">
          <GlassButton type="submit" size="lg" loading={loading}>
            {t('common.continue')}
          </GlassButton>
        </div>
      </form>
    </GlassCard>
  )
}
