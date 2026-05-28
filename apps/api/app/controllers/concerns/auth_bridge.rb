# Ponte de autenticação Rails ↔ Better Auth.
# Lê a sessão de duas fontes (mesmo-origem usa cookie; cross-origin usa Bearer):
#   1) cookie `__Secure-better-auth.session_token` (ou variante dev sem __Secure-)
#   2) header `Authorization: Bearer <session_token>`
#
# Faz lookup direto em `auth.session` (Drizzle schema). Latência sub-2ms.
# Espelha o user pra `public.app_users` (idempotente) e retorna o ApplicationUser.
#
# Não chama HTTP em outro serviço — tudo no mesmo banco.

module AuthBridge
  extend ActiveSupport::Concern

  COOKIE_NAMES = %w[
    __Secure-better-auth.session_token
    better-auth.session_token
  ].freeze

  included do
    helper_method :current_app_user, :current_session if respond_to?(:helper_method)
  end

  # ===================================================================
  # Public API
  # ===================================================================
  def current_session
    @current_session ||= load_session_from_request
  end

  def current_app_user
    @current_app_user ||= load_app_user
  end

  def authenticate!
    return if current_app_user

    render json: { error: "unauthenticated" }, status: :unauthorized
  end

  # ===================================================================
  # Internals
  # ===================================================================
  private

  def session_token_from_request
    cookie_token = COOKIE_NAMES.lazy.map { |n| request.cookies[n] }.find(&:present?)
    if cookie_token
      # Better Auth pode anexar `.signature` no cookie — token "puro" fica antes do primeiro ponto.
      return cookie_token.split(".").first
    end

    header = request.headers["Authorization"].to_s
    return header.sub(/\ABearer\s+/i, "") if header =~ /\ABearer\s+/i

    nil
  end

  def load_session_from_request
    token = session_token_from_request
    return nil if token.blank?

    sql = <<~SQL
      SELECT s.user_id, s.expires_at, u.email, u.name, u.image
      FROM auth.session s
      JOIN auth.user u ON u.id = s.user_id
      WHERE s.token = $1 AND s.expires_at > NOW()
      LIMIT 1
    SQL

    row = ActiveRecord::Base.connection.exec_query(
      sql, "BetterAuthSessionLookup", [token]
    ).first
    row&.with_indifferent_access
  end

  def load_app_user
    sess = current_session
    return nil unless sess

    # Idempotente — sincroniza Better Auth user com nosso app_user.
    # Em produção, dispara hook better-auth-side no signup pra criar app_user
    # antes que primeira request chegue; este fallback cobre dev e edge cases.
    user = AppUser.find_or_create_by!(better_auth_user_id: sess[:user_id]) do |u|
      u.email = sess[:email]
      u.name  = sess[:name]
    end

    # Mantém email/name atualizados se mudaram no Better Auth.
    if user.email != sess[:email] || user.name != sess[:name]
      user.update_columns(email: sess[:email], name: sess[:name], updated_at: Time.current)
    end

    user
  end
end
