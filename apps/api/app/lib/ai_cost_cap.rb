# Soma `cost_usd_actual` (ou fallback `cost_usd_estimated`) dos `ai_jobs`
# do workspace no mês corrente. Compara com PlanFeatures.limit
# `:ai_monthly_cost_usd`. Levanta `CapReached` quando passa.
#
# Chamado em todo job/service AI ANTES da chamada Anthropic. Cheap (1
# query agregada com index em workspace_id+created_at).

module AiCostCap
  module_function

  def used_this_month(workspace)
    AiJob.where(workspace_id: workspace.id)
         .where("created_at >= ?", Time.current.beginning_of_month)
         .where.not(status: "error")
         .sum(Arel.sql("COALESCE(cost_usd_actual, cost_usd_estimated, 0)"))
         .to_f
  end

  def require!(workspace)
    cap = PlanFeatures.limit(workspace, :ai_monthly_cost_usd)
    return if cap.nil? # ultra = sem cap

    used = used_this_month(workspace)
    return if used < cap

    raise CapReached.new(
      kind:         :ai_monthly_cost_usd,
      workspace_id: workspace.id,
      limit:        cap,
      used:         used,
    )
  end

  def report(workspace)
    cap  = PlanFeatures.limit(workspace, :ai_monthly_cost_usd)
    used = used_this_month(workspace)
    {
      used_usd:    used,
      limit_usd:   cap,
      percent:     cap ? (used / cap.to_f * 100).round(1) : nil,
      remaining:   cap ? [cap - used, 0.0].max : nil,
    }
  end
end
