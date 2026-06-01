'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

import { GlassButton, GlassCard } from '@/components/ui'
import { Icon } from '@/components/shell/icon'
import { cn } from '@/lib/cn'
import { generateProductField, publishProduct } from '@/lib/api/mutations'
import type { ProductDetail, ProductFaq } from '@/lib/api/types'

import { RichTextField } from './rich-text-field'
import { FaqIcon, FAQ_ICON_VALUES } from './faq-icons'

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
  const t = useTranslations('products')
  const tc = useTranslations('common')
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
      ? { ok: true, text: t('published_ok') }
      : { ok: false, text: res.error === 'no_connector' ? t('no_connector') : res.message })
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
            <label className={label}>{t('product_title')}</label>
            <AiButton slug={slug} id={product.id} field="name" onResult={(v) => patch('name', String(v))} />
          </div>
          <input className={field} value={form.name} onChange={(e) => patch('name', e.target.value)} />
          {product.categories.length > 0 && (
            <p className="text-xs text-[var(--uc-text-muted)]">{t('categories_label', { list: product.categories.join(', ') })}</p>
          )}
        </div>
        <div className="flex flex-col gap-2 w-full sm:w-auto items-stretch sm:items-end">
          <GlassButton size="lg" loading={publishing} onClick={publish}>
            <Icon name="product" size={16} />{t('publish_woo')}
          </GlassButton>
          {product.permalink && (
            <a href={product.permalink} target="_blank" rel="noreferrer" className="text-xs text-[var(--uc-text-muted)] hover:text-[var(--uc-accent)]">{t('view_in_store')}</a>
          )}
          {msg && <span className={cn('text-sm', msg.ok ? 'text-emerald-400' : 'text-[var(--uc-danger)]')}>{msg.text}</span>}
        </div>
      </GlassCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Geral */}
        <Section title={t('section_general')}>
          <div className="grid grid-cols-2 gap-4">
            <Field label={t('price')}><input className={field} value={form.regular_price} onChange={(e) => patch('regular_price', e.target.value)} inputMode="decimal" /></Field>
            <Field label={t('sale_price')}><input className={field} value={form.sale_price} onChange={(e) => patch('sale_price', e.target.value)} inputMode="decimal" /></Field>
          </div>
        </Section>

        {/* Estoque */}
        <Section title={t('section_stock')}>
          <div className="grid grid-cols-2 gap-4">
            <Field label={t('sku')}><input className={field} value={form.sku} onChange={(e) => patch('sku', e.target.value)} /></Field>
            <Field label={t('quantity')}><input className={field} value={form.stock_quantity} onChange={(e) => patch('stock_quantity', e.target.value)} inputMode="numeric" disabled={!form.manage_stock} /></Field>
          </div>
          <div className="flex items-center gap-4 mt-3">
            <label className="flex items-center gap-2 text-sm text-[var(--uc-text)] cursor-pointer">
              <input type="checkbox" checked={form.manage_stock} onChange={(e) => patch('manage_stock', e.target.checked)} />
              {t('manage_stock')}
            </label>
            <div className="flex-1">
              <select className={cn(field, 'py-2')} value={form.backorders} onChange={(e) => patch('backorders', e.target.value)}>
                <option value="no">{t('backorder_no')}</option>
                <option value="notify">{t('backorder_notify')}</option>
                <option value="yes">{t('backorder_yes')}</option>
              </select>
            </div>
          </div>
        </Section>
      </div>

      {/* Descrição longa */}
      <Section title={t('section_description')} ai={<AiButton slug={slug} id={product.id} field="description_html" onResult={(v) => patch('description_html', String(v))} />}>
        <RichTextField value={form.description_html} onChange={(v) => patch('description_html', v)} rows={8} />
        <p className="text-xs text-[var(--uc-text-faint)] mt-1.5">{t('description_html_hint')}</p>
      </Section>

      {/* Breve descrição (bullets) */}
      <Section title={t('section_short')} ai={<AiButton slug={slug} id={product.id} field="short_description_html" onResult={(v) => patch('short_description_html', String(v))} />}>
        <RichTextField value={form.short_description_html} onChange={(v) => patch('short_description_html', v)} rows={5} />
      </Section>

      {/* Entrega */}
      <Section title={t('section_delivery')}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Field label={t('weight')}><input className={field} value={form.weight} onChange={(e) => patch('weight', e.target.value)} inputMode="decimal" /></Field>
          <Field label={t('length')}><input className={field} value={form.dimensions.length} onChange={(e) => patch('dimensions', { ...form.dimensions, length: e.target.value })} inputMode="decimal" /></Field>
          <Field label={t('width')}><input className={field} value={form.dimensions.width} onChange={(e) => patch('dimensions', { ...form.dimensions, width: e.target.value })} inputMode="decimal" /></Field>
          <Field label={t('height')}><input className={field} value={form.dimensions.height} onChange={(e) => patch('dimensions', { ...form.dimensions, height: e.target.value })} inputMode="decimal" /></Field>
        </div>
      </Section>

      {/* Tags */}
      <Section title={t('section_tags')} ai={<AiButton slug={slug} id={product.id} field="tags" onResult={(v) => Array.isArray(v) && patch('tags', v.map(String))} />}>
        <ChipsInput value={form.tags} onChange={(tags) => patch('tags', tags)} placeholder={t('add_tag')} />
      </Section>

      {/* Sobre o Produto */}
      <Section title={t('section_about')}>
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <label className={label}>{t('about_title')}</label>
          <AiButton slug={slug} id={product.id} field="about_title" onResult={(v) => patch('about', { ...form.about, title: String(v) })} />
        </div>
        <input className={field} value={form.about.title} onChange={(e) => patch('about', { ...form.about, title: e.target.value })} />
        <div className="flex items-center justify-between gap-2 mt-4 mb-1.5">
          <label className={label}>{t('about_description')}</label>
          <AiButton slug={slug} id={product.id} field="about_description" onResult={(v) => patch('about', { ...form.about, description: String(v) })} />
        </div>
        <RichTextField value={form.about.description} onChange={(v) => patch('about', { ...form.about, description: v })} rows={5} />
      </Section>

      {/* FAQ do Produto */}
      <Section
        title={t('section_faq')}
        ai={<AiButton slug={slug} id={product.id} field="faq" label={t('faq_generate')} onResult={(v) => Array.isArray(v) && patch('faq', v as ProductFaq[])} />}
      >
        <div className="space-y-3">
          {form.faq.map((f, i) => {
            const update = (p: Partial<ProductFaq>) => {
              const next = [...form.faq]; next[i] = { ...f, ...p }; patch('faq', next)
            }
            return (
              <div key={i} className="rounded-2xl border border-[var(--uc-border)] bg-[var(--uc-bg-mute)] p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="size-10 shrink-0 rounded-xl grid place-items-center bg-[var(--uc-accent-soft)] text-[var(--uc-accent)]">
                    <FaqIcon value={f.icon_value} size={20} />
                  </span>
                  <input className={cn(field, 'flex-1')} placeholder={t('faq_question')} value={f.title} onChange={(e) => update({ title: e.target.value })} />
                  <GlassButton size="sm" variant="ghost" onClick={() => patch('faq', form.faq.filter((_, j) => j !== i))}>{tc('remove')}</GlassButton>
                </div>

                {/* Picker de ícone (presets do plugin) */}
                <div>
                  <p className="text-[10px] font-bold tracking-wide uppercase text-[var(--uc-text-muted)] mb-1.5">{t('faq_icon')}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {FAQ_ICON_VALUES.map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => update({ icon_type: 'preset', icon_value: v })}
                        title={v}
                        className={cn(
                          'size-9 rounded-lg grid place-items-center uc-transition-fast cursor-pointer border',
                          f.icon_value === v
                            ? 'border-[var(--uc-accent-ring)] bg-[var(--uc-accent-soft)] text-[var(--uc-accent)]'
                            : 'border-[var(--uc-border)] text-[var(--uc-text-muted)] hover:text-[var(--uc-text)] hover:border-[var(--uc-border-strong)]',
                        )}
                      >
                        <FaqIcon value={v} size={16} />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Resposta — editor visual */}
                <div>
                  <p className="text-[10px] font-bold tracking-wide uppercase text-[var(--uc-text-muted)] mb-1.5">{t('faq_answer')}</p>
                  <RichTextField value={f.content} onChange={(v) => update({ content: v })} rows={3} />
                </div>
              </div>
            )
          })}
          <GlassButton size="sm" variant="secondary" onClick={() => patch('faq', [...form.faq, { title: '', content: '', icon_type: 'preset', icon_value: 'help-circle' }])}>{t('faq_new')}</GlassButton>
        </div>
      </Section>

      {/* Publicar (rodapé) */}
      <div className="flex items-center justify-end gap-3 pt-2">
        {msg && <span className={cn('text-sm', msg.ok ? 'text-emerald-400' : 'text-[var(--uc-danger)]')}>{msg.text}</span>}
        <GlassButton size="lg" loading={publishing} onClick={publish}><Icon name="product" size={16} />{t('publish_woo')}</GlassButton>
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

