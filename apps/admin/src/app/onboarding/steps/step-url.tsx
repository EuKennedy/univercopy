'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

import { GlassButton, GlassCard, GlassInput } from '@/components/ui'

import { startOnboarding } from '../actions'

type Props = {
  onStarted: (info: { workspaceSlug: string; jobId: string }) => void
}

export function StepUrl({ onStarted }: Props) {
  const t = useTranslations('onboarding')
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handle(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const cleaned = url.trim()
    if (!/^https?:\/\//i.test(cleaned) && !/^[\w.-]+\.[a-z]{2,}/i.test(cleaned)) {
      setError('Informe uma URL válida (ex.: minhamarca.com.br).')
      return
    }
    const normalized = /^https?:\/\//i.test(cleaned) ? cleaned : `https://${cleaned}`
    setLoading(true)
    try {
      const res = await startOnboarding(normalized)
      onStarted({ workspaceSlug: res.workspace.slug, jobId: res.job.id })
    } catch (err) {
      setError(err instanceof Error ? err.message : t('step_url_continue'))
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
          disabled={loading}
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
