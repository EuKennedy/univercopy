import { Topbar } from '@/components/shell'
import { listCampaigns } from '@/lib/api/queries'

import { CampaignsClient } from './campaigns-client'

type Props = { params: Promise<{ workspace_slug: string }> }

export default async function CampaignsPage({ params }: Props) {
  const { workspace_slug } = await params
  const campaigns = await listCampaigns(workspace_slug)

  return (
    <>
      <Topbar
        eyebrow="CAMPANHAS"
        title="Campanhas"
        description="Agrupe peças por evento ou lançamento. Cada uma com objetivo, audiência e contexto que alimenta a IA."
      />
      <div className="px-8 py-8 max-w-6xl mx-auto w-full">
        <CampaignsClient slug={workspace_slug} campaigns={campaigns} />
      </div>
    </>
  )
}
