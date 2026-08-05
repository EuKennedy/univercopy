'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

import { Icon } from '@/components/shell/icon'
import { fieldCls, labelCls } from '@/components/ui'
import { cn } from '@/lib/cn'
import type { BlogTerm } from '@/lib/api/types'

// Multi-seleção de categorias/tags em chips, com "+" pra criar termo novo
// direto no WordPress sem sair da tela. Usado nas duas taxonomias.
export function TermPicker({
  label,
  terms,
  selected,
  onToggle,
  onCreate,
  disabled = false,
  loadFailed = false,
  createPlaceholder,
}: {
  label: string
  terms: BlogTerm[]
  selected: Set<number>
  onToggle: (id: number) => void
  onCreate: (name: string) => Promise<string | null>
  disabled?: boolean
  loadFailed?: boolean
  createPlaceholder: string
}) {
  const t = useTranslations('blog')
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    const clean = name.trim()
    if (!clean) return

    setBusy(true)
    setError(null)
    const err = await onCreate(clean)
    setBusy(false)

    if (err) {
      setError(err)
      return
    }
    setName('')
    setAdding(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className={cn(labelCls, 'mb-0')}>{label}</span>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setAdding((v) => !v)}
          className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--uc-accent-strong)] hover:underline disabled:opacity-50 disabled:cursor-not-allowed disabled:no-underline"
        >
          <Icon name={adding ? 'x' : 'plus'} size={14} />
          {adding ? t('cancel_new_term') : t('new_term')}
        </button>
      </div>

      {adding && (
        <div className="flex gap-2 mb-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void submit()
              }
            }}
            placeholder={createPlaceholder}
            disabled={busy}
            autoFocus
            className={cn(fieldCls, 'h-10 text-sm')}
          />
          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy || !name.trim()}
            className="shrink-0 h-10 px-4 rounded-2xl text-sm font-semibold text-[var(--uc-text-on-accent)] bg-[var(--uc-accent)] hover:bg-[var(--uc-accent-strong)] uc-transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? t('creating_term') : t('create_term')}
          </button>
        </div>
      )}

      {error && <p className="text-xs text-[var(--uc-danger)] mb-2">{error}</p>}

      {terms.length === 0 ? (
        <p className="text-xs text-[var(--uc-text-faint)]">
          {loadFailed ? t('terms_error') : t('terms_loading')}
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
          {terms.map((term) => {
            const on = selected.has(term.id)
            return (
              <button
                key={term.id}
                type="button"
                disabled={disabled}
                onClick={() => onToggle(term.id)}
                aria-pressed={on}
                className={cn(
                  'text-xs rounded-full px-3 py-1.5 uc-transition border disabled:opacity-50 disabled:cursor-not-allowed',
                  on
                    ? 'bg-[var(--uc-accent)] text-[var(--uc-text-on-accent)] border-transparent font-semibold'
                    : 'uc-glass text-[var(--uc-text-soft)] border-[var(--uc-border)] hover:text-[var(--uc-text)]',
                )}
              >
                {term.name}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
