import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

import { Icon, Topbar } from '@/components/shell'
import { GlassButton, GlassCard } from '@/components/ui'
import { getOverview } from '@/lib/api/queries'
import { brl } from '@/lib/money'
import type { CopyStatus } from '@/lib/api/types'

type Props = { params: Promise<{ workspace_slug: string }> }

export default async function WorkspaceOverviewPage({ params }: Props) {
  const { workspace_slug } = await params
  const o = await getOverview(workspace_slug)
  const t = await getTranslations('dashboard')
  const ts = await getTranslations('status')

  const STATUS_LABEL: Record<CopyStatus, string> = {
    rascunho: ts('rascunho'), revisao: ts('revisao'), aprovado: ts('aprovado'), publicado: ts('publicado'), arquivado: ts('arquivado'),
  }

  const stats = [
    { label: t('stat_copies'), value: o.counts.copies, href: `/${workspace_slug}/copy` },
    { label: t('stat_in_review'), value: o.counts.copies_revisao, href: `/${workspace_slug}/copy?status=revisao` },
    { label: t('stat_campaigns'), value: o.counts.campaigns, href: `/${workspace_slug}/campaigns` },
    { label: t('stat_products'), value: o.counts.products, href: `/${workspace_slug}/products` },
    { label: t('stat_generations_month'), value: o.counts.generations_month, href: `/${workspace_slug}/generate` },
  ]

  return (
    <>
      <Topbar
        eyebrow={t('eyebrow')}
        title={o.workspace.name}
        description={t('description')}
        actions={
          <Link href={`/${workspace_slug}/generate`}>
            <GlassButton size="sm"><Icon name="spark" size={16} />{t('generateCopy')}</GlassButton>
          </Link>
        }
      />

      <div className="px-4 sm:px-6 lg:px-8 py-8 space-y-6 max-w-6xl mx-auto w-full">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
          {stats.map((s) => (
            <Link key={s.label} href={s.href} className="cursor-pointer">
              <GlassCard className="p-5 uc-transition-fast hover:translate-y-[-2px] hover:shadow-[var(--uc-shadow-prisma)]">
                <p className="text-3xl font-bold text-[var(--uc-text)] tracking-tight">{s.value}</p>
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
                    <GlassCard className="p-4 flex items-center justify-between gap-3 uc-transition-fast hover:translate-y-[-2px]">
                      <span className="text-sm font-semibold text-[var(--uc-text)] truncate">{c.title}</span>
                      <span className="text-xs text-[var(--uc-text-muted)] shrink-0">{STATUS_LABEL[c.status]}</span>
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
              <p className="text-2xl font-bold text-[var(--uc-text)]">
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
              <GlassCard className="p-5 uc-transition-fast hover:translate-y-[-2px] cursor-pointer flex items-center gap-3">
                <Icon name="sparkle" size={18} className="text-[var(--uc-accent)]" />
                <div>
                  <p className="text-sm font-semibold text-[var(--uc-text)] first-letter:capitalize">{t('dna_in_use', { kind: o.dna_in_use })}</p>
                  <p className="text-xs text-[var(--uc-text-muted)]">{t('edit_or_switch')}</p>
                </div>
              </GlassCard>
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
