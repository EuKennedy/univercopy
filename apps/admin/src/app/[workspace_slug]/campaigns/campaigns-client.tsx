'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

import { GlassButton, GlassCard, GlassInput } from '@/components/ui'
import { Icon } from '@/components/shell/icon'
import { cn } from '@/lib/cn'
import { createCampaign } from '@/lib/api/mutations'
import type { CampaignListItem } from '@/lib/api/types'

const fieldCls =
  'w-full px-4 py-3 rounded-2xl uc-glass uc-transition text-[15px] text-[var(--uc-text)] outline-none leading-6 ' +
  'focus:border-[var(--uc-accent-ring)] focus:shadow-[0_0_0_4px_var(--uc-accent-soft-2)]'

export function CampaignsClient({ slug, campaigns }: { slug: string; campaigns: CampaignListItem[] }) {
  const router = useRouter()
  const t = useTranslations('campaigns')
  const tc = useTranslations('common')
  const STATUS_META: Record<string, { label: string; cls: string }> = {
    planejada: { label: t('status_planejada'), cls: 'bg-[var(--uc-surface-soft)] text-[var(--uc-text-soft)]' },
    ativa:     { label: t('status_ativa'),     cls: 'bg-emerald-500/15 text-emerald-300' },
    concluida: { label: t('status_concluida'), cls: 'bg-[var(--uc-accent-soft-2)] text-[var(--uc-accent)]' },
    arquivada: { label: t('status_arquivada'), cls: 'bg-[var(--uc-surface-soft)] text-[var(--uc-text-faint)]' },
  }
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [objective, setObjective] = useState('')
  const [audience, setAudience] = useState('')
  const [context, setContext] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [paywall, setPaywall] = useState(false)

  async function submit() {
    setBusy(true); setError(null); setPaywall(false)
    const res = await createCampaign(slug, {
      name: name.trim(),
      objective: objective.trim() || undefined,
      audience: audience.trim() || undefined,
      context: context.trim() || undefined,
    })
    setBusy(false)
    if (!res.ok) {
      if (res.error === 'feature_locked') setPaywall(true)
      setError(res.message)
      return
    }
    setOpen(false); setName(''); setObjective(''); setAudience(''); setContext('')
    router.push(`/${slug}/campaigns/${res.data.id}`)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <GlassButton onClick={() => setOpen((v) => !v)}>
          <Icon name={open ? 'chevron-left' : 'campaign'} size={16} />
          {open ? tc('cancel') : t('new_campaign')}
        </GlassButton>
      </div>

      {open && (
        <GlassCard variant="strong" className="p-6 space-y-4">
          <GlassInput label={t('name')} placeholder={t('name_placeholder')} value={name} onChange={(e) => setName(e.target.value)} />
          <GlassInput label={t('objective')} placeholder={t('objective_placeholder')} value={objective} onChange={(e) => setObjective(e.target.value)} />
          <GlassInput label={t('audience')} placeholder={t('audience_placeholder')} value={audience} onChange={(e) => setAudience(e.target.value)} />
          <div>
            <label className="text-xs font-semibold tracking-wide uppercase text-[var(--uc-text-muted)] mb-1.5 block">{t('context')}</label>
            <textarea rows={4} className={cn(fieldCls, 'resize-y')} placeholder={t('context_placeholder')} value={context} onChange={(e) => setContext(e.target.value)} />
          </div>
          {error && (
            <p className={cn('text-sm', paywall ? 'text-[var(--uc-accent-strong)]' : 'text-[var(--uc-danger)]')}>
              {paywall ? t('plan_locked') : ''}{error}
            </p>
          )}
          <GlassButton loading={busy} disabled={!name.trim()} onClick={submit}>{t('create_campaign')}</GlassButton>
        </GlassCard>
      )}

      {campaigns.length === 0 && !open ? (
        <GlassCard variant="strong" iridescent className="p-12 flex flex-col items-center text-center gap-5">
          <span className="flex items-center justify-center size-14 rounded-2xl text-white" style={{ background: 'linear-gradient(135deg, var(--uc-brand-purple) 0%, var(--uc-brand-blue) 100%)' }}>
            <Icon name="campaign" size={26} />
          </span>
          <div className="space-y-1.5 max-w-sm">
            <h3 className="text-xl font-bold text-[var(--uc-text)]">{t('empty_title')}</h3>
            <p className="text-sm leading-6 text-[var(--uc-text-soft)]">{t('empty_description')}</p>
          </div>
          <GlassButton size="lg" onClick={() => setOpen(true)}>{t('create_first')}</GlassButton>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {campaigns.map((c) => {
            const meta = STATUS_META[c.status] ?? { label: c.status, cls: 'bg-[var(--uc-surface-soft)] text-[var(--uc-text-soft)]' }
            return (
              <Link key={c.id} href={`/${slug}/campaigns/${c.id}`} className="group cursor-pointer">
                <GlassCard className="p-5 h-full uc-transition-fast hover:translate-y-[-2px] hover:shadow-[var(--uc-shadow-prisma)]">
                  <div className="flex items-center gap-2.5 mb-2">
                    <h3 className="text-base font-semibold text-[var(--uc-text)] truncate flex-1">{c.name}</h3>
                    <span className={`shrink-0 text-[11px] font-semibold rounded-full px-2 py-0.5 ${meta.cls}`}>{meta.label}</span>
                  </div>
                  {c.objective && <p className="text-sm leading-6 text-[var(--uc-text-soft)] line-clamp-2">{c.objective}</p>}
                  <p className="text-xs text-[var(--uc-text-faint)] mt-3">{t('pieces', { count: c.pieces })}</p>
                </GlassCard>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
