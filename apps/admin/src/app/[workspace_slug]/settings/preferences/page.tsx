import Link from 'next/link'

import { Icon, Topbar } from '@/components/shell'
import { getAccount } from '@/lib/api/queries'

import { PreferencesClient } from './preferences-client'

type Props = { params: Promise<{ workspace_slug: string }> }

export default async function PreferencesPage({ params }: Props) {
  const { workspace_slug } = await params
  const account = await getAccount()

  return (
    <>
      <Topbar
        eyebrow="PESSOAL"
        title="Idioma & modelo padrão"
        description="Preferências da sua conta — valem em todos os workspaces."
        actions={
          <Link href={`/${workspace_slug}/settings`} className="text-sm text-[var(--uc-text-soft)] hover:text-[var(--uc-text)] inline-flex items-center gap-1.5">
            <Icon name="chevron-left" size={16} />Configurações
          </Link>
        }
      />
      <div className="px-8 py-8 max-w-6xl mx-auto w-full">
        <PreferencesClient slug={workspace_slug} account={account} />
      </div>
    </>
  )
}
