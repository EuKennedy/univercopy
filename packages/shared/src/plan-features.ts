// Single source of truth para o paywall. O backend Rails reexpõe via
// /api/v1/workspace#show (snapshot por workspace) — não mudar aqui sem
// sincronizar com app/lib/plan_features.rb no apps/api.

export type Plan = 'entry' | 'medium' | 'ultra'

export type FeatureKey =
  | 'ai_generate'           // gerador multicanal core
  | 'ai_dna_extract'        // DNA from URL
  | 'ai_dna_improve'        // proposto a partir de atual
  | 'ai_name_generator'     // Name Generator v3
  | 'ai_seo_geo'            // SEO+GEO describe + review
  | 'ai_page_audit'         // analisar página
  | 'ai_intelligence'       // PDPs concorrentes
  | 'campaigns'             // agrupar copies em campanhas
  | 'connector_woo'
  | 'connector_csv'
  | 'connector_wordpress'
  | 'connector_openai'
  | 'ai_blog_writer'
  | 'ai_cover_image'
  | 'connector_shopify'
  | 'connector_nuvemshop'
  | 'connector_tray'
  | 'multi_user'
  | 'audit_log_api'         // export do audit log via API
  | 'priority_support'

export type LimitKey =
  | 'ai_generations_per_month'
  | 'copies_per_workspace'
  | 'connectors_max'
  | 'users_max'
  | 'ai_monthly_cost_usd'

export const PLAN_FEATURES: Record<Plan, Record<FeatureKey, boolean>> = {
  entry: {
    ai_generate: true,
    ai_dna_extract: true,
    ai_dna_improve: true,
    ai_name_generator: false,
    ai_seo_geo: false,
    ai_page_audit: false,
    ai_intelligence: false,
    campaigns: false,
    connector_woo: true,
    connector_csv: true,
    connector_wordpress: true,
    connector_openai: true,
    ai_blog_writer: true,
    ai_cover_image: true,
    connector_shopify: false,
    connector_nuvemshop: false,
    connector_tray: false,
    multi_user: false,
    audit_log_api: false,
    priority_support: false,
  },
  medium: {
    ai_generate: true,
    ai_dna_extract: true,
    ai_dna_improve: true,
    ai_name_generator: true,
    ai_seo_geo: true,
    ai_page_audit: true,
    ai_intelligence: false,
    campaigns: true,
    connector_woo: true,
    connector_csv: true,
    connector_wordpress: true,
    connector_openai: true,
    ai_blog_writer: true,
    ai_cover_image: true,
    connector_shopify: true,
    connector_nuvemshop: false,
    connector_tray: false,
    multi_user: true,
    audit_log_api: false,
    priority_support: false,
  },
  ultra: {
    ai_generate: true,
    ai_dna_extract: true,
    ai_dna_improve: true,
    ai_name_generator: true,
    ai_seo_geo: true,
    ai_page_audit: true,
    ai_intelligence: true,
    campaigns: true,
    connector_woo: true,
    connector_csv: true,
    connector_wordpress: true,
    connector_openai: true,
    ai_blog_writer: true,
    ai_cover_image: true,
    connector_shopify: true,
    connector_nuvemshop: true,
    connector_tray: true,
    multi_user: true,
    audit_log_api: true,
    priority_support: true,
  },
}

// Limites numéricos. null = sem limite.
export const PLAN_LIMITS: Record<Plan, Record<LimitKey, number | null>> = {
  entry:  { ai_generations_per_month: 200,   copies_per_workspace: 1_000,  connectors_max: 1,    users_max: 1,  ai_monthly_cost_usd: 5  },
  medium: { ai_generations_per_month: 1_500, copies_per_workspace: 10_000, connectors_max: 2,    users_max: 5,  ai_monthly_cost_usd: 30 },
  ultra:  { ai_generations_per_month: 10_000, copies_per_workspace: null,  connectors_max: null, users_max: 20, ai_monthly_cost_usd: 200 },
}

export function planAllows(plan: Plan, feature: FeatureKey): boolean {
  return PLAN_FEATURES[plan][feature]
}

export function planLimit(plan: Plan, key: LimitKey): number | null {
  return PLAN_LIMITS[plan][key]
}
