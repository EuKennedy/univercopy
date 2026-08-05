'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'

import { Icon } from '@/components/shell/icon'
import { GlassButton, fieldCls } from '@/components/ui'
import { cn } from '@/lib/cn'
import { getBlogAgentRun, runBlogAgent, sendBlogAgentMessage } from '@/lib/api/mutations'
import type { AgentJob, AgentMessage, AgentPlan } from '@/lib/api/types'

const POLL_MS = 3000

export function AgentModal({ slug, onClose }: { slug: string; onClose: () => void }) {
  const t = useTranslations('blog')
  const scroller = useRef<HTMLDivElement>(null)

  const [messages, setMessages] = useState<AgentMessage[]>([])
  const [plan, setPlan] = useState<AgentPlan | null>(null)
  const [ready, setReady] = useState(false)
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const [starting, setStarting] = useState(false)
  const [job, setJob] = useState<AgentJob | null>(null)
  const [error, setError] = useState<string | null>(null)

  const running = job !== null && (job.status === 'queued' || job.status === 'running')

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  // Rola pro fim a cada turno novo.
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' })
  }, [messages, thinking, job])

  // Polling do lote. O job segue no servidor mesmo se o modal fechar.
  useEffect(() => {
    if (!running || !job) return

    const id = setInterval(async () => {
      const res = await getBlogAgentRun(slug, job.id)
      if (res.ok) setJob(res.data)
    }, POLL_MS)

    return () => clearInterval(id)
  }, [running, job, slug])

  const send = useCallback(
    async (text: string) => {
      const clean = text.trim()
      if (!clean || thinking) return

      const next: AgentMessage[] = [...messages, { role: 'user', content: clean }]
      setMessages(next)
      setInput('')
      setThinking(true)
      setError(null)

      const res = await sendBlogAgentMessage(slug, next)
      setThinking(false)

      if (!res.ok) {
        setError(res.message || t('error_generic'))
        return
      }

      setMessages([...next, { role: 'assistant', content: res.data.reply }])
      setPlan(res.data.plan)
      setReady(res.data.ready)
    },
    [messages, slug, t, thinking],
  )

  async function confirm() {
    if (!plan) return
    setStarting(true)
    setError(null)

    const res = await runBlogAgent(slug, plan)
    setStarting(false)

    if (!res.ok) {
      setError(res.message || t('error_generic'))
      return
    }
    setJob(res.data)
  }

  const result = job?.result ?? null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="uc-agent-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm"
    >
      <div className="uc-fade-in flex w-full max-w-2xl max-h-[85vh] flex-col rounded-3xl uc-glass border border-[var(--uc-border-strong)] shadow-[0_32px_80px_-24px_rgba(0,0,0,0.55)]">
        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-4 border-b border-[var(--uc-border)] p-5">
          <div className="flex items-center gap-3 min-w-0">
            <span
              className="flex size-10 shrink-0 items-center justify-center rounded-xl text-white"
              style={{ background: 'var(--uc-prisma)' }}
            >
              <Icon name="sparkle" size={18} />
            </span>
            <div className="min-w-0">
              <h2 id="uc-agent-title" className="text-base font-semibold tracking-tight text-[var(--uc-text)]">
                {t('agent_title')}
              </h2>
              <p className="text-xs text-[var(--uc-text-muted)]">{t('agent_subtitle')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('agent_close')}
            className="shrink-0 rounded-full p-2 text-[var(--uc-text-muted)] hover:text-[var(--uc-text)] hover:bg-[var(--uc-surface-soft)] uc-transition"
          >
            <Icon name="x" size={18} />
          </button>
        </div>

        {/* Corpo */}
        <div ref={scroller} className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.length === 0 && !job && <Starters onPick={(s) => void send(s)} />}

          {messages.map((m, i) => (
            <Bubble key={i} role={m.role} content={m.content} />
          ))}

          {thinking && (
            <div className="flex items-center gap-1.5 text-xs text-[var(--uc-text-muted)]">
              <span className="uc-dot size-1.5 rounded-full bg-[var(--uc-accent)]" />
              <span className="uc-dot size-1.5 rounded-full bg-[var(--uc-accent)]" />
              <span className="uc-dot size-1.5 rounded-full bg-[var(--uc-accent)]" />
              <span className="ml-1">{t('agent_thinking')}</span>
            </div>
          )}

          {/* Plano fechado, aguardando o clique. */}
          {ready && plan && !job && <PlanCard plan={plan} />}

          {result && <Progress result={result} job={job} />}

          {error && <p className="text-sm text-[var(--uc-danger)]">{error}</p>}
        </div>

        {/* Rodapé */}
        <div className="border-t border-[var(--uc-border)] p-4">
          {job ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-[var(--uc-text-muted)]">
                {running ? t('agent_running_note') : t('agent_finished_note')}
              </p>
              <GlassButton size="sm" variant={running ? 'secondary' : 'primary'} onClick={onClose}>
                {running ? t('agent_close_keep_running') : t('agent_close')}
              </GlassButton>
            </div>
          ) : ready && plan ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-[var(--uc-text-muted)]">
                {plan.status === 'publish' ? t('agent_confirm_publish_note') : t('agent_confirm_draft_note')}
              </p>
              <div className="flex gap-2">
                <GlassButton size="sm" variant="secondary" disabled={starting} onClick={() => setReady(false)}>
                  {t('agent_keep_talking')}
                </GlassButton>
                <GlassButton size="sm" loading={starting} disabled={starting} onClick={confirm}>
                  <Icon name="check" size={15} />
                  {plan.status === 'publish' ? t('agent_confirm_publish') : t('agent_confirm_draft')}
                </GlassButton>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    void send(input)
                  }
                }}
                placeholder={t('agent_input_placeholder')}
                disabled={thinking}
                className={cn(fieldCls, 'h-12')}
              />
              <GlassButton
                size="md"
                loading={thinking}
                disabled={thinking || !input.trim()}
                onClick={() => void send(input)}
              >
                {t('agent_send')}
              </GlassButton>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Starters({ onPick }: { onPick: (s: string) => void }) {
  const t = useTranslations('blog')
  const examples = [t('agent_example_1'), t('agent_example_2'), t('agent_example_3')]

  return (
    <div className="space-y-3">
      <p className="text-sm leading-6 text-[var(--uc-text-soft)]">{t('agent_intro')}</p>
      <div className="space-y-2">
        {examples.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => onPick(ex)}
            className="block w-full rounded-2xl border border-[var(--uc-border)] uc-glass px-4 py-3 text-left text-sm text-[var(--uc-text-soft)] hover:text-[var(--uc-text)] hover:border-[var(--uc-border-strong)] uc-transition"
          >
            “{ex}”
          </button>
        ))}
      </div>
    </div>
  )
}

