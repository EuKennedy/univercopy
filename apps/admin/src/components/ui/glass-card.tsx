import type { HTMLAttributes } from 'react'

import { cn } from '@/lib/cn'

type GlassCardProps = HTMLAttributes<HTMLDivElement> & {
  variant?: 'default' | 'strong'
  iridescent?: boolean
  glow?: boolean
}

export function GlassCard({
  className,
  variant = 'default',
  iridescent = false,
  glow = false,
  ...rest
}: GlassCardProps) {
  return (
    <div
      className={cn(
        'rounded-3xl',
        variant === 'strong' ? 'uc-glass-strong' : 'uc-glass',
        iridescent && 'uc-irid-border',
        glow && 'uc-glow',
        className,
      )}
      {...rest}
    />
  )
}
