import Link from 'next/link'

import { Icon, Topbar } from '@/components/shell'
import { getDna } from '@/lib/api/queries'

import { DnaClient } from './dna-client'

type Props = { params: Promise<{ workspace_slug: string }> }

export default async function DnaSettingsPage({ params }: Props) {
  const { workspace_slug } = await params
  const bundle = await getDna(workspace_slug)

  return (
    <>
      <Topbar
        eyebrow="IDENTIDADE"
        title="DNA da marca"
        description="O contexto que alimenta toda geração. Edite atual + proposto e escolha qual alimenta o gerador."
        actions={
          <Link href={`/${workspace_slug}/settings`} className="text-sm text-[var(--uc-text-soft)] hover:text-[var(--uc-text)] inline-flex items-center gap-1.5">
            <Icon name="chevron-left" size={16} />Configurações
          </Link>
        }
      />
      <div className="px-8 py-8 max-w-6xl mx-auto w-full">
        <DnaClient slug={workspace_slug} bundle={bundle} />
      </div>
    </>
  )
}
