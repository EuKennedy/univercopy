'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

import { GlassButton, GlassCard } from '@/components/ui'
import { Icon } from '@/components/shell/icon'
import { cn } from '@/lib/cn'
import { generateCopy, saveCopy } from '@/lib/api/mutations'
import type { Category, Framework, PieceType, Style, Variation } from '@/lib/api/types'

type Props = {
  slug: string
  pieceTypes: PieceType[]
  styles: Style[]
  frameworks: Framework[]
  categories: Category[]
  products: { id: string; name: string }[]
  campaigns: { id: string; name: string }[]
  initialProductId?: string
}

const MODELS = [
  { value: 'auto', label: 'Auto' },
  { value: 'haiku', label: 'Haiku' },
  { value: 'sonnet', label: 'Sonnet' },
  { value: 'opus', label: 'Opus' },
]

const fieldCls =
  'w-full px-4 rounded-2xl uc-glass uc-transition text-[15px] text-[var(--uc-text)] outline-none ' +
  'focus:border-[var(--uc-accent-ring)] focus:shadow-[0_0_0_4px_var(--uc-accent-soft-2)]'

type TFn = ReturnType<typeof useTranslations>

function friendlyError(t: TFn, code: string, raw: string): string {
  switch (code) {
    case 'ai_failed': return t('error_ai_failed')
    case 'feature_locked': return t('error_feature_locked')
    case 'cap_reached': return t('error_cap_reached')
    default: return raw?.length > 160 ? t('error_generic') : raw
  }
}

