module Api
  module V1
    class GenerationsController < WorkspaceScopedController
      # GET /api/v1/workspaces/:workspace_slug/generations
      def index
        list = current_workspace.generations
                                .order(created_at: :desc)
                                .limit(50)
                                .map { |g| list_payload(g) }
        render json: { generations: list }
      end

      # POST /api/v1/workspaces/:workspace_slug/generate
      # body: { piece_type_key, style_key?, framework_key?, product_id?,
      #         campaign_id?, brief?, n?, model? }
      # Devolve variações pro usuário escolher — NÃO salva como Copy ainda.
      def create
        PlanFeatures.require!(current_workspace, :ai_generate)
        AiCostCap.require!(current_workspace)

        b = generate_params

        result = Ai::CopyGenerator.call(
          workspace:      current_workspace,
          piece_type_key: b[:piece_type_key],
          style_key:      b[:style_key],
          framework_key:  b[:framework_key],
          product_id:     b[:product_id],
          campaign_id:    b[:campaign_id],
          brief:          b[:brief],
          n:              (b[:n].presence || 2).to_i,
          model:          (b[:model].presence || "auto"),
        )

        gen = persist_generation(result)

        render json: {
          generation_id: gen.id,
          variations:    result.variations,
          resolved:      result.resolved,
          model:         result.ai_result.model.to_s,
          cost_usd:      result.ai_result.cost_usd,
          cost:          AiCostCap.report(current_workspace),
        }, status: :created
      end

      private

      def generate_params
        params.permit(
          :piece_type_key, :style_key, :framework_key,
          :product_id, :campaign_id, :brief, :n, :model,
        ).to_h.with_indifferent_access
      end

      # Loga em generations (histórico) e ai_jobs (cost cap mensal).
      def persist_generation(result)
        ai = result.ai_result
        gen = current_workspace.generations.create!(
          purpose:       "generate_copy",
          model:         ai.model.to_s,
          prompt:        result.resolved,
          output:        ai.text,
          prompt_tokens: ai.input_tokens,
          output_tokens: ai.output_tokens,
          cost_usd:      ai.cost_usd,
          created_by:    current_app_user.id,
        )

        current_workspace.ai_jobs.create!(
          task_kind:         "generate_copy",
          status:            "done",
          model:             ai.model.to_s,
          prompt_tokens:     ai.input_tokens,
          output_tokens:     ai.output_tokens,
          cost_usd_actual:   ai.cost_usd,
          payload:           result.resolved,
          finished_at:       Time.current,
        )

        gen
      end

      def list_payload(g)
        {
          id:         g.id,
          purpose:    g.purpose,
          model:      g.model,
          cost_usd:   g.cost_usd,
          copy_id:    g.copy_id,
          created_at: g.created_at,
        }
      end
    end
  end
end
