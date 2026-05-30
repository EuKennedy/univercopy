import Link from 'next/link'

import { Icon, Topbar } from '@/components/shell'
import { GlassCard } from '@/components/ui'
import { getPlan } from '@/lib/api/queries'

type Props = { params: Promise<{ workspace_slug: string }> }

const FEATURE_LABEL: Record<string, string> = {
  ai_generate: 'Gerador de copy',
  ai_dna_extract: 'Extrair DNA',
  ai_dna_improve: 'Melhorar DNA',
  ai_name_generator: 'Gerador de nomes',
  ai_seo_geo: 'SEO/GEO',
  ai_page_audit: 'Análise de página',
  ai_intelligence: 'Inteligência competitiva',
  campaigns: 'Campanhas',
  connector_woo: 'WooCommerce',
  connector_csv: 'CSV',
  connector_shopify: 'Shopify',
  connector_nuvemshop: 'Nuvemshop',
  connector_tray: 'Tray',
  multi_user: 'Multiusuário',
  audit_log_api: 'Log de auditoria',
  priority_support: 'Suporte prioritário',
}

export default async function BillingPage({ params }: Props) {
  const { workspace_slug } = await params
  const { snapshot, cost, usage } = await getPlan(workspace_slug)

  return (
    <>
      <Topbar
        eyebrow="PLANO"
        title="Plano & uso"
        description="Plano atual, recursos liberados e consumo de IA no mês."
        actions={
          <Link href={`/${workspace_slug}/settings`} className="text-sm text-[var(--uc-text-soft)] hover:text-[var(--uc-text)] inline-flex items-center gap-1.5">
            <Icon name="chevron-left" size={16} />Configurações
          </Link>
        }
      />
      <div className="px-8 py-8 max-w-6xl mx-auto w-full space-y-5">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
          {/* Recursos */}
          <GlassCard className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-[var(--uc-text)]">Recursos do plano</h3>
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
              <p className="text-xs font-semibold tracking-wide uppercase text-[var(--uc-text-muted)]">Custo de IA no mês</p>
              <p className="text-2xl font-bold text-[var(--uc-text)]">
                US$ {cost.used_usd.toFixed(2)}
                {cost.limit_usd != null && <span className="text-sm font-normal text-[var(--uc-text-muted)]"> / {cost.limit_usd.toFixed(0)}</span>}
              </p>
              {cost.percent != null && (
                <div className="h-2 rounded-full bg-[var(--uc-bg-mute)] overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(cost.percent, 100)}%`, background: 'linear-gradient(90deg, var(--uc-brand-purple), var(--uc-brand-blue))' }} />
                </div>
              )}
            </GlassCard>
            <GlassCard className="p-6 space-y-2.5 text-sm">
              <Row label="Gerações no mês" value={usage.generations_month} />
              <Row label="Copies" value={usage.copies} />
              <Row label="Produtos" value={usage.products} />
              <Row label="Membros" value={usage.members} />
            </GlassCard>
          </div>
        </div>

        <p className="text-xs text-[var(--uc-text-muted)] leading-5">
          Mudança de plano e cobrança são processadas pelo gateway externo. Fale com o suporte para upgrade.
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
