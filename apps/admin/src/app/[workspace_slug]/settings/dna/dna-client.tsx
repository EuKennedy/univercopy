'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

import { GlassButton, GlassCard } from '@/components/ui'
import { Icon } from '@/components/shell/icon'
import { cn } from '@/lib/cn'
import { improveDna, saveDnaKind, useDnaKind as setDnaInUse } from '@/lib/api/mutations'
import type { Dna, DnaBundle } from '@/lib/api/types'

const TEXT_FIELD_KEYS: (keyof Dna)[] = ['marca', 'missao', 'posicionamento', 'tom', 'publico', 'consciencia']
const LIST_FIELD_KEYS: (keyof Dna)[] = ['valores', 'produtos', 'ofertas', 'provas', 'objecoes', 'evitar']

const fieldCls =
  'w-full px-4 py-2.5 rounded-xl uc-glass uc-transition text-[15px] text-[var(--uc-text)] outline-none leading-6 ' +
  'focus:border-[var(--uc-accent-ring)] focus:shadow-[0_0_0_4px_var(--uc-accent-soft-2)]'

function emptyDna(kind: 'atual' | 'proposto'): Dna {
  return {
    kind, marca: '', missao: '', posicionamento: '', tom: '', publico: '', consciencia: '',
    valores: [], produtos: [], ofertas: [], provas: [], objecoes: [], evitar: [],
    publico_alvo_detalhado: null, restricoes_regulatorias: [], framework: null, source_url: null, updated_at: null,
  }
}

export function DnaClient({ slug, bundle }: { slug: string; bundle: DnaBundle }) {
  const router = useRouter()
  const t = useTranslations('settingsDna')
  const TEXT_FIELDS = TEXT_FIELD_KEYS.map((key) => ({ key, label: t(`field_${key}`) }))
  const LIST_FIELDS = LIST_FIELD_KEYS.map((key) => ({ key, label: t(`field_${key}`) }))
  const [tab, setTab] = useState<'atual' | 'proposto'>('atual')
  const [inUse, setInUse] = useState(bundle.dna_in_use)
  const [dna, setDna] = useState<Dna>(bundle[tab] ?? emptyDna(tab))
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err' | 'paywall'; text: string } | null>(null)
  const [direction, setDirection] = useState('')

  function switchTab(next: 'atual' | 'proposto') {
    setTab(next)
    setDna(bundle[next] ?? emptyDna(next))
    setMsg(null)
  }

  function setText(key: keyof Dna, value: string) {
    setDna((d) => ({ ...d, [key]: value }))
  }
  function setList(key: keyof Dna, value: string) {
    setDna((d) => ({ ...d, [key]: value.split('\n').map((s) => s.trim()).filter(Boolean) }))
  }

  async function save() {
    setBusy('save'); setMsg(null)
    const res = await saveDnaKind(slug, tab, {
      marca: dna.marca, missao: dna.missao, posicionamento: dna.posicionamento,
      tom: dna.tom, publico: dna.publico, consciencia: dna.consciencia,
      valores: dna.valores, produtos: dna.produtos, ofertas: dna.ofertas,
      provas: dna.provas, objecoes: dna.objecoes, evitar: dna.evitar,
    })
    setBusy(null)
    if (!res.ok) { setMsg({ kind: 'err', text: res.message }); return }
    setMsg({ kind: 'ok', text: t('saved') })
    router.refresh()
  }

  async function setActive(kind: 'atual' | 'proposto') {
    setBusy('use')
    const res = await setDnaInUse(slug, kind)
    setBusy(null)
    if (res.ok) { setInUse(kind); router.refresh() }
  }

  async function improve() {
    setBusy('improve'); setMsg(null)
    const res = await improveDna(slug, { direction: direction.trim() || undefined })
    setBusy(null)
    if (!res.ok) { setMsg({ kind: res.error === 'feature_locked' || res.error === 'cap_reached' ? 'paywall' : 'err', text: res.message }); return }
    setMsg({ kind: 'ok', text: t('improve_done') })
    setTab('proposto')
    setDna(res.data)
    router.refresh()
  }

  return (
    <div className="space-y-5">
      {/* Tabs + em uso */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex gap-1 p-1 rounded-2xl uc-glass">
          {(['atual', 'proposto'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => switchTab(k)}
              className={cn(
                'px-4 h-9 rounded-xl text-sm font-semibold uc-transition-fast cursor-pointer',
                tab === k ? 'bg-[var(--uc-accent-soft)] text-[var(--uc-accent)]' : 'text-[var(--uc-text-soft)] hover:text-[var(--uc-text)]',
              )}
            >
              {t(`tab_${k}`)}{inUse === k && ` · ${t('in_use')}`}
            </button>
          ))}
        </div>
        {inUse !== tab && (
          <GlassButton size="sm" variant="secondary" loading={busy === 'use'} onClick={() => setActive(tab)}>
            {t('use_in_generator', { tab: t(`tab_${tab}`) })}
          </GlassButton>
        )}
      </div>

      <GlassCard className="p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {TEXT_FIELDS.map((f) => (
            <div key={f.key} className={f.key === 'marca' ? '' : 'sm:col-span-2'}>
              <label className="text-xs font-semibold tracking-wide uppercase text-[var(--uc-text-muted)] mb-1.5 block">{f.label}</label>
              {f.key === 'marca' ? (
                <input className={fieldCls} value={(dna[f.key] as string) ?? ''} onChange={(e) => setText(f.key, e.target.value)} />
              ) : (
                <textarea rows={2} className={cn(fieldCls, 'resize-y')} value={(dna[f.key] as string) ?? ''} onChange={(e) => setText(f.key, e.target.value)} />
              )}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          {LIST_FIELDS.map((f) => (
            <div key={f.key}>
              <label className="text-xs font-semibold tracking-wide uppercase text-[var(--uc-text-muted)] mb-1.5 block">{f.label} <span className="normal-case text-[var(--uc-text-faint)]">{t('one_per_line')}</span></label>
              <textarea rows={3} className={cn(fieldCls, 'resize-y')} value={(dna[f.key] as string[]).join('\n')} onChange={(e) => setList(f.key, e.target.value)} />
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <GlassButton loading={busy === 'save'} onClick={save}>{t('save_dna', { tab: t(`tab_${tab}`) })}</GlassButton>
        </div>

        {msg && (
          <p className={cn('text-sm', msg.kind === 'ok' && 'text-emerald-400', msg.kind === 'err' && 'text-[var(--uc-danger)]', msg.kind === 'paywall' && 'text-[var(--uc-accent-strong)]')}>
            {msg.kind === 'paywall' ? t('out_of_plan') : ''}{msg.text}
          </p>
        )}
      </GlassCard>

      {/* Melhorar com IA */}
      <GlassCard variant="strong" iridescent className="p-6 space-y-3">
        <div className="flex items-center gap-2">
          <Icon name="sparkle" size={18} className="text-[var(--uc-accent)]" />
          <h3 className="text-base font-semibold text-[var(--uc-text)]">{t('improve_title')}</h3>
        </div>
        <p className="text-sm leading-6 text-[var(--uc-text-soft)]">
          {t('improve_description')}
        </p>
        <input
          className={fieldCls}
          placeholder={t('improve_placeholder')}
          value={direction}
          onChange={(e) => setDirection(e.target.value)}
        />
        <GlassButton variant="secondary" loading={busy === 'improve'} onClick={improve}>
          <Icon name="wand" size={16} />{t('improve_cta')}
        </GlassButton>
      </GlassCard>
    </div>
  )
}
