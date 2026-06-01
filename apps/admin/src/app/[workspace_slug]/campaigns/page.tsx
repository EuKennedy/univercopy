import { getTranslations } from 'next-intl/server'

import { Topbar } from '@/components/shell'
import { listCampaigns } from '@/lib/api/queries'

import { CampaignsClient } from './campaigns-client'

type Props = { params: Promise<{ workspace_slug: string }> }

export default async function CampaignsPage({ params }: Props) {
  const { workspace_slug } = await params
  const campaigns = await listCampaigns(workspace_slug)
  const t = await getTranslations('campaigns')

  return (
    <>
      <Topbar
        eyebrow={t('eyebrow')}
        title={t('title')}
        description={t('description')}
      />
      <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-6xl mx-auto w-full">
        <CampaignsClient slug={workspace_slug} campaigns={campaigns} />
      </div>
    </>
  )
}
