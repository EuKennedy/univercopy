import { cookies } from 'next/headers'
import { getRequestConfig } from 'next-intl/server'

import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE_NAME } from './config'

// Loader server-side de mensagens. Roda em cada request — não cachear.
// Locale resolvido em ordem: cookie `uc_locale` > default pt-BR.
// Quando o usuário troca em /settings, server action seta o cookie e revalida.

export default getRequestConfig(async () => {
  const cookieStore = await cookies()
  const fromCookie = cookieStore.get(LOCALE_COOKIE_NAME)?.value
  const locale = isLocale(fromCookie) ? fromCookie : DEFAULT_LOCALE

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    timeZone: 'America/Sao_Paulo',
    now: new Date(),
  }
})