export function GeneratorForm({ slug, pieceTypes, styles, frameworks, categories, products, campaigns, initialProductId = '' }: Props) {
  const router = useRouter()
  const t = useTranslations('generate')
  const tc = useTranslations('common')
  const STEPS = [t('step_content'), t('step_style'), t('step_context')] as const

  const [step, setStep] = useState(0)
  const [pieceTypeKey, setPieceTypeKey] = useState(
    initialProductId ? (pieceTypes.find((p) => p.key === 'ecom:desc-prod-longa')?.key ?? '') : '',
  )
  const [styleKey, setStyleKey] = useState('')
  const [frameworkKey, setFrameworkKey] = useState('')
  const [productId, setProductId] = useState(initialProductId)
  const [campaignId, setCampaignId] = useState('')
  const [brief, setBrief] = useState('')
  const [n, setN] = useState(2)
  const [model, setModel] = useState('auto')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [paywall, setPaywall] = useState(false)
  const [variations, setVariations] = useState<Variation[]>([])
  const [resolved, setResolved] = useState<Record<string, string | null>>({})
  const [done, setDone] = useState(false)

  const catLabel = useMemo(() => {
    const m = new Map(categories.map((c) => [c.key, c.name]))
    return (k: string) => m.get(k) ?? k
  }, [categories])

  const pieceGroups = useMemo(() => {
    const g = new Map<string, PieceType[]>()
    for (const pt of pieceTypes) { const a = g.get(pt.category_key) ?? []; a.push(pt); g.set(pt.category_key, a) }
    return [...g.entries()]
  }, [pieceTypes])

  const styleGroups = useMemo(() => {
    const g = new Map<string, Style[]>()
    for (const s of styles) { const k = s.grp ?? 'outros'; const a = g.get(k) ?? []; a.push(s); g.set(k, a) }
    return [...g.entries()]
  }, [styles])

  const selectedPiece = pieceTypes.find((p) => p.key === pieceTypeKey)
  const selectedStyle = styles.find((s) => s.key === styleKey)

  async function onGenerate() {
    setLoading(true); setError(null); setPaywall(false); setVariations([]); setDone(false)
    const res = await generateCopy(slug, {
      piece_type_key: pieceTypeKey,
      style_key: styleKey || undefined,
      framework_key: frameworkKey || undefined,
      product_id: productId || undefined,
      campaign_id: campaignId || undefined,
      brief: brief.trim() || undefined,
      n, model,
    })
    setLoading(false)
    setDone(true)
    if (!res.ok) {
      if (res.error === 'feature_locked' || res.error === 'cap_reached') setPaywall(true)
      setError(friendlyError(t, res.error, res.message))
      return
    }
    setVariations(res.data.variations)
    setResolved(res.data.resolved as Record<string, string | null>)
    if (res.data.variations.length === 0) setError(t('error_no_variations'))
  }

  // Tela de resultado
  if (done) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-[var(--uc-text-muted)]">{t('result')}</p>
            <h2 className="text-xl font-bold text-[var(--uc-text)] mt-1">{variations.length > 0 ? t('result_count', { count: variations.length }) : t('result_generic')}</h2>
          </div>
          <GlassButton variant="secondary" onClick={() => { setDone(false); setError(null) }}>
            <Icon name="chevron-left" size={16} />{t('adjust_regenerate')}
          </GlassButton>
        </div>

        {loading && <LoadingCard n={n} t={t} />}
        {error && <ErrorBox paywall={paywall} text={error} t={t} />}

        {variations.map((v, i) => (
          <VariationCard key={i} slug={slug} variation={v} index={i} resolved={resolved} t={t} onSaved={(id) => router.push(`/${slug}/copy/${id}`)} />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Stepper */}
      <div className="flex items-center gap-2">
        {STEPS.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => i < step && setStep(i)}
            disabled={i > step}
            className={cn(
              'flex items-center gap-2 px-3.5 h-10 rounded-2xl text-sm font-semibold uc-transition-fast',
              i === step ? 'bg-[var(--uc-accent-soft)] text-[var(--uc-accent)] shadow-[inset_0_0_0_1px_var(--uc-accent-soft-2)]'
                : i < step ? 'text-[var(--uc-text)] hover:bg-[var(--uc-surface-soft)] cursor-pointer'
                : 'text-[var(--uc-text-faint)] cursor-default',
            )}
          >
            <span className={cn('size-6 rounded-full grid place-items-center text-xs', i <= step ? 'text-white' : 'bg-[var(--uc-bg-mute)]')}
              style={i <= step ? { background: 'linear-gradient(135deg, var(--uc-brand-purple), var(--uc-brand-blue))' } : undefined}>
              {i + 1}
            </span>
            {label}
            {i < STEPS.length - 1 && <span className="w-6 h-px bg-[var(--uc-border)] ml-1" />}
          </button>
        ))}
      </div>

      {/* STEP 1 — Conteúdo */}
      {step === 0 && (
        <GlassCard className="p-6 space-y-5">
          <Header title={t('step1_title')} sub={t('step1_sub')} />
          <div className="space-y-5 max-h-[52vh] overflow-y-auto pr-1">
            {pieceGroups.map(([catKey, items]) => (
              <div key={catKey}>
                <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-[var(--uc-text-muted)] mb-2">{catLabel(catKey)}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {items.map((pt) => (
                    <SelectCard
                      key={pt.key}
                      active={pieceTypeKey === pt.key}
                      title={pt.name}
                      sub={pt.length_hint ?? pt.description ?? undefined}
                      onClick={() => { setPieceTypeKey(pt.key); setStep(1) }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* STEP 2 — Estilo */}
      {step === 1 && (
        <GlassCard className="p-6 space-y-5">
          <Header title={t('step2_title')} sub={t('step2_sub')} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <SelectCard active={styleKey === ''} title={t('let_ai_choose')} sub={t('let_ai_choose_sub')} onClick={() => setStyleKey('')} />
          </div>
          <div className="space-y-5 max-h-[40vh] overflow-y-auto pr-1">
            {styleGroups.map(([grp, items]) => (
              <div key={grp}>
                <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-[var(--uc-text-muted)] mb-2">{grp}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {items.map((s) => (
                    <SelectCard
                      key={s.key}
                      active={styleKey === s.key}
                      title={`${s.name}${s.era ? ` · ${s.era}` : ''}`}
                      sub={s.when_to_use ?? s.description ?? undefined}
                      onClick={() => setStyleKey(s.key)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
          {/* Framework é jargão de copy — escondido em "Avançado". Auto cobre 99%. */}
          <details className="rounded-2xl uc-glass px-4 py-3 group">
            <summary className="cursor-pointer list-none flex items-center justify-between text-sm font-semibold text-[var(--uc-text-soft)] hover:text-[var(--uc-text)]">
              <span>{t('advanced_structure')}</span>
              <span className="text-[var(--uc-text-faint)] group-open:rotate-90 uc-transition-fast"><Icon name="chevron-right" size={16} /></span>
            </summary>
            <div className="pt-3">
              <p className="text-xs text-[var(--uc-text-muted)] leading-5 mb-2">
                {t('advanced_hint')}
              </p>
              <select className={cn(fieldCls, 'h-12')} value={frameworkKey} onChange={(e) => setFrameworkKey(e.target.value)}>
                <option value="">{t('auto_recommended')}</option>
                {frameworks.map((f) => (
                  <option key={f.key} value={f.key}>{f.name}{f.structure ? ` — ${f.structure.slice(0, 60)}` : ''}</option>
                ))}
              </select>
            </div>
          </details>
          <div className="flex justify-between pt-1">
            <GlassButton variant="ghost" onClick={() => setStep(0)}><Icon name="chevron-left" size={16} />{tc('back')}</GlassButton>
            <GlassButton onClick={() => setStep(2)}>{tc('continue')}<Icon name="chevron-right" size={16} /></GlassButton>
          </div>
        </GlassCard>
      )}

      {/* STEP 3 — Contexto + brief */}
      {step === 2 && (
        <GlassCard className="p-6 space-y-5">
          <Header title={t('step3_title')} sub={t('step3_sub')} />

          {(products.length > 0 || campaigns.length > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {products.length > 0 && (
                <div>
                  <label className="text-xs font-semibold tracking-wide uppercase text-[var(--uc-text-muted)] mb-1.5 block">{t('store_product')} <span className="normal-case text-[var(--uc-text-faint)]">{tc('optional')}</span></label>
                  <select className={cn(fieldCls, 'h-12')} value={productId} onChange={(e) => setProductId(e.target.value)}>
                    <option value="">{tc('none')}</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}
              {campaigns.length > 0 && (
                <div>
                  <label className="text-xs font-semibold tracking-wide uppercase text-[var(--uc-text-muted)] mb-1.5 block">{t('campaign')} <span className="normal-case text-[var(--uc-text-faint)]">{tc('optional')}</span></label>
                  <select className={cn(fieldCls, 'h-12')} value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
                    <option value="">{tc('none')}</option>
                    {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="text-xs font-semibold tracking-wide uppercase text-[var(--uc-text-muted)] mb-1.5 block">{t('brief')}</label>
            <textarea rows={5} className={cn(fieldCls, 'py-3 resize-y leading-7')} placeholder={t('brief_placeholder')} value={brief} onChange={(e) => setBrief(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-4 max-w-sm">
            <div>
              <label className="text-xs font-semibold tracking-wide uppercase text-[var(--uc-text-muted)] mb-1.5 block">{t('variations')}</label>
              <select className={cn(fieldCls, 'h-12')} value={n} onChange={(e) => setN(Number(e.target.value))}>
                {[1, 2, 3, 4, 5].map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold tracking-wide uppercase text-[var(--uc-text-muted)] mb-1.5 block">{t('model')}</label>
              <select className={cn(fieldCls, 'h-12')} value={model} onChange={(e) => setModel(e.target.value)}>
                {MODELS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
          </div>

          {/* Resumo das escolhas */}
          <div className="flex flex-wrap gap-2 text-xs">
            <Chip label={t('chip_content')} value={selectedPiece?.name ?? '—'} />
            <Chip label={t('chip_style')} value={selectedStyle ? selectedStyle.name : t('auto')} />
          </div>

          <div className="flex justify-between items-center pt-1">
            <GlassButton variant="ghost" onClick={() => setStep(1)}><Icon name="chevron-left" size={16} />{tc('back')}</GlassButton>
            <GlassButton size="lg" loading={loading} disabled={!pieceTypeKey} onClick={onGenerate}>
              {!loading && <Icon name="spark" size={18} />}{loading ? t('generating') : t('generateCopy')}
            </GlassButton>
          </div>
        </GlassCard>
      )}
    </div>
  )
}

function Header({ title, sub }: { title: string; sub: string }) {
  return (
    <div>
      <h2 className="text-2xl font-bold text-[var(--uc-text)] tracking-tight">{title}</h2>
      <p className="text-sm text-[var(--uc-text-soft)] mt-1">{sub}</p>
    </div>
  )
}

function SelectCard({ active, title, sub, onClick }: { active: boolean; title: string; sub?: string | null; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'text-left rounded-2xl p-4 border uc-transition-fast cursor-pointer',
        active
          ? 'border-[var(--uc-accent-ring)] bg-[var(--uc-accent-soft)] shadow-[0_0_0_3px_var(--uc-accent-soft-2)]'
          : 'border-[var(--uc-border)] bg-[var(--uc-bg-mute)] hover:border-[var(--uc-border-strong)] hover:-translate-y-0.5',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-[var(--uc-text)]">{title}</span>
        {active && <Icon name="sparkle" size={14} className="text-[var(--uc-accent)] shrink-0" />}
      </div>
      {sub && <p className="text-xs text-[var(--uc-text-muted)] mt-1 line-clamp-2 leading-5">{sub}</p>}
    </button>
  )
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 bg-[var(--uc-surface-soft)] text-[var(--uc-text-soft)]">
      <span className="text-[var(--uc-text-muted)]">{label}:</span>
      <span className="font-semibold text-[var(--uc-text)]">{value}</span>
    </span>
  )
}

function LoadingCard({ n, t }: { n: number; t: TFn }) {
  return (
    <GlassCard className="p-12 flex flex-col items-center gap-4 text-center">
      <span className="inline-block size-8 rounded-full border-2 border-[var(--uc-accent)] border-r-transparent animate-spin" />
      <p className="text-sm text-[var(--uc-text-soft)]">{t('writing_variations', { count: n })}</p>
    </GlassCard>
  )
}

function ErrorBox({ paywall, text, t }: { paywall: boolean; text: string; t: TFn }) {
  return (
    <div className={cn(
      'rounded-2xl px-4 py-3 text-sm leading-6',
      paywall
        ? 'border border-[var(--uc-accent-soft-3)] bg-[var(--uc-accent-soft)] text-[var(--uc-accent-strong)]'
        : 'border border-[var(--uc-danger)]/40 bg-[var(--uc-danger)]/10 text-[var(--uc-danger)]',
    )}>
      {paywall ? t('plan_limit_reached') : ''}{text}
    </div>
  )
}

function VariationCard({
  slug, variation, index, resolved, onSaved, t,
}: {
  slug: string
  variation: Variation
  index: number
  resolved: Record<string, string | null>
  onSaved: (copyId: string) => void
  t: TFn
}) {
  const tc = useTranslations('common')
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function save() {
    setSaving(true); setErr(null)
    const res = await saveCopy(slug, {
      title: variation.title,
      content: variation.content,
      category_key: resolved.category_key,
      piece_type_key: resolved.piece_type_key,
      style_key: resolved.style_key,
      framework_key: resolved.framework_key,
      product_id: resolved.product_id,
      campaign_id: resolved.campaign_id,
    })
    setSaving(false)
    if (!res.ok) { setErr(res.message); return }
    onSaved(res.data.id)
  }

  async function copy() {
    await navigator.clipboard.writeText(variation.content)
    setCopied(true); setTimeout(() => setCopied(false), 1500)
  }

  return (
    <GlassCard className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-[var(--uc-text-muted)]">{t('variation_n', { n: index + 1 })}</p>
          <h3 className="text-lg font-semibold text-[var(--uc-text)] mt-1">{variation.title}</h3>
          {variation.angle && <p className="text-sm text-[var(--uc-accent)] mt-0.5">{variation.angle}</p>}
        </div>
        <div className="flex gap-2 shrink-0">
          <GlassButton size="sm" variant="ghost" onClick={copy}>{copied ? tc('copied') : tc('copy')}</GlassButton>
          <GlassButton size="sm" loading={saving} onClick={save}>{t('save_to_library')}</GlassButton>
        </div>
      </div>
      <div className="rounded-xl bg-[var(--uc-bg-mute)] p-4 text-[15px] leading-7 text-[var(--uc-text)] whitespace-pre-wrap">{variation.content}</div>
      {err && <p className="text-sm text-[var(--uc-danger)]">{err}</p>}
    </GlassCard>
  )
}
