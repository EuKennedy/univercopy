import { Icon, Topbar } from '@/components/shell'
import { EmptyState, GlassButton } from '@/components/ui'

type Props = { params: Promise<{ workspace_slug: string }> }

export default async function CopyAcervoPage({ params }: Props) {
  const { workspace_slug } = await params

  return (
    <>
      <Topbar
        eyebrow="ACERVO"
        title="Acervo de Copy"
        description="Versões com histórico, status (rascunho/revisão/aprovado/publicado) e comentários por peça."
      />
      <div className="px-8 py-10 max-w-5xl mx-auto">
        <EmptyState
          status="wip"
          eyebrow="Em construção"
          icon={<Icon name="copy" size={28} />}
          title="Nenhuma copy aqui ainda"
          description="O acervo aparece quando você gera a primeira peça pelo gerador OU recebe uma cópia importada de outro workspace."
          primaryAction={
            <a href={`/${workspace_slug}/generate`}>
              <GlassButton size="lg">Abrir o gerador</GlassButton>
            </a>
          }
        />
      </div>
    </>
  )
}
