class HealthController < ActionController::API
  # Probe leve. Não toca DB — uptime monitor não deve cair se Postgres tem lag.
  # Probe profundo (DB + Redis) entra na Fase 9 como /api/v1/health/deep.
  def show
    render json: {
      ok: true,
      service: "univercopy-api",
      env: Rails.env,
      version: ENV.fetch("APP_VERSION", "0.1.0"),
      time: Time.now.utc.iso8601
    }
  end
end
