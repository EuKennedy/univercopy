import { Topbar } from '@/components/shell'

import {
  getCategories,
  getFrameworks,
  getPieceTypes,
  getStyles,
  listCampaigns,
  listProducts,
} from '@/lib/api/queries'

import { GeneratorForm } from './generator-form'

type Props = { params: Promise<{ workspace_slug: string }> }

export default async function GeneratorPage({ params }: Props) {
  const { workspace_slug } = await params

  const [pieceTypes, styles, frameworks, categories, products, campaigns] = await Promise.all([
    getPieceTypes(),
    getStyles(),
    getFrameworks(),
    getCategories(),
    listProducts(workspace_slug).then((r) => r.products).catch(() => []),
    listCampaigns(workspace_slug).catch(() => []),
  ])

  return (
    <>
      <Topbar
        eyebrow="GERADOR"
        title="Gerador multicanal"
        description="DNA + estilo + framework + tipo de peça + brief → variações prontas pra escolher."
      />
      <div className="px-8 py-8 max-w-6xl mx-auto w-full">
        <GeneratorForm
          slug={workspace_slug}
          pieceTypes={pieceTypes}
          styles={styles}
          frameworks={frameworks}
          categories={categories}
          products={products.map((p) => ({ id: p.id, name: p.name }))}
          campaigns={campaigns.map((c) => ({ id: c.id, name: c.name }))}
        />
      </div>
    </>
  )
}
