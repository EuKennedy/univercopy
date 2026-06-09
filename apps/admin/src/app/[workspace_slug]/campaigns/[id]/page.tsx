import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'

import { Topbar } from '@/components/shell'
import { GlassCard } from '@/components/ui'
import { ApiError } from '@/lib/api-client'
import { getCampaign, getChannels } from '@/lib/api/queries'

import { CampaignWorkspace } from './campaign-workspace'

type Props = { params: Promise<{ workspace_slug: string; id: string }> }

export default async function CampaignDetailPage({ params }: Props) {
  const { workspace_slug, id } = await params
  const t = await getTranslations('campaigns')

  let data
  try {
    data = await getCampaign(workspace_slug, id)
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound()
    throw err
  }
  const channels = await getChannels().catch(() => [])

  const { campaign, sequences } = data
  const statusKeys = ['planejada', 'ativa', 'concluida', 'arquivada']
  const statusLabel = statusKeys.includes(campaign.status) ? t(`status_${campaign.status}`) : campaign.status

  return (
    <>
      <Topbar
        eyebrow={t('detail_eyebrow')}
        title={campaign.name}
        description={campaign.objective ?? t('no_objective')}
      />
      <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
        <CampaignWorkspace
          slug={workspace_slug}
          campaignId={id}
          channels={channels}
          sequences={sequences}
        />

        <GlassCard className="p-6 space-y-3 h-fit">
          <Field label={t('field_status')} value={statusLabel} />
          <Field label={t('field_audience')} value={campaign.audience} />
          <Field label={t('field_starts')} value={campaign.starts_at} />
          <Field label={t('field_ends')} value={campaign.ends_at} />
          {campaign.context && (
            <div className="pt-2">
              <p className="text-xs font-semibold tracking-wide uppercase text-[var(--uc-text-muted)] mb-1.5">{t('field_context')}</p>
              <p className="text-sm leading-6 text-[var(--uc-text-soft)] whitespace-pre-wrap">{campaign.context}</p>
            </div>
          )}
        </GlassCard>
      </div>
    </>
  )
}

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-[var(--uc-text-muted)]">{label}</span>
      <span className="text-[var(--uc-text)] font-medium">{value}</span>
    </div>
  )
}
