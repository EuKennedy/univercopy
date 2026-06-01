import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

import { Icon, Topbar } from '@/components/shell'
import { GlassCard } from '@/components/ui'
import { getWorkspaceMembers } from '@/lib/api/queries'

type Props = { params: Promise<{ workspace_slug: string }> }

export default async function TeamPage({ params }: Props) {
  const { workspace_slug } = await params
  const members = await getWorkspaceMembers(workspace_slug).catch(() => [])
  const t = await getTranslations('team')
  const ts = await getTranslations('settings')

  const ROLE_LABEL: Record<string, string> = {
    owner: t('role_owner'), admin: t('role_admin'), editor: t('role_editor'), reviewer: t('role_reviewer'), viewer: t('role_viewer'),
  }

  return (
    <>
      <Topbar
        eyebrow={t('eyebrow')}
        title={t('title')}
        description={t('description')}
        actions={
          <Link href={`/${workspace_slug}/settings`} className="text-sm text-[var(--uc-text-soft)] hover:text-[var(--uc-text)] inline-flex items-center gap-1.5">
            <Icon name="chevron-left" size={16} />{ts('back')}
          </Link>
        }
      />
      <div className="px-8 py-8 max-w-6xl mx-auto w-full space-y-4">
        <GlassCard className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--uc-border)] text-left">
                  <th className="font-semibold text-[var(--uc-text-muted)] uppercase tracking-wider text-[11px] px-5 py-3">{t('col_member')}</th>
                  <th className="font-semibold text-[var(--uc-text-muted)] uppercase tracking-wider text-[11px] px-4 py-3">{t('col_role')}</th>
                  <th className="font-semibold text-[var(--uc-text-muted)] uppercase tracking-wider text-[11px] px-4 py-3 hidden sm:table-cell">{t('col_since')}</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.user_id} className="border-b border-[var(--uc-border-soft)] last:border-0">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <span className="size-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ background: 'linear-gradient(135deg, var(--uc-brand-purple) 0%, var(--uc-brand-blue) 100%)' }}>
                          {(m.name ?? m.email).slice(0, 2).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <p className="font-medium text-[var(--uc-text)] truncate">{m.name ?? m.email.split('@')[0]}</p>
                          <p className="text-xs text-[var(--uc-text-faint)] truncate">{m.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[11px] font-semibold rounded-full px-2 py-0.5 bg-[var(--uc-accent-soft)] text-[var(--uc-accent)]">
                        {ROLE_LABEL[m.role] ?? m.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-[var(--uc-text-muted)]">
                      {m.accepted_at ? new Date(m.accepted_at).toLocaleDateString('pt-BR') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
        <p className="text-xs text-[var(--uc-text-muted)] leading-5">
          {t('footnote')}
        </p>
      </div>
    </>
  )
}
