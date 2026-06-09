module Api
  module V1
    class CampaignsController < WorkspaceScopedController
      # GET /api/v1/workspaces/:workspace_slug/campaigns
      def index
        list = current_workspace.campaigns.order(created_at: :desc).map { |c| list_payload(c) }
        render json: { campaigns: list }
      end

      # GET /api/v1/workspaces/:workspace_slug/campaigns/:id
      # Copies agrupadas por canal (sequências), ordenadas por sequence_index.
      def show
        campaign = current_workspace.campaigns.find(params[:id])
        copies = Copy.where(campaign_id: campaign.id)
                     .order(Arel.sql("channel NULLS LAST, sequence_index NULLS LAST, created_at"))
                     .to_a
        previews = current_version_previews(copies.map(&:id))

        flat = copies.map { |c| copy_payload(c, previews[c.id]) }
        render json: {
          campaign:  detail_payload(campaign),
          copies:    flat,
          sequences: group_by_channel(flat),
        }
      end

      # POST /api/v1/workspaces/:workspace_slug/campaigns
      def create
        PlanFeatures.require!(current_workspace, :campaigns)
        c = current_workspace.campaigns.create!(create_params.merge(created_by: current_app_user.id))
        render json: detail_payload(c), status: :created
      end

      # PATCH /api/v1/workspaces/:workspace_slug/campaigns/:id
      def update
        c = current_workspace.campaigns.find(params[:id])
        c.update!(update_params)
        render json: detail_payload(c)
      end

      # DELETE /api/v1/workspaces/:workspace_slug/campaigns/:id
      def destroy
        c = current_workspace.campaigns.find(params[:id])
        c.destroy!
        render json: { ok: true }
      end

      # POST /api/v1/workspaces/:workspace_slug/campaigns/:id/sequence
      # body: { channel, piece_type_key?, style_key?, framework_key?,
      #         product_id?, brief?, steps?, model? }
      # Gera N passos de copy do canal e SALVA direto na campanha como Copies
      # ordenadas (sequence_index). Devolve os passos criados.
      def generate_sequence
        PlanFeatures.require!(current_workspace, :ai_generate)
        AiCostCap.require!(current_workspace)

        campaign = current_workspace.campaigns.find(params[:id])
        b = sequence_params

        unless Catalog::Channels.valid?(b[:channel])
          return render json: { error: "invalid_channel", message: "Canal inválido." }, status: :unprocessable_entity
        end

        result = Ai::SequenceGenerator.call(
          workspace:      current_workspace,
          campaign:       campaign,
          channel:        b[:channel],
          piece_type_key: b[:piece_type_key],
          style_key:      b[:style_key],
          framework_key:  b[:framework_key],
          product_id:     b[:product_id],
          brief:          b[:brief],
          steps:          (b[:steps].presence || 3).to_i,
          model:          (b[:model].presence || "auto"),
        )

        created = persist_sequence(campaign, b[:channel], result)
        log_generation(result)

        render json: {
          channel:  b[:channel],
          copies:   created,
          resolved: result.resolved,
          model:    result.ai_result.model.to_s,
          cost_usd: result.ai_result.cost_usd,
          cost:     AiCostCap.report(current_workspace),
        }, status: :created
      end

      private

      def create_params
        params.require(:campaign).permit(:name, :objective, :audience, :status, :starts_at, :ends_at, :context).to_h
      end

      def update_params
        params.require(:campaign).permit(:name, :objective, :audience, :status, :starts_at, :ends_at, :context).to_h
      end

      def sequence_params
        params.permit(
          :channel, :piece_type_key, :style_key, :framework_key,
          :product_id, :brief, :steps, :model,
        ).to_h.with_indifferent_access
      end

      # Cria uma Copy + CopyVersion por passo, em ordem (sequence_index contínuo
      # após o que já existe no canal). Transação única.
      def persist_sequence(campaign, channel, result)
        r = result.resolved
        base = Copy.where(campaign_id: campaign.id, channel: channel).maximum(:sequence_index) || 0
        out = []

        ActiveRecord::Base.transaction do
          result.steps.each_with_index do |step, i|
            copy = current_workspace.copies.create!(
              campaign_id:    campaign.id,
              channel:        channel,
              sequence_index: base + i + 1,
              product_id:     r[:product_id],
              category_key:   r[:category_key],
              piece_type_key: r[:piece_type_key],
              style_key:      r[:style_key],
              framework_key:  r[:framework_key],
              title:          step[:title].presence || "#{channel} #{base + i + 1}",
              tags:           [],
              created_by:     current_app_user.id,
            )
            CopyVersion.create!(
              copy_id:    copy.id,
              n:          1,
              content:    step[:content].to_s,
              author_id:  current_app_user.id,
              ai_model:   result.ai_result.model.to_s,
              cost_usd:   (result.ai_result.cost_usd.to_f / result.steps.size if result.ai_result.cost_usd),
              note:       "Gerado em sequência",
              is_current: true,
            )
            out << copy_payload(copy, step[:content].to_s.slice(0, 240))
          end
        end

        out
      end

      def log_generation(result)
        ai = result.ai_result
        current_workspace.generations.create!(
          purpose:       "generate_sequence",
          model:         ai.model.to_s,
          prompt:        result.resolved,
          output:        ai.text,
          prompt_tokens: ai.input_tokens,
          output_tokens: ai.output_tokens,
          cost_usd:      ai.cost_usd,
          created_by:    current_app_user.id,
        )
        current_workspace.ai_jobs.create!(
          task_kind:       "generate_sequence",
          status:          "done",
          model:           ai.model.to_s,
          prompt_tokens:   ai.input_tokens,
          output_tokens:   ai.output_tokens,
          cost_usd_actual: ai.cost_usd,
          payload:         result.resolved,
          finished_at:     Time.current,
        )
      end

      def current_version_previews(copy_ids)
        return {} if copy_ids.empty?

        CopyVersion.where(copy_id: copy_ids, is_current: true)
                   .pluck(:copy_id, :content)
                   .to_h
                   .transform_values { |c| c.to_s.slice(0, 240) }
      end

      def group_by_channel(flat)
        flat.group_by { |c| c[:channel] }.map do |channel, steps|
          { channel: channel, steps: steps }
        end
      end

      def copy_payload(c, preview)
        {
          id: c.id, title: c.title, status: c.status,
          channel: c.channel, sequence_index: c.sequence_index,
          piece_type_key: c.piece_type_key, category_key: c.category_key,
          current_content_preview: preview,
          updated_at: c.updated_at,
        }
      end

      def list_payload(c)
        pieces = Copy.where(campaign_id: c.id).count
        c.slice(:id, :name, :objective, :audience, :status, :starts_at, :ends_at,
                :created_at, :updated_at).merge(pieces: pieces)
      end

      def detail_payload(c)
        c.slice(:id, :name, :objective, :audience, :status, :starts_at, :ends_at,
                :context, :created_at, :updated_at)
      end
    end
  end
end
