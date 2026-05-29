import Link from 'next/link'
import { notFound } from 'next/navigation'

import { Icon, Topbar } from '@/components/shell'
import { GlassButton, GlassCard } from '@/components/ui'
import { ApiError } from '@/lib/api-client'
import { getCampaign } from '@/lib/api/queries'

type Props = { params: Promise<{ workspace_slug: string; id: string }> }

export default async function CampaignDetailPage({ params }: Props) {
  const { workspace_slug, id } = await params

  let data
  try {
    data = await getCampaign(workspace_slug, id)
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound()
    throw err
  }

  const { campaign, copies } = data

  return (
    <>
      <Topbar
        eyebrow="CAMPANHA"
        title={campaign.name}
        description={campaign.objective ?? 'Sem objetivo definido.'}
        actions={
          <Link href={`/${workspace_slug}/generate`}>
            <GlassButton size="sm"><Icon name="spark" size={16} />Gerar peça</GlassButton>
          </Link>
        }
      />
      <div className="px-8 py-8 max-w-5xl mx-auto w-full grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
        <div className="space-y-4 min-w-0">
          <p className="text-xs font-semibold tracking-wide uppercase text-[var(--uc-text-muted)]">Peças da campanha</p>
          {copies.length === 0 ? (
            <GlassCard className="p-8 text-center text-sm text-[var(--uc-text-soft)]">
              Nenhuma peça vinculada ainda. Gere uma copy e selecione esta campanha.
            </GlassCard>
          ) : (
            <div className="space-y-3">
              {copies.map((c) => (
                <Link key={c.id} href={`/${workspace_slug}/copy/${c.id}`} className="group cursor-pointer block">
                  <GlassCard className="p-4 flex items-center justify-between gap-3 uc-transition-fast hover:translate-y-[-2px]">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-[var(--uc-text)] truncate">{c.title}</h3>
                      {c.piece_type_key && <p className="text-xs text-[var(--uc-text-faint)] mt-0.5">{c.piece_type_key}</p>}
                    </div>
                    <Icon name="chevron-right" className="text-[var(--uc-text-faint)] group-hover:text-[var(--uc-text)] shrink-0" />
                  </GlassCard>
                </Link>
              ))}
            </div>
          )}
        </div>

        <GlassCard className="p-6 space-y-3 h-fit">
          <Field label="Status" value={campaign.status} />
          <Field label="Audiência" value={campaign.audience} />
          <Field label="Início" value={campaign.starts_at} />
          <Field label="Fim" value={campaign.ends_at} />
          {campaign.context && (
            <div className="pt-2">
              <p className="text-xs font-semibold tracking-wide uppercase text-[var(--uc-text-muted)] mb-1.5">Contexto</p>
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
