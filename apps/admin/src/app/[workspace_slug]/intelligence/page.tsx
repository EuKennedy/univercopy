import { getTranslations } from 'next-intl/server'

import { Icon, Topbar } from '@/components/shell'
import { EmptyState, GlassButton } from '@/components/ui'

type Props = { params: Promise<{ workspace_slug: string }> }

export default async function IntelligencePage({ params }: Props) {
  const { workspace_slug } = await params
  const t = await getTranslations('intelligence')

  return (
    <>
      <Topbar
        eyebrow={t('eyebrow')}
        title={t('title')}
        description={t('description')}
      />
      <div className="px-4 sm:px-6 lg:px-8 py-10 max-w-6xl mx-auto">
        <EmptyState
          status="wip"
          eyebrow={t('wip_eyebrow')}
          icon={<Icon name="intelligence" size={28} />}
          title={t('empty_title')}
          description={t('empty_description')}
          secondaryAction={
            <a href={`/${workspace_slug}`}>
              <GlassButton size="lg" variant="secondary">{t('back_to_dashboard')}</GlassButton>
            </a>
          }
        />
      </div>
    </>
  )
}
