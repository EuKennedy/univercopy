'use client'

import { useState } from 'react'

import { GlassButton, GlassCard } from '@/components/ui'
import { Icon } from '@/components/shell/icon'
import { cn } from '@/lib/cn'
import { generateProductField, publishProduct } from '@/lib/api/mutations'
import type { ProductDetail, ProductFaq } from '@/lib/api/types'

import { RichTextField } from './rich-text-field'

const field =
  'w-full px-4 py-2.5 rounded-xl uc-glass uc-transition text-[15px] text-[var(--uc-text)] outline-none leading-6 ' +
  'focus:border-[var(--uc-accent-ring)] focus:shadow-[0_0_0_4px_var(--uc-accent-soft-2)]'
const label = 'text-xs font-semibold tracking-wide uppercase text-[var(--uc-text-muted)] mb-1.5 block'

type Form = {
  name: string
  sku: string
  regular_price: string
  sale_price: string
  description_html: string
  short_description_html: string
  tags: string[]
  manage_stock: boolean
  stock_quantity: string
  backorders: string
  weight: string
  dimensions: { length: string; width: string; height: string }
  about: { title: string; description: string }
  faq: ProductFaq[]
  attributes: { name: string; options: string[] }[]
}

function toForm(p: ProductDetail): Form {
  return {
    name: p.name ?? '',
    sku: p.sku ?? '',
    regular_price: p.regular_price != null ? String(p.regular_price) : '',
    sale_price: p.sale_price != null ? String(p.sale_price) : '',
    description_html: p.description_html ?? '',
    short_description_html: p.short_description_html ?? '',
    tags: p.tags ?? [],
    manage_stock: !!p.manage_stock,
    stock_quantity: p.stock_quantity != null ? String(p.stock_quantity) : '',
    backorders: p.backorders ?? 'no',
    weight: p.weight ?? '',
    dimensions: {
      length: p.dimensions?.length ?? '',
      width: p.dimensions?.width ?? '',
      height: p.dimensions?.height ?? '',
    },
    about: { title: p.about?.title ?? '', description: p.about?.description ?? '' },
    faq: p.faq ?? [],
    attributes: (p.attributes ?? []).map((a) => ({ name: a.name, options: a.options })),
  }
}

