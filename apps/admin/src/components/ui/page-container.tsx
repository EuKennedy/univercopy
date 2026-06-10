import type { HTMLAttributes } from 'react'

import { cn } from '@/lib/cn'

// Wrapper padrão do conteúdo de página: padding responsivo + max-width +
// centralização. Substitui o `px-4 sm:px-6 lg:px-8 py-8 max-w-6xl mx-auto`
// repetido em ~19 páginas. `grid` permite usar como container de grid direto.
type PageContainerProps = HTMLAttributes<HTMLDivElement> & {
  grid?: boolean
  size?: 'default' | 'narrow'
}

export function PageContainer({ className, grid = false, size = 'default', ...rest }: PageContainerProps) {
  return (
    <div
      className={cn(
        'px-4 sm:px-6 lg:px-8 py-8 mx-auto w-full',
        size === 'narrow' ? 'max-w-3xl' : 'max-w-6xl',
        !grid && 'space-y-6',
        className,
      )}
      {...rest}
    />
  )
}
