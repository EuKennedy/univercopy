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
      get "/channels",     to: "libraries#channels"

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

        # Campaigns + geração de sequência multi-canal direto na campanha
        resources :campaigns, only: %i[index show create update destroy]
        post "/campaigns/:id/sequence", to: "campaigns#generate_sequence"

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
        post   "/integrations/wordpress/test",   to: "integrations#test_wordpress"
        post   "/integrations/wordpress",        to: "integrations#connect_wordpress"
        post   "/integrations/openai/test",      to: "integrations#test_openai"
        post   "/integrations/openai",           to: "integrations#connect_openai"
        post   "/integrations/:type/sync",       to: "integrations#sync"
        delete "/integrations/:type",            to: "integrations#disconnect"

        # Blog WordPress (REST API v2). Publica rascunho ou post direto.
        # Credenciais (WordPress e OpenAI) vêm da integration do workspace,
        # nunca de ENV.
        get  "/blog/status",           to: "blog_posts#status"
        get  "/blog/categories",       to: "blog_posts#categories"
        post "/blog/categories",       to: "blog_posts#create_category"
        get  "/blog/tags",             to: "blog_posts#tags"
        post "/blog/tags",             to: "blog_posts#create_tag"
        post "/blog/generate/title",   to: "blog_posts#generate_title"
        post "/blog/generate/content", to: "blog_posts#generate_content"
        post "/blog/cover/generate",   to: "blog_posts#generate_cover"
        post "/blog/cover/upload",     to: "blog_posts#upload_cover"
        post "/blog/publish",          to: "blog_posts#publish"
        # Agente: conversa até fechar o plano, executa em background com polling.
        post "/blog/agent/message",    to: "blog_posts#agent_message"
        post "/blog/agent/run",        to: "blog_posts#agent_run"
        get  "/blog/agent/run/:id",    to: "blog_posts#agent_run_status"

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
