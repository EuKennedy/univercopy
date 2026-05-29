import { Icon, Topbar } from '@/components/shell'
import { EmptyState, GlassButton } from '@/components/ui'

type Props = { params: Promise<{ workspace_slug: string }> }

export default async function CampaignsPage({ params }: Props) {
  const { workspace_slug } = await params

  return (
    <>
      <Topbar
        eyebrow="CAMPANHAS"
        title="Campanhas"
        description="Agrupe peças por evento ou lançamento. Black Friday, sazonais, novos produtos — cada uma com contexto + status (planejada/ativa/concluída/arquivada)."
      />
      <div className="px-8 py-10 max-w-5xl mx-auto">
        <EmptyState
          status="wip"
          eyebrow="Fase 4"
          icon={<Icon name="campaign" size={28} />}
          title="Nenhuma campanha planejada"
          description="Cria uma campanha pra agrupar copies por evento, definir audiência, datas e contexto rico (textão + uploads .md/.csv) que alimenta a IA em cada geração."
          primaryAction={
            <a href={`/${workspace_slug}/generate`}>
              <GlassButton size="lg">Gerar a primeira peça</GlassButton>
            </a>
          }
        />
      </div>
    </>
  )
}
