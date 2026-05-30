'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { GlassButton, GlassCard } from '@/components/ui'
import { cn } from '@/lib/cn'
import { updateAccount } from '@/lib/api/mutations'
import type { Account } from '@/lib/api/types'

const LOCALES = [
  { value: 'pt-BR', label: 'Português (Brasil)' },
  { value: 'en-US', label: 'English (US)' },
  { value: 'es-AR', label: 'Español' },
]
const MODELS = [
  { value: 'auto', label: 'Auto Router (recomendado)' },
  { value: 'haiku', label: 'Haiku — rápido e barato' },
  { value: 'sonnet', label: 'Sonnet — equilíbrio' },
  { value: 'opus', label: 'Opus — máxima qualidade' },
]

const fieldCls =
  'w-full h-12 px-4 rounded-2xl uc-glass uc-transition text-[15px] text-[var(--uc-text)] outline-none cursor-pointer ' +
  'focus:border-[var(--uc-accent-ring)] focus:shadow-[0_0_0_4px_var(--uc-accent-soft-2)]'
const labelCls = 'text-xs font-semibold tracking-wide uppercase text-[var(--uc-text-muted)] mb-1.5 block'

export function PreferencesClient({ slug, account }: { slug: string; account: Account }) {
  const router = useRouter()
  const [locale, setLocale] = useState(account.default_locale)
  const [model, setModel] = useState(account.preferred_ai_model)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const dirty = locale !== account.default_locale || model !== account.preferred_ai_model

  async function save() {
    setBusy(true); setMsg(null)
    const res = await updateAccount(slug, { default_locale: locale, preferred_ai_model: model })
    setBusy(false)
    if (!res.ok) { setMsg({ ok: false, text: res.message }); return }
    setMsg({ ok: true, text: 'Preferências salvas.' })
    router.refresh()
  }

  return (
    <GlassCard className="p-6 space-y-5 max-w-xl">
      <div>
        <label className={labelCls} htmlFor="locale">Idioma da interface e da copy</label>
        <select id="locale" className={fieldCls} value={locale} onChange={(e) => setLocale(e.target.value)}>
          {LOCALES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
        </select>
      </div>
      <div>
        <label className={labelCls} htmlFor="model">Modelo de IA padrão</label>
        <select id="model" className={fieldCls} value={model} onChange={(e) => setModel(e.target.value as Account['preferred_ai_model'])}>
          {MODELS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        <p className="text-xs text-[var(--uc-text-muted)] mt-1.5 leading-5">Auto escolhe o melhor modelo por tarefa (Haiku pra lote, Sonnet pra copy, Opus pra análise pesada).</p>
      </div>
      <div className="flex items-center gap-3">
        <GlassButton loading={busy} disabled={!dirty} onClick={save}>Salvar preferências</GlassButton>
        {msg && <span className={cn('text-sm', msg.ok ? 'text-emerald-400' : 'text-[var(--uc-danger)]')}>{msg.text}</span>}
      </div>
    </GlassCard>
  )
}
