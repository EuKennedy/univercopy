# Rate limit + safelist. Sobreposto na Fase 9 com throttles por workspace.
# Por ora: safelist de health probes + throttle global por IP pra impedir
# abuso anônimo no boot.

class Rack::Attack
  Rack::Attack.cache.store = ActiveSupport::Cache::MemoryStore.new

  # Health probes nunca throttled — uptime monitors precisam responder rápido.
  safelist("health probes") do |req|
    %w[/up /healthz /health /api/health].include?(req.path)
  end

  # Throttle anônimo: 60 req/min por IP em paths públicos.
  throttle("public/ip", limit: 60, period: 60) do |req|
    req.ip if req.path.start_with?("/api/v1/public/")
  end

  self.throttled_responder = lambda do |req|
    retry_after = (req.env["rack.attack.match_data"] || {})[:period]
    [
      429,
      {
        "Content-Type" => "application/json",
        "Retry-After" => retry_after.to_s
      },
      [{ error: "rate_limited", message: "Slow down." }.to_json]
    ]
  end
end