function Bubble({ role, content }: { role: 'user' | 'assistant'; content: string }) {
  const mine = role === 'user'
  return (
    <div className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-6 whitespace-pre-wrap',
          mine
            ? 'bg-[var(--uc-accent)] text-[var(--uc-text-on-accent)]'
            : 'uc-glass border border-[var(--uc-border)] text-[var(--uc-text)]',
        )}
      >
        {content}
      </div>
    </div>
  )
}

function PlanCard({ plan }: { plan: AgentPlan }) {
  const t = useTranslations('blog')
  return (
    <div className="rounded-2xl border border-[var(--uc-accent-ring)] bg-[var(--uc-accent-soft)] p-4 space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--uc-accent-strong)]">
        {t('agent_plan_title')}
      </p>
      <ul className="space-y-1 text-sm text-[var(--uc-text)]">
        {plan.posts.map((p, i) => (
          <li key={i} className="flex gap-2">
            <span className="text-[var(--uc-text-faint)] tabular-nums">{i + 1}.</span>
            <span>{p.topic}{p.angle ? ` — ${p.angle}` : ''}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-[var(--uc-text-muted)]">
        {t('agent_plan_meta', {
          count: plan.posts.length,
          mode: plan.status === 'publish' ? t('agent_mode_publish') : t('agent_mode_draft'),
          cover: plan.generate_cover ? t('agent_cover_yes') : t('agent_cover_no'),
        })}
      </p>
    </div>
  )
}

function Progress({
  result, job,
}: {
  result: NonNullable<AgentJob['result']>
  job: AgentJob | null
}) {
  const t = useTranslations('blog')
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold uppercase tracking-wide text-[var(--uc-text-muted)]">
          {t('agent_progress_title')}
        </span>
        <span className="tabular-nums text-[var(--uc-text-faint)]">
          {t('agent_progress_count', { done: result.completed, total: result.total })}
        </span>
      </div>

      <ul className="space-y-1.5">
        {result.posts.map((p) => (
          <li
            key={p.index}
            className="flex items-start gap-2.5 rounded-xl border border-[var(--uc-border)] uc-glass px-3 py-2.5 text-sm"
          >
            <StatusDot status={p.status} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[var(--uc-text)]">{p.title || p.topic}</p>
              {p.status === 'running' && p.step && (
                <p className="text-xs text-[var(--uc-accent-strong)]">{t(`agent_step_${p.step}`)}</p>
              )}
              {p.status === 'error' && p.error && (
                <p className="text-xs text-[var(--uc-danger)]">{p.error}</p>
              )}
              {p.status === 'skipped' && (
                <p className="text-xs text-[var(--uc-text-muted)]">{t('agent_step_skipped')}</p>
              )}
            </div>
            {p.url && (
              <a
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-xs font-semibold text-[var(--uc-accent-strong)] hover:underline"
              >
                {t('view_post')} →
              </a>
            )}
          </li>
        ))}
      </ul>

      {job?.status === 'error' && job.error && (
        <p className="text-xs text-[var(--uc-danger)]">{job.error}</p>
      )}
    </div>
  )
}

function StatusDot({ status }: { status: string }) {
  if (status === 'running') {
    return <span className="uc-breathe mt-1.5 size-2 shrink-0 rounded-full bg-[var(--uc-accent)]" />
  }
  const cls =
    status === 'done' ? 'bg-emerald-400'
    : status === 'error' ? 'bg-[var(--uc-danger)]'
    : status === 'skipped' ? 'bg-[var(--uc-text-faint)]'
    : 'bg-[var(--uc-border-strong)]'
  return <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', cls)} />
}
