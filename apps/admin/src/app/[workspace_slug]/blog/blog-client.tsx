'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'

import { Icon } from '@/components/shell/icon'
import { GlassButton, GlassCard, fieldCls, labelCls } from '@/components/ui'
import { cn } from '@/lib/cn'
import { loadBlogCategories, loadBlogStatus, publishBlogPost } from '@/lib/api/mutations'
import type { BlogCategory, BlogPostResult, BlogStatus } from '@/lib/api/types'

type Pending = 'draft' | 'publish' | null

export function BlogClient({ slug }: { slug: string }) {
  const t = useTranslations('blog')

  const [status, setStatus] = useState<BlogStatus | null>(null)
  const [categories, setCategories] = useState<BlogCategory[]>([])
  const [categoriesFailed, setCategoriesFailed] = useState(false)

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [excerpt, setExcerpt] = useState('')
  const [categoryId, setCategoryId] = useState('')

  const [pending, setPending] = useState<Pending>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<BlogPostResult | null>(null)

  // Status e categorias em paralelo — são round-trips SSH independentes.
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

    return () => {
      alive = false
    }
  }, [slug])

  const notConnected = status !== null && !status.connected
  const unreachable = status !== null && status.connected && !status.reachable
  const busy = pending !== null
  const incomplete = !title.trim() || !content.trim()

  async function submit(next: 'draft' | 'publish') {
    if (!title.trim()) {
      setError(t('error_title_required'))
      return
    }
    if (!content.trim()) {
      setError(t('error_content_required'))
      return
    }

    setPending(next)
    setError(null)
    setResult(null)

    const res = await publishBlogPost(slug, {
      title: title.trim(),
      content,
      excerpt: excerpt.trim() || undefined,
      status: next,
      category_ids: categoryId ? [Number(categoryId)] : undefined,
    })

    setPending(null)

    if (!res.ok) {
      setError(res.message || t('error_generic'))
      return
    }

    setResult(res.data)
    setTitle('')
    setContent('')
    setExcerpt('')
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
      {status?.site && !unreachable && (
        <p className="text-xs text-[var(--uc-text-muted)]">{t('connected', { host: status.site })}</p>
      )}

      {unreachable && (
        <GlassCard className="p-4">
          <p className="text-sm text-[var(--uc-danger)]">{t('unreachable_warning')}</p>
        </GlassCard>
      )}

      <GlassCard className="p-6 space-y-5">
        <div>
          <label htmlFor="blog-title" className={labelCls}>
            {t('field_title')}
          </label>
          <input
            id="blog-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('field_title_placeholder')}
            disabled={busy}
            className={cn(fieldCls, 'h-12')}
          />
        </div>

        <div>
          <label htmlFor="blog-content" className={labelCls}>
            {t('field_content')}
          </label>
          <textarea
            id="blog-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={t('field_content_placeholder')}
            disabled={busy}
            rows={14}
            className={cn(fieldCls, 'py-3 resize-y leading-relaxed')}
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="blog-excerpt" className={labelCls}>
              {t('field_excerpt')}
            </label>
            <textarea
              id="blog-excerpt"
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              placeholder={t('field_excerpt_placeholder')}
              disabled={busy}
              rows={3}
              className={cn(fieldCls, 'py-3 resize-y')}
            />
            <p className="mt-1.5 text-xs text-[var(--uc-text-faint)]">{t('field_excerpt_hint')}</p>
          </div>

          <div>
            <label htmlFor="blog-category" className={labelCls}>
              {t('field_category')}
            </label>
            <select
              id="blog-category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              disabled={busy || categories.length === 0}
              className={cn(fieldCls, 'h-12')}
            >
              <option value="">{t('category_none')}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.count})
                </option>
              ))}
            </select>
            {categoriesFailed && (
              <p className="mt-1.5 text-xs text-[var(--uc-danger)]">{t('categories_error')}</p>
            )}
          </div>
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
