// Custo de IA é rastreado em USD (faturamento Anthropic). Exibimos em R$.
// Taxa configurável via NEXT_PUBLIC_USD_BRL (fallback 5,40). Conversão só de
// apresentação — o valor armazenado continua em USD.

export const USD_BRL = Number(process.env.NEXT_PUBLIC_USD_BRL) || 5.4

export function brl(usd: number | null | undefined): string {
  const n = (typeof usd === 'number' ? usd : 0) * USD_BRL
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 })
}
