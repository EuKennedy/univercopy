import Link from 'next/link'

import { Icon, Topbar } from '@/components/shell'
import { GlassButton, GlassCard } from '@/components/ui'
import { listCopies } from '@/lib/api/queries'
import type { CopyStatus } from '@/lib/api/types'

type Props = {
  params: Promise<{ workspace_slug: string }>
  searchParams: Promise<{ status?: string }>
}

const STATUS_META: Record<CopyStatus, { label: string; cls: string }> = {
  rascunho:   { label: 'Rascunho',  cls: 'bg-[var(--uc-surface-soft)] text-[var(--uc-text-soft)]' },
  revisao:    { label: 'Revisão',   cls: 'bg-amber-500/15 text-amber-300' },
  aprovado:   { label: 'Aprovado',  cls: 'bg-emerald-500/15 text-emerald-300' },
  publicado:  { label: 'Publicado', cls: 'bg-[var(--uc-accent-soft-2)] text-[var(--uc-accent)]' },
  arquivado:  { label: 'Arquivado', cls: 'bg-[var(--uc-surface-soft)] text-[var(--uc-text-faint)]' },
}

const FILTERS: { key: string; label: string }[] = [
  { key: '', label: 'Tudo' },
  { key: 'rascunho', label: 'Rascunhos' },
  { key: 'revisao', label: 'Em revisão' },
  { key: 'aprovado', label: 'Aprovados' },
  { key: 'publicado', label: 'Publicados' },
]

export default async function CopyListPage({ params, searchParams }: Props) {
  const { workspace_slug } = await params
  const { status } = await searchParams

  const copies = await listCopies(workspace_slug, status ? { status } : undefined)

  return (
    <>
      <Topbar
        eyebrow="ACERVO"
        title="Acervo de Copy"
        description="Versões com histórico, status e ângulos. Tudo que a IA gerou e você aprovou."
        actions={
          <Link href={`/${workspace_slug}/generate`}>
            <GlassButton size="sm"><Icon name="spark" size={16} />Gerar copy</GlassButton>
          </Link>
        }
      />
      <div className="px-8 py-8 max-w-6xl mx-auto w-full space-y-6">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => {
            const active = (status ?? '') === f.key
            return (
              <Link
                key={f.key}
                href={f.key ? `/${workspace_slug}/copy?status=${f.key}` : `/${workspace_slug}/copy`}
                className={`px-3.5 h-9 inline-flex items-center rounded-full text-sm font-medium uc-transition-fast ${
                  active
                    ? 'bg-[var(--uc-accent-soft)] text-[var(--uc-accent)] shadow-[inset_0_0_0_1px_var(--uc-accent-soft-2)]'
                    : 'text-[var(--uc-text-soft)] hover:text-[var(--uc-text)] hover:bg-[var(--uc-surface-soft)]'
                }`}
              >
                {f.label}
              </Link>
            )
          })}
        </div>

        {copies.length === 0 ? (
          <GlassCard variant="strong" iridescent className="p-12 flex flex-col items-center text-center gap-5">
            <span
              className="flex items-center justify-center size-14 rounded-2xl text-white"
              style={{ background: 'linear-gradient(135deg, var(--uc-brand-purple) 0%, var(--uc-brand-blue) 100%)' }}
            >
              <Icon name="copy" size={26} />
            </span>
            <div className="space-y-1.5 max-w-sm">
              <h3 className="text-xl font-bold text-[var(--uc-text)]">Nenhuma copy aqui ainda</h3>
              <p className="text-sm leading-6 text-[var(--uc-text-soft)]">
                Gere a primeira peça no gerador. Cada variação salva vira uma copy com histórico de versões.
              </p>
            </div>
            <Link href={`/${workspace_slug}/generate`}>
              <GlassButton size="lg"><Icon name="spark" size={18} />Abrir o gerador</GlassButton>
            </Link>
          </GlassCard>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {copies.map((c) => {
              const meta = STATUS_META[c.status]
              return (
                <Link key={c.id} href={`/${workspace_slug}/copy/${c.id}`} className="group cursor-pointer">
                  <GlassCard className="p-5 uc-transition-fast hover:translate-y-[-2px] hover:shadow-[var(--uc-shadow-prisma)]">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2.5">
                          <h3 className="text-base font-semibold text-[var(--uc-text)] truncate">{c.title}</h3>
                          <span className={`shrink-0 text-[11px] font-semibold rounded-full px-2 py-0.5 ${meta.cls}`}>{meta.label}</span>
                        </div>
                        {c.current_content_preview && (
                          <p className="text-sm leading-6 text-[var(--uc-text-soft)] mt-1.5 line-clamp-2">
                            {c.current_content_preview}
                          </p>
                        )}
                        {(c.piece_type_key || c.style_key) && (
                          <p className="text-xs text-[var(--uc-text-faint)] mt-2 flex gap-2 flex-wrap">
                            {c.piece_type_key && <span>{c.piece_type_key}</span>}
                            {c.style_key && <span>· {c.style_key}</span>}
                            {c.framework_key && <span>· {c.framework_key}</span>}
                          </p>
                        )}
                      </div>
                      <Icon name="chevron-right" className="text-[var(--uc-text-faint)] group-hover:text-[var(--uc-text)] mt-1 shrink-0" />
                    </div>
                  </GlassCard>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
