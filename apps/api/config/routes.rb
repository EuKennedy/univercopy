Rails.application.routes.draw do
  # Health probes — Coolify, uptime monitors, Rack::Attack safelist.
  get "/up",     to: "health#show", as: :health_root
  get "/health", to: "health#show"

  namespace :api do
    namespace :v1 do
      get "/health", to: "/health#show"

      # ---------------------------------------------------------------
      # Bibliotecas globais (sem workspace scope — leitura pública).
      # ---------------------------------------------------------------
      get "/styles",       to: "libraries#styles"
      get "/frameworks",   to: "libraries#frameworks"
      get "/piece-types",  to: "libraries#piece_types"
      get "/piece_types",  to: "libraries#piece_types"
      get "/categories",   to: "libraries#categories"

      # ---------------------------------------------------------------
      # Conta do usuário (preferências — nível conta, não workspace).
      get   "/me", to: "account#show"
      patch "/me", to: "account#update"

      # Onboarding wizard.
      # ---------------------------------------------------------------
      get   "/onboarding/state",    to: "onboarding#state"
      post  "/onboarding/start",    to: "onboarding#start"
      get   "/onboarding/job/:id",  to: "onboarding#job"
      patch "/onboarding/dna",      to: "onboarding#update_dna"
      patch "/onboarding/qa",       to: "onboarding#update_qa"
      post  "/onboarding/complete", to: "onboarding#complete"

      # ---------------------------------------------------------------
      # Workspaces — index + show (param :slug).
      # ---------------------------------------------------------------
      resources :workspaces, only: %i[index show], param: :slug

      # ---------------------------------------------------------------
      # Tudo workspace-scoped (RLS via :workspace_slug).
      # ---------------------------------------------------------------
      scope "workspaces/:workspace_slug" do
        # DNA
        get   "/dna",         to: "dna#show"
        post  "/dna/use",     to: "dna#use"
        post  "/dna/improve", to: "dna#improve"
        patch "/dna/:kind",   to: "dna#update"

        # Copies + versões
        get    "/copies",              to: "copies#index"
        post   "/copies",              to: "copies#create"
        get    "/copies/:id",          to: "copies#show"
        patch  "/copies/:id",          to: "copies#update"
        delete "/copies/:id",          to: "copies#destroy"
        get    "/copies/:id/versions", to: "copies#versions"
        post   "/copies/:id/versions", to: "copies#create_version"

        # Campaigns
        resources :campaigns, only: %i[index show create update destroy]

        # Gerador (Fase 5)
        post "/generate",     to: "generations#create"
        get  "/generations",  to: "generations#index"

        # Produtos (catálogo importado) + editor/write-back
        get  "/products",                to: "products#index"
        get  "/products/:id",            to: "products#show"
        post "/products/:id/publish",        to: "products#publish"
        post "/products/:id/generate-field", to: "products#generate_field"

        # Integrações / conectores
        get    "/integrations",                  to: "integrations#index"
        post   "/integrations/woocommerce/test", to: "integrations#test_woocommerce"
        post   "/integrations/woocommerce",      to: "integrations#connect_woocommerce"
        post   "/integrations/:type/sync",       to: "integrations#sync"
        delete "/integrations/:type",            to: "integrations#disconnect"

        # Análise de página (page audit).
        get  "/page-audits", to: "page_audits#index"
        post "/page-audits", to: "page_audits#create"

        # Dashboard + plano + auditoria.
        get "/overview",    to: "workspaces#overview"
        get "/plan",        to: "workspaces#plan"
        get "/audit-logs",  to: "workspaces#audit_logs"
      end
    end
  end
end
