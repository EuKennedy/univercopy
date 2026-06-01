import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

import { Icon, Topbar } from '@/components/shell'
import { GlassButton, GlassCard } from '@/components/ui'
import { listProducts } from '@/lib/api/queries'

type Props = {
  params: Promise<{ workspace_slug: string }>
  searchParams: Promise<{ q?: string; source?: string }>
}

const SOURCE_LABEL: Record<string, string> = {
  woocommerce: 'WooCommerce',
  shopify: 'Shopify',
  nuvemshop: 'Nuvemshop',
  tray: 'Tray',
  csv: 'CSV',
  site: 'Site',
  manual: 'Manual',
}

function formatPrice(v: number | null): string | null {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n.toFixed(2) : null
}

export default async function ProductsPage({ params, searchParams }: Props) {
  const { workspace_slug } = await params
  const { q, source } = await searchParams
  const t = await getTranslations('products')

  let products: Awaited<ReturnType<typeof listProducts>>['products'] = []
  let total = 0
  try {
    const res = await listProducts(workspace_slug, { q, source })
    products = res.products
    total = res.total
  } catch {
    return (
      <>
        <Topbar eyebrow={t('eyebrow')} title={t('title')} description={t('description_short')} />
        <div className="px-8 py-8 max-w-6xl mx-auto w-full">
          <GlassCard className="p-8 text-center text-sm text-[var(--uc-text-soft)]">
            {t('load_error')}
          </GlassCard>
        </div>
      </>
    )
  }

  // Origens presentes no catálogo (pra montar os filtros só com o que existe).
  const sources = Array.from(new Set(products.map((p) => p.source)))

  return (
    <>
      <Topbar
        eyebrow={t('eyebrow')}
        title={t('title')}
        description={t('description')}
        actions={total > 0 ? <span className="text-sm text-[var(--uc-text-muted)]">{t('count', { count: total })}</span> : undefined}
      />
      <div className="px-8 py-8 max-w-6xl mx-auto w-full space-y-5">
        {total === 0 && !q && !source ? (
          <GlassCard variant="strong" iridescent className="p-12 flex flex-col items-center text-center gap-5">
            <span className="flex items-center justify-center size-14 rounded-2xl text-white" style={{ background: 'linear-gradient(135deg, var(--uc-brand-purple) 0%, var(--uc-brand-blue) 100%)' }}>
              <Icon name="product" size={26} />
            </span>
            <div className="space-y-1.5 max-w-sm">
              <h3 className="text-xl font-bold text-[var(--uc-text)]">{t('empty_title')}</h3>
              <p className="text-sm leading-6 text-[var(--uc-text-soft)]">
                {t('empty_description')}
              </p>
            </div>
            <Link href={`/${workspace_slug}/settings/integrations`}>
              <GlassButton size="lg"><Icon name="product" size={18} />{t('connect_store')}</GlassButton>
            </Link>
          </GlassCard>
        ) : (
          <>
            {/* Busca + filtro de origem */}
            <form className="flex flex-wrap gap-2 items-center" action={`/${workspace_slug}/products`}>
              <div className="relative flex-1 min-w-[220px]">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--uc-text-faint)]"><Icon name="audit" size={16} /></span>
                <input
                  name="q"
                  defaultValue={q ?? ''}
                  placeholder={t('search_placeholder')}
                  className="w-full h-11 pl-10 pr-4 rounded-2xl uc-glass text-[15px] text-[var(--uc-text)] outline-none focus:border-[var(--uc-accent-ring)] focus:shadow-[0_0_0_4px_var(--uc-accent-soft-2)]"
                />
              </div>
              {sources.length > 1 && (
                <select
                  name="source"
                  defaultValue={source ?? ''}
                  className="h-11 px-4 rounded-2xl uc-glass text-[15px] text-[var(--uc-text)] outline-none cursor-pointer focus:border-[var(--uc-accent-ring)]"
                >
                  <option value="">{t('all_sources')}</option>
                  {sources.map((s) => <option key={s} value={s}>{SOURCE_LABEL[s] ?? s}</option>)}
                </select>
              )}
              <GlassButton size="md" variant="secondary" type="submit">{t('search')}</GlassButton>
            </form>

            {products.length === 0 ? (
              <GlassCard className="p-8 text-center text-sm text-[var(--uc-text-soft)]">
                {t('not_found', { q: q ?? '' })}
              </GlassCard>
            ) : (
              <GlassCard className="overflow-hidden p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--uc-border)] text-left">
                        <th className="font-semibold text-[var(--uc-text-muted)] uppercase tracking-wider text-[11px] px-5 py-3">{t('col_product')}</th>
                        <th className="font-semibold text-[var(--uc-text-muted)] uppercase tracking-wider text-[11px] px-4 py-3 hidden md:table-cell">{t('col_categories')}</th>
                        <th className="font-semibold text-[var(--uc-text-muted)] uppercase tracking-wider text-[11px] px-4 py-3">{t('col_price')}</th>
                        <th className="font-semibold text-[var(--uc-text-muted)] uppercase tracking-wider text-[11px] px-4 py-3 hidden sm:table-cell">{t('col_source')}</th>
                        <th className="px-5 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((p) => (
                        <tr key={p.id} className="border-b border-[var(--uc-border-soft)] last:border-0 uc-transition-fast hover:bg-[var(--uc-surface-soft)]">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="size-10 shrink-0 rounded-lg overflow-hidden bg-[var(--uc-bg-mute)] flex items-center justify-center">
                                {p.image ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={p.image} alt="" className="size-full object-cover" />
                                ) : (
                                  <Icon name="product" size={16} className="text-[var(--uc-text-faint)]" />
                                )}
                              </span>
                              <div className="min-w-0">
                                <p className="font-medium text-[var(--uc-text)] truncate max-w-[280px]">{p.name}</p>
                                {p.sku && <p className="text-xs text-[var(--uc-text-faint)] truncate">SKU {p.sku}</p>}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell text-[var(--uc-text-muted)] text-xs">
                            {Array.isArray(p.categories) && p.categories.length > 0 ? p.categories.slice(0, 2).join(', ') : '—'}
                          </td>
                          <td className="px-4 py-3 font-semibold text-[var(--uc-text)] whitespace-nowrap">
                            {formatPrice(p.price) ? `R$ ${formatPrice(p.price)}` : '—'}
                          </td>
                          <td className="px-4 py-3 hidden sm:table-cell">
                            <span className="text-[11px] font-semibold rounded-full px-2 py-0.5 bg-[var(--uc-accent-soft)] text-[var(--uc-accent)]">
                              {SOURCE_LABEL[p.source] ?? p.source}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-right whitespace-nowrap">
                            <span className="inline-flex gap-2">
                              <Link href={`/${workspace_slug}/products/${p.id}`}>
                                <GlassButton size="sm"><Icon name="product" size={14} />{t('edit')}</GlassButton>
                              </Link>
                              <Link href={`/${workspace_slug}/generate?product=${p.id}`}>
                                <GlassButton size="sm" variant="secondary"><Icon name="spark" size={14} />{t('copy')}</GlassButton>
                              </Link>
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </GlassCard>
            )}
          </>
        )}
      </div>
    </>
  )
}
