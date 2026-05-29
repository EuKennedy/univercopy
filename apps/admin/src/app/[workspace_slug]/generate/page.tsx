import { Icon, Topbar } from '@/components/shell'
import { EmptyState, GlassButton } from '@/components/ui'

type Props = { params: Promise<{ workspace_slug: string }> }

export default async function GeneratorPage({ params }: Props) {
  const { workspace_slug } = await params

  return (
    <>
      <Topbar
        eyebrow="GERADOR"
        title="Gerador multicanal"
        description="DNA + Estilo + Framework + Tipo de peça + Brief → 2 variações em PT-BR."
      />
      <div className="px-8 py-10 max-w-5xl mx-auto">
        <EmptyState
          status="wip"
          eyebrow="Fase 5"
          icon={<Icon name="spark" size={28} />}
          title="Motor de geração em construção"
          description="Aqui você vai escolher a peça (e-commerce, página de vendas, ads, e-mail, social, marca, SEO), pegar 44 estilos de copywriters lendários, 17 frameworks e gerar variações com Auto Router (Haiku/Sonnet/Opus)."
          secondaryAction={
            <a href={`/${workspace_slug}/settings`}>
              <GlassButton size="lg" variant="secondary">Revisar DNA da marca</GlassButton>
            </a>
          }
        />
      </div>
    </>
  )
}
