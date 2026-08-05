'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'

import { Icon } from '@/components/shell/icon'
import { cn } from '@/lib/cn'

export type GenerationKind = 'title' | 'content' | 'cover'

// Quantas mensagens de etapa cada tipo tem (chaves step_<kind>_1..N no i18n) e
// de quanto em quanto tempo avançar. Os intervalos acompanham a duração real
// medida de cada operação: título é rápido, capa é a mais lenta.
const STEPS: Record<GenerationKind, { count: number; intervalMs: number }> = {
  title:   { count: 4, intervalMs: 1800 },
  content: { count: 6, intervalMs: 4000 },
  cover:   { count: 5, intervalMs: 7000 },
}

// A partir daqui a espera já é longa o bastante pra merecer um aviso honesto
// em vez de só girar a animação.
const SLOW_AFTER_SECONDS = 30

// `key={kind}` remonta o diálogo a cada geração, então o contador e a etapa
// nascem zerados sem precisar resetar estado dentro de efeito.
export function GenerationModal({ kind }: { kind: GenerationKind | null }) {
  if (!kind) return null
  return <GenerationDialog key={kind} kind={kind} />
}

function GenerationDialog({ kind }: { kind: GenerationKind }) {
  const t = useTranslations('blog')
  const [step, setStep] = useState(0)
  const [seconds, setSeconds] = useState(0)

  // Trava o scroll do fundo enquanto o modal está aberto.
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  // Avança as etapas e para na última — nunca finge que terminou.
  useEffect(() => {
    const { count, intervalMs } = STEPS[kind]
    const stepTimer = setInterval(() => {
      setStep((s) => (s < count - 1 ? s + 1 : s))
    }, intervalMs)
    const clockTimer = setInterval(() => setSeconds((s) => s + 1), 1000)

    return () => {
      clearInterval(stepTimer)
      clearInterval(clockTimer)
    }
  }, [kind])

  const slow = seconds >= SLOW_AFTER_SECONDS

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="uc-gen-title"
      aria-busy="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm"
    >
      <div className="uc-fade-in w-full max-w-md rounded-3xl uc-glass border border-[var(--uc-border-strong)] shadow-[0_32px_80px_-24px_rgba(0,0,0,0.55)] p-8 text-center">
        <Orb />

        <h2 id="uc-gen-title" className="mt-6 text-lg font-semibold tracking-tight text-[var(--uc-text)]">
          {t(`gen_title_${kind}`)}
        </h2>
        <p className="mt-1.5 text-sm leading-6 text-[var(--uc-text-soft)]">
          {t(`gen_subtitle_${kind}`)}
        </p>

        {/* aria-live: leitor de tela acompanha a etapa sem roubar o foco. */}
        <p
          aria-live="polite"
          className="mt-5 min-h-[1.5rem] text-sm font-medium text-[var(--uc-accent-strong)] uc-transition"
        >
          {t(`step_${kind}_${step + 1}`)}
        </p>

        <div className="relative mt-4 h-1.5 w-full overflow-hidden rounded-full bg-[var(--uc-surface-soft)] uc-indeterminate" />

        <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-[var(--uc-text-faint)]">
          <span className="uc-dot size-1.5 rounded-full bg-[var(--uc-accent)]" />
          <span className="uc-dot size-1.5 rounded-full bg-[var(--uc-accent)]" />
          <span className="uc-dot size-1.5 rounded-full bg-[var(--uc-accent)]" />
          <span className="ml-2 tabular-nums">{t('gen_elapsed', { seconds })}</span>
        </div>

        <p
          className={cn(
            'mt-4 text-xs leading-5 uc-transition',
            slow ? 'text-[var(--uc-text-muted)]' : 'text-[var(--uc-text-faint)]',
          )}
        >
          {slow ? t('gen_slow_note') : t('gen_keep_open')}
        </p>
      </div>
    </div>
  )
}

// Anel girando + núcleo pulsando. Puro CSS/SVG, sem dependência externa.
function Orb() {
  return (
    <div className="relative mx-auto size-20">
      <svg viewBox="0 0 80 80" className="uc-orbit absolute inset-0 size-20" aria-hidden="true">
        <defs>
          <linearGradient id="uc-orb-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--uc-brand-purple)" />
            <stop offset="100%" stopColor="var(--uc-brand-blue)" />
          </linearGradient>
        </defs>
        <circle
          cx="40" cy="40" r="34"
          fill="none"
          stroke="var(--uc-border)"
          strokeWidth="3"
        />
        <circle
          cx="40" cy="40" r="34"
          fill="none"
          stroke="url(#uc-orb-grad)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="54 160"
        />
      </svg>

      <span
        className="uc-breathe absolute inset-0 m-auto flex size-11 items-center justify-center rounded-full text-white"
        style={{ background: 'var(--uc-prisma)', boxShadow: '0 10px 30px -8px var(--uc-accent-glow)' }}
      >
        <Icon name="sparkle" size={20} />
      </span>
    </div>
  )
}
