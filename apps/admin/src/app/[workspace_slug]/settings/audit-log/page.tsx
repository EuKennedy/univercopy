import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

import { Icon, Topbar } from '@/components/shell'
import { GlassCard } from '@/components/ui'
import { listAuditLogs } from '@/lib/api/queries'

type Props = { params: Promise<{ workspace_slug: string }> }

export default async function AuditLogPage({ params }: Props) {
  const { workspace_slug } = await params
  const logs = await listAuditLogs(workspace_slug).catch(() => [])
  const t = await getTranslations('auditLog')
  const ts = await getTranslations('settings')

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
      <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-6xl mx-auto w-full">
        {logs.length === 0 ? (
          <GlassCard className="p-10 text-center space-y-2">
            <span className="inline-flex items-center justify-center size-12 rounded-2xl text-white mb-2" style={{ background: 'linear-gradient(135deg, var(--uc-brand-purple) 0%, var(--uc-brand-blue) 100%)' }}>
              <Icon name="audit" size={22} />
            </span>
            <h3 className="text-lg font-semibold text-[var(--uc-text)]">{t('empty_title')}</h3>
            <p className="text-sm text-[var(--uc-text-soft)] max-w-sm mx-auto">{t('empty_description')}</p>
          </GlassCard>
        ) : (
          <GlassCard className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--uc-border)] text-left">
                    <th className="font-semibold text-[var(--uc-text-muted)] uppercase tracking-wider text-[11px] px-5 py-3">{t('col_action')}</th>
                    <th className="font-semibold text-[var(--uc-text-muted)] uppercase tracking-wider text-[11px] px-4 py-3 hidden sm:table-cell">{t('col_ip')}</th>
                    <th className="font-semibold text-[var(--uc-text-muted)] uppercase tracking-wider text-[11px] px-4 py-3">{t('col_when')}</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l) => (
                    <tr key={l.id} className="border-b border-[var(--uc-border-soft)] last:border-0">
                      <td className="px-5 py-3 font-medium text-[var(--uc-text)]">{l.action}</td>
                      <td className="px-4 py-3 hidden sm:table-cell text-[var(--uc-text-muted)]">{l.ip ?? '—'}</td>
                      <td className="px-4 py-3 text-[var(--uc-text-muted)]">{new Date(l.created_at).toLocaleString('pt-BR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlassCard>
        )}
      </div>
    </>
  )
}
