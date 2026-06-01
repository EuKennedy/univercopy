import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

import { Icon, Topbar } from '@/components/shell'
import { getAccount } from '@/lib/api/queries'

import { PreferencesClient } from './preferences-client'

type Props = { params: Promise<{ workspace_slug: string }> }

export default async function PreferencesPage({ params }: Props) {
  const { workspace_slug } = await params
  const account = await getAccount()
  const t = await getTranslations('preferences')
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
        <PreferencesClient slug={workspace_slug} account={account} />
      </div>
    </>
  )
}
