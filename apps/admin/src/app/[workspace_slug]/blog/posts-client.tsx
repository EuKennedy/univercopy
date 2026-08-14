'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'

import { Icon } from '@/components/shell/icon'
import { GlassButton, GlassCard, fieldCls } from '@/components/ui'
import { cn } from '@/lib/cn'
import {
  deleteBlogPost,
  getBlogPost,
  listBlogPosts,
  publishBlogDraft,
  syncBlogPosts,
} from '@/lib/api/mutations'
import type { BlogPostDetail, BlogPostList, BlogPostRecord } from '@/lib/api/types'

type Filter = 'all' | 'draft' | 'wordpress'

// Ação em andamento, amarrada ao id do post — sem isso o spinner apareceria
// em todos os botões da lista de uma vez.
type Busy = { id: string; kind: 'publish' | 'draft' | 'delete' | 'open' } | null

export function PostsClient({
  slug,
  onEdit,
}: {
  slug: string
  /** Carrega o rascunho no editor da aba "Postar". */
  onEdit: (post: BlogPostDetail) => void
}) {
  const t = useTranslations('blog')

  const [data, setData] = useState<BlogPostList | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<Busy>(null)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await listBlogPosts(slug, {
      origin: filter === 'wordpress' ? 'wordpress' : undefined,
      status: filter === 'draft' ? 'draft' : undefined,
      q: query.trim() || undefined,
    })
    setLoading(false)
    if (!res.ok) {
      setError(res.message || t('error_generic'))
      return
    }
    setError(null)
    setData(res.data)
  }, [slug, filter, query, t])

  // Busca digitada espera o usuário parar — um request por tecla derrubaria
  // a lista de 500 posts a cada letra.
  useEffect(() => {
    const id = setTimeout(() => { void load() }, query ? 350 : 0)
    return () => clearTimeout(id)
  }, [load, query])

  async function onSync() {
    setSyncing(true); setError(null); setNotice(null)
    const res = await syncBlogPosts(slug)
    setSyncing(false)
    if (!res.ok) { setError(res.message || t('error_generic')); return }
    setNotice(t('posts_sync_queued'))
  }

  async function onOpen(post: BlogPostRecord) {
    setBusy({ id: post.id, kind: 'open' }); setError(null)
    const res = await getBlogPost(slug, post.id)
    setBusy(null)
    if (!res.ok) { setError(res.message || t('error_generic')); return }
    onEdit(res.data)
  }

  async function onPublish(post: BlogPostRecord, status: 'draft' | 'publish') {
    setBusy({ id: post.id, kind: status === 'publish' ? 'publish' : 'draft' })
    setError(null); setNotice(null)

    const res = await publishBlogDraft(slug, post.id, status)
    setBusy(null)
    if (!res.ok) { setError(res.message || t('error_generic')); return }

    setNotice(status === 'publish' ? t('posts_published') : t('posts_sent_as_draft'))
    void load()
  }

  async function onDelete(post: BlogPostRecord) {
    setBusy({ id: post.id, kind: 'delete' }); setError(null); setNotice(null)
    const res = await deleteBlogPost(slug, post.id)
    setBusy(null)
    if (!res.ok) { setError(res.message || t('error_generic')); return }
    void load()
  }

  const counts = data?.counts
  const posts = data?.posts ?? []

  return (
    <div className="space-y-4">
      {/* Filtros + busca + sync */}
      <GlassCard className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex gap-1.5 flex-wrap">
            <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}
              label={t('posts_filter_all')} count={counts?.total} />
            <FilterChip active={filter === 'draft'} onClick={() => setFilter('draft')}
              label={t('posts_filter_drafts')} count={counts?.drafts} />
            <FilterChip active={filter === 'wordpress'} onClick={() => setFilter('wordpress')}
              label={t('posts_filter_wordpress')} count={counts?.wordpress} />
          </div>

          <GlassButton size="sm" variant="secondary" loading={syncing} onClick={onSync}>
            {!syncing && <Icon name="layers" size={15} />}
            {syncing ? t('posts_syncing') : t('posts_sync')}
          </GlassButton>
        </div>

        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--uc-text-faint)]" aria-hidden>
            <Icon name="search" size={16} />
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('posts_search_placeholder')}
            aria-label={t('posts_search_placeholder')}
            className={cn(fieldCls, 'h-11 pl-10')}
          />
        </div>

        {data?.last_sync_at && (
          <p className="text-xs text-[var(--uc-text-faint)]">
            {t('posts_last_sync', { when: formatDate(data.last_sync_at) })}
          </p>
        )}
      </GlassCard>

      {notice && (
        <GlassCard className="p-3">
          <p className="text-sm text-[var(--uc-text-soft)]">{notice}</p>
        </GlassCard>
      )}
      {error && (
        <GlassCard className="p-3">
          <p className="text-sm text-[var(--uc-danger)]">{error}</p>
        </GlassCard>
      )}

      {loading ? (
        <GlassCard className="p-8 text-center">
          <p className="text-sm text-[var(--uc-text-muted)]">{t('posts_loading')}</p>
        </GlassCard>
      ) : posts.length === 0 ? (
        <GlassCard className="p-8 text-center space-y-1">
          <p className="text-[15px] font-semibold text-[var(--uc-text)]">{t('posts_empty_title')}</p>
          <p className="text-sm text-[var(--uc-text-muted)]">{t('posts_empty_description')}</p>
        </GlassCard>
      ) : (
        <div className="space-y-2">
          {posts.map((post) => (
            <PostRow
              key={post.id}
              post={post}
              busy={busy?.id === post.id ? busy.kind : null}
              anyBusy={busy !== null}
              t={t}
              onOpen={() => onOpen(post)}
              onPublish={(status) => onPublish(post, status)}
              onDelete={() => onDelete(post)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function PostRow({
  post, busy, anyBusy, t, onOpen, onPublish, onDelete,
}: {
  post: BlogPostRecord
  busy: 'publish' | 'draft' | 'delete' | 'open' | null
  anyBusy: boolean
  t: (key: string, values?: Record<string, string | number>) => string
  onOpen: () => void
  onPublish: (status: 'draft' | 'publish') => void
  onDelete: () => void
}) {
  return (
    <GlassCard className="p-4 flex items-start gap-4">
      {post.featured_media_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.featured_media_url}
          alt=""
          className="hidden sm:block size-14 rounded-xl object-cover shrink-0 border border-[var(--uc-border)]"
        />
      ) : (
        <span
          aria-hidden
          className="hidden sm:flex size-14 rounded-xl shrink-0 items-center justify-center bg-[var(--uc-bg-mute)] text-[var(--uc-text-faint)]"
        >
          <Icon name="blog" size={18} />
        </span>
      )}

      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge tone={post.origin === 'univercopy' ? 'accent' : 'neutral'}>
            {post.origin === 'univercopy' ? t('posts_badge_univercopy') : t('posts_badge_wordpress')}
          </Badge>
          <Badge tone={post.status === 'draft' ? 'warn' : 'ok'}>
            {post.status === 'draft' ? t('posts_badge_draft') : t('posts_badge_published')}
          </Badge>
          {post.wp_status && post.wp_status !== 'publish' && (
            <Badge tone="neutral">{t('posts_badge_wp_status', { status: post.wp_status })}</Badge>
          )}
        </div>

        <p className="text-[15px] font-semibold text-[var(--uc-text)] leading-snug break-words">
          {post.title}
        </p>

        <p className="text-xs text-[var(--uc-text-faint)]">
          {formatDate(post.published_at ?? post.updated_at)}
        </p>

        {post.last_error && (
          <p className="text-xs text-[var(--uc-danger)] break-words">{post.last_error}</p>
        )}
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5 shrink-0">
        {post.editable ? (
          <>
            <GlassButton size="sm" variant="ghost" disabled={anyBusy} loading={busy === 'open'} onClick={onOpen}>
              {t('posts_action_edit')}
            </GlassButton>
            <GlassButton size="sm" variant="secondary" disabled={anyBusy} loading={busy === 'draft'}
              onClick={() => onPublish('draft')}>
              {t('posts_action_send_draft')}
            </GlassButton>
            <GlassButton size="sm" disabled={anyBusy} loading={busy === 'publish'}
              onClick={() => onPublish('publish')}>
              {t('posts_action_publish')}
            </GlassButton>
          </>
        ) : (
          post.url && (
            <a
              href={post.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-2xl px-4 h-10 text-sm font-semibold text-[var(--uc-text-soft)] hover:text-[var(--uc-text)] hover:bg-[var(--uc-surface-soft)] uc-transition"
            >
              {t('posts_action_view')}
              <Icon name="chevron-right" size={14} />
            </a>
          )
        )}

        <GlassButton
          size="sm"
          variant="ghost"
          disabled={anyBusy}
          loading={busy === 'delete'}
          onClick={onDelete}
          aria-label={t('posts_action_delete')}
          title={t('posts_action_delete')}
          className="text-[var(--uc-text-faint)] hover:text-[var(--uc-danger)]"
        >
          {busy !== 'delete' && <Icon name="trash" size={14} />}
        </GlassButton>
      </div>
    </GlassCard>
  )
}

function FilterChip({
  active, label, count, onClick,
}: { active: boolean; label: string; count?: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-semibold uc-transition cursor-pointer',
        active
          ? 'bg-[var(--uc-accent-soft)] text-[var(--uc-accent-strong)] shadow-[inset_0_0_0_1px_var(--uc-accent-soft-2)]'
          : 'text-[var(--uc-text-soft)] hover:text-[var(--uc-text)] hover:bg-[var(--uc-surface-soft)]',
      )}
    >
      {label}
      {typeof count === 'number' && (
        <span className="text-xs font-bold text-[var(--uc-text-faint)]">{count}</span>
      )}
    </button>
  )
}

function Badge({ tone, children }: { tone: 'accent' | 'neutral' | 'ok' | 'warn'; children: React.ReactNode }) {
  const tones = {
    accent: 'bg-[var(--uc-accent-soft)] text-[var(--uc-accent-strong)]',
    neutral: 'bg-[var(--uc-bg-mute)] text-[var(--uc-text-muted)]',
    ok: 'bg-emerald-500/10 text-emerald-400',
    warn: 'bg-amber-500/10 text-amber-400',
  }
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider', tones[tone])}>
      {children}
    </span>
  )
}

// Data curta e local. `undefined` no locale = usa o do navegador.
function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
}
