'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

import { GlassButton, GlassCard } from '@/components/ui'
import { Icon } from '@/components/shell/icon'
import { cn } from '@/lib/cn'
import { generateCopy, saveCopy } from '@/lib/api/mutations'
import type {
  Category,
  Framework,
  PieceType,
  Style,
  Variation,
} from '@/lib/api/types'

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
  { value: 'auto', label: 'Auto Router' },
  { value: 'haiku', label: 'Haiku · rápido' },
  { value: 'sonnet', label: 'Sonnet · equilíbrio' },
  { value: 'opus', label: 'Opus · máximo' },
]

// Traduz códigos de erro do backend pra mensagem limpa (evita despejar
// hash cru da API Anthropic na UI).
function friendlyError(code: string, raw: string): string {
  switch (code) {
    case 'ai_failed':
      return 'A IA não respondeu agora. Verifique a configuração de IA do workspace ou tente novamente em instantes.'
    case 'feature_locked':
      return 'Esse recurso não está no seu plano atual.'
    case 'cap_reached':
      return 'Você atingiu o limite de uso de IA do mês.'
    default:
      return raw?.length > 160 ? 'Não foi possível gerar agora. Tente novamente.' : raw
  }
}

const labelCls = 'text-xs font-semibold tracking-wide uppercase text-[var(--uc-text-muted)] mb-1.5 block'
const fieldCls =
  'w-full h-12 px-4 rounded-2xl uc-glass uc-transition text-[15px] text-[var(--uc-text)] outline-none ' +
  'focus:border-[var(--uc-accent-ring)] focus:shadow-[0_0_0_4px_var(--uc-accent-soft-2)]'

