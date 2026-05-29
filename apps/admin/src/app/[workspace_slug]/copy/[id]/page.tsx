import Link from 'next/link'
import { notFound } from 'next/navigation'

import { Icon, Topbar } from '@/components/shell'
import { ApiError } from '@/lib/api-client'
import { getCopy, getCopyVersions } from '@/lib/api/queries'

import { CopyEditor } from './copy-editor'

type Props = { params: Promise<{ workspace_slug: string; id: string }> }

export default async function CopyDetailPage({ params }: Props) {
  const { workspace_slug, id } = await params

  let copy
  let versions
  try {
    [copy, versions] = await Promise.all([
      getCopy(workspace_slug, id),
      getCopyVersions(workspace_slug, id),
    ])
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound()
    throw err
  }

  return (
    <>
      <Topbar
        eyebrow="ACERVO"
        title={copy.title}
        description="Edite o conteúdo, crie versões e mova pelo fluxo de aprovação."
        actions={
          <Link href={`/${workspace_slug}/copy`} className="text-sm text-[var(--uc-text-soft)] hover:text-[var(--uc-text)] inline-flex items-center gap-1.5">
            <Icon name="chevron-left" size={16} />Voltar ao acervo
          </Link>
        }
      />
      <div className="px-8 py-8 max-w-6xl mx-auto w-full">
        <CopyEditor slug={workspace_slug} copy={copy} versions={versions} />
      </div>
    </>
  )
}
