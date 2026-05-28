import { Topbar } from '@/components/shell'
import { GlassCard } from '@/components/ui'

type Props = {
  params: Promise<{ workspace_slug: string }>
}

// Visão geral do workspace. Placeholder editorial até Fase 4 trazer
// dados reais (KPIs, atividade recente, quota gauge).
export default async function WorkspaceOverviewPage({ params }: Props) {
  const { workspace_slug } = await params

  return (
    <>
      <Topbar
        eyebrow="Visão geral"
        title="Bem-vindo de volta"
        description="Aqui é o ponto de partida da sua marca. A IA tem o seu DNA — agora é só pedir."
      />

      <div className="px-8 py-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        <ActionCard
          eyebrow="GERADOR"
          title="Criar uma copy multicanal"
          body="Escolha peça, framework e estilo. A IA combina com o DNA da marca e devolve variações pra escolher."
          href={`/${workspace_slug}/generate`}
          cta="Abrir o gerador"
        />
        <ActionCard
          eyebrow="ACERVO"
          title="Voltar pras copies em revisão"
          body="Versões aguardando aprovação aparecem aqui assim que existirem peças."
          href={`/${workspace_slug}/copy`}
          cta="Ver acervo"
        />
        <ActionCard
          eyebrow="CAMPANHAS"
          title="Planejar próxima campanha"
          body="Organize peças por evento. Stories, e-mails e ads em uma linha do tempo."
          href={`/${workspace_slug}/campaigns`}
          cta="Nova campanha"
        />
      </div>

      <div className="px-8 pb-12">
        <GlassCard variant="strong" iridescent className="p-7 sm:p-8 flex flex-wrap items-center gap-6 justify-between">
          <div className="max-w-xl space-y-2">
            <p className="text-[10px] font-bold tracking-[0.22em] uppercase text-[var(--uc-accent)]">
              Próximo passo
            </p>
            <h2 className="text-xl font-semibold text-[var(--uc-text)] leading-snug">
              Conecte sua loja para gerar copies em lote
            </h2>
            <p className="text-sm leading-6 text-[var(--uc-text-soft)]">
              WooCommerce, Shopify, Nuvemshop ou CSV. Sincronizamos o catálogo e geramos descrições
              respeitando seu DNA + Q&A do onboarding.
            </p>
          </div>
          <a
            href={`/${workspace_slug}/settings/integrations`}
            className="inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold text-white uc-transition-fast cursor-pointer shadow-[0_12px_32px_-12px_rgba(139,92,246,0.5)]"
            style={{ background: 'linear-gradient(135deg, var(--uc-brand-purple) 0%, var(--uc-brand-blue) 100%)' }}
          >
            Conectar loja
          </a>
        </GlassCard>
      </div>
    </>
  )
}

function ActionCard({
  eyebrow, title, body, href, cta,
}: { eyebrow: string; title: string; body: string; href: string; cta: string }) {
  return (
    <GlassCard className="p-6 flex flex-col gap-4 uc-transition-fast hover:translate-y-[-2px] hover:shadow-[var(--uc-shadow-prisma)] cursor-pointer">
      <p className="text-[10px] font-bold tracking-[0.22em] uppercase text-[var(--uc-text-muted)]">
        {eyebrow}
      </p>
      <h3 className="text-lg font-semibold tracking-tight text-[var(--uc-text)] leading-snug">
        {title}
      </h3>
      <p className="text-sm leading-6 text-[var(--uc-text-soft)] flex-1">
        {body}
      </p>
      <a
        href={href}
        className="inline-flex items-center gap-2 text-sm font-semibold uc-prisma-text cursor-pointer"
      >
        {cta} →
      </a>
    </GlassCard>
  )
}
