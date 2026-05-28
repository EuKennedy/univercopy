import { cn } from '@/lib/cn'

type StepIndicatorProps = {
  steps: string[]
  current: number
  className?: string
}

// Indicador horizontal de progresso pra wizard. Linha gradiente "viva"
// entre os steps + glow no atual. Reduce-motion respeitado via .uc-transition.
export function StepIndicator({ steps, current, className }: StepIndicatorProps) {
  return (
    <nav aria-label="Progresso do onboarding" className={cn('w-full', className)}>
      <ol className="flex items-center gap-3">
        {steps.map((label, idx) => {
          const isCompleted = idx < current
          const isCurrent   = idx === current
          return (
            <li key={label} className="flex-1 flex items-center gap-3">
              <div className="flex flex-col gap-2 flex-1">
                <div
                  className={cn(
                    'h-1.5 rounded-full uc-transition',
                    isCompleted && 'bg-[var(--uc-accent)]',
                    isCurrent && 'bg-gradient-to-r from-[var(--uc-accent)] via-[var(--uc-irid-2)] to-[var(--uc-accent)] shadow-[0_0_24px_var(--uc-accent-glow)]',
                    !isCompleted && !isCurrent && 'bg-[var(--uc-border)]',
                  )}
                />
                <div className="flex items-center gap-2 min-h-[20px]">
                  <span
                    className={cn(
                      'text-[10px] font-semibold tracking-wider uppercase tabular-nums',
                      isCurrent ? 'text-[var(--uc-text)]' : 'text-[var(--uc-text-muted)]',
                    )}
                  >
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <span
                    className={cn(
                      'text-xs',
                      isCurrent ? 'text-[var(--uc-text-secondary)] font-semibold' : 'text-[var(--uc-text-muted)]',
                    )}
                  >
                    {label}
                  </span>
                </div>
              </div>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
