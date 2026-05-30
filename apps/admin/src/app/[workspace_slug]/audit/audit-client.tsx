'use client'

import { useState } from 'react'

import { GlassButton, GlassCard } from '@/components/ui'
import { Icon } from '@/components/shell/icon'
import { cn } from '@/lib/cn'
import { runPageAudit } from '@/lib/api/mutations'
import type { PageAudit } from '@/lib/api/types'

function scoreColor(n: number | null): string {
  if (n == null) return 'text-[var(--uc-text-muted)]'
  if (n >= 75) return 'text-emerald-400'
  if (n >= 50) return 'text-amber-300'
  return 'text-[var(--uc-danger)]'
}

export function AuditClient({ slug, initial }: { slug: string; initial: PageAudit[] }) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [paywall, setPaywall] = useState(false)
  const [result, setResult] = useState<PageAudit | null>(null)
  const [history, setHistory] = useState<PageAudit[]>(initial)

  async function run() {
    setLoading(true); setError(null); setPaywall(false); setResult(null)
    const res = await runPageAudit(slug, { url: url.trim() })
    setLoading(false)
    if (!res.ok) {
      if (res.error === 'feature_locked' || res.error === 'cap_reached') setPaywall(true)
      setError(res.error === 'ai_failed' ? 'A IA não conseguiu analisar essa URL agora. Verifique o link e tente de novo.' : res.message)
      return
    }
    setResult(res.data)
    setHistory((h) => [res.data, ...h])
    setUrl('')
  }

  return (
    <div className="space-y-5">
      <GlassCard className="p-6 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://pagina-para-analisar.com/produto"
            className="flex-1 h-12 px-4 rounded-2xl uc-glass text-[15px] text-[var(--uc-text)] outline-none focus:border-[var(--uc-accent-ring)] focus:shadow-[0_0_0_4px_var(--uc-accent-soft-2)]"
          />
          <GlassButton size="lg" loading={loading} disabled={!url.trim()} onClick={run}>
            {!loading && <Icon name="audit" size={16} />}{loading ? 'Analisando…' : 'Analisar'}
          </GlassButton>
        </div>
        {error && (
          <p className={cn('text-sm', paywall ? 'text-[var(--uc-accent-strong)]' : 'text-[var(--uc-danger)]')}>
            {paywall ? 'Recurso fora do seu plano. ' : ''}{error}
          </p>
        )}
      </GlassCard>

      {result && <AuditResult audit={result} />}

      {history.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold tracking-wide uppercase text-[var(--uc-text-muted)]">Análises anteriores</p>
          {history.map((a) => <AuditResult key={a.id} audit={a} compact />)}
        </div>
      )}
    </div>
  )
}

function AuditResult({ audit, compact = false }: { audit: PageAudit; compact?: boolean }) {
  const [open, setOpen] = useState(!compact)
  return (
    <GlassCard className="p-6">
      <button type="button" onClick={() => setOpen((v) => !v)} className="w-full flex items-center gap-4 text-left cursor-pointer">
        <span className={cn('text-3xl font-bold tabular-nums', scoreColor(audit.score))}>{audit.score ?? '—'}</span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-[var(--uc-text)] truncate">{audit.brand_name || audit.url}</p>
          <p className="text-xs text-[var(--uc-text-muted)] truncate">{audit.url}</p>
        </div>
        {compact && <Icon name={open ? 'chevron-left' : 'chevron-right'} className="text-[var(--uc-text-faint)] shrink-0" />}
      </button>

      {open && (
        <div className="mt-4 space-y-4">
          {audit.summary && <p className="text-sm leading-6 text-[var(--uc-text-soft)]">{audit.summary}</p>}
          <div className="space-y-2.5">
            {audit.sections.map((s, i) => (
              <div key={i} className="rounded-xl bg-[var(--uc-bg-mute)] p-4">
                <div className="flex items-center justify-between gap-3 mb-1">
                  <span className="text-sm font-semibold text-[var(--uc-text)]">{s.title}</span>
                  <span className={cn('text-sm font-bold tabular-nums', scoreColor(s.score))}>{s.score}</span>
                </div>
                <p className="text-sm leading-6 text-[var(--uc-text-soft)]">{s.notes}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </GlassCard>
  )
}
