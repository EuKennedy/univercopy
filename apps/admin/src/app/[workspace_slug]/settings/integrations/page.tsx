import { Icon, Topbar } from '@/components/shell'
import { GlassCard } from '@/components/ui'

type Props = { params: Promise<{ workspace_slug: string }> }

const CONNECTORS = [
  { key: 'woocommerce', name: 'WooCommerce', desc: 'API REST v3 (BasicAuth com consumer key/secret). Sync catálogo + publish back.', plans: ['entry', 'medium', 'ultra'], available: true },
  { key: 'csv',         name: 'CSV import',  desc: 'Upload em planilha — Magento, Tray, Loja Integrada, plataformas próprias.',     plans: ['entry', 'medium', 'ultra'], available: true },
  { key: 'shopify',     name: 'Shopify',     desc: 'Shopify Admin API + OAuth. Catálogo, metafields e publish.',                    plans: ['medium', 'ultra'],          available: false },
  { key: 'nuvemshop',   name: 'Nuvemshop',   desc: 'REST + OAuth. Plataforma BR mais usada depois do Woo.',                         plans: ['ultra'],                    available: false },
  { key: 'tray',        name: 'Tray',        desc: 'REST + OAuth. Integra catálogo, pedidos e categorias.',                         plans: ['ultra'],                    available: false },
]

export default async function IntegrationsPage({ params }: Props) {
  await params

  return (
    <>
      <Topbar
        eyebrow="CONECTORES"
        title="Integrações com lojas"
        description="Sincroniza catálogo e publica de volta com 1 clique. Credenciais cifradas com MessageEncryptor (TENANT_CREDENTIALS_KEY)."
      />
      <div className="px-8 py-10 max-w-5xl mx-auto space-y-4">
        {CONNECTORS.map((c) => (
          <GlassCard key={c.key} className="p-6 flex flex-wrap items-center gap-5 justify-between">
            <div className="flex items-start gap-4 min-w-0">
              <span
                className="size-12 rounded-xl flex items-center justify-center text-white shrink-0 shadow-[0_8px_22px_-8px_var(--uc-accent-glow)]"
                style={{ background: 'linear-gradient(135deg, var(--uc-brand-purple) 0%, var(--uc-brand-blue) 100%)' }}
                aria-hidden
              >
                <Icon name="product" size={22} />
              </span>
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg font-semibold tracking-tight text-[var(--uc-text)]">
                    {c.name}
                  </h3>
                  {!c.available && (
                    <span className="text-[10px] font-bold tracking-wider uppercase rounded-full px-2 py-0.5 bg-[var(--uc-surface-2)] text-[var(--uc-text-muted)] border border-[var(--uc-border)]">
                      em breve
                    </span>
                  )}
                </div>
                <p className="text-sm leading-6 text-[var(--uc-text-soft)] max-w-xl">{c.desc}</p>
                <p className="text-xs text-[var(--uc-text-muted)] uppercase tracking-wider">
                  Plano: {c.plans.join(', ')}
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={!c.available}
              className="px-5 py-2.5 rounded-2xl text-sm font-semibold text-white uc-transition-fast cursor-pointer shadow-[0_12px_32px_-12px_rgba(139,92,246,0.5)] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
              style={c.available ? { background: 'linear-gradient(135deg, var(--uc-brand-purple) 0%, var(--uc-brand-blue) 100%)' } : { background: 'var(--uc-surface-2)' }}
            >
              {c.available ? 'Conectar' : 'Em breve'}
            </button>
          </GlassCard>
        ))}
      </div>
    </>
  )
}
