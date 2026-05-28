// Configuração de idiomas suportados. Default PT-BR; switcher em settings
// (Fase 4) altera o cookie. URLs SEM prefixo de locale (UI única por host).

export const LOCALES = ['pt-BR', 'en-US', 'es-AR'] as const
export type Locale = (typeof LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'pt-BR'

export const LOCALE_COOKIE_NAME = 'uc_locale'

export const LOCALE_LABELS: Record<Locale, string> = {
  'pt-BR': 'Português (Brasil)',
  'en-US': 'English (US)',
  'es-AR': 'Español (LATAM)',
}

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value)
}
