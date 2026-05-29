# Espelha packages/shared/src/plan-features.ts. Single source of truth
# Ruby pra paywall. Sempre re-enforça em backend mesmo que UI mostre/
# esconda — UI nunca é autoridade.

module PlanFeatures
  PLANS = %i[entry medium ultra].freeze

  FEATURES = {
    entry: {
      ai_generate:        true,
      ai_dna_extract:     true,
      ai_dna_improve:     true,
      ai_name_generator:  false,
      ai_seo_geo:         false,
      ai_page_audit:      false,
      ai_intelligence:    false,
      campaigns:          false,
      connector_woo:      true,
      connector_csv:      true,
      connector_shopify:  false,
      connector_nuvemshop: false,
      connector_tray:     false,
      multi_user:         false,
      audit_log_api:      false,
      priority_support:   false,
    },
    medium: {
      ai_generate:        true,
      ai_dna_extract:     true,
      ai_dna_improve:     true,
      ai_name_generator:  true,
      ai_seo_geo:         true,
      ai_page_audit:      true,
      ai_intelligence:    false,
      campaigns:          true,
      connector_woo:      true,
      connector_csv:      true,
      connector_shopify:  true,
      connector_nuvemshop: false,
      connector_tray:     false,
      multi_user:         true,
      audit_log_api:      false,
      priority_support:   false,
    },
    ultra: {
      ai_generate:        true,
      ai_dna_extract:     true,
      ai_dna_improve:     true,
      ai_name_generator:  true,
      ai_seo_geo:         true,
      ai_page_audit:      true,
      ai_intelligence:    true,
      campaigns:          true,
      connector_woo:      true,
      connector_csv:      true,
      connector_shopify:  true,
      connector_nuvemshop: true,
      connector_tray:     true,
      multi_user:         true,
      audit_log_api:      true,
      priority_support:   true,
    },
  }.freeze

  LIMITS = {
    entry:  { ai_generations_per_month: 200,    copies_per_workspace: 1_000,  connectors_max: 1,    users_max: 1,  ai_monthly_cost_usd: 5 },
    medium: { ai_generations_per_month: 1_500,  copies_per_workspace: 10_000, connectors_max: 2,    users_max: 5,  ai_monthly_cost_usd: 30 },
    ultra:  { ai_generations_per_month: 10_000, copies_per_workspace: nil,    connectors_max: nil,  users_max: 20, ai_monthly_cost_usd: 200 },
  }.freeze

  module_function

  def plan(workspace)
    (workspace.plan || "entry").to_sym
  end

  def allow?(workspace, feature)
    FEATURES.fetch(plan(workspace)).fetch(feature.to_sym, false)
  end

  def require!(workspace, feature)
    raise FeatureLocked.new(feature: feature, plan: plan(workspace)) unless allow?(workspace, feature)
  end

  def limit(workspace, key)
    LIMITS.fetch(plan(workspace)).fetch(key.to_sym, nil)
  end

  def snapshot(workspace)
    p = plan(workspace)
    { plan: p, features: FEATURES[p], limits: LIMITS[p] }
  end
end
