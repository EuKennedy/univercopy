import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'

import { Icon, Topbar } from '@/components/shell'
import { ApiError } from '@/lib/api-client'
import { getProduct } from '@/lib/api/queries'

import { ProductEditor } from './product-editor'

type Props = { params: Promise<{ workspace_slug: string; id: string }> }

export default async function ProductDetailPage({ params }: Props) {
  const { workspace_slug, id } = await params
  const t = await getTranslations('products')

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
        eyebrow={t('detail_eyebrow')}
        title={product.name}
        description={t('detail_description')}
        actions={
          <Link href={`/${workspace_slug}/products`} className="text-sm text-[var(--uc-text-soft)] hover:text-[var(--uc-text)] inline-flex items-center gap-1.5">
            <Icon name="chevron-left" size={16} />{t('catalog')}
          </Link>
        }
      />
      <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-6xl mx-auto w-full">
        <ProductEditor slug={workspace_slug} product={product} />
      </div>
    </>
  )
}
