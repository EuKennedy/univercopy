module Api
  module V1
    class BaseController < ActionController::API
      include ActionController::Cookies
      include AuthBridge

      before_action :authenticate!
      around_action :set_app_user_session

      rescue_from ActiveRecord::RecordNotFound,         with: :render_not_found
      rescue_from ActiveRecord::RecordInvalid,          with: :render_unprocessable
      rescue_from ActionController::ParameterMissing,   with: :render_bad_request
      rescue_from Security::SsrfBlocked,                with: :render_ssrf_blocked
      rescue_from Ai::CallFailed,                       with: :render_ai_failed

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
    end
  end
end
