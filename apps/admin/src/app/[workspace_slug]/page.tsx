import Link from 'next/link'

import { Icon, Topbar } from '@/components/shell'
import { GlassButton, GlassCard } from '@/components/ui'
import { getOverview } from '@/lib/api/queries'
import { brl } from '@/lib/money'
import type { CopyStatus } from '@/lib/api/types'

type Props = { params: Promise<{ workspace_slug: string }> }

const STATUS_LABEL: Record<CopyStatus, string> = {
  rascunho: 'Rascunho', revisao: 'Revisão', aprovado: 'Aprovado', publicado: 'Publicado', arquivado: 'Arquivado',
}

export default async function WorkspaceOverviewPage({ params }: Props) {
  const { workspace_slug } = await params
  const o = await getOverview(workspace_slug)

  const stats = [
    { label: 'Copies', value: o.counts.copies, href: `/${workspace_slug}/copy` },
    { label: 'Em revisão', value: o.counts.copies_revisao, href: `/${workspace_slug}/copy?status=revisao` },
    { label: 'Campanhas', value: o.counts.campaigns, href: `/${workspace_slug}/campaigns` },
    { label: 'Produtos', value: o.counts.products, href: `/${workspace_slug}/products` },
    { label: 'Gerações no mês', value: o.counts.generations_month, href: `/${workspace_slug}/generate` },
  ]

  return (
    <>
      <Topbar
        eyebrow="Visão geral"
        title={o.workspace.name}
        description="Ponto de partida da sua marca. A IA tem o seu DNA — agora é só pedir."
        actions={
          <Link href={`/${workspace_slug}/generate`}>
            <GlassButton size="sm"><Icon name="spark" size={16} />Gerar copy</GlassButton>
          </Link>
        }
      />

      <div className="px-8 py-8 space-y-6 max-w-6xl mx-auto w-full">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
          {stats.map((s) => (
            <Link key={s.label} href={s.href} className="cursor-pointer">
              <GlassCard className="p-5 uc-transition-fast hover:translate-y-[-2px] hover:shadow-[var(--uc-shadow-prisma)]">
                <p className="text-3xl font-bold text-[var(--uc-text)] tracking-tight">{s.value}</p>
                <p className="text-xs text-[var(--uc-text-muted)] mt-1 uppercase tracking-wider">{s.label}</p>
              </GlassCard>
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          {/* Recentes */}
          <div className="space-y-3">
            <p className="text-xs font-semibold tracking-wide uppercase text-[var(--uc-text-muted)]">Copies recentes</p>
            {o.recent_copies.length === 0 ? (
              <GlassCard variant="strong" iridescent className="p-10 flex flex-col items-center text-center gap-4">
                <span className="flex items-center justify-center size-14 rounded-2xl text-white" style={{ background: 'linear-gradient(135deg, var(--uc-brand-purple) 0%, var(--uc-brand-blue) 100%)' }}>
                  <Icon name="spark" size={26} />
                </span>
                <div className="space-y-1.5 max-w-sm">
                  <h3 className="text-lg font-bold text-[var(--uc-text)]">Gere sua primeira copy</h3>
                  <p className="text-sm leading-6 text-[var(--uc-text-soft)]">A IA combina o DNA da marca com estilo + framework e devolve variações prontas.</p>
                </div>
                <Link href={`/${workspace_slug}/generate`}><GlassButton size="lg">Abrir o gerador</GlassButton></Link>
              </GlassCard>
            ) : (
              <div className="space-y-2">
                {o.recent_copies.map((c) => (
                  <Link key={c.id} href={`/${workspace_slug}/copy/${c.id}`} className="group cursor-pointer block">
                    <GlassCard className="p-4 flex items-center justify-between gap-3 uc-transition-fast hover:translate-y-[-2px]">
                      <span className="text-sm font-semibold text-[var(--uc-text)] truncate">{c.title}</span>
                      <span className="text-xs text-[var(--uc-text-muted)] shrink-0">{STATUS_LABEL[c.status]}</span>
                    </GlassCard>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Custo + DNA */}
          <div className="space-y-4">
            <GlassCard className="p-6 space-y-3">
              <p className="text-xs font-semibold tracking-wide uppercase text-[var(--uc-text-muted)]">Custo de IA no mês</p>
              <p className="text-2xl font-bold text-[var(--uc-text)]">
                {brl(o.cost.used_usd)}
                {o.cost.limit_usd != null && <span className="text-sm font-normal text-[var(--uc-text-muted)]"> / {brl(o.cost.limit_usd)}</span>}
              </p>
              {o.cost.percent != null && (
                <div className="h-2 rounded-full bg-[var(--uc-bg-mute)] overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(o.cost.percent, 100)}%`, background: 'linear-gradient(90deg, var(--uc-brand-purple), var(--uc-brand-blue))' }} />
                </div>
              )}
              <p className="text-xs text-[var(--uc-text-muted)] capitalize">Plano {o.workspace.plan}</p>
            </GlassCard>

            <Link href={`/${workspace_slug}/settings/dna`}>
              <GlassCard className="p-5 uc-transition-fast hover:translate-y-[-2px] cursor-pointer flex items-center gap-3">
                <Icon name="sparkle" size={18} className="text-[var(--uc-accent)]" />
                <div>
                  <p className="text-sm font-semibold text-[var(--uc-text)]">DNA em uso: <span className="capitalize">{o.dna_in_use}</span></p>
                  <p className="text-xs text-[var(--uc-text-muted)]">Editar ou trocar →</p>
                </div>
              </GlassCard>
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
