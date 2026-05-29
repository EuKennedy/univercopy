module Api
  module V1
    class DnaController < WorkspaceScopedController
      # GET /api/v1/workspaces/:workspace_slug/dna
      def show
        render json: {
          dna_in_use: current_workspace.dna_in_use,
          atual:      payload(current_workspace.brand_dnas.find_by(kind: "atual")),
          proposto:   payload(current_workspace.brand_dnas.find_by(kind: "proposto")),
        }
      end

      # PATCH /api/v1/workspaces/:workspace_slug/dna/:kind
      def update
        kind = params.require(:kind)
        raise ActionController::ParameterMissing, "kind inválido" unless %w[atual proposto].include?(kind)

        dna = current_workspace.brand_dnas.find_or_initialize_by(kind: kind)
        dna.assign_attributes(permitted_dna_params)
        dna.updated_at = Time.current
        dna.save!

        render json: payload(dna)
      end

      # POST /api/v1/workspaces/:workspace_slug/dna/use
      # body: { kind: 'atual' | 'proposto' }
      def use
        kind = params.require(:kind)
        raise ActionController::ParameterMissing, "kind inválido" unless %w[atual proposto].include?(kind)

        ws = current_workspace
        settings = (ws.settings || {}).merge("dna_in_use" => kind)
        ws.update!(settings: settings)
        render json: { ok: true, dna_in_use: kind }
      end

      # POST /api/v1/workspaces/:workspace_slug/dna/improve
      # body: { framework?, direction?, model? }
      def improve
        PlanFeatures.require!(current_workspace, :ai_dna_improve)
        AiCostCap.require!(current_workspace)

        framework = params[:framework].presence
        direction = params[:direction].presence
        model     = params[:model].presence || "auto"

        atual = current_workspace.brand_dnas.find_by(kind: "atual")
        raise ActionController::ParameterMissing, "DNA atual ainda não preenchido" if atual.nil?

        result = Ai::DnaImprover.call(
          workspace: current_workspace,
          atual_dna: atual,
          framework: framework,
          direction: direction,
          model:     model.to_sym,
        )

        # Persiste proposto.
        proposto = current_workspace.brand_dnas.find_or_initialize_by(kind: "proposto")
        proposto.assign_attributes(result[:dna_attrs])
        proposto.updated_at = Time.current
        proposto.save!

        # Log generation.
        Generation.create!(
          workspace_id:  current_workspace.id,
          purpose:       "dna_improve",
          model:         result[:ai_result].model.to_s,
          prompt:        { framework: framework, direction: direction },
          output:        result[:ai_result].text,
          prompt_tokens: result[:ai_result].input_tokens,
          output_tokens: result[:ai_result].output_tokens,
          cost_usd:      result[:ai_result].cost_usd,
          created_by:    current_app_user.id,
        )

        render json: payload(proposto)
      end

      private

      def permitted_dna_params
        params.require(:dna).permit(
          :marca, :missao, :posicionamento, :tom, :publico, :consciencia,
          :framework, :source_url,
          valores: [], produtos: [], ofertas: [], provas: [], objecoes: [], evitar: [],
          restricoes_regulatorias: [],
          publico_alvo_detalhado: %i[faixa_etaria faixa_renda genero geografia interesses],
        ).to_h
      end

      def payload(d)
        return nil unless d
        d.slice(:kind, :marca, :missao, :posicionamento, :tom, :publico, :consciencia,
                :valores, :produtos, :ofertas, :provas, :objecoes, :evitar,
                :publico_alvo_detalhado, :restricoes_regulatorias,
                :framework, :source_url, :updated_at)
      end
    end
  end
end