export function ProductEditor({ slug, product }: { slug: string; product: ProductDetail }) {
  const [form, setForm] = useState<Form>(toForm(product))
  const [publishing, setPublishing] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  function patch<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function publish() {
    setPublishing(true); setMsg(null)
    const payload = {
      name: form.name,
      sku: form.sku,
      regular_price: form.regular_price,
      sale_price: form.sale_price,
      description_html: form.description_html,
      short_description_html: form.short_description_html,
      tags: form.tags,
      manage_stock: form.manage_stock,
      stock_quantity: form.stock_quantity,
      backorders: form.backorders,
      weight: form.weight,
      dimensions: form.dimensions,
      category_ids: product.categories_full.map((c) => c.id),
      attributes: form.attributes,
      about: form.about,
      faq: form.faq,
    }
    const res = await publishProduct(slug, product.id, payload)
    setPublishing(false)
    setMsg(res.ok
      ? { ok: true, text: 'Publicado no WooCommerce.' }
      : { ok: false, text: res.error === 'no_connector' ? 'Conecte a loja WooCommerce primeiro.' : res.message })
  }

  const mainImage = product.images?.[0]

  return (
    <div className="space-y-5">
      {/* Cabeçalho: imagem + título + publicar */}
      <GlassCard className="p-6 flex flex-wrap gap-5 items-start">
        <span className="size-24 rounded-2xl overflow-hidden bg-[var(--uc-bg-mute)] flex items-center justify-center shrink-0">
          {mainImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mainImage} alt="" className="size-full object-cover" />
          ) : <Icon name="product" size={28} className="text-[var(--uc-text-faint)]" />}
        </span>
        <div className="flex-1 min-w-[260px] space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label className={label}>Título do produto</label>
            <AiButton slug={slug} id={product.id} field="name" onResult={(v) => patch('name', String(v))} />
          </div>
          <input className={field} value={form.name} onChange={(e) => patch('name', e.target.value)} />
          {product.categories.length > 0 && (
            <p className="text-xs text-[var(--uc-text-muted)]">Categorias: {product.categories.join(', ')}</p>
          )}
        </div>
        <div className="flex flex-col gap-2 items-end">
          <GlassButton size="lg" loading={publishing} onClick={publish}>
            <Icon name="product" size={16} />Publicar no WooCommerce
          </GlassButton>
          {product.permalink && (
            <a href={product.permalink} target="_blank" rel="noreferrer" className="text-xs text-[var(--uc-text-muted)] hover:text-[var(--uc-accent)]">Ver na loja ↗</a>
          )}
          {msg && <span className={cn('text-sm', msg.ok ? 'text-emerald-400' : 'text-[var(--uc-danger)]')}>{msg.text}</span>}
        </div>
      </GlassCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Geral */}
        <Section title="Geral">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Preço (R$)"><input className={field} value={form.regular_price} onChange={(e) => patch('regular_price', e.target.value)} inputMode="decimal" /></Field>
            <Field label="Preço promocional (R$)"><input className={field} value={form.sale_price} onChange={(e) => patch('sale_price', e.target.value)} inputMode="decimal" /></Field>
          </div>
        </Section>

        {/* Estoque */}
        <Section title="Estoque">
          <div className="grid grid-cols-2 gap-4">
            <Field label="SKU"><input className={field} value={form.sku} onChange={(e) => patch('sku', e.target.value)} /></Field>
            <Field label="Quantidade"><input className={field} value={form.stock_quantity} onChange={(e) => patch('stock_quantity', e.target.value)} inputMode="numeric" disabled={!form.manage_stock} /></Field>
          </div>
          <div className="flex items-center gap-4 mt-3">
            <label className="flex items-center gap-2 text-sm text-[var(--uc-text)] cursor-pointer">
              <input type="checkbox" checked={form.manage_stock} onChange={(e) => patch('manage_stock', e.target.checked)} />
              Gerenciar estoque
            </label>
            <div className="flex-1">
              <select className={cn(field, 'py-2')} value={form.backorders} onChange={(e) => patch('backorders', e.target.value)}>
                <option value="no">Encomenda: não permitir</option>
                <option value="notify">Permitir, avisar cliente</option>
                <option value="yes">Permitir encomenda</option>
              </select>
            </div>
          </div>
        </Section>
      </div>

      {/* Descrição longa */}
      <Section title="Descrição do produto" ai={<AiButton slug={slug} id={product.id} field="description_html" onResult={(v) => patch('description_html', String(v))} />}>
        <RichTextField value={form.description_html} onChange={(v) => patch('description_html', v)} rows={8} />
        <p className="text-xs text-[var(--uc-text-faint)] mt-1.5">Aceita HTML. Renderiza na página do produto.</p>
      </Section>

      {/* Breve descrição (bullets) */}
      <Section title="Breve descrição (bullet points)" ai={<AiButton slug={slug} id={product.id} field="short_description_html" onResult={(v) => patch('short_description_html', String(v))} />}>
        <RichTextField value={form.short_description_html} onChange={(v) => patch('short_description_html', v)} rows={5} />
      </Section>

      {/* Entrega */}
      <Section title="Entrega">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Field label="Peso (kg)"><input className={field} value={form.weight} onChange={(e) => patch('weight', e.target.value)} inputMode="decimal" /></Field>
          <Field label="Comprimento (cm)"><input className={field} value={form.dimensions.length} onChange={(e) => patch('dimensions', { ...form.dimensions, length: e.target.value })} inputMode="decimal" /></Field>
          <Field label="Largura (cm)"><input className={field} value={form.dimensions.width} onChange={(e) => patch('dimensions', { ...form.dimensions, width: e.target.value })} inputMode="decimal" /></Field>
          <Field label="Altura (cm)"><input className={field} value={form.dimensions.height} onChange={(e) => patch('dimensions', { ...form.dimensions, height: e.target.value })} inputMode="decimal" /></Field>
        </div>
      </Section>

      {/* Tags */}
      <Section title="Tags do produto" ai={<AiButton slug={slug} id={product.id} field="tags" onResult={(v) => Array.isArray(v) && patch('tags', v.map(String))} />}>
        <ChipsInput value={form.tags} onChange={(t) => patch('tags', t)} />
      </Section>

      {/* Sobre o Produto */}
      <Section title="Sobre o Produto">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <label className={label}>Título</label>
          <AiButton slug={slug} id={product.id} field="about_title" onResult={(v) => patch('about', { ...form.about, title: String(v) })} />
        </div>
        <input className={field} value={form.about.title} onChange={(e) => patch('about', { ...form.about, title: e.target.value })} />
        <div className="flex items-center justify-between gap-2 mt-4 mb-1.5">
          <label className={label}>Descrição</label>
          <AiButton slug={slug} id={product.id} field="about_description" onResult={(v) => patch('about', { ...form.about, description: String(v) })} />
        </div>
        <RichTextField value={form.about.description} onChange={(v) => patch('about', { ...form.about, description: v })} rows={5} />
      </Section>

      {/* FAQ do Produto */}
      <Section
        title="FAQ do Produto"
        ai={<AiButton slug={slug} id={product.id} field="faq" label="Gerar FAQ com IA" onResult={(v) => Array.isArray(v) && patch('faq', v as ProductFaq[])} />}
      >
        <div className="space-y-3">
          {form.faq.map((f, i) => (
            <div key={i} className="rounded-xl bg-[var(--uc-bg-mute)] p-4 space-y-2">
              <div className="flex items-center gap-2">
                <input className={cn(field, 'flex-1')} placeholder="Pergunta" value={f.title} onChange={(e) => {
                  const next = [...form.faq]; next[i] = { ...f, title: e.target.value }; patch('faq', next)
                }} />
                <GlassButton size="sm" variant="ghost" onClick={() => patch('faq', form.faq.filter((_, j) => j !== i))}>Remover</GlassButton>
              </div>
              <textarea rows={3} className={cn(field, 'resize-y')} placeholder="Resposta" value={f.content} onChange={(e) => {
                const next = [...form.faq]; next[i] = { ...f, content: e.target.value }; patch('faq', next)
              }} />
            </div>
          ))}
          <GlassButton size="sm" variant="secondary" onClick={() => patch('faq', [...form.faq, { title: '', content: '' }])}>+ Nova pergunta</GlassButton>
        </div>
      </Section>

      {/* Publicar (rodapé) */}
      <div className="flex items-center justify-end gap-3 pt-2">
        {msg && <span className={cn('text-sm', msg.ok ? 'text-emerald-400' : 'text-[var(--uc-danger)]')}>{msg.text}</span>}
        <GlassButton size="lg" loading={publishing} onClick={publish}><Icon name="product" size={16} />Publicar no WooCommerce</GlassButton>
      </div>
    </div>
  )
}