function ChipsInput({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [draft, setDraft] = useState('')
  return (
    <div className="flex flex-wrap gap-2 items-center">
      {value.map((tag, i) => (
        <span key={i} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm bg-[var(--uc-accent-soft)] text-[var(--uc-accent)]">
          {tag}
          <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="cursor-pointer hover:text-[var(--uc-danger)]">×</button>
        </span>
      ))}
      <input
        className="flex-1 min-w-[140px] h-9 px-3 rounded-xl uc-glass text-sm text-[var(--uc-text)] outline-none"
        placeholder={placeholder}
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
  slug, id, field, label: text, onResult,
}: {
  slug: string
  id: string
  field: string
  label?: string
  onResult: (value: unknown) => void
}) {
  const t = useTranslations('products')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const buttonLabel = text ?? t('ai_generate')

  async function run() {
    setBusy(true); setErr(null)
    const res = await generateProductField(slug, id, field)
    setBusy(false)
    if (!res.ok) {
      setErr(res.error === 'feature_locked' ? t('ai_out_of_plan') : res.error === 'cap_reached' ? t('ai_cap') : t('ai_failed'))
      return
    }
    onResult(res.data.value)
  }

  return (
    <span className="inline-flex items-center gap-2">
      {err && <span className="text-xs text-[var(--uc-danger)]">{err}</span>}
      <GlassButton size="sm" variant="secondary" loading={busy} onClick={run}>
        <Icon name="sparkle" size={14} />{buttonLabel}
      </GlassButton>
    </span>
  )
}
