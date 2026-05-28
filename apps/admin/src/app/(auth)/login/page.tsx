import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import { Wordmark } from '@/components/brand/wordmark'

import { LoginForm } from './login-form'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth')
  return { title: t('login_title') }
}

export default async function LoginPage() {
  const t = await getTranslations()

  return (
    <main className="w-full max-w-md">
      <div className="flex flex-col items-center text-center mb-8 space-y-5">
        <Wordmark size="lg" />
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-[var(--uc-text)] leading-tight">
            {t('auth.login_title')}
          </h1>
          <p className="text-[15px] leading-7 text-[var(--uc-text-soft)]">
            {t('auth.login_subtitle')}
          </p>
        </div>
      </div>
      <LoginForm />
    </main>
  )
}
