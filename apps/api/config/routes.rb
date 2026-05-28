Rails.application.routes.draw do
  # Health probes — Coolify, uptime monitors, Rack::Attack safelist.
  get "/up",     to: "health#show", as: :health_root
  get "/health", to: "health#show"

  namespace :api do
    namespace :v1 do
      get "/health", to: "/health#show"

      # Onboarding wizard.
      get   "/onboarding/state",    to: "onboarding#state"
      post  "/onboarding/start",    to: "onboarding#start"
      get   "/onboarding/job/:id",  to: "onboarding#job"
      patch "/onboarding/dna",      to: "onboarding#update_dna"
      patch "/onboarding/qa",       to: "onboarding#update_qa"
      post  "/onboarding/complete", to: "onboarding#complete"
    end
  end
end
