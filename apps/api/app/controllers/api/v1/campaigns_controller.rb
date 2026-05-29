module Api
  module V1
    class CampaignsController < WorkspaceScopedController
      # GET /api/v1/workspaces/:workspace_slug/campaigns
      def index
        list = current_workspace.campaigns.order(created_at: :desc).map { |c| list_payload(c) }
        render json: { campaigns: list }
      end

      # GET /api/v1/workspaces/:workspace_slug/campaigns/:id
      def show
        campaign = current_workspace.campaigns.find(params[:id])
        copies = Copy.where(campaign_id: campaign.id).order(updated_at: :desc).map { |c|
          { id: c.id, title: c.title, status: c.status, piece_type_key: c.piece_type_key, updated_at: c.updated_at }
        }
        render json: { campaign: detail_payload(campaign), copies: copies }
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

      private

      def create_params
        params.require(:campaign).permit(:name, :objective, :audience, :status, :starts_at, :ends_at, :context).to_h
      end

      def update_params
        params.require(:campaign).permit(:name, :objective, :audience, :status, :starts_at, :ends_at, :context).to_h
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
