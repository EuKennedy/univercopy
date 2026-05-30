module Api
  module V1
    class PageAuditsController < WorkspaceScopedController
      # GET /api/v1/workspaces/:workspace_slug/page-audits
      def index
        list = current_workspace.page_audits.order(created_at: :desc).limit(50).map { |a| payload(a) }
        render json: { audits: list }
      end

      # POST /api/v1/workspaces/:workspace_slug/page-audits
      # body: { url, model? }
      def create
        PlanFeatures.require!(current_workspace, :ai_page_audit)
        AiCostCap.require!(current_workspace)

        url   = params.require(:url).to_s.strip
        model = (params[:model].presence || "auto")

        result = Ai::PageAuditor.call(
          url:   url,
          dna:   current_workspace.active_brand_dna,
          model: model,
        )
        a = result[:audit]
        ai = result[:ai_result]

        audit = current_workspace.page_audits.create!(
          url:        a["url"],
          brand_name: a["brand_name"],
          score:      a["score"],
          summary:    a["summary"],
          sections:   a["sections"],
          created_by: current_app_user.id,
        )

        current_workspace.ai_jobs.create!(
          task_kind: "page_audit", status: "done", model: ai.model.to_s,
          prompt_tokens: ai.input_tokens, output_tokens: ai.output_tokens,
          cost_usd_actual: ai.cost_usd, payload: { url: url }, finished_at: Time.current,
        )

        render json: payload(audit), status: :created
      end

      private

      def payload(a)
        {
          id:         a.id,
          url:        a.url,
          brand_name: a.brand_name,
          score:      a.score,
          summary:    a.summary,
          sections:   a.sections,
          created_at: a.created_at,
        }
      end
    end
  end
end
