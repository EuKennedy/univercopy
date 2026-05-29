import { Icon, Topbar } from '@/components/shell'
import { EmptyState, GlassButton } from '@/components/ui'

type Props = { params: Promise<{ workspace_slug: string }> }

export default async function IntelligencePage({ params }: Props) {
  const { workspace_slug } = await params

  return (
    <>
      <Topbar
        eyebrow="INTELIGÊNCIA"
        title="Inteligência competitiva"
        description="Ingere PDPs de concorrentes — extrai padrão, estrutura e estratégia. NUNCA copia o texto: aprende o esqueleto."
      />
      <div className="px-8 py-10 max-w-5xl mx-auto">
        <EmptyState
          status="wip"
          eyebrow="Fase 7 · Plano Ultra"
          icon={<Icon name="intelligence" size={28} />}
          title="Sem registros de concorrência ainda"
          description="Cola URLs de PDPs concorrentes (até 3 por ingestão). A IA volta com estrutura da página, ângulo de copy, mecanismo aparente, ativos destacados, score competitivo."
          secondaryAction={
            <a href={`/${workspace_slug}`}>
              <GlassButton size="lg" variant="secondary">Voltar ao painel</GlassButton>
            </a>
          }
        />
      </div>
    </>
  )
}
