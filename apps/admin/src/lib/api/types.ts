// Tipos compartilhados entre server components (queries) e server actions
// (mutations). Espelham os payloads do Rails API v1. Módulo puro — sem
// 'use server', então pode exportar tipos livremente.

export type Plan = 'entry' | 'medium' | 'ultra'

export type CopyStatus = 'rascunho' | 'revisao' | 'aprovado' | 'publicado' | 'arquivado'

export type Style = {
  key: string
  name: string
  era: string | null
  grp: string | null
  description: string | null
  principles: string[]
  when_to_use: string | null
}

export type Framework = {
  key: string
  name: string
  structure: string | null
}

export type PieceType = {
  key: string
  category_key: string
  name: string
  description: string | null
  structure: string | null
  default_framework: string | null
  default_style: string | null
  length_hint: string | null
}

export type Category = {
  key: string
  name: string
  icon: string | null
  color: string | null
}

export type Dna = {
  kind: 'atual' | 'proposto'
  marca: string | null
  missao: string | null
  posicionamento: string | null
  tom: string | null
  publico: string | null
  consciencia: string | null
  valores: string[]
  produtos: string[]
  ofertas: string[]
  provas: string[]
  objecoes: string[]
  evitar: string[]
  publico_alvo_detalhado: Record<string, unknown> | null
  restricoes_regulatorias: string[]
  framework: string | null
  source_url: string | null
  updated_at: string | null
}

export type DnaBundle = {
  dna_in_use: 'atual' | 'proposto'
  atual: Dna | null
  proposto: Dna | null
}

export type CopyVersion = {
  id: string
  n: number
  content: string
  note: string | null
  author_id: string | null
  is_current: boolean
  ai_model: string | null
  cost_usd: number | null
  created_at: string
}

export type CopyListItem = {
  id: string
  title: string
  status: CopyStatus
  category_key: string | null
  piece_type_key: string | null
  style_key: string | null
  framework_key: string | null
  tags: string[]
  product_id: string | null
  campaign_id: string | null
  current_content_preview: string | null
  updated_at: string
}

export type CopyDetail = {
  id: string
  title: string
  status: CopyStatus
  category_key: string | null
  piece_type_key: string | null
  style_key: string | null
  framework_key: string | null
  tags: string[]
  product_id: string | null
  campaign_id: string | null
  current_version: CopyVersion | null
  created_at: string
  updated_at: string
}

export type CampaignListItem = {
  id: string
  name: string
  objective: string | null
  audience: string | null
  status: 'planejada' | 'ativa' | 'concluida' | 'arquivada'
  starts_at: string | null
  ends_at: string | null
  pieces: number
  created_at: string
  updated_at: string
}

export type CampaignDetail = CampaignListItem & { context: string | null }

export type ProductListItem = {
  id: string
  name: string
  sku: string | null
  price: number | null
  source: string
  permalink: string | null
  image: string | null
  categories: string[]
  reviews_count: number
  rating_avg: number | null
  synced_at: string | null
}

export type ConnectorState = {
  type: string
  label: string
  allowed: boolean
  status: 'connected' | 'disconnected' | 'error'
  last_sync_at: string | null
  last_error: string | null
}

export type Variation = {
  title: string
  angle: string
  content: string
}

export type GenerateResult = {
  generation_id: string
  variations: Variation[]
  resolved: {
    piece_type_key: string | null
    style_key: string | null
    framework_key: string | null
    category_key: string | null
    product_id: string | null
    campaign_id: string | null
  }
  model: string
  cost_usd: number | null
}

export type CostReport = {
  used_usd: number
  limit_usd: number | null
  percent: number | null
  remaining: number | null
}

export type Overview = {
  workspace: { id: string; slug: string; name: string; plan: Plan; onboarding_status: string }
  dna_in_use: 'atual' | 'proposto'
  counts: {
    copies: number
    copies_revisao: number
    campaigns: number
    products: number
    generations_month: number
  }
  cost: CostReport
  recent_copies: { id: string; title: string; status: CopyStatus; updated_at: string }[]
}

export type Account = {
  id: string
  email: string
  name: string | null
  default_locale: string
  preferred_ai_model: 'auto' | 'haiku' | 'sonnet' | 'opus'
}

export type PlanSnapshot = {
  snapshot: {
    plan: Plan
    features: Record<string, boolean>
    limits: Record<string, number | null>
  }
  cost: CostReport
  usage: { generations_month: number; copies: number; products: number; members: number }
}

export type Member = {
  user_id: string
  email: string
  name: string | null
  role: string
  accepted_at: string | null
}

export type AuditLogEntry = {
  id: string
  action: string
  metadata: Record<string, unknown>
  ip: string | null
  created_at: string
}

export type PageAuditSection = { title: string; score: number; notes: string }

export type PageAudit = {
  id: string
  url: string
  brand_name: string | null
  score: number | null
  summary: string | null
  sections: PageAuditSection[]
  created_at: string
}

// Erro normalizado de paywall/cap pra UI tratar 402.
export type ActionError = {
  ok: false
  error: string
  message: string
  feature?: string
  plan?: string
}

export type ActionOk<T> = { ok: true; data: T }
export type ActionResult<T> = ActionOk<T> | ActionError
