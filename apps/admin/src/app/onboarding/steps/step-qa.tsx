'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

import { GlassButton, GlassCard, GlassInput } from '@/components/ui'

import { saveQa } from '../actions'
import type { QaDraft } from '../onboarding-wizard'

type Props = {
  workspaceSlug: string
  onContinue: (qa: QaDraft) => void
}

const FAIXA_ETARIA = ['18-24', '25-34', '35-44', '45-54', '55+', 'múltiplas']
const FAIXA_RENDA  = ['A', 'B', 'C', 'D/E', 'múltiplas']
const GENERO       = ['Feminino', 'Masculino', 'Diverso', 'Indiferente']

export function StepQa({ workspaceSlug, onContinue }: Props) {
  const t = useTranslations()
  const [qa, setQa] = useState<QaDraft>({
    publico_alvo: '',
    faixa_etaria: '',
    faixa_renda: '',
    genero: '',
    geografia: '',
    interesses: [],
  })
  const [interesseDraft, setInteresseDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function update<K extends keyof QaDraft>(k: K, v: QaDraft[K]) {
    setQa((prev) => ({ ...prev, [k]: v }))
  }

  function addInteresse() {
    const v = interesseDraft.trim()
    if (!v) return
    if (qa.interesses.includes(v) || qa.interesses.length >= 5) return
    update('interesses', [...qa.interesses, v])
    setInteresseDraft('')
  }

  async function handle(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await saveQa(workspaceSlug, qa)
      onContinue(qa)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <GlassCard variant="strong" iridescent className="p-8 sm:p-10 space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight text-[var(--uc-text)]">
          {t('onboarding.step_qa_title')}
        </h2>
        <p className="text-[15px] leading-7 text-[var(--uc-text-soft)]">
          {t('onboarding.step_qa_subtitle')}
        </p>
      </div>

      <form onSubmit={handle} className="space-y-5">
        <GlassInput
          label={t('onboarding.qa_publico_alvo_label')}
          value={qa.publico_alvo}
          onChange={(e) => update('publico_alvo', e.target.value)}
          placeholder={t('onboarding.qa_publico_alvo_placeholder')}
          required
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <ChipGroup label={t('onboarding.qa_faixa_etaria_label')} options={FAIXA_ETARIA} value={qa.faixa_etaria} onChange={(v) => update('faixa_etaria', v)} />
          <ChipGroup label={t('onboarding.qa_faixa_renda_label')}  options={FAIXA_RENDA}  value={qa.faixa_renda}  onChange={(v) => update('faixa_renda', v)} />
          <ChipGroup label={t('onboarding.qa_genero_label')}       options={GENERO}       value={qa.genero}       onChange={(v) => update('genero', v)} />
        </div>

        <GlassInput
          label={t('onboarding.qa_geografia_label')}
          value={qa.geografia}
          onChange={(e) => update('geografia', e.target.value)}
          placeholder="Brasil, capitais; PT-BR"
        />

        <div className="space-y-2">
          <label className="text-xs font-semibold tracking-wide uppercase text-[var(--uc-text-muted)]">
            {t('onboarding.qa_interesses_label')}
          </label>
          <div className="flex gap-2 items-stretch">
            <GlassInput
              value={interesseDraft}
              onChange={(e) => setInteresseDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addInteresse()
                }
              }}
              placeholder="autocuidado, profissionalismo, autenticidade…"
            />
            <GlassButton type="button" variant="secondary" onClick={addInteresse}>
              Adicionar
            </GlassButton>
          </div>
          {qa.interesses.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {qa.interesses.map((it) => (
                <button
                  type="button"
                  key={it}
                  onClick={() => update('interesses', qa.interesses.filter((x) => x !== it))}
                  className="cursor-pointer px-3 py-1.5 rounded-full text-sm bg-[var(--uc-accent-soft)] text-[var(--uc-accent-strong)] border border-[var(--uc-accent-soft-3)] uc-transition hover:bg-[var(--uc-accent-soft-2)]"
                >
                  {it} <span aria-hidden className="ml-1 opacity-60">×</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div role="alert" className="rounded-xl px-4 py-3 text-sm bg-[var(--uc-danger-bg)] text-[var(--uc-danger)] border border-[var(--uc-danger)]">
            {error}
          </div>
        )}

        <div className="flex justify-end pt-3">
          <GlassButton type="submit" size="lg" loading={saving}>
            {t('common.continue')}
          </GlassButton>
        </div>
      </form>

      <p className="text-xs text-[var(--uc-text-muted)] pt-1">
        Workspace: <code className="text-[var(--uc-text-soft)]">{workspaceSlug}</code>
      </p>
    </GlassCard>
  )
}

function ChipGroup({
  label, options, value, onChange,
}: {
  label: string
  options: readonly string[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="space-y-2">
      <span className="text-xs font-semibold tracking-wide uppercase text-[var(--uc-text-muted)]">
        {label}
      </span>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const active = value === opt
          return (
            <button
              type="button"
              key={opt}
              onClick={() => onChange(opt)}
              className={
                'cursor-pointer px-3 py-2 rounded-xl text-sm font-medium uc-transition border min-h-[44px] sm:min-h-0 ' +
                (active
                  ? 'bg-[var(--uc-accent)] text-[var(--uc-text-on-accent)] border-transparent shadow-[0_8px_24px_-12px_var(--uc-accent-glow)]'
                  : 'bg-[var(--uc-surface-soft)] text-[var(--uc-text-secondary)] border-[var(--uc-border)] hover:border-[var(--uc-border-strong)]')
              }
            >
              {opt}
            </button>
          )
        })}
      </div>
    </div>
  )
}
