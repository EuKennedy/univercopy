'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

import { GlassButton, GlassCard, fieldCls } from '@/components/ui'
import { Icon } from '@/components/shell/icon'
import { cn } from '@/lib/cn'
import { createCopyVersion, deleteCopy, updateCopy } from '@/lib/api/mutations'
import type { CopyDetail, CopyStatus, CopyVersion } from '@/lib/api/types'

export function CopyEditor({
  slug, copy, versions,
}: {
  slug: string
  copy: CopyDetail
  versions: CopyVersion[]
}) {
  const router = useRouter()
  const t = useTranslations('copy')
  const tc = useTranslations('common')
  const STATUSES: { value: CopyStatus; label: string }[] = [
    { value: 'rascunho', label: t('status_rascunho') },
    { value: 'revisao', label: t('status_revisao') },
    { value: 'aprovado', label: t('status_aprovado') },
    { value: 'publicado', label: t('status_publicado') },
    { value: 'arquivado', label: t('status_arquivado') },
  ]
  const [content, setContent] = useState(copy.current_version?.content ?? '')
  const [status, setStatus] = useState<CopyStatus>(copy.status)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const dirty = content !== (copy.current_version?.content ?? '')

  async function saveVersion() {
    setBusy('version'); setMsg(null)
    const res = await createCopyVersion(slug, copy.id, content, t('manual_edit'))
    setBusy(null)
    if (!res.ok) { setMsg(res.message); return }
    setMsg(t('version_saved'))
    router.refresh()
  }

  async function changeStatus(next: CopyStatus) {
    setStatus(next)
    setBusy('status'); setMsg(null)
    const res = await updateCopy(slug, copy.id, { status: next })
    setBusy(null)
    if (!res.ok) { setMsg(res.message); setStatus(copy.status); return }
    router.refresh()
  }

  async function remove() {
    if (!confirm(t('delete_confirm'))) return
    setBusy('delete')
    const res = await deleteCopy(slug, copy.id)
    setBusy(null)
    if (!res.ok) { setMsg(res.message); return }
    router.push(`/${slug}/copy`)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
      <div className="space-y-4 min-w-0">
        <GlassCard className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold tracking-wide uppercase text-[var(--uc-text-muted)]">
              {t('content')} {copy.current_version ? `· v${copy.current_version.n}` : ''}
            </p>
            <div className="flex gap-2">
              <GlassButton size="sm" variant="ghost" onClick={() => navigator.clipboard.writeText(content)}>{tc('copy')}</GlassButton>
              <GlassButton size="sm" loading={busy === 'version'} disabled={!dirty} onClick={saveVersion}>
                {t('save_version')}
              </GlassButton>
            </div>
          </div>
          <textarea
            rows={16}
            className={cn(fieldCls, 'py-3 resize-y leading-7 font-[450]')}
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          {msg && <p className="text-sm text-[var(--uc-text-soft)]">{msg}</p>}
        </GlassCard>

        {versions.length > 1 && (
          <GlassCard className="p-6 space-y-3">
            <p className="text-xs font-semibold tracking-wide uppercase text-[var(--uc-text-muted)]">{t('version_history')}</p>
            <div className="space-y-2">
              {versions.map((v) => (
                <div key={v.id} className={cn(
                  'rounded-xl px-4 py-3 border',
                  v.is_current ? 'border-[var(--uc-accent-soft-2)] bg-[var(--uc-accent-soft)]' : 'border-[var(--uc-border)] bg-[var(--uc-bg-mute)]',
                )}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-[var(--uc-text)]">
                      v{v.n} {v.is_current && <span className="text-[var(--uc-accent)]">· {t('current')}</span>}
                    </span>
                    <span className="text-xs text-[var(--uc-text-faint)]">
                      {v.note}{v.ai_model ? ` · ${v.ai_model}` : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        )}
      </div>

      <div className="space-y-4">
        <GlassCard className="p-6 space-y-4 h-fit">
          <div>
            <label className="text-xs font-semibold tracking-wide uppercase text-[var(--uc-text-muted)] mb-1.5 block">{t('status')}</label>
            <select
              className={cn(fieldCls, 'h-12')}
              value={status}
              disabled={busy === 'status'}
              onChange={(e) => changeStatus(e.target.value as CopyStatus)}
            >
              {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>

          <dl className="space-y-2 text-sm">
            <Row label={t('field_piece')} value={copy.piece_type_key} />
            <Row label={t('field_style')} value={copy.style_key} />
            <Row label={t('field_framework')} value={copy.framework_key} />
            <Row label={t('field_category')} value={copy.category_key} />
          </dl>
        </GlassCard>

        <GlassButton variant="ghost" className="w-full text-[var(--uc-danger)]" loading={busy === 'delete'} onClick={remove}>
          <Icon name="logout" size={16} />{t('delete_copy')}
        </GlassButton>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string | null }) {
  if (!value) return null
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-[var(--uc-text-muted)]">{label}</dt>
      <dd className="text-[var(--uc-text)] font-medium truncate">{value}</dd>
    </div>
  )
}
