import { getTranslations } from 'next-intl/server'

import { Topbar } from '@/components/shell'
import { listPageAudits } from '@/lib/api/queries'

import { AuditClient } from './audit-client'

type Props = { params: Promise<{ workspace_slug: string }> }

export default async function AuditPage({ params }: Props) {
  const { workspace_slug } = await params
  const audits = await listPageAudits(workspace_slug).catch(() => [])
  const t = await getTranslations('audit')

  return (
    <>
      <Topbar
        eyebrow={t('eyebrow')}
        title={t('title')}
        description={t('description')}
      />
      <div className="px-8 py-8 max-w-6xl mx-auto w-full">
        <AuditClient slug={workspace_slug} initial={audits} />
      </div>
    </>
  )
}
