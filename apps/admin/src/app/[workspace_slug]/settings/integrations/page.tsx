import Link from 'next/link'

import { Icon, Topbar } from '@/components/shell'
import { listIntegrations } from '@/lib/api/queries'

import { IntegrationsClient } from './integrations-client'

type Props = { params: Promise<{ workspace_slug: string }> }

export default async function IntegrationsPage({ params }: Props) {
  const { workspace_slug } = await params
  const { connectors, products_count } = await listIntegrations(workspace_slug)

  return (
    <>
      <Topbar
        eyebrow="CONECTORES"
        title="Integrações com lojas"
        description="Sincroniza catálogo pra gerar descrições em lote. Credenciais cifradas em repouso."
        actions={
          <Link href={`/${workspace_slug}/settings`} className="text-sm text-[var(--uc-text-soft)] hover:text-[var(--uc-text)] inline-flex items-center gap-1.5">
            <Icon name="chevron-left" size={16} />Configurações
          </Link>
        }
      />
      <div className="px-8 py-8 max-w-6xl mx-auto w-full">
        <IntegrationsClient slug={workspace_slug} connectors={connectors} productsCount={products_count} />
      </div>
    </>
  )
}
