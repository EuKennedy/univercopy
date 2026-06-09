import { getTranslations } from 'next-intl/server'

import { Topbar } from '@/components/shell'

import {
  getChannels,
  getFrameworks,
  getPieceTypes,
  getStyles,
  listCampaigns,
  listProducts,
} from '@/lib/api/queries'

import { GeneratorForm } from './generator-form'

type Props = {
  params: Promise<{ workspace_slug: string }>
  searchParams: Promise<{ product?: string }>
}

export default async function GeneratorPage({ params, searchParams }: Props) {
  const { workspace_slug } = await params
  const { product } = await searchParams
  const t = await getTranslations('generate')

  const [pieceTypes, styles, frameworks, channels, products, campaigns] = await Promise.all([
    getPieceTypes(),
    getStyles(),
    getFrameworks(),
    getChannels().catch(() => []),
    listProducts(workspace_slug).then((r) => r.products).catch(() => []),
    listCampaigns(workspace_slug).catch(() => []),
  ])

  return (
    <>
      <Topbar
        eyebrow={t('eyebrow')}
        title={t('title')}
        description={t('description')}
      />
      <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-6xl mx-auto w-full">
        <GeneratorForm
          slug={workspace_slug}
          pieceTypes={pieceTypes}
          styles={styles}
          frameworks={frameworks}
          channels={channels}
          products={products.map((p) => ({ id: p.id, name: p.name }))}
          campaigns={campaigns.map((c) => ({ id: c.id, name: c.name }))}
          initialProductId={product ?? ''}
        />
      </div>
    </>
  )
}
