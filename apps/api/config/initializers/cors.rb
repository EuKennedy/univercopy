# CORS allowlist explícita. Default vazio em dev/test; produção lê de ENV.
# Não use "*" — abre a API para qualquer origem.

allowed_origins = ENV.fetch("CORS_ALLOWED_ORIGINS", "http://localhost:3000")
                     .split(",")
                     .map(&:strip)
                     .reject(&:empty?)

Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    origins(*allowed_origins)

    resource "/api/*",
      headers: :any,
      methods: %i[get post put patch delete options head],
      expose: %w[X-RateLimit-Limit X-RateLimit-Remaining X-RateLimit-Reset],
      credentials: true,
      max_age: 600
  end
end
