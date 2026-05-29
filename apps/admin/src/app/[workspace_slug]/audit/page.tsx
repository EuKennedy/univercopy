import { Icon, Topbar } from '@/components/shell'
import { EmptyState, GlassButton } from '@/components/ui'

type Props = { params: Promise<{ workspace_slug: string }> }

export default async function AuditPage({ params }: Props) {
  const { workspace_slug } = await params

  return (
    <>
      <Topbar
        eyebrow="ANÁLISE"
        title="Análise de página"
        description="Cola a URL de qualquer página (sua ou concorrente) — a IA devolve score 0-100, diagnóstico por seção e recomendações alinhadas ao DNA."
      />
      <div className="px-8 py-10 max-w-6xl mx-auto">
        <EmptyState
          status="wip"
          eyebrow="Fase 7"
          icon={<Icon name="audit" size={28} />}
          title="Nenhuma auditoria realizada"
          description="Auditoria de página avalia copy, SEO e GEO (otimização pra motor de resposta IA) contra o DNA da marca. Saída: score + seções + recomendações priorizadas."
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
