'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/cn'

// Editor de texto com 2 modos (igual WooCommerce): "Visual" (WYSIWYG via
// contentEditable + execCommand) e "Texto" (HTML cru em textarea).
// Sem dependência externa — leve e suficiente pra copy de produto.

type Props = {
  value: string
  onChange: (html: string) => void
  rows?: number
}

const toolBtn =
  'h-8 min-w-8 px-2 rounded-lg text-sm font-semibold text-[var(--uc-text-soft)] ' +
  'hover:bg-[var(--uc-surface-soft)] hover:text-[var(--uc-text)] uc-transition-fast cursor-pointer'

const tabBtn = (active: boolean) =>
  cn(
    'h-7 px-3 rounded-lg text-xs font-semibold uc-transition-fast cursor-pointer',
    active
      ? 'bg-[var(--uc-accent-soft)] text-[var(--uc-accent)]'
      : 'text-[var(--uc-text-muted)] hover:text-[var(--uc-text)]',
  )

export function RichTextField({ value, onChange, rows = 8 }: Props) {
  const t = useTranslations('products')
  const [mode, setMode] = useState<'visual' | 'html'>('visual')
  const ref = useRef<HTMLDivElement>(null)
  const last = useRef(value)

  // Ao entrar no modo Visual, injeta o HTML atual no contentEditable.
  useEffect(() => {
    if (mode === 'visual' && ref.current) {
      ref.current.innerHTML = value || ''
      last.current = value
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  // Mudança externa de value (ex.: "Gerar com IA") → sincroniza o DOM se o
  // usuário não estiver digitando dentro do editor.
  useEffect(() => {
    if (mode === 'visual' && ref.current && document.activeElement !== ref.current && value !== last.current) {
      ref.current.innerHTML = value || ''
      last.current = value
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  function emit() {
    const html = ref.current?.innerHTML ?? ''
    last.current = html
    onChange(html)
  }

  function cmd(command: string, arg?: string) {
    ref.current?.focus()
    document.execCommand(command, false, arg)
    emit()
  }

  function link() {
    const url = window.prompt(t('rich_link_prompt'))
    if (url) cmd('createLink', url)
  }

  return (
    <div className="rounded-2xl uc-glass overflow-hidden">
      {/* Barra: tabs Visual/Texto + toolbar (só no visual) */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-[var(--uc-border)]">
        {mode === 'visual' ? (
          <div className="flex items-center gap-0.5">
            <button type="button" className={cn(toolBtn, 'font-bold')} onMouseDown={(e) => e.preventDefault()} onClick={() => cmd('bold')} title={t('rich_bold')}>B</button>
            <button type="button" className={cn(toolBtn, 'italic')} onMouseDown={(e) => e.preventDefault()} onClick={() => cmd('italic')} title={t('rich_italic')}>I</button>
            <button type="button" className={cn(toolBtn, 'underline')} onMouseDown={(e) => e.preventDefault()} onClick={() => cmd('underline')} title={t('rich_underline')}>U</button>
            <span className="w-px h-5 bg-[var(--uc-border)] mx-1" />
            <button type="button" className={toolBtn} onMouseDown={(e) => e.preventDefault()} onClick={() => cmd('insertUnorderedList')} title={t('rich_list_label')}>{t('rich_list')}</button>
            <button type="button" className={toolBtn} onMouseDown={(e) => e.preventDefault()} onClick={() => cmd('insertOrderedList')} title={t('rich_ordered_label')}>{t('rich_ordered')}</button>
            <button type="button" className={toolBtn} onMouseDown={(e) => e.preventDefault()} onClick={link} title={t('rich_link')}>{t('rich_link')}</button>
          </div>
        ) : (
          <span className="text-xs text-[var(--uc-text-faint)] px-1">HTML</span>
        )}
        <div className="flex items-center gap-1 shrink-0">
          <button type="button" className={tabBtn(mode === 'visual')} onClick={() => setMode('visual')}>{t('rich_visual')}</button>
          <button type="button" className={tabBtn(mode === 'html')} onClick={() => setMode('html')}>{t('rich_text')}</button>
        </div>
      </div>

      {mode === 'visual' ? (
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          onInput={emit}
          onBlur={emit}
          className="uc-rich px-4 py-3 text-[15px] leading-7 text-[var(--uc-text)] outline-none"
          style={{ minHeight: `${rows * 1.75}rem` }}
        />
      ) : (
        <textarea
          rows={rows}
          className="w-full px-4 py-3 bg-transparent text-[13px] font-mono leading-6 text-[var(--uc-text)] outline-none resize-y"
          value={value}
          onChange={(e) => { last.current = e.target.value; onChange(e.target.value) }}
        />
      )}
    </div>
  )
}
