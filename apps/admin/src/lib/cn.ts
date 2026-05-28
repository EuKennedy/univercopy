// Utility de className join — versão minimalista do clsx/cn sem libs.
export function cn(...inputs: Array<string | number | null | undefined | false | Record<string, boolean>>): string {
  const parts: string[] = []
  for (const input of inputs) {
    if (!input) continue
    if (typeof input === 'string' || typeof input === 'number') {
      parts.push(String(input))
    } else if (typeof input === 'object') {
      for (const [k, v] of Object.entries(input)) {
        if (v) parts.push(k)
      }
    }
  }
  return parts.join(' ')
}
