module Api
  module V1
    class BaseController < ActionController::API
      include ActionController::Cookies
      include AuthBridge

      before_action :authenticate!
      around_action :set_app_user_session

      # ORDEM IMPORTA: Rails avalia rescue_from na ordem REVERSA de declaração
      # (o último declarado é checado primeiro). O catch-all StandardError vem
      # PRIMEIRO para ser o último a ser checado — senão ele sombreia todos os
      # handlers específicos (404/402/422 virariam 500).
      rescue_from StandardError,                        with: :render_internal_error
      rescue_from ActiveRecord::RecordNotFound,         with: :render_not_found
      rescue_from ActiveRecord::RecordInvalid,          with: :render_unprocessable
      rescue_from ActionController::ParameterMissing,   with: :render_bad_request
      rescue_from Security::SsrfBlocked,                with: :render_ssrf_blocked
      rescue_from Ai::CallFailed,                       with: :render_ai_failed
      rescue_from FeatureLocked,                        with: :render_feature_locked
      rescue_from CapReached,                           with: :render_cap_reached

      private

      # Setta app.user_id pra que policies RLS reconheçam quem é. Workspace
      # context é setado em subclasses via around_action específico.
      def set_app_user_session
        ApplicationRecord.with_user(current_app_user.id) { yield }
      end

      def render_not_found(e)
        render json: { error: "not_found", message: e.message }, status: :not_found
      end

      def render_unprocessable(e)
        render json: { error: "validation", errors: e.record.errors.as_json }, status: :unprocessable_entity
      end

      def render_bad_request(e)
        render json: { error: "bad_request", message: e.message }, status: :bad_request
      end

      def render_ssrf_blocked(e)
        Rails.logger.warn("[SSRF blocked] #{e.message}")
        render json: { error: "ssrf_blocked", message: "URL inválida ou aponta para endereço interno." }, status: :unprocessable_entity
      end

      def render_ai_failed(e)
        render json: { error: "ai_failed", message: e.message }, status: :bad_gateway
      end

      # 402 — feature fora do plano. Frontend mostra paywall/upgrade.
      def render_feature_locked(e)
        render json: {
          error:   "feature_locked",
          feature: e.feature,
          plan:    e.plan,
          message: e.message,
        }, status: :payment_required
      end

      # 402 — cap mensal de custo AI atingido. Frontend mostra cap + upgrade.
      def render_cap_reached(e)
        render json: {
          error:        "cap_reached",
          kind:         e.kind,
          limit:        e.limit,
          used:         e.used,
          message:      e.message,
        }, status: :payment_required
      end

      def render_internal_error(e)
        # Loga sempre com stack trace completo (top 12 frames) — log
        # estruturado JSON pra grep + correlation_id da request_id do Rails.
        Rails.logger.error({
          api_error:      "internal",
          class:          e.class.name,
          message:        e.message,
          request_id:     request.request_id,
          path:           request.path,
          method:         request.method,
          backtrace:      e.backtrace&.first(12),
        }.to_json)

        # Body sempre presente com class+message (não vaza secret pq exception
        # message do Rails é controlada pelo nosso código).
        render json: {
          error:        "internal_error",
          message:      e.message,
          exception:    e.class.name,
          request_id:   request.request_id,
        }, status: :internal_server_error
      end
    end
  end
end
