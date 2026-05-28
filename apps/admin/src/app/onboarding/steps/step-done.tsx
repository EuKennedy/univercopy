'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'

import { GlassButton, GlassCard } from '@/components/ui'

import { completeOnboarding } from '../actions'

type Props = {
  workspaceSlug: string
}

export function StepDone({ workspaceSlug }: Props) {
  const t = useTranslations('onboarding')
  const [done, setDone] = useState(false)

  useEffect(() => {
    let cancelled = false
    completeOnboarding(workspaceSlug)
      .then(() => { if (!cancelled) setDone(true) })
      .catch(() => { /* silencioso */ })
    return () => { cancelled = true }
  }, [workspaceSlug])

  return (
    <GlassCard variant="strong" iridescent glow className="p-10 sm:p-12 text-center space-y-6">
      <div className="mx-auto size-16 rounded-2xl bg-[var(--uc-accent-soft-2)] border border-[var(--uc-accent-soft-3)] flex items-center justify-center">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
             className="text-[var(--uc-accent)]" aria-hidden="true">
          <path d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight text-[var(--uc-text)]">
          {t('step_done_title')}
        </h2>
        <p className="text-[15px] leading-7 text-[var(--uc-text-soft)] max-w-md mx-auto">
          {t('step_done_subtitle')}
        </p>
      </div>
      <Link href={`/${workspaceSlug}`} className="inline-block">
        <GlassButton size="lg" type="button" disabled={!done}>
          {t('step_done_cta')}
        </GlassButton>
      </Link>
    </GlassCard>
  )
}
