Rails.application.routes.draw do
  # Health probes — usados pelo Coolify, uptime monitors e Rack::Attack safelist.
  get "/up",     to: "health#show", as: :health_root
  get "/health", to: "health#show"

  # /api/v1 montado nas Fases 4+. Health stub responde já no bootstrap.
  namespace :api do
    namespace :v1 do
      get "/health", to: "/health#show"
    end
  end
end