export function GeneratorForm({ slug, pieceTypes, styles, frameworks, categories, products, campaigns, initialProductId = '' }: Props) {
  const router = useRouter()

  // Tipo de peça default: se veio de um produto, prioriza descrição de produto
  // detalhada; senão qualquer peça de e-commerce; senão a primeira da lista.
  const defaultPiece = initialProductId
    ? (pieceTypes.find((pt) => pt.key === 'ecom:desc-prod-longa')?.key
       || pieceTypes.find((pt) => pt.category_key === 'ecom')?.key
       || pieceTypes[0]?.key
       || '')
    : (pieceTypes[0]?.key ?? '')

  const [pieceTypeKey, setPieceTypeKey] = useState(defaultPiece)
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

  const catLabel = useMemo(() => {
    const m = new Map(categories.map((c) => [c.key, c.name]))
    return (key: string) => m.get(key) ?? key
  }, [categories])

  const pieceGroups = useMemo(() => {
    const groups = new Map<string, PieceType[]>()
    for (const pt of pieceTypes) {
      const arr = groups.get(pt.category_key) ?? []
      arr.push(pt)
      groups.set(pt.category_key, arr)
    }
    return [...groups.entries()]
  }, [pieceTypes])

  const styleGroups = useMemo(() => {
    const groups = new Map<string, Style[]>()
    for (const s of styles) {
      const k = s.grp ?? 'outros'
      const arr = groups.get(k) ?? []
      arr.push(s)
      groups.set(k, arr)
    }
    return [...groups.entries()]
  }, [styles])

  async function onGenerate() {
    setLoading(true)
    setError(null)
    setPaywall(false)
    setVariations([])

    const res = await generateCopy(slug, {
      piece_type_key: pieceTypeKey,
      style_key: styleKey || undefined,
      framework_key: frameworkKey || undefined,
      product_id: productId || undefined,
      campaign_id: campaignId || undefined,
      brief: brief.trim() || undefined,
      n,
      model,
    })

    setLoading(false)
    if (!res.ok) {
      if (res.error === 'feature_locked' || res.error === 'cap_reached') setPaywall(true)
      setError(friendlyError(res.error, res.message))
      return
    }
    setVariations(res.data.variations)
    setResolved(res.data.resolved as Record<string, string | null>)
    if (res.data.variations.length === 0) setError('A IA não devolveu variações. Tente um brief mais específico.')
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
      {/* Painel de controle */}
      <GlassCard className="p-6 h-fit lg:sticky lg:top-28 space-y-5">
        <div>
          <label className={labelCls} htmlFor="piece">Formato da peça <span className="normal-case text-[var(--uc-text-faint)]">(o que escrever)</span></label>
          <select id="piece" className={fieldCls} value={pieceTypeKey} onChange={(e) => setPieceTypeKey(e.target.value)}>
            {pieceGroups.map(([catKey, items]) => (
              <optgroup key={catKey} label={catLabel(catKey)}>
                {items.map((pt) => (
                  <option key={pt.key} value={pt.key}>{pt.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className={labelCls} htmlFor="style">Estilo <span className="normal-case text-[var(--uc-text-faint)]">(opcional)</span></label>
            <select id="style" className={fieldCls} value={styleKey} onChange={(e) => setStyleKey(e.target.value)}>
              <option value="">Auto (sugerido pela peça)</option>
              {styleGroups.map(([grp, items]) => (
                <optgroup key={grp} label={grp.toUpperCase()}>
                  {items.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
                </optgroup>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="fw">Framework <span className="normal-case text-[var(--uc-text-faint)]">(opcional)</span></label>
            <select id="fw" className={fieldCls} value={frameworkKey} onChange={(e) => setFrameworkKey(e.target.value)}>
              <option value="">Auto (sugerido pela peça)</option>
              {frameworks.map((f) => <option key={f.key} value={f.key}>{f.name}</option>)}
            </select>
          </div>
        </div>

        {products.length > 0 && (
          <div>
            <label className={labelCls} htmlFor="prod">Produto da loja <span className="normal-case text-[var(--uc-text-faint)]">(opcional — base da copy)</span></label>
            <select id="prod" className={fieldCls} value={productId} onChange={(e) => setProductId(e.target.value)}>
              <option value="">Nenhum</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        )}

        {campaigns.length > 0 && (
          <div>
            <label className={labelCls} htmlFor="camp">Campanha <span className="normal-case text-[var(--uc-text-faint)]">(opcional)</span></label>
            <select id="camp" className={fieldCls} value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
              <option value="">Nenhuma</option>
              {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}

        <div>
          <label className={labelCls} htmlFor="brief">Brief</label>
          <textarea
            id="brief"
            rows={4}
            className={cn(fieldCls, 'h-auto py-3 resize-y leading-6')}
            placeholder="Objetivo, oferta, ângulo, contexto. Quanto mais específico, melhor a copy."
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls} htmlFor="n">Variações</label>
            <select id="n" className={fieldCls} value={n} onChange={(e) => setN(Number(e.target.value))}>
              {[1, 2, 3, 4, 5].map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="model">Modelo</label>
            <select id="model" className={fieldCls} value={model} onChange={(e) => setModel(e.target.value)}>
              {MODELS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
        </div>

        <GlassButton className="w-full" size="lg" loading={loading} disabled={!pieceTypeKey} onClick={onGenerate}>
          {!loading && <Icon name="spark" size={18} />}
          {loading ? 'Gerando…' : 'Gerar copy'}
        </GlassButton>

        {error && (
          <div className={cn(
            'rounded-xl px-4 py-3 text-sm leading-6',
            paywall
              ? 'border border-[var(--uc-accent-soft-3)] bg-[var(--uc-accent-soft)] text-[var(--uc-accent-strong)]'
              : 'border border-[var(--uc-danger)]/40 bg-[var(--uc-danger)]/10 text-[var(--uc-danger)]',
          )}>
            {paywall ? 'Limite do plano atingido. ' : ''}{error}
          </div>
        )}
      </GlassCard>

      {/* Resultados */}
      <div className="space-y-4 min-w-0">
        {variations.length === 0 && !loading && (
          <GlassCard variant="strong" className="p-12 flex flex-col items-center text-center gap-4">
            <span
              className="flex items-center justify-center size-14 rounded-2xl text-white"
              style={{ background: 'linear-gradient(135deg, var(--uc-brand-purple) 0%, var(--uc-brand-blue) 100%)' }}
            >
              <Icon name="sparkle" size={26} />
            </span>
            <div className="space-y-1.5 max-w-sm">
              <h3 className="text-xl font-bold text-[var(--uc-text)]">Pronto pra gerar</h3>
              <p className="text-sm leading-6 text-[var(--uc-text-soft)]">
                Escolha a peça, ajuste estilo e framework, escreva o brief. A IA combina com o DNA da marca e devolve variações pra você escolher.
              </p>
            </div>
          </GlassCard>
        )}

        {loading && (
          <GlassCard className="p-12 flex flex-col items-center gap-4 text-center">
            <span className="inline-block size-8 rounded-full border-2 border-[var(--uc-accent)] border-r-transparent animate-spin" />
            <p className="text-sm text-[var(--uc-text-soft)]">Escrevendo {n} {n === 1 ? 'variação' : 'variações'} com base no seu DNA…</p>
          </GlassCard>
        )}

        {variations.map((v, i) => (
          <VariationCard key={i} slug={slug} variation={v} index={i} resolved={resolved} onSaved={(id) => router.push(`/${slug}/copy/${id}`)} />
        ))}
      </div>
    </div>
  )
}

function VariationCard({
  slug, variation, index, resolved, onSaved,
}: {
  slug: string
  variation: Variation
  index: number
  resolved: Record<string, string | null>
  onSaved: (copyId: string) => void
}) {
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function save() {
    setSaving(true)
    setErr(null)
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
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <GlassCard className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-[var(--uc-text-muted)]">
            Variação {index + 1}
          </p>
          <h3 className="text-lg font-semibold text-[var(--uc-text)] mt-1">{variation.title}</h3>
          {variation.angle && <p className="text-sm text-[var(--uc-accent)] mt-0.5">{variation.angle}</p>}
        </div>
        <div className="flex gap-2 shrink-0">
          <GlassButton size="sm" variant="ghost" onClick={copy}>{copied ? 'Copiado!' : 'Copiar'}</GlassButton>
          <GlassButton size="sm" loading={saving} onClick={save}>Salvar no acervo</GlassButton>
        </div>
      </div>
      <div className="rounded-xl bg-[var(--uc-bg-mute)] p-4 text-[15px] leading-7 text-[var(--uc-text)] whitespace-pre-wrap">
        {variation.content}
      </div>
      {err && <p className="text-sm text-[var(--uc-danger)]">{err}</p>}
    </GlassCard>
  )
}
