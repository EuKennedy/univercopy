import Link from 'next/link'

import { Icon, Topbar } from '@/components/shell'
import { GlassButton, GlassCard } from '@/components/ui'
import { listProducts } from '@/lib/api/queries'

type Props = {
  params: Promise<{ workspace_slug: string }>
  searchParams: Promise<{ q?: string }>
}

function formatPrice(v: number | null): string | null {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n.toFixed(2) : null
}

export default async function ProductsPage({ params, searchParams }: Props) {
  const { workspace_slug } = await params
  const { q } = await searchParams

  let products: Awaited<ReturnType<typeof listProducts>>['products'] = []
  let total = 0
  try {
    const res = await listProducts(workspace_slug, q ? { q } : undefined)
    products = res.products
    total = res.total
  } catch {
    return (
      <>
        <Topbar eyebrow="CATÁLOGO" title="Produtos" description="Catálogo sincronizado da sua loja." />
        <div className="px-8 py-8 max-w-6xl mx-auto w-full">
          <GlassCard className="p-8 text-center text-sm text-[var(--uc-text-soft)]">
            Não foi possível carregar o catálogo agora. Tente recarregar em instantes.
          </GlassCard>
        </div>
      </>
    )
  }

  return (
    <>
      <Topbar
        eyebrow="CATÁLOGO"
        title="Produtos"
        description="Catálogo sincronizado da sua loja. Use no gerador pra escrever descrições respeitando o DNA."
        actions={total > 0 ? <span className="text-sm text-[var(--uc-text-muted)]">{total} produtos</span> : undefined}
      />
      <div className="px-8 py-8 max-w-6xl mx-auto w-full space-y-6">
        {total === 0 ? (
          <GlassCard variant="strong" iridescent className="p-12 flex flex-col items-center text-center gap-5">
            <span className="flex items-center justify-center size-14 rounded-2xl text-white" style={{ background: 'linear-gradient(135deg, var(--uc-brand-purple) 0%, var(--uc-brand-blue) 100%)' }}>
              <Icon name="product" size={26} />
            </span>
            <div className="space-y-1.5 max-w-sm">
              <h3 className="text-xl font-bold text-[var(--uc-text)]">Nenhum produto sincronizado</h3>
              <p className="text-sm leading-6 text-[var(--uc-text-soft)]">
                Conecte sua loja WooCommerce pra puxar o catálogo. A IA respeita o DNA + Q&A do onboarding em cada descrição.
              </p>
            </div>
            <Link href={`/${workspace_slug}/settings/integrations`}>
              <GlassButton size="lg"><Icon name="product" size={18} />Conectar loja</GlassButton>
            </Link>
          </GlassCard>
        ) : (
          <>
            <form className="flex gap-2" action={`/${workspace_slug}/products`}>
              <input
                name="q"
                defaultValue={q ?? ''}
                placeholder="Buscar por nome ou SKU…"
                className="flex-1 h-11 px-4 rounded-2xl uc-glass text-[15px] text-[var(--uc-text)] outline-none focus:border-[var(--uc-accent-ring)] focus:shadow-[0_0_0_4px_var(--uc-accent-soft-2)]"
              />
              <GlassButton size="md" variant="secondary" type="submit">Buscar</GlassButton>
            </form>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {products.map((p) => (
                <GlassCard key={p.id} className="p-4 flex flex-col gap-3">
                  <div className="aspect-[4/3] rounded-xl overflow-hidden bg-[var(--uc-bg-mute)] flex items-center justify-center">
                    {p.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.image} alt={p.name} className="size-full object-cover" />
                    ) : (
                      <Icon name="product" size={28} className="text-[var(--uc-text-faint)]" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-[var(--uc-text)] line-clamp-2">{p.name}</h3>
                    <div className="flex items-center gap-2 mt-1.5 text-xs text-[var(--uc-text-muted)]">
                      {formatPrice(p.price) && <span className="text-[var(--uc-text)] font-semibold">R$ {formatPrice(p.price)}</span>}
                      {p.sku && <span>· {p.sku}</span>}
                    </div>
                  </div>
                  <Link href={`/${workspace_slug}/generate`} className="mt-auto">
                    <GlassButton size="sm" variant="secondary" className="w-full"><Icon name="spark" size={14} />Gerar descrição</GlassButton>
                  </Link>
                </GlassCard>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  )
}
