import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

import { Icon, Topbar } from '@/components/shell'
import { GlassCard } from '@/components/ui'

type Props = { params: Promise<{ workspace_slug: string }> }

export default async function SettingsPage({ params }: Props) {
  const { workspace_slug } = await params
  const t = await getTranslations('settings')

  const SECTIONS = [
    { slug: 'dna',          eyebrow: t('dna_eyebrow'),          title: t('dna_title'),          description: t('dna_description'),          icon: 'sparkle' as const },
    { slug: 'team',         eyebrow: t('team_eyebrow'),         title: t('team_title'),         description: t('team_description'),         icon: 'intelligence' as const },
    { slug: 'integrations', eyebrow: t('integrations_eyebrow'), title: t('integrations_title'), description: t('integrations_description'), icon: 'product' as const },
    { slug: 'billing',      eyebrow: t('billing_eyebrow'),      title: t('billing_title'),      description: t('billing_description'),      icon: 'cube' as const },
    { slug: 'audit-log',    eyebrow: t('auditlog_eyebrow'),     title: t('auditlog_title'),     description: t('auditlog_description'),     icon: 'audit' as const },
    { slug: 'preferences',  eyebrow: t('preferences_eyebrow'),  title: t('preferences_title'),  description: t('preferences_description'),  icon: 'settings' as const },
  ]

  return (
    <>
      <Topbar
        eyebrow={t('eyebrow')}
        title={t('title')}
        description={t('description')}
      />
      <div className="px-4 sm:px-6 lg:px-8 py-10 grid grid-cols-1 md:grid-cols-2 gap-5 max-w-6xl mx-auto">
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
