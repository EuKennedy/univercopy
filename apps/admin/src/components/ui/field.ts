// Classe única de input/select/textarea glass. Fonte da verdade — antes
// estava duplicada (com pequenas variações) em 5 telas. Componha com altura:
// cn(fieldCls, 'h-12') para inputs, cn(fieldCls, 'py-3') para textarea.
export const fieldCls =
  'w-full px-4 rounded-2xl uc-glass uc-transition text-[15px] text-[var(--uc-text)] outline-none ' +
  'placeholder:text-[var(--uc-text-faint)] ' +
  'focus:border-[var(--uc-accent-ring)] focus:shadow-[0_0_0_4px_var(--uc-accent-soft-2)]'

// Label padrão de campo (uppercase, tracking).
export const labelCls =
  'text-xs font-semibold tracking-wide uppercase text-[var(--uc-text-muted)] mb-1.5 block'
