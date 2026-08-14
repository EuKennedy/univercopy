'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'

import { Icon } from '@/components/shell/icon'
import { GlassButton, fieldCls, labelCls } from '@/components/ui'
import { cn } from '@/lib/cn'
import {
  generateCommunityMessage,
  loadCommunitySpaces,
  loadCommunityStatus,
  publishToCommunity,
} from '@/lib/api/mutations'
import type { BlogPostRecord, CommunitySpace, CommunityStatus } from '@/lib/api/types'

// Teto do plugin. O contador avisa antes do round-trip.
const MAX_CHARS = 15_000

export function CommunityModal({
  slug, post, onClose, onPublished,
}: {
  slug: string
  post: BlogPostRecord
  onClose: () => void
  onPublished: () => void
}) {
  const t = useTranslations('blog')

  const [status, setStatus] = useState<CommunityStatus | null>(null)
  const [spaces, setSpaces] = useState<CommunitySpace[]>([])
  const [space, setSpace] = useState('')
  const [message, setMessage] = useState('')
  // Já nasce true: a primeira geração dispara junto com o modal, e o efeito
  // abaixo não pode ligar o estado de forma síncrona.
  const [generating, setGenerating] = useState(true)
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [])

  // Botão "gerar de novo". É handler de evento, não efeito.
  const generate = useCallback(async () => {
    setGenerating(true)
    const res = await generateCommunityMessage(slug, post.id)
    setGenerating(false)
    if (!res.ok) { setError(res.message || t('error_generic')); return }
    setMessage(res.data.message)
  }, [slug, post.id, t])

  // Status, spaces e primeira geração em paralelo: são round-trips
  // independentes e o formulário vai montando enquanto a IA escreve.
  useEffect(() => {
    let alive = true

    loadCommunityStatus(slug).then((r) => {
      if (!alive) return
      setStatus(r.ok ? r.data : { connected: false, reachable: false })
      if (r.ok && r.data.default_space) setSpace((s) => s || r.data.default_space!)
    })

    loadCommunitySpaces(slug).then((r) => {
      if (!alive || !r.ok) return
      setSpaces(r.data)
      setSpace((s) => s || r.data[0]?.slug || '')
    })

    generateCommunityMessage(slug, post.id).then((r) => {
      if (!alive) return
      setGenerating(false)
      if (r.ok) setMessage(r.data.message)
      else setError(r.message || t('error_generic'))
    })

    return () => { alive = false }
  }, [slug, post.id, t])

  async function onPublish() {
    if (!message.trim()) { setError(t('community_error_empty')); return }
    if (!space) { setError(t('community_error_space')); return }

    setPublishing(true); setError(null)
    const res = await publishToCommunity(slug, post.id, { message: message.trim(), space })
    setPublishing(false)
    if (!res.ok) { setError(res.message || t('error_generic')); return }
    onPublished()
  }

  const notConnected = status !== null && !status.connected
  const busy = generating || publishing
  const tooLong = message.length > MAX_CHARS

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('community_title')}
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl uc-glass-strong p-6 space-y-5"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-[var(--uc-text)]">{t('community_title')}</h2>
            <p className="text-sm text-[var(--uc-text-muted)] truncate">{post.title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('community_close')}
            className="rounded-lg p-1.5 text-[var(--uc-text-muted)] hover:bg-[var(--uc-surface-soft)] hover:text-[var(--uc-text)] cursor-pointer"
          >
            <Icon name="x" size={18} />
          </button>
        </div>

        {notConnected ? (
          <div className="space-y-3">
            <p className="text-sm text-[var(--uc-text-soft)]">{t('community_not_connected')}</p>
            <Link
              href={`/${slug}/settings/integrations`}
              className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--uc-accent-strong)] hover:underline"
            >
              {t('go_to_integrations')} →
            </Link>
          </div>
        ) : (
          <>
            <div>
              <label htmlFor="community-space" className={labelCls}>{t('community_space')}</label>
              <select
                id="community-space"
                value={space}
                onChange={(e) => setSpace(e.target.value)}
                disabled={busy || spaces.length === 0}
                className={cn(fieldCls, 'h-12 cursor-pointer')}
              >
                {spaces.length === 0 && <option value="">{t('community_spaces_loading')}</option>}
                {spaces.map((s) => (
                  <option key={s.slug} value={s.slug}>
                    {s.title}{s.privacy !== 'public' ? ` · ${s.privacy}` : ''}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-[var(--uc-text-faint)]">{t('community_space_hint')}</p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="community-message" className={cn(labelCls, 'mb-0')}>
                  {t('community_message')}
                </label>
                <button
                  type="button"
                  onClick={generate}
                  disabled={busy}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--uc-accent-strong)] hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Icon name="sparkle" size={14} />
                  {generating ? t('generating') : t('community_regenerate')}
                </button>
              </div>
              <textarea
                id="community-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={generating ? t('community_generating') : t('community_message_placeholder')}
                disabled={busy}
                rows={10}
                className={cn(fieldCls, 'py-3 resize-y leading-relaxed')}
              />
              <p className={cn('mt-1.5 text-xs', tooLong ? 'text-[var(--uc-danger)]' : 'text-[var(--uc-text-faint)]')}>
                {t('community_chars', { count: message.length, max: MAX_CHARS })}
              </p>
            </div>

            {error && <p className="text-sm text-[var(--uc-danger)]">{error}</p>}

            <div className="flex flex-col sm:flex-row gap-2">
              <GlassButton variant="secondary" size="lg" disabled={busy} onClick={onClose}>
                {t('community_cancel')}
              </GlassButton>
              <GlassButton
                size="lg"
                loading={publishing}
                disabled={busy || tooLong || !message.trim() || !space}
                onClick={onPublish}
              >
                {!publishing && <Icon name="megaphone" size={16} />}
                {publishing ? t('community_publishing') : t('community_publish')}
              </GlassButton>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
