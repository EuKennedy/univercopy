'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

import { GlassButton, GlassCard, GlassInput, StatusBadge, type StatusTone, fieldCls, labelCls } from '@/components/ui'
import { Icon } from '@/components/shell/icon'
import { cn } from '@/lib/cn'
import { createCampaign } from '@/lib/api/mutations'
import type { CampaignListItem } from '@/lib/api/types'

export function CampaignsClient({ slug, campaigns }: { slug: string; campaigns: CampaignListItem[] }) {
  const router = useRouter()
  const t = useTranslations('campaigns')
  const tc = useTranslations('common')
  const STATUS_META: Record<string, { label: string; tone: StatusTone }> = {
    planejada: { label: t('status_planejada'), tone: 'neutral' },
    ativa:     { label: t('status_ativa'),     tone: 'success' },
    concluida: { label: t('status_concluida'), tone: 'accent' },
    arquivada: { label: t('status_arquivada'), tone: 'neutral' },
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
            <label className={labelCls}>{t('context')}</label>
            <textarea rows={4} className={cn(fieldCls, 'py-3 resize-y')} placeholder={t('context_placeholder')} value={context} onChange={(e) => setContext(e.target.value)} />
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
            const meta = STATUS_META[c.status] ?? { label: c.status, tone: 'neutral' as StatusTone }
            return (
              <Link key={c.id} href={`/${slug}/campaigns/${c.id}`} className="group cursor-pointer">
                <GlassCard className="p-5 h-full uc-transition-fast hover:translate-y-[-2px] hover:shadow-[var(--uc-shadow-prisma)]">
                  <div className="flex items-center gap-2.5 mb-2">
                    <h3 className="text-base font-semibold text-[var(--uc-text)] truncate flex-1">{c.name}</h3>
                    <StatusBadge label={meta.label} tone={meta.tone} className="shrink-0" />
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
