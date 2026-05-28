'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'

import { GlassButton, GlassCard, GlassInput } from '@/components/ui'

import { getJobStatus, saveDna } from '../actions'
import type { DnaDraft } from '../onboarding-wizard'

type Props = {
  workspaceSlug: string
  jobId: string
  initial: DnaDraft | null
  onContinue: (dna: DnaDraft) => void
}

type RemoteState = 'loading' | 'ready' | 'failed'

const EMPTY_DNA: DnaDraft = {
  marca: '', posicionamento: '', tom: '', publico: '', consciencia: '',
  valores: [], produtos: [], provas: [], objecoes: [], evitar: [],
}

const POLL_INTERVAL_MS = 2200

export function StepDna({ workspaceSlug, jobId, initial, onContinue }: Props) {
  const t = useTranslations()
  const [remote, setRemote] = useState<RemoteState>(initial ? 'ready' : 'loading')
  const [dna, setDna] = useState<DnaDraft>(initial ?? EMPTY_DNA)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const stopRef = useRef(false)

  useEffect(() => {
    if (initial) return
    let cancelled = false

    async function tick() {
      try {
        const job = await getJobStatus(jobId)
        if (cancelled) return
        if (job.status === 'done') {
          const result = (job.result?.dna ?? {}) as Partial<DnaDraft>
          setDna((prev) => ({
            ...prev,
            marca:           (result.marca as string) ?? prev.marca,
            posicionamento:  (result.posicionamento as string) ?? prev.posicionamento,
            tom:             (result.tom as string) ?? prev.tom,
            publico:         (result.publico as string) ?? prev.publico,
            consciencia:     (result.consciencia as string) ?? prev.consciencia,
            valores:         (result.valores as string[])  ?? prev.valores,
            produtos:        (result.produtos as string[]) ?? prev.produtos,
            provas:          (result.provas as string[])   ?? prev.provas,
            objecoes:        (result.objecoes as string[]) ?? prev.objecoes,
            evitar:          (result.evitar as string[])   ?? prev.evitar,
          }))
          setRemote('ready')
          stopRef.current = true
          return
        }
        if (job.status === 'error' || job.status === 'cap_reached') {
          setError(job.error ?? 'Falha na geração — tente novamente.')
          setRemote('failed')
          stopRef.current = true
          return
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'erro de rede')
        setRemote('failed')
        stopRef.current = true
        return
      }
      if (!cancelled && !stopRef.current) {
        setTimeout(tick, POLL_INTERVAL_MS)
      }
    }
    tick()
    return () => { cancelled = true; stopRef.current = true }
  }, [jobId, initial])

  function update<K extends keyof DnaDraft>(k: K, v: DnaDraft[K]) {
    setDna((prev) => ({ ...prev, [k]: v }))
  }

  async function handle(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await saveDna(workspaceSlug, dna)
      onContinue(dna)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  if (remote === 'loading') {
    return (
      <GlassCard variant="strong" iridescent glow className="p-10 sm:p-12">
        <div className="flex flex-col items-center text-center space-y-5">
          <span className="size-12 rounded-2xl bg-[var(--uc-accent-soft-2)] border border-[var(--uc-accent-soft-3)] flex items-center justify-center">
            <span className="size-5 rounded-full border-2 border-[var(--uc-accent)] border-r-transparent animate-spin" />
          </span>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight text-[var(--uc-text)]">
              Estudando sua marca em profundidade…
            </h2>
            <p className="text-[15px] leading-7 text-[var(--uc-text-soft)] max-w-md">
              A IA leu o site, está identificando posicionamento, tom e ofertas. Volta em alguns segundos.
            </p>
          </div>
        </div>
      </GlassCard>
    )
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

        {error && (
          <div role="alert" className="sm:col-span-2 rounded-xl px-4 py-3 text-sm bg-[var(--uc-danger-bg)] text-[var(--uc-danger)] border border-[var(--uc-danger)]">
            {error}
          </div>
        )}

        <div className="sm:col-span-2 flex justify-end pt-3">
          <GlassButton type="submit" size="lg" loading={saving}>
            {t('common.continue')}
          </GlassButton>
        </div>
      </form>
    </GlassCard>
  )
}
