module Api
  module V1
    class WorkspacesController < BaseController
      # GET /api/v1/workspaces — workspaces do user atual.
      def index
        list = current_app_user.workspaces.order(created_at: :desc).map { |w| workspace_payload(w) }
        render json: { workspaces: list }
      end

      # GET /api/v1/workspaces/:slug — detalhe + DNA atual.
      def show
        ws = current_app_user.workspaces.find_by!(slug: params[:slug])
        ApplicationRecord.with_workspace_rls(ws.id, user_id: current_app_user.id) do
          render json: {
            workspace: workspace_payload(ws),
            dna_atual: dna_payload(ws.brand_dnas.find_by(kind: "atual")),
            members:   ws.workspace_members.includes(:app_user).map { |m| member_payload(m) },
          }
        end
      end

      # GET /api/v1/workspaces/:workspace_slug/overview — counts pro dashboard.
      def overview
        ws = current_app_user.workspaces.find_by!(slug: params.require(:workspace_slug))
        ApplicationRecord.with_workspace_rls(ws.id, user_id: current_app_user.id) do
          month_start = Time.current.beginning_of_month
          render json: {
            workspace:  workspace_payload(ws),
            dna_in_use: ws.dna_in_use,
            counts: {
              copies:           ws.copies.count,
              copies_revisao:   ws.copies.where(status: "revisao").count,
              campaigns:        ws.campaigns.count,
              products:         ws.products.count,
              generations_month: ws.generations.where("created_at >= ?", month_start).count,
            },
            cost: AiCostCap.report(ws),
            recent_copies: ws.copies.order(updated_at: :desc).limit(5).map { |c|
              { id: c.id, title: c.title, status: c.status, updated_at: c.updated_at }
            },
          }
        end
      end

      # GET /api/v1/workspaces/:workspace_slug/plan — plano + features + uso.
      def plan
        ws = current_app_user.workspaces.find_by!(slug: params.require(:workspace_slug))
        ApplicationRecord.with_workspace_rls(ws.id, user_id: current_app_user.id) do
          render json: {
            snapshot: PlanFeatures.snapshot(ws),
            cost:     AiCostCap.report(ws),
            usage: {
              generations_month: ws.generations.where("created_at >= ?", Time.current.beginning_of_month).count,
              copies:            ws.copies.count,
              products:          ws.products.count,
              members:           ws.workspace_members.count,
            },
          }
        end
      end

      # GET /api/v1/workspaces/:workspace_slug/audit-logs
      def audit_logs
        ws = current_app_user.workspaces.find_by!(slug: params.require(:workspace_slug))
        ApplicationRecord.with_workspace_rls(ws.id, user_id: current_app_user.id) do
          logs = ws.audit_logs.order(created_at: :desc).limit(100).map do |l|
            { id: l.id, action: l.action, metadata: l.metadata, ip: l.ip, created_at: l.created_at }
          end
          render json: { logs: logs }
        end
      end

      private

      def workspace_payload(w)
        w.slice(:id, :slug, :name, :site_url, :brand_color, :default_locale,
                :plan, :status, :onboarding_status, :created_at, :updated_at)
      end

      def dna_payload(d)
        return nil unless d
        d.slice(:kind, :marca, :missao, :posicionamento, :tom, :publico, :consciencia,
                :valores, :produtos, :ofertas, :provas, :objecoes, :evitar,
                :publico_alvo_detalhado, :restricoes_regulatorias,
                :framework, :source_url, :updated_at)
      end

      def member_payload(m)
        u = m.app_user
        {
          user_id: u.id,
          email:   u.email,
          name:    u.name,
          role:    m.role,
          accepted_at: m.accepted_at,
        }
      end
    end
  end
end
