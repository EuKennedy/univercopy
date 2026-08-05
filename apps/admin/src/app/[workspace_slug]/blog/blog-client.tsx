'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'

import { Icon } from '@/components/shell/icon'
import { GlassButton, GlassCard, fieldCls, labelCls } from '@/components/ui'
import { cn } from '@/lib/cn'
import {
  createBlogCategory,
  createBlogTag,
  generateBlogContent,
  generateBlogCover,
  generateBlogTitle,
  loadBlogCategories,
  loadBlogStatus,
  loadBlogTags,
  publishBlogPost,
  uploadBlogCover,
} from '@/lib/api/mutations'
import type { BlogMedia, BlogPostResult, BlogStatus, BlogTerm } from '@/lib/api/types'

import { GenerationModal, type GenerationKind } from './generation-modal'
import { TermPicker } from './term-picker'

type Pending = 'draft' | 'publish' | 'title' | 'content' | 'cover' | 'upload' | null

const ACCEPTED_MIMES = ['image/jpeg', 'image/png', 'image/webp']
// 8MB: casa com MAX_UPLOAD_BYTES no Rails e cabe no bodySizeLimit do server
// action depois do inchaço do base64.
const MAX_COVER_BYTES = 8 * 1024 * 1024

export function BlogClient({ slug }: { slug: string }) {
  const t = useTranslations('blog')
  const fileInput = useRef<HTMLInputElement>(null)

  const [status, setStatus] = useState<BlogStatus | null>(null)
  const [categories, setCategories] = useState<BlogTerm[]>([])
  const [tags, setTags] = useState<BlogTerm[]>([])
  const [categoriesFailed, setCategoriesFailed] = useState(false)
  const [tagsFailed, setTagsFailed] = useState(false)

  const [brief, setBrief] = useState('')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [excerpt, setExcerpt] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<Set<number>>(new Set())
  const [selectedTags, setSelectedTags] = useState<Set<number>>(new Set())
  const [cover, setCover] = useState<BlogMedia | null>(null)

  const [pending, setPending] = useState<Pending>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<BlogPostResult | null>(null)

  // Status, categorias e tags em paralelo — round-trips independentes pro
  // WordPress. A tela abre na hora e vai preenchendo.
  useEffect(() => {
    let alive = true

    loadBlogStatus(slug).then((r) => {
      if (alive) setStatus(r.ok ? r.data : { connected: false, reachable: false })
    })
    loadBlogCategories(slug).then((r) => {
      if (!alive) return
      if (r.ok) setCategories(r.data)
      else setCategoriesFailed(true)
    })
    loadBlogTags(slug).then((r) => {
      if (!alive) return
      if (r.ok) setTags(r.data)
      else setTagsFailed(true)
    })

    return () => {
      alive = false
    }
  }, [slug])

  const notConnected = status !== null && !status.connected
  const unreachable = status !== null && status.connected && !status.reachable
  const hasOpenai = status?.openai === true
  const busy = pending !== null
  const incomplete = !title.trim() || !content.trim()

  // O modal cobre só as três gerações por IA. Salvar/publicar e upload já têm
  // estado inline no próprio botão.
  const generating: GenerationKind | null =
    pending === 'title' || pending === 'content' || pending === 'cover' ? pending : null

  function toggle(set: Set<number>, apply: (next: Set<number>) => void, id: number) {
    const next = new Set(set)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    apply(next)
  }

  // --- geração com IA ---

  async function genTitle() {
    setPending('title'); setError(null)
    const res = await generateBlogTitle(slug, { brief: brief.trim() || undefined })
    setPending(null)
    if (!res.ok) { setError(res.message || t('error_generic')); return }
    setTitle(res.data.title)
  }

  async function genContent() {
    setPending('content'); setError(null)
    const res = await generateBlogContent(slug, {
      title: title.trim() || undefined,
      brief: brief.trim() || undefined,
    })
    setPending(null)
    if (!res.ok) { setError(res.message || t('error_generic')); return }
    setContent(res.data.content)
  }

  async function genCover() {
    setPending('cover'); setError(null)
    const res = await generateBlogCover(slug, {
      title: title.trim() || undefined,
      brief: brief.trim() || undefined,
    })
    setPending(null)
    if (!res.ok) { setError(res.message || t('error_generic')); return }
    setCover(res.data.media)
  }

  async function onPickFile(file: File | undefined) {
    if (!file) return

    if (!ACCEPTED_MIMES.includes(file.type)) {
      setError(t('cover_bad_format'))
      return
    }
    if (file.size > MAX_COVER_BYTES) {
      setError(t('cover_too_big'))
      return
    }

    setPending('upload'); setError(null)

    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(new Error('read_failed'))
      reader.readAsDataURL(file)
    }).catch(() => null)

    if (!base64) {
      setPending(null)
      setError(t('cover_read_failed'))
      return
    }

    const res = await uploadBlogCover(slug, {
      filename: file.name,
      mime: file.type,
      data_base64: base64,
      alt: title.trim() || undefined,
    })
    setPending(null)
    if (!res.ok) { setError(res.message || t('error_generic')); return }
    setCover(res.data.media)
  }

  // --- publicação ---

  async function submit(next: 'draft' | 'publish') {
    if (!title.trim()) { setError(t('error_title_required')); return }
    if (!content.trim()) { setError(t('error_content_required')); return }

    setPending(next); setError(null); setResult(null)

    const res = await publishBlogPost(slug, {
      title: title.trim(),
      content,
      excerpt: excerpt.trim() || undefined,
      status: next,
      category_ids: selectedCategories.size ? [...selectedCategories] : undefined,
      tag_ids: selectedTags.size ? [...selectedTags] : undefined,
      featured_media: cover?.id,
    })

    setPending(null)
    if (!res.ok) { setError(res.message || t('error_generic')); return }

    setResult(res.data)
    setTitle(''); setContent(''); setExcerpt(''); setBrief('')
    setSelectedCategories(new Set()); setSelectedTags(new Set()); setCover(null)
  }

  if (notConnected) {
    return (
      <GlassCard className="p-6 space-y-3">
        <p className="text-[15px] font-semibold text-[var(--uc-text)]">{t('unconfigured_title')}</p>
        <p className="text-sm text-[var(--uc-text-muted)]">{t('unconfigured_description')}</p>
        <Link
          href={`/${slug}/settings/integrations`}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--uc-accent-strong)] hover:underline"
        >
          {t('go_to_integrations')} →
        </Link>
      </GlassCard>
    )
  }

  return (
    <div className="space-y-5">
      <GenerationModal kind={generating} />

      {status?.site && !unreachable && (
        <p className="text-xs text-[var(--uc-text-muted)]">{t('connected', { host: status.site })}</p>
      )}

      {unreachable && (
        <GlassCard className="p-4">
          <p className="text-sm text-[var(--uc-danger)]">{t('unreachable_warning')}</p>
        </GlassCard>
      )}

      {/* Tema: orienta todas as gerações de IA da tela. */}
      <GlassCard className="p-6 space-y-2">
        <label htmlFor="blog-brief" className={labelCls}>{t('field_brief')}</label>
        <textarea
          id="blog-brief"
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          placeholder={t('field_brief_placeholder')}
          disabled={busy}
          rows={2}
          className={cn(fieldCls, 'py-3 resize-y')}
        />
        <p className="text-xs text-[var(--uc-text-faint)]">{t('field_brief_hint')}</p>
      </GlassCard>

      <GlassCard className="p-6 space-y-5">
        {/* Título */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="blog-title" className={cn(labelCls, 'mb-0')}>{t('field_title')}</label>
            <AiButton
              label={t('generate_ai')}
              loadingLabel={t('generating')}
              loading={pending === 'title'}
              disabled={busy}
              onClick={genTitle}
            />
          </div>
          <input
            id="blog-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('field_title_placeholder')}
            disabled={busy}
            className={cn(fieldCls, 'h-12')}
          />
        </div>

        {/* Conteúdo */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="blog-content" className={cn(labelCls, 'mb-0')}>{t('field_content')}</label>
            <AiButton
              label={t('generate_ai')}
              loadingLabel={t('generating')}
              loading={pending === 'content'}
              disabled={busy}
              onClick={genContent}
            />
          </div>
          <textarea
            id="blog-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={t('field_content_placeholder')}
            disabled={busy}
            rows={16}
            className={cn(fieldCls, 'py-3 resize-y leading-relaxed font-mono text-[13px]')}
          />
        </div>

        {/* Capa */}
        <div>
          <div className="flex items-center justify-between mb-1.5 gap-2 flex-wrap">
            <span className={cn(labelCls, 'mb-0')}>{t('field_cover')}</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => fileInput.current?.click()}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--uc-text-soft)] hover:text-[var(--uc-text)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Icon name={pending === 'upload' ? 'sparkle' : 'plus'} size={14} />
                {pending === 'upload' ? t('cover_uploading') : t('cover_upload')}
              </button>
              <AiButton
                label={t('generate_ai')}
                loadingLabel={t('cover_generating')}
                loading={pending === 'cover'}
                disabled={busy || !hasOpenai}
                onClick={genCover}
              />
            </div>
          </div>

          <input
            ref={fileInput}
            type="file"
            accept={ACCEPTED_MIMES.join(',')}
            className="hidden"
            onChange={(e) => {
              void onPickFile(e.target.files?.[0])
              e.target.value = ''
            }}
          />

          {cover?.url ? (
            <div className="relative rounded-2xl overflow-hidden border border-[var(--uc-border)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cover.url} alt={title || t('field_cover')} className="w-full max-h-72 object-cover" />
              <button
                type="button"
                disabled={busy}
                onClick={() => setCover(null)}
                className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold bg-[var(--uc-surface-2)]/90 text-[var(--uc-text)] hover:bg-[var(--uc-surface-overlay)] uc-transition disabled:opacity-50"
              >
                <Icon name="trash" size={13} />
                {t('cover_remove')}
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-[var(--uc-border)] px-4 py-6 text-center">
              <p className="text-xs text-[var(--uc-text-faint)]">
                {hasOpenai ? t('cover_empty') : t('cover_needs_openai')}
              </p>
              {!hasOpenai && (
                <Link
                  href={`/${slug}/settings/integrations`}
                  className="mt-1 inline-block text-xs font-semibold text-[var(--uc-accent-strong)] hover:underline"
                >
                  {t('go_to_integrations')} →
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Categorias e tags */}
        <div className="grid gap-5 sm:grid-cols-2">
          <TermPicker
            label={t('field_category')}
            terms={categories}
            selected={selectedCategories}
            onToggle={(id) => toggle(selectedCategories, setSelectedCategories, id)}
            onCreate={async (name) => {
              const res = await createBlogCategory(slug, name)
              if (!res.ok) return res.message || t('error_generic')
              setCategories((list) => (list.some((c) => c.id === res.data.id) ? list : [res.data, ...list]))
              setSelectedCategories((s) => new Set(s).add(res.data.id))
              return null
            }}
            disabled={busy}
            loadFailed={categoriesFailed}
            createPlaceholder={t('new_category_placeholder')}
          />

          <TermPicker
            label={t('field_tags')}
            terms={tags}
            selected={selectedTags}
            onToggle={(id) => toggle(selectedTags, setSelectedTags, id)}
            onCreate={async (name) => {
              const res = await createBlogTag(slug, name)
              if (!res.ok) return res.message || t('error_generic')
              setTags((list) => (list.some((c) => c.id === res.data.id) ? list : [res.data, ...list]))
              setSelectedTags((s) => new Set(s).add(res.data.id))
              return null
            }}
            disabled={busy}
            loadFailed={tagsFailed}
            createPlaceholder={t('new_tag_placeholder')}
          />
        </div>

        {/* Resumo */}
        <div>
          <label htmlFor="blog-excerpt" className={labelCls}>{t('field_excerpt')}</label>
          <textarea
            id="blog-excerpt"
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            placeholder={t('field_excerpt_placeholder')}
            disabled={busy}
            rows={2}
            className={cn(fieldCls, 'py-3 resize-y')}
          />
          <p className="mt-1.5 text-xs text-[var(--uc-text-faint)]">{t('field_excerpt_hint')}</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <GlassButton
            variant="secondary"
            size="lg"
            loading={pending === 'draft'}
            disabled={busy || incomplete}
            onClick={() => submit('draft')}
          >
            {pending !== 'draft' && <Icon name="file-text" size={16} />}
            {pending === 'draft' ? t('saving') : t('save_draft')}
          </GlassButton>

          <GlassButton
            size="lg"
            loading={pending === 'publish'}
            disabled={busy || incomplete}
            onClick={() => submit('publish')}
          >
            {pending !== 'publish' && <Icon name="blog" size={16} />}
            {pending === 'publish' ? t('publishing') : t('publish_now')}
          </GlassButton>
        </div>

        {error && <p className="text-sm text-[var(--uc-danger)]">{error}</p>}
      </GlassCard>

      {result && (
        <GlassCard className="p-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-[var(--uc-text)]">
            {result.status === 'publish' ? t('success_publish') : t('success_draft')}
          </p>
          {result.url && (
            <a
              href={result.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold text-[var(--uc-accent-strong)] hover:underline"
            >
              {t('view_post')} →
            </a>
          )}
        </GlassCard>
      )}
    </div>
  )
}

function AiButton({
  label, loadingLabel, loading, disabled, onClick,
}: {
  label: string
  loadingLabel: string
  loading: boolean
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--uc-accent-strong)] hover:underline disabled:opacity-50 disabled:cursor-not-allowed disabled:no-underline"
    >
      <Icon name="sparkle" size={14} />
      {loading ? loadingLabel : label}
    </button>
  )
}
