import Link from 'next/link'

import { Icon, Topbar } from '@/components/shell'
import { GlassCard } from '@/components/ui'

type Props = { params: Promise<{ workspace_slug: string }> }

const SECTIONS = [
  { slug: 'dna',          eyebrow: 'IDENTIDADE',     title: 'DNA da marca',                description: 'Editar atual + proposto. Re-extrair via URL. Trocar qual DNA alimenta o gerador.',  icon: 'sparkle' as const },
  { slug: 'team',         eyebrow: 'EQUIPE',         title: 'Membros & convites',          description: 'Adicionar editores e revisores. Permissões por papel (owner/admin/editor/viewer).',   icon: 'intelligence' as const },
  { slug: 'integrations', eyebrow: 'CONECTORES',     title: 'Integrações com lojas',       description: 'WooCommerce, Shopify, Nuvemshop, Tray ou CSV. Sync manual, publish back.',           icon: 'product' as const },
  { slug: 'billing',      eyebrow: 'PLANO',          title: 'Plano & uso',                 description: 'Plano atual (entry/medium/ultra), gerações no mês, cost cap, histórico de cobrança.', icon: 'cube' as const },
  { slug: 'audit-log',    eyebrow: 'AUDITORIA',      title: 'Log de auditoria',            description: 'Toda ação sensível registrada com IP + user agent + diff.',                            icon: 'audit' as const },
  { slug: 'preferences',  eyebrow: 'PESSOAL',        title: 'Idioma & modelo padrão',      description: 'PT-BR / EN-US / ES. Modelo padrão (Auto/Haiku/Sonnet/Opus) por ação de IA.',           icon: 'settings' as const },
]

export default async function SettingsPage({ params }: Props) {
  const { workspace_slug } = await params

  return (
    <>
      <Topbar
        eyebrow="CONFIGURAÇÕES"
        title="Configurações do workspace"
        description="Tudo que define como a IA gera, quem tem acesso, conectores ativos e plano em uso."
      />
      <div className="px-8 py-10 grid grid-cols-1 md:grid-cols-2 gap-5 max-w-5xl mx-auto">
        {SECTIONS.map((s) => (
          <Link key={s.slug} href={`/${workspace_slug}/settings/${s.slug}`} className="group cursor-pointer">
            <GlassCard className="p-6 flex gap-4 items-start uc-transition-fast hover:translate-y-[-2px] hover:shadow-[var(--uc-shadow-prisma)]">
              <span
                className="size-12 rounded-xl flex items-center justify-center text-white shrink-0 shadow-[0_8px_22px_-8px_var(--uc-accent-glow)]"
                style={{ background: 'linear-gradient(135deg, var(--uc-brand-purple) 0%, var(--uc-brand-blue) 100%)' }}
                aria-hidden
              >
                <Icon name={s.icon} size={22} />
              </span>
              <div className="flex flex-col gap-1.5 min-w-0">
                <p className="text-[10px] font-bold tracking-[0.22em] uppercase text-[var(--uc-text-muted)]">
                  {s.eyebrow}
                </p>
                <h3 className="text-lg font-semibold tracking-tight text-[var(--uc-text)]">
                  {s.title}
                </h3>
                <p className="text-sm leading-6 text-[var(--uc-text-soft)]">
                  {s.description}
                </p>
              </div>
            </GlassCard>
          </Link>
        ))}
      </div>
    </>
  )
}
