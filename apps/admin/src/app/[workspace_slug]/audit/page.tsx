import { Topbar } from '@/components/shell'
import { listPageAudits } from '@/lib/api/queries'

import { AuditClient } from './audit-client'

type Props = { params: Promise<{ workspace_slug: string }> }

export default async function AuditPage({ params }: Props) {
  const { workspace_slug } = await params
  const audits = await listPageAudits(workspace_slug).catch(() => [])

  return (
    <>
      <Topbar
        eyebrow="ANÁLISE"
        title="Análise de página"
        description="Cole a URL de qualquer página — a IA devolve score 0-100, diagnóstico por seção (copy, SEO, GEO, CTA) e recomendações alinhadas ao DNA."
      />
      <div className="px-8 py-8 max-w-6xl mx-auto w-full">
        <AuditClient slug={workspace_slug} initial={audits} />
      </div>
    </>
  )
}
