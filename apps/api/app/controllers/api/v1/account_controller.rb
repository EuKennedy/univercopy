module Api
  module V1
    # Preferências do usuário (nível conta, não workspace). Idioma + modelo
    # de IA padrão. Não é workspace-scoped.
    class AccountController < BaseController
      # GET /api/v1/me
      def show
        render json: payload(current_app_user)
      end

      # PATCH /api/v1/me
      # body: { default_locale?, preferred_ai_model? }
      def update
        attrs = params.permit(:default_locale, :preferred_ai_model).to_h.compact_blank
        current_app_user.update!(attrs)
        render json: payload(current_app_user)
      end

      private

      def payload(u)
        {
          id:                 u.id,
          email:              u.email,
          name:               u.name,
          default_locale:     u.default_locale,
          preferred_ai_model: u.preferred_ai_model,
        }
      end
    end
  end
end
