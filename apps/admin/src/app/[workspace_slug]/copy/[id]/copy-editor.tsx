'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { GlassButton, GlassCard } from '@/components/ui'
import { Icon } from '@/components/shell/icon'
import { cn } from '@/lib/cn'
import { createCopyVersion, deleteCopy, updateCopy } from '@/lib/api/mutations'
import type { CopyDetail, CopyStatus, CopyVersion } from '@/lib/api/types'

const STATUSES: { value: CopyStatus; label: string }[] = [
  { value: 'rascunho', label: 'Rascunho' },
  { value: 'revisao', label: 'Em revisão' },
  { value: 'aprovado', label: 'Aprovado' },
  { value: 'publicado', label: 'Publicado' },
  { value: 'arquivado', label: 'Arquivado' },
]

const fieldCls =
  'w-full px-4 rounded-2xl uc-glass uc-transition text-[15px] text-[var(--uc-text)] outline-none ' +
  'focus:border-[var(--uc-accent-ring)] focus:shadow-[0_0_0_4px_var(--uc-accent-soft-2)]'

export function CopyEditor({
  slug, copy, versions,
}: {
  slug: string
  copy: CopyDetail
  versions: CopyVersion[]
}) {
  const router = useRouter()
  const [content, setContent] = useState(copy.current_version?.content ?? '')
  const [status, setStatus] = useState<CopyStatus>(copy.status)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const dirty = content !== (copy.current_version?.content ?? '')

  async function saveVersion() {
    setBusy('version'); setMsg(null)
    const res = await createCopyVersion(slug, copy.id, content, 'Edição manual')
    setBusy(null)
    if (!res.ok) { setMsg(res.message); return }
    setMsg('Nova versão salva.')
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
    if (!confirm('Excluir esta copy e todo o histórico de versões? Esta ação não pode ser desfeita.')) return
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
              Conteúdo {copy.current_version ? `· v${copy.current_version.n}` : ''}
            </p>
            <div className="flex gap-2">
              <GlassButton size="sm" variant="ghost" onClick={() => navigator.clipboard.writeText(content)}>Copiar</GlassButton>
              <GlassButton size="sm" loading={busy === 'version'} disabled={!dirty} onClick={saveVersion}>
                Salvar versão
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
            <p className="text-xs font-semibold tracking-wide uppercase text-[var(--uc-text-muted)]">Histórico de versões</p>
            <div className="space-y-2">
              {versions.map((v) => (
                <div key={v.id} className={cn(
                  'rounded-xl px-4 py-3 border',
                  v.is_current ? 'border-[var(--uc-accent-soft-2)] bg-[var(--uc-accent-soft)]' : 'border-[var(--uc-border)] bg-[var(--uc-bg-mute)]',
                )}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-[var(--uc-text)]">
                      v{v.n} {v.is_current && <span className="text-[var(--uc-accent)]">· atual</span>}
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
            <label className="text-xs font-semibold tracking-wide uppercase text-[var(--uc-text-muted)] mb-1.5 block">Status</label>
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
            <Row label="Peça" value={copy.piece_type_key} />
            <Row label="Estilo" value={copy.style_key} />
            <Row label="Framework" value={copy.framework_key} />
            <Row label="Categoria" value={copy.category_key} />
          </dl>
        </GlassCard>

        <GlassButton variant="ghost" className="w-full text-[var(--uc-danger)]" loading={busy === 'delete'} onClick={remove}>
          <Icon name="logout" size={16} />Excluir copy
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
