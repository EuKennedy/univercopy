module Api
  module V1
    class CopiesController < WorkspaceScopedController
      # GET /api/v1/workspaces/:workspace_slug/copies?status=&category=&campaign_id=
      def index
        scope = current_workspace.copies.order(updated_at: :desc)
        scope = scope.where(status: params[:status])               if params[:status].present?
        scope = scope.where(category_key: params[:category])       if params[:category].present?
        scope = scope.where(campaign_id: params[:campaign_id])     if params[:campaign_id].present?
        scope = scope.where(product_id: params[:product_id])       if params[:product_id].present?

        copies = scope.includes(:campaign).limit(200).map { |c| list_payload(c) }
        render json: { copies: copies }
      end

      # GET /api/v1/workspaces/:workspace_slug/copies/:id
      def show
        copy = current_workspace.copies.find(params[:id])
        render json: detail_payload(copy)
      end

      # POST /api/v1/workspaces/:workspace_slug/copies
      # body: { title, content, category_key?, piece_type_key?, style_key?, framework_key?, product_id?, campaign_id?, tags? }
      def create
        b = create_params
        copy = nil

        # Validação manual de unidade (single transaction).
        copy = current_workspace.copies.create!(
          product_id:     b[:product_id],
          campaign_id:    b[:campaign_id],
          category_key:   b[:category_key],
          piece_type_key: b[:piece_type_key],
          style_key:      b[:style_key],
          framework_key:  b[:framework_key],
          channel:        b[:channel],
          title:          b[:title],
          tags:           b[:tags] || [],
          created_by:     current_app_user.id,
        )
        CopyVersion.create!(
          copy_id:    copy.id,
          n:          1,
          content:    b[:content].to_s,
          author_id:  current_app_user.id,
          note:       "Criação manual",
          is_current: true,
        )

        render json: detail_payload(copy), status: :created
      end

      # PATCH /api/v1/workspaces/:workspace_slug/copies/:id
      # body: { title?, status?, tags?, category_key?, piece_type_key? }
      def update
        copy = current_workspace.copies.find(params[:id])
        copy.update!(update_params)
        render json: detail_payload(copy)
      end

      # POST /api/v1/workspaces/:workspace_slug/copies/:id/versions
      # body: { content, note? }
      def create_version
        copy = current_workspace.copies.find(params[:id])
        new_content = params.require(:content).to_s
        note        = params[:note].presence || "Nova versão"

        copy_version = nil
        ActiveRecord::Base.transaction do
          CopyVersion.where(copy_id: copy.id, is_current: true).update_all(is_current: false)
          n = (CopyVersion.where(copy_id: copy.id).maximum(:n) || 0) + 1
          copy_version = CopyVersion.create!(
            copy_id:    copy.id,
            n:          n,
            content:    new_content,
            author_id:  current_app_user.id,
            note:       note,
            is_current: true,
          )
          copy.touch(:updated_at)
        end

        render json: version_payload(copy_version), status: :created
      end

      # GET /api/v1/workspaces/:workspace_slug/copies/:id/versions
      def versions
        copy = current_workspace.copies.find(params[:id])
        list = CopyVersion.where(copy_id: copy.id).order(n: :desc).map { |v| version_payload(v) }
        render json: { versions: list }
      end

      # DELETE /api/v1/workspaces/:workspace_slug/copies/:id
      def destroy
        copy = current_workspace.copies.find(params[:id])
        copy.destroy!
        render json: { ok: true }
      end

      private

      def create_params
        params.permit(
          :title, :content, :category_key, :piece_type_key,
          :style_key, :framework_key, :product_id, :campaign_id, :channel,
          tags: [],
        ).to_h.with_indifferent_access
      end

      def update_params
        params.permit(:title, :status, :category_key, :piece_type_key, :style_key, :framework_key,
                      :campaign_id, :product_id, tags: []).to_h
      end

      def list_payload(c)
        current = CopyVersion.where(copy_id: c.id, is_current: true).pick(:content)
        {
          id: c.id, title: c.title, status: c.status,
          category_key: c.category_key, piece_type_key: c.piece_type_key,
          style_key: c.style_key, framework_key: c.framework_key,
          tags: c.tags, product_id: c.product_id, campaign_id: c.campaign_id,
          current_content_preview: current&.slice(0, 240),
          updated_at: c.updated_at,
        }
      end

      def detail_payload(c)
        current_v = CopyVersion.find_by(copy_id: c.id, is_current: true)
        {
          id: c.id, title: c.title, status: c.status,
          category_key: c.category_key, piece_type_key: c.piece_type_key,
          style_key: c.style_key, framework_key: c.framework_key,
          tags: c.tags,
          product_id: c.product_id, campaign_id: c.campaign_id,
          current_version: current_v && version_payload(current_v),
          created_at: c.created_at, updated_at: c.updated_at,
        }
      end

      def version_payload(v)
        {
          id: v.id, n: v.n, content: v.content, note: v.note,
          author_id: v.author_id, is_current: v.is_current,
          ai_model: v.ai_model, cost_usd: v.cost_usd,
          created_at: v.created_at,
        }
      end
    end
  end
end
