import { cn } from '@/lib/cn'

type WordmarkProps = {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  withIcon?: boolean
}

// Wordmark UniverCopy — "univer" em dark gray + "Copy" com gradient
// purple→blue (prisma animado). Ícone opcional (chip prisma).
const SIZE_TXT: Record<NonNullable<WordmarkProps['size']>, string> = {
  sm: 'text-lg',
  md: 'text-xl',
  lg: 'text-2xl',
  xl: 'text-3xl',
}

const SIZE_ICON: Record<NonNullable<WordmarkProps['size']>, string> = {
  sm: 'size-7 rounded-[8px]',
  md: 'size-9 rounded-[10px]',
  lg: 'size-11 rounded-[12px]',
  xl: 'size-14 rounded-[16px]',
}

export function Wordmark({ size = 'md', className, withIcon = true }: WordmarkProps) {
  return (
    <span className={cn('inline-flex items-center gap-2.5 select-none', className)} aria-label="UniverCopy">
      {withIcon && (
        <span
          aria-hidden
          className={cn(
            SIZE_ICON[size],
            'relative flex items-center justify-center text-white font-bold uc-transition',
            'shadow-[0_8px_24px_-8px_rgba(139,92,246,0.55)]',
          )}
          style={{ background: 'linear-gradient(135deg, var(--uc-brand-purple) 0%, var(--uc-brand-blue) 100%)' }}
        >
          <span className="font-extrabold leading-none">u</span>
        </span>
      )}
      <span className={cn(SIZE_TXT[size], 'font-extrabold tracking-tight leading-none')}>
        <span className="text-[var(--uc-text)]">univer</span>
        <span className="uc-prisma-text">Copy</span>
      </span>
    </span>
  )
}
