'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

import { GlassButton, GlassCard, GlassInput } from '@/components/ui'

import type { DnaDraft } from '../onboarding-wizard'

type Props = {
  onSubmit: (url: string, dna: DnaDraft) => void
}

// Step 1 — coleta URL da loja/marca. Na Fase 3.D, dispara POST /api/v1/
// onboarding/start (cria workspace + Sidekiq job que scrapeia + chama
// Claude pra extrair DNA). Aqui simula com timeout + DNA stub.
export function StepUrl({ onSubmit }: Props) {
  const t = useTranslations('onboarding')
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handle(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!/^https?:\/\//i.test(url) && !/^[\w.-]+\.[a-z]{2,}/i.test(url)) {
      setError('Informe uma URL válida (ex.: minhamarca.com.br).')
      return
    }
    setLoading(true)
    try {
      // TODO Fase 3.D: substituir por chamada real na API Rails.
      await new Promise((r) => setTimeout(r, 2200))
      const stub: DnaDraft = {
        marca: '',
        posicionamento: '',
        tom: '',
        publico: '',
        consciencia: '',
        valores: [],
        produtos: [],
        provas: [],
        objecoes: [],
        evitar: [],
        source_url: url,
      }
      onSubmit(url, stub)
    } finally {
      setLoading(false)
    }
  }

  return (
    <GlassCard variant="strong" iridescent glow className="p-8 sm:p-10 space-y-7">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight text-[var(--uc-text)]">
          {t('step_url_title')}
        </h2>
        <p className="text-[15px] leading-7 text-[var(--uc-text-soft)]">
          {t('step_url_subtitle')}
        </p>
      </div>

      <form onSubmit={handle} className="space-y-5">
        <GlassInput
          type="url"
          inputMode="url"
          autoComplete="url"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={t('step_url_placeholder')}
          error={error ?? undefined}
        />

        <GlassButton type="submit" size="lg" loading={loading} className="w-full">
          {loading ? 'Analisando sua marca…' : t('step_url_continue')}
        </GlassButton>
      </form>

      {loading && (
        <ul className="space-y-1.5 text-sm text-[var(--uc-text-muted)] tabular-nums">
          <li className="flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-[var(--uc-accent)]" />
            Lendo páginas públicas…
          </li>
          <li className="flex items-center gap-2 opacity-70">
            <span className="size-1.5 rounded-full bg-[var(--uc-accent-soft-3)]" />
            Identificando tom, público e ofertas…
          </li>
          <li className="flex items-center gap-2 opacity-40">
            <span className="size-1.5 rounded-full bg-[var(--uc-accent-soft-2)]" />
            Montando primeiro rascunho de DNA…
          </li>
        </ul>
      )}
    </GlassCard>
  )
}
