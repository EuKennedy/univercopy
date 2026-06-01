import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

import { Icon, Topbar } from '@/components/shell'
import { GlassCard } from '@/components/ui'
import { getPlan } from '@/lib/api/queries'
import { brl } from '@/lib/money'

type Props = { params: Promise<{ workspace_slug: string }> }

export default async function BillingPage({ params }: Props) {
  const { workspace_slug } = await params
  const { snapshot, cost, usage } = await getPlan(workspace_slug)
  const t = await getTranslations('billing')
  const ts = await getTranslations('settings')

  const FEATURE_LABEL: Record<string, string> = {
    ai_generate: t('feat_ai_generate'),
    ai_dna_extract: t('feat_ai_dna_extract'),
    ai_dna_improve: t('feat_ai_dna_improve'),
    ai_name_generator: t('feat_ai_name_generator'),
    ai_seo_geo: t('feat_ai_seo_geo'),
    ai_page_audit: t('feat_ai_page_audit'),
    ai_intelligence: t('feat_ai_intelligence'),
    campaigns: t('feat_campaigns'),
    connector_woo: t('feat_connector_woo'),
    connector_csv: t('feat_connector_csv'),
    connector_shopify: t('feat_connector_shopify'),
    connector_nuvemshop: t('feat_connector_nuvemshop'),
    connector_tray: t('feat_connector_tray'),
    multi_user: t('feat_multi_user'),
    audit_log_api: t('feat_audit_log_api'),
    priority_support: t('feat_priority_support'),
  }

  return (
    <>
      <Topbar
        eyebrow={t('eyebrow')}
        title={t('title')}
        description={t('description')}
        actions={
          <Link href={`/${workspace_slug}/settings`} className="text-sm text-[var(--uc-text-soft)] hover:text-[var(--uc-text)] inline-flex items-center gap-1.5">
            <Icon name="chevron-left" size={16} />{ts('back')}
          </Link>
        }
      />
      <div className="px-8 py-8 max-w-6xl mx-auto w-full space-y-5">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
          {/* Recursos */}
          <GlassCard className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-[var(--uc-text)]">{t('plan_features')}</h3>
              <span className="text-[11px] font-bold uppercase tracking-wider rounded-full px-3 py-1 bg-[var(--uc-accent-soft)] text-[var(--uc-accent)] capitalize">
                {snapshot.plan}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
              {Object.entries(snapshot.features).map(([key, on]) => (
                <div key={key} className="flex items-center gap-2 text-sm">
                  <span className={on ? 'text-emerald-400' : 'text-[var(--uc-text-faint)]'}>
                    {on ? '✓' : '—'}
                  </span>
                  <span className={on ? 'text-[var(--uc-text)]' : 'text-[var(--uc-text-faint)] line-through'}>
                    {FEATURE_LABEL[key] ?? key}
                  </span>
                </div>
              ))}
            </div>
          </GlassCard>

          {/* Custo + uso */}
          <div className="space-y-4">
            <GlassCard className="p-6 space-y-3">
              <p className="text-xs font-semibold tracking-wide uppercase text-[var(--uc-text-muted)]">{t('ai_cost_month')}</p>
              <p className="text-2xl font-bold text-[var(--uc-text)]">
                {brl(cost.used_usd)}
                {cost.limit_usd != null && <span className="text-sm font-normal text-[var(--uc-text-muted)]"> / {brl(cost.limit_usd)}</span>}
              </p>
              {cost.percent != null && (
                <div className="h-2 rounded-full bg-[var(--uc-bg-mute)] overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(cost.percent, 100)}%`, background: 'linear-gradient(90deg, var(--uc-brand-purple), var(--uc-brand-blue))' }} />
                </div>
              )}
            </GlassCard>
            <GlassCard className="p-6 space-y-2.5 text-sm">
              <Row label={t('row_generations')} value={usage.generations_month} />
              <Row label={t('row_copies')} value={usage.copies} />
              <Row label={t('row_products')} value={usage.products} />
              <Row label={t('row_members')} value={usage.members} />
            </GlassCard>
          </div>
        </div>

        <p className="text-xs text-[var(--uc-text-muted)] leading-5">
          {t('footnote')}
        </p>
      </div>
    </>
  )
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between">
      <span className="text-[var(--uc-text-muted)]">{label}</span>
      <span className="text-[var(--uc-text)] font-semibold">{value}</span>
    </div>
  )
}