function Section({ title, children, ai }: { title: string; children: React.ReactNode; ai?: React.ReactNode }) {
  return (
    <GlassCard className="p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="text-base font-semibold text-[var(--uc-text)]">{title}</h3>
        {ai}
      </div>
      {children}
    </GlassCard>
  )
}

function Field({ label: l, children }: { label: string; children: React.ReactNode }) {
  return <div><label className={label}>{l}</label>{children}</div>
}

function ChipsInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState('')
  return (
    <div className="flex flex-wrap gap-2 items-center">
      {value.map((t, i) => (
        <span key={i} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm bg-[var(--uc-accent-soft)] text-[var(--uc-accent)]">
          {t}
          <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="cursor-pointer hover:text-[var(--uc-danger)]">×</button>
        </span>
      ))}
      <input
        className="flex-1 min-w-[140px] h-9 px-3 rounded-xl uc-glass text-sm text-[var(--uc-text)] outline-none"
        placeholder="Adicionar tag + Enter"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && draft.trim()) { e.preventDefault(); onChange([...value, draft.trim()]); setDraft('') }
        }}
      />
    </div>
  )
}

function AiButton({
  slug, id, field, label: text = 'Gerar com IA', onResult,
}: {
  slug: string
  id: string
  field: string
  label?: string
  onResult: (value: unknown) => void
}) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function run() {
    setBusy(true); setErr(null)
    const res = await generateProductField(slug, id, field)
    setBusy(false)
    if (!res.ok) {
      setErr(res.error === 'feature_locked' ? 'Fora do plano' : res.error === 'cap_reached' ? 'Limite de IA' : 'Falhou')
      return
    }
    onResult(res.data.value)
  }

  return (
    <span className="inline-flex items-center gap-2">
      {err && <span className="text-xs text-[var(--uc-danger)]">{err}</span>}
      <GlassButton size="sm" variant="secondary" loading={busy} onClick={run}>
        <Icon name="sparkle" size={14} />{text}
      </GlassButton>
    </span>
  )
}
