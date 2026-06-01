import Link from 'next/link'
import { notFound } from 'next/navigation'

import { Icon, Topbar } from '@/components/shell'
import { ApiError } from '@/lib/api-client'
import { getProduct } from '@/lib/api/queries'

import { ProductEditor } from './product-editor'

type Props = { params: Promise<{ workspace_slug: string; id: string }> }

export default async function ProductDetailPage({ params }: Props) {
  const { workspace_slug, id } = await params

  let product
  try {
    product = await getProduct(workspace_slug, id)
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound()
    throw err
  }

  return (
    <>
      <Topbar
        eyebrow="PRODUTO"
        title={product.name}
        description="Edite todos os campos do produto e publique direto no WooCommerce. Cada campo tem geração com IA."
        actions={
          <Link href={`/${workspace_slug}/products`} className="text-sm text-[var(--uc-text-soft)] hover:text-[var(--uc-text)] inline-flex items-center gap-1.5">
            <Icon name="chevron-left" size={16} />Catálogo
          </Link>
        }
      />
      <div className="px-8 py-8 max-w-6xl mx-auto w-full">
        <ProductEditor slug={workspace_slug} product={product} />
      </div>
    </>
  )
}
