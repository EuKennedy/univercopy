import { getTranslations } from 'next-intl/server'

import { Topbar } from '@/components/shell'

import { BlogClient } from './blog-client'

type Props = { params: Promise<{ workspace_slug: string }> }

// Sem fetch bloqueante de propósito: listar categorias no WordPress da Lizzon
// leva ~6s (bootstrap do WP com 85 plugins ativos). O formulário abre na hora e
// o BlogClient preenche status + categorias depois da montagem.
export default async function BlogPage({ params }: Props) {
  const { workspace_slug } = await params
  const t = await getTranslations('blog')

  return (
    <>
      <Topbar eyebrow={t('eyebrow')} title={t('title')} description={t('description')} />
      <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-4xl mx-auto w-full">
        <BlogClient slug={workspace_slug} />
      </div>
    </>
  )
}
