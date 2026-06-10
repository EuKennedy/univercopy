import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

import { Icon, Topbar, type IconName } from '@/components/shell'
import { GlassButton, GlassCard, PageContainer, StatusBadge, type StatusTone } from '@/components/ui'
import { getOverview } from '@/lib/api/queries'
import { brl } from '@/lib/money'
import type { CopyStatus } from '@/lib/api/types'

type Props = { params: Promise<{ workspace_slug: string }> }

const STATUS_TONE: Record<CopyStatus, StatusTone> = {
  rascunho: 'neutral', revisao: 'warning', aprovado: 'success', publicado: 'accent', arquivado: 'neutral',
}

export default async function WorkspaceOverviewPage({ params }: Props) {
  const { workspace_slug } = await params
  const o = await getOverview(workspace_slug)
  const t = await getTranslations('dashboard')
  const ts = await getTranslations('status')

  const STATUS_LABEL: Record<CopyStatus, string> = {
    rascunho: ts('rascunho'), revisao: ts('revisao'), aprovado: ts('aprovado'), publicado: ts('publicado'), arquivado: ts('arquivado'),
  }

  const stats: { label: string; value: number; href: string; icon: IconName; color: string }[] = [
    { label: t('stat_copies'),            value: o.counts.copies,            href: `/${workspace_slug}/copy`,                 icon: 'copy',     color: 'var(--uc-brand-purple)' },
    { label: t('stat_in_review'),         value: o.counts.copies_revisao,    href: `/${workspace_slug}/copy?status=revisao`,  icon: 'check',    color: 'var(--uc-warn)' },
    { label: t('stat_campaigns'),         value: o.counts.campaigns,         href: `/${workspace_slug}/campaigns`,            icon: 'campaign', color: 'var(--uc-brand-blue)' },
    { label: t('stat_products'),          value: o.counts.products,          href: `/${workspace_slug}/products`,             icon: 'product',  color: '#06b6d4' },
    { label: t('stat_generations_month'), value: o.counts.generations_month, href: `/${workspace_slug}/generate`,             icon: 'spark',    color: 'var(--uc-success)' },
  ]

  return (
    <>
      <Topbar eyebrow={t('eyebrow')} title={o.workspace.name} description={t('description')} />

      <PageContainer>
        {/* Hero "criar" */}
        <GlassCard variant="strong" iridescent glow className="relative overflow-hidden p-6 sm:p-8">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full opacity-30 blur-3xl"
            style={{ background: 'radial-gradient(circle, var(--uc-brand-purple), transparent 70%)' }}
          />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-xl">
              <span
                className="mb-3 inline-flex size-11 items-center justify-center rounded-2xl text-white shadow-[0_8px_24px_-8px_rgba(139,92,246,0.6)]"
                style={{ background: 'linear-gradient(135deg, var(--uc-brand-purple), var(--uc-brand-blue))' }}
              >
                <Icon name="spark" size={22} />
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--uc-text)] leading-tight">{t('hero_title')}</h2>
              <p className="text-sm sm:text-[15px] leading-6 text-[var(--uc-text-soft)] mt-2">{t('hero_sub')}</p>
            </div>
            <div className="flex flex-wrap gap-2.5 shrink-0">
              <Link href={`/${workspace_slug}/generate`}>
                <GlassButton size="lg"><Icon name="spark" size={18} />{t('generateCopy')}</GlassButton>
              </Link>
              <Link href={`/${workspace_slug}/campaigns`}>
                <GlassButton size="lg" variant="secondary"><Icon name="campaign" size={18} />{t('cta_campaign')}</GlassButton>
              </Link>
            </div>
          </div>
        </GlassCard>

        {/* KPIs com ícone + cor */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
          {stats.map((s) => (
            <Link key={s.label} href={s.href} className="cursor-pointer">
              <GlassCard className="p-5 h-full uc-transition-fast hover:translate-y-[-2px] hover:shadow-[var(--uc-shadow-prisma)]">
                <span
                  className="mb-3 inline-flex size-9 items-center justify-center rounded-xl"
                  style={{ background: `color-mix(in srgb, ${s.color} 16%, transparent)`, color: s.color }}
                >
                  <Icon name={s.icon} size={18} />
                </span>
                <p className="text-3xl font-bold text-[var(--uc-text)] tracking-tight tabular-nums">{s.value}</p>
                <p className="text-xs text-[var(--uc-text-muted)] mt-1 uppercase tracking-wider">{s.label}</p>
              </GlassCard>
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          {/* Recentes */}
          <div className="space-y-3">
            <p className="text-xs font-semibold tracking-wide uppercase text-[var(--uc-text-muted)]">{t('recent_copies')}</p>
            {o.recent_copies.length === 0 ? (
              <GlassCard variant="strong" iridescent className="p-10 flex flex-col items-center text-center gap-4">
                <span className="flex items-center justify-center size-14 rounded-2xl text-white" style={{ background: 'linear-gradient(135deg, var(--uc-brand-purple) 0%, var(--uc-brand-blue) 100%)' }}>
                  <Icon name="spark" size={26} />
                </span>
                <div className="space-y-1.5 max-w-sm">
                  <h3 className="text-lg font-bold text-[var(--uc-text)]">{t('empty_title')}</h3>
                  <p className="text-sm leading-6 text-[var(--uc-text-soft)]">{t('empty_description')}</p>
                </div>
                <Link href={`/${workspace_slug}/generate`}><GlassButton size="lg">{t('open_generator')}</GlassButton></Link>
              </GlassCard>
            ) : (
              <div className="space-y-2">
                {o.recent_copies.map((c) => (
                  <Link key={c.id} href={`/${workspace_slug}/copy/${c.id}`} className="group cursor-pointer block">
                    <GlassCard className="p-4 flex items-center justify-between gap-3 uc-transition-fast hover:translate-y-[-2px] hover:shadow-[var(--uc-shadow-prisma)]">
                      <span className="text-sm font-semibold text-[var(--uc-text)] truncate">{c.title}</span>
                      <span className="flex items-center gap-2 shrink-0">
                        <StatusBadge label={STATUS_LABEL[c.status]} tone={STATUS_TONE[c.status]} />
                        <Icon name="chevron-right" size={16} className="text-[var(--uc-text-faint)] group-hover:text-[var(--uc-text)]" />
                      </span>
                    </GlassCard>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Custo + DNA */}
          <div className="space-y-4">
            <GlassCard className="p-6 space-y-3">
              <p className="text-xs font-semibold tracking-wide uppercase text-[var(--uc-text-muted)]">{t('ai_cost_month')}</p>
              <p className="text-2xl font-bold text-[var(--uc-text)] tabular-nums">
                {brl(o.cost.used_usd)}
                {o.cost.limit_usd != null && <span className="text-sm font-normal text-[var(--uc-text-muted)]"> / {brl(o.cost.limit_usd)}</span>}
              </p>
              {o.cost.percent != null && (
                <div className="h-2 rounded-full bg-[var(--uc-bg-mute)] overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(o.cost.percent, 100)}%`, background: 'linear-gradient(90deg, var(--uc-brand-purple), var(--uc-brand-blue))' }} />
                </div>
              )}
              <p className="text-xs text-[var(--uc-text-muted)] capitalize">{t('plan', { plan: o.workspace.plan })}</p>
            </GlassCard>

            <Link href={`/${workspace_slug}/settings/dna`}>
              <GlassCard className="p-5 uc-transition-fast hover:translate-y-[-2px] hover:shadow-[var(--uc-shadow-prisma)] cursor-pointer flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-xl shrink-0" style={{ background: 'var(--uc-accent-soft-2)', color: 'var(--uc-accent)' }}>
                  <Icon name="sparkle" size={18} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--uc-text)] first-letter:capitalize truncate">{t('dna_in_use', { kind: o.dna_in_use })}</p>
                  <p className="text-xs text-[var(--uc-text-muted)]">{t('edit_or_switch')}</p>
                </div>
                <Icon name="chevron-right" size={16} className="ml-auto text-[var(--uc-text-faint)] shrink-0" />
              </GlassCard>
            </Link>
          </div>
        </div>
      </PageContainer>
    </>
  )
}
