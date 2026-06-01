'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

import { GlassButton, GlassCard } from '@/components/ui'
import { cn } from '@/lib/cn'
import { updateAccount } from '@/lib/api/mutations'
import { setLocale } from '@/lib/i18n-actions'
import { isLocale, LOCALES, LOCALE_LABELS } from '@/i18n/config'
import type { Account } from '@/lib/api/types'

const fieldCls =
  'w-full h-12 px-4 rounded-2xl uc-glass uc-transition text-[15px] text-[var(--uc-text)] outline-none cursor-pointer ' +
  'focus:border-[var(--uc-accent-ring)] focus:shadow-[0_0_0_4px_var(--uc-accent-soft-2)]'
const labelCls = 'text-xs font-semibold tracking-wide uppercase text-[var(--uc-text-muted)] mb-1.5 block'

export function PreferencesClient({ slug, account }: { slug: string; account: Account }) {
  const router = useRouter()
  const t = useTranslations('preferences')
  const [locale, setLocaleState] = useState(account.default_locale)
  const [model, setModel] = useState(account.preferred_ai_model)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const MODELS = [
    { value: 'auto', label: t('model_auto') },
    { value: 'haiku', label: t('model_haiku') },
    { value: 'sonnet', label: t('model_sonnet') },
    { value: 'opus', label: t('model_opus') },
  ]

  const dirty = locale !== account.default_locale || model !== account.preferred_ai_model

  async function save() {
    setBusy(true); setMsg(null)
    // Persiste no backend (default_locale + modelo) e troca a UI imediatamente
    // via cookie `uc_locale`. router.refresh() re-renderiza no novo idioma.
    const res = await updateAccount(slug, { default_locale: locale, preferred_ai_model: model })
    if (isLocale(locale)) await setLocale(locale)
    setBusy(false)
    if (!res.ok) { setMsg({ ok: false, text: res.message }); return }
    setMsg({ ok: true, text: t('saved') })
    router.refresh()
  }

  return (
    <GlassCard className="p-6 space-y-5 max-w-xl">
      <div>
        <label className={labelCls} htmlFor="locale">{t('locale_label')}</label>
        <select id="locale" className={fieldCls} value={locale} onChange={(e) => setLocaleState(e.target.value)}>
          {LOCALES.map((l) => <option key={l} value={l}>{LOCALE_LABELS[l]}</option>)}
        </select>
      </div>
      <div>
        <label className={labelCls} htmlFor="model">{t('model_label')}</label>
        <select id="model" className={fieldCls} value={model} onChange={(e) => setModel(e.target.value as Account['preferred_ai_model'])}>
          {MODELS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        <p className="text-xs text-[var(--uc-text-muted)] mt-1.5 leading-5">{t('model_hint')}</p>
      </div>
      <div className="flex items-center gap-3">
        <GlassButton loading={busy} disabled={!dirty} onClick={save}>{t('save')}</GlassButton>
        {msg && <span className={cn('text-sm', msg.ok ? 'text-emerald-400' : 'text-[var(--uc-danger)]')}>{msg.text}</span>}
      </div>
    </GlassCard>
  )
}
