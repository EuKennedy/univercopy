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

// Canal de distribuição (campanhas multi-canal).
export type ChannelKey =
  | 'email' | 'whatsapp' | 'sms' | 'meta_ads' | 'google_ads'
  | 'social' | 'landing' | 'ecommerce' | 'brand' | 'seo'

export type Channel = {
  key: ChannelKey
  name: string
  icon: string
  color: string
  sequence: boolean
  description: string
  piece_types: PieceType[]
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

// Passo de uma sequência dentro de uma campanha (copy enxuta + preview).
export type CampaignStep = {
  id: string
  title: string
  status: CopyStatus
  channel: ChannelKey | null
  sequence_index: number | null
  piece_type_key: string | null
  category_key: string | null
  current_content_preview: string | null
  updated_at: string
}

export type CampaignSequence = {
  channel: ChannelKey | null
  steps: CampaignStep[]
}

export type CampaignBundle = {
  campaign: CampaignDetail
  copies: CampaignStep[]
  sequences: CampaignSequence[]
}

export type SequenceResult = {
  channel: ChannelKey
  copies: CampaignStep[]
  resolved: Record<string, string | null>
  model: string
  cost_usd: number | null
}

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

export type ProductFaq = {
  title: string
  content: string
  icon_type?: string
  icon_value?: string
  icon_attachment_id?: number
}

export type ProductAttribute = { name: string; options: string[]; visible?: boolean }

export type ProductDetail = {
  id: string
  external_id: string
  name: string
  sku: string | null
  permalink: string | null
  price: number | null
  images: string[]
  images_full: { id: number; src: string; alt: string }[]
  categories: string[]
  categories_full: { id: number; name: string }[]
  tags: string[]
  description_html: string
  short_description_html: string
  attributes: ProductAttribute[]
  regular_price: number | null
  sale_price: number | null
  manage_stock: boolean | null
  stock_quantity: number | null
  stock_status: string | null
  backorders: string | null
  weight: string | null
  dimensions: { length: string | null; width: string | null; height: string | null }
  about: { title: string; description: string }
  faq: ProductFaq[]
  synced_at: string | null
}

export type ConnectorState = {
  type: string
  label: string
  allowed: boolean
  status: 'connected' | 'disconnected' | 'error'
  last_sync_at: string | null
  last_error: string | null
  /** Ajustes seguros de expor. Credencial nunca vem daqui. */
  settings?: { text_model?: string; base_url?: string }
}

/** Modelo de texto da OpenAI oferecido no painel. Preço em USD por 1M tokens. */
export type OpenAiModel = {
  id: string
  label: string
  input: number
  output: number
}

export type IntegrationsPayload = {
  connectors: ConnectorState[]
  products_count: number
  openai_models: OpenAiModel[]
  /** Quem gera texto hoje neste workspace. */
  text_provider: 'anthropic' | 'openai'
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
    channel: string | null
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

// --- Blog WordPress (REST API v2 + Application Password) ---
// Credenciais são por workspace, cadastradas em Configurações → Integrações.
export type BlogStatus = {
  connected: boolean
  reachable: boolean
  site?: string
  message?: string
  /** Se há chave da OpenAI cadastrada — habilita o botão de gerar capa. */
  openai?: boolean
}

export type WordpressCredentials = {
  base_url: string
  username: string
  application_password: string
}

/** Categoria ou tag do WordPress. `existed` vem quando o "+" reaproveitou um termo já criado. */
export type BlogTerm = {
  id: number
  name: string
  slug: string
  count: number
  existed?: boolean
}

export type BlogMedia = {
  id: number
  url: string | null
}

// --- Agente de blog ---
export type AgentMessage = { role: 'user' | 'assistant'; content: string }

export type AgentPlanPost = { topic: string; angle?: string }

export type AgentPlan = {
  posts: AgentPlanPost[]
  status: 'draft' | 'publish'
  generate_cover: boolean
  category_ids: number[]
  tag_ids: number[]
  notes?: string
}

export type AgentReply = {
  reply: string
  plan: AgentPlan
  /** Plano completo, aguardando confirmação. Nunca significa "pode publicar". */
  ready: boolean
  cost: AiCostReport
}

export type AgentRunPost = {
  index: number
  topic: string
  status: 'pending' | 'running' | 'done' | 'error' | 'skipped'
  step?: 'title' | 'content' | 'cover' | 'publish'
  title?: string
  post_id?: number
  url?: string
  error?: string
}

export type AgentRunResult = {
  total: number
  completed: number
  failed: number
  cost_usd: number
  posts: AgentRunPost[]
}

export type AgentJob = {
  id: string
  status: 'queued' | 'running' | 'done' | 'error'
  task_kind: string
  cost_usd: number | null
  error: string | null
  started_at: string | null
  finished_at: string | null
  result: AgentRunResult | null
}

export type AiCostReport = {
  used_usd: number
  limit_usd: number | null
  percent: number | null
  remaining: number | null
}

export type BlogCategory = BlogTerm

export type BlogPostResult = {
  id: number
  url: string | null
  status: 'draft' | 'publish'
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
