import type { Plan } from './plan-features.js'

export type Locale = 'pt-BR' | 'en-US' | 'es-AR'

export type Workspace = {
  id: string
  slug: string
  name: string
  icon: string | null
  site_url: string | null
  plan: Plan
  default_locale: Locale
  created_at: string
  updated_at: string
}

export type WorkspaceMember = {
  workspace_id: string
  user_id: string
  email: string
  name: string | null
  role: 'owner' | 'admin' | 'editor' | 'reviewer' | 'viewer'
}

export type DnaKind = 'atual' | 'proposto'

export type BrandDna = {
  workspace_id: string
  kind: DnaKind
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
  framework: string | null
  source_url: string | null
  // Capturado no onboarding (Q&A) — alimenta RAG + prompts.
  publico_alvo_detalhado: {
    faixa_etaria?: string
    faixa_renda?: string
    genero?: string
    geografia?: string
    interesses?: string[]
  } | null
  restricoes_regulatorias: string[] | null
  updated_at: string
}

export type CopyStatus = 'rascunho' | 'revisao' | 'aprovado' | 'publicado'

export type Copy = {
  id: string
  workspace_id: string
  product_id: string | null
  campaign_id: string | null
  category_key: string | null
  piece_type_key: string | null
  style_key: string | null
  framework_key: string | null
  title: string
  status: CopyStatus
  tags: string[]
  current_content: string | null
  created_at: string
  updated_at: string
}
