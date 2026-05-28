'use client'

import { forwardRef, type InputHTMLAttributes, useId } from 'react'

import { cn } from '@/lib/cn'

type GlassInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string
  hint?: string
  error?: string
  leadingIcon?: React.ReactNode
}

export const GlassInput = forwardRef<HTMLInputElement, GlassInputProps>(function GlassInput(
  { label, hint, error, leadingIcon, className, id, ...rest }, ref,
) {
  const generatedId = useId()
  const inputId = id ?? generatedId

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="text-xs font-semibold tracking-wide uppercase text-[var(--uc-text-muted)]"
        >
          {label}
        </label>
      )}
      <div
        className={cn(
          'group relative flex items-center rounded-2xl uc-glass uc-transition',
          'focus-within:border-[var(--uc-accent-ring)] focus-within:shadow-[0_0_0_4px_var(--uc-accent-soft-2)]',
          error && 'border-[var(--uc-danger)] focus-within:border-[var(--uc-danger)]',
        )}
      >
        {leadingIcon && (
          <span className="pl-4 text-[var(--uc-text-faint)] group-focus-within:text-[var(--uc-accent)]">
            {leadingIcon}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'flex-1 bg-transparent outline-none text-[15px] text-[var(--uc-text)]',
            'placeholder:text-[var(--uc-text-faint)]',
            'h-12 px-4 min-w-0',
            className,
          )}
          {...rest}
        />
      </div>
      {(hint || error) && (
        <p className={cn('text-xs leading-5', error ? 'text-[var(--uc-danger)]' : 'text-[var(--uc-text-muted)]')}>
          {error ?? hint}
        </p>
      )}
    </div>
  )
})
