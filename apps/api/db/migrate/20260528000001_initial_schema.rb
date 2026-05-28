class InitialSchema < ActiveRecord::Migration[8.1]
  # Migration única do bootstrap world-class. Idempotente via `create_table
  # if_not_exists` não — usamos schema_migrations pra controle. Reversível
  # via `change` semântico OU `up`/`down` quando precisa SQL bruto.
  def up
    # ---------------------------------------------------------------
    # Extensões PostgreSQL
    # ---------------------------------------------------------------
    enable_extension "pgcrypto"   # gen_random_uuid()
    enable_extension "pg_trgm"    # fuzzy search
    enable_extension "vector"     # pgvector — embeddings RAG

    # ---------------------------------------------------------------
    # Helper RLS — checa se o usuário corrente é membro do workspace.
    # SECURITY DEFINER pra que checagem cruzada (workspace_member) não
    # dispare o próprio RLS dela quando chamada de policy.
    # ---------------------------------------------------------------
    execute <<~SQL
      CREATE OR REPLACE FUNCTION app_current_user_id() RETURNS uuid
      LANGUAGE sql STABLE AS $$
        SELECT NULLIF(current_setting('app.user_id', true), '')::uuid
      $$;

      CREATE OR REPLACE FUNCTION app_current_workspace_id() RETURNS uuid
      LANGUAGE sql STABLE AS $$
        SELECT NULLIF(current_setting('app.workspace_id', true), '')::uuid
      $$;
    SQL

    # ---------------------------------------------------------------
    # 1. app_user
    # Espelho de auth.user (Better Auth). Sincronizado via hook na Fase 3.
    # Não tem RLS — usuários precisam ser lookup-able globalmente.
    # ---------------------------------------------------------------
    create_table :app_users, id: :uuid, default: -> { "gen_random_uuid()" } do |t|
      t.string  :email, null: false
      t.string  :name
      t.string  :avatar_url
      t.string  :default_locale, null: false, default: "pt-BR"
      t.string  :preferred_ai_model, null: false, default: "auto"  # auto|haiku|sonnet|opus
      t.string  :better_auth_user_id  # FK soft p/ auth.user.id
      t.string  :accepted_terms_version
      t.string  :accepted_privacy_version
      t.datetime :accepted_at
      t.datetime :deletion_requested_at
      t.timestamps
    end
    add_index :app_users, :email, unique: true
    add_index :app_users, :better_auth_user_id, unique: true, where: "better_auth_user_id IS NOT NULL"

    # ---------------------------------------------------------------
    # 2. workspace
    # 1 marca = 1 workspace. Sem campo "vertical" — DNA carrega contexto.
    # ---------------------------------------------------------------
    create_table :workspaces, id: :uuid, default: -> { "gen_random_uuid()" } do |t|
      t.string  :slug, null: false
      t.string  :name, null: false
      t.string  :site_url
      t.string  :brand_color  # hex livre
      t.string  :default_locale, null: false, default: "pt-BR"
      t.string  :plan, null: false, default: "entry"  # entry|medium|ultra
      t.string  :status, null: false, default: "active"  # active|suspended|deleted
      t.datetime :plan_expires_at
      t.uuid    :owner_id, null: false
      t.jsonb   :settings, null: false, default: {}
      t.string  :onboarding_status, null: false, default: "pending"  # pending|dna_loaded|qa_done|done
      t.timestamps
    end
    add_index :workspaces, :slug, unique: true
    add_index :workspaces, :owner_id
    add_index :workspaces, :plan
    add_index :workspaces, :status
    add_foreign_key :workspaces, :app_users, column: :owner_id, on_delete: :restrict

    # ---------------------------------------------------------------
    # 3. workspace_member (RBAC)
    # ---------------------------------------------------------------
    execute <<~SQL
      CREATE TYPE member_role AS ENUM ('owner','admin','editor','reviewer','viewer');
    SQL

    create_table :workspace_members, primary_key: [:workspace_id, :user_id], id: false do |t|
      t.uuid :workspace_id, null: false
      t.uuid :user_id,      null: false
      t.column :role, :member_role, null: false, default: "editor"
      t.datetime :invited_at
      t.datetime :accepted_at
      t.timestamps
    end
    add_foreign_key :workspace_members, :workspaces, on_delete: :cascade
    add_foreign_key :workspace_members, :app_users,  column: :user_id, on_delete: :cascade
    add_index :workspace_members, :user_id

    # is_member precisa de workspace_member existente — definimos só agora.
    execute <<~SQL
      CREATE OR REPLACE FUNCTION is_member(ws uuid) RETURNS boolean
      LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
        SELECT EXISTS (
          SELECT 1 FROM workspace_members m
          WHERE m.workspace_id = ws
            AND m.user_id = app_current_user_id()
        )
      $$;
    SQL

    # ---------------------------------------------------------------
    # 4. workspace_api_key — tokens programáticos JWT
    # ---------------------------------------------------------------
    create_table :workspace_api_keys, id: :uuid, default: -> { "gen_random_uuid()" } do |t|
      t.uuid    :workspace_id, null: false
      t.string  :name, null: false
      t.string  :token_digest, null: false  # bcrypt
      t.string  :prefix, null: false, limit: 8  # 8 primeiros chars visíveis
      t.string  :scopes, array: true, default: [], null: false
      t.uuid    :created_by
      t.datetime :last_used_at
      t.datetime :expires_at
      t.datetime :revoked_at
      t.timestamps
    end
    add_index :workspace_api_keys, :workspace_id
    add_index :workspace_api_keys, :token_digest, unique: true
    add_foreign_key :workspace_api_keys, :workspaces, on_delete: :cascade

    # ---------------------------------------------------------------
    # 5. brand_dna (atual | proposto) — coração contextual
    # ---------------------------------------------------------------
    execute <<~SQL
      CREATE TYPE dna_kind AS ENUM ('atual','proposto');
    SQL

    create_table :brand_dnas, id: :uuid, default: -> { "gen_random_uuid()" } do |t|
      t.uuid    :workspace_id, null: false
      t.column  :kind, :dna_kind, null: false
      t.string  :marca
      t.text    :missao
      t.text    :posicionamento
      t.text    :tom
      t.text    :publico
      t.text    :consciencia
      t.jsonb   :valores,    null: false, default: []
      t.jsonb   :produtos,   null: false, default: []
      t.jsonb   :ofertas,    null: false, default: []
      t.jsonb   :provas,     null: false, default: []
      t.jsonb   :objecoes,   null: false, default: []
      t.jsonb   :evitar,     null: false, default: []
      # Detalhamento de público capturado no onboarding Q&A (Fase 3).
      t.jsonb   :publico_alvo_detalhado, null: false, default: {}
      # Restrições regulatórias opcionais (ANVISA, ANATEL, CVM, custom).
      t.jsonb   :restricoes_regulatorias, null: false, default: []
      t.string  :framework      # Sinek, Kapferer, etc
      t.string  :source_url     # de onde extraímos (DNA from URL)
      t.datetime :updated_at, null: false, default: -> { "now()" }
      t.datetime :created_at, null: false, default: -> { "now()" }
    end
    add_index :brand_dnas, [:workspace_id, :kind], unique: true
    add_foreign_key :brand_dnas, :workspaces, on_delete: :cascade

    # ---------------------------------------------------------------
    # 6. Bibliotecas globais (sem RLS — leitura pública por todos)
    # ---------------------------------------------------------------
    create_table :styles, id: false do |t|
      t.string :key, primary_key: true, null: false
      t.string :name, null: false
      t.string :era
      t.string :grp  # dr|brand|modern|strategy|br
      t.text   :description
      t.jsonb  :principles, null: false, default: []
      t.text   :when_to_use
      t.timestamps
    end

    create_table :frameworks, id: false do |t|
      t.string :key, primary_key: true, null: false
      t.string :name, null: false
      t.text   :structure
      t.timestamps
    end

    create_table :piece_types, id: false do |t|
      t.string :key, primary_key: true, null: false
      t.string :category_key, null: false
      t.string :name, null: false
      t.text   :description
      t.text   :structure
      t.string :default_framework
      t.string :default_style
      t.string :length_hint
      t.timestamps
    end
    add_foreign_key :piece_types, :frameworks, column: :default_framework, primary_key: :key, on_delete: :nullify
    add_foreign_key :piece_types, :styles,     column: :default_style,     primary_key: :key, on_delete: :nullify

    # Categorias: global (workspace_id NULL) ou custom (workspace_id presente).
    create_table :categories, id: :uuid, default: -> { "gen_random_uuid()" } do |t|
      t.uuid   :workspace_id  # NULL = global
      t.string :key, null: false
      t.string :name, null: false
      t.string :icon
      t.string :color
      t.timestamps
    end
    # NULLS NOT DISTINCT (pg15+) trata múltiplos NULLs como iguais — necessário
    # pra que ON CONFLICT no seed idempotente de categorias globais funcione.
    execute "CREATE UNIQUE INDEX idx_categories_uniq ON categories (workspace_id, key) NULLS NOT DISTINCT;"
    add_index :categories, :key
    add_foreign_key :categories, :workspaces, on_delete: :cascade

    # ---------------------------------------------------------------
    # 7. product — catálogo importado (Woo/Shopify/CSV/Site)
    # ---------------------------------------------------------------
    create_table :products, id: :uuid, default: -> { "gen_random_uuid()" } do |t|
      t.uuid    :workspace_id, null: false
      t.string  :source, null: false, default: "manual"  # woocommerce|shopify|nuvemshop|tray|csv|site|manual
      t.string  :external_id
      t.string  :sku
      t.string  :name, null: false
      t.text    :description
      t.text    :short_description
      t.decimal :price, precision: 12, scale: 2
      t.string  :permalink
      t.jsonb   :categories, null: false, default: []
      t.jsonb   :images,     null: false, default: []
      t.decimal :rating_avg, precision: 3, scale: 2
      t.integer :reviews_count, null: false, default: 0
      t.jsonb   :profile     # ficha técnica-comercial gerada por IA
      t.jsonb   :metadata, null: false, default: {}
      t.datetime :synced_at
      t.timestamps
    end
    add_index :products, [:workspace_id, :source, :external_id], unique: true, name: "idx_products_uniq_source"
    add_index :products, :workspace_id
    add_index :products, [:workspace_id, :name]
    add_foreign_key :products, :workspaces, on_delete: :cascade
    execute <<~SQL
      CREATE INDEX idx_products_text_search ON products
        USING gin (to_tsvector('portuguese',
          coalesce(name,'') || ' ' || coalesce(description,'')));
    SQL

    # ---------------------------------------------------------------
    # 8. campaign — agrupa copies por evento/lançamento
    # ---------------------------------------------------------------
    create_table :campaigns, id: :uuid, default: -> { "gen_random_uuid()" } do |t|
      t.uuid   :workspace_id, null: false
      t.string :name, null: false
      t.text   :objective
      t.text   :audience
      t.string :status, null: false, default: "planejada"  # planejada|ativa|concluida|arquivada
      t.date   :starts_at
      t.date   :ends_at
      t.text   :context  # textão + uploads (referenciados em rag_documents)
      t.uuid   :created_by
      t.timestamps
    end
    add_index :campaigns, :workspace_id
    add_index :campaigns, [:workspace_id, :status]
    add_foreign_key :campaigns, :workspaces, on_delete: :cascade
    add_foreign_key :campaigns, :app_users, column: :created_by, on_delete: :nullify

    # ---------------------------------------------------------------
    # 9. copy + copy_version + copy_comment
    # ---------------------------------------------------------------
    execute <<~SQL
      CREATE TYPE copy_status AS ENUM ('rascunho','revisao','aprovado','publicado','arquivado');
    SQL

    create_table :copies, id: :uuid, default: -> { "gen_random_uuid()" } do |t|
      t.uuid   :workspace_id, null: false
      t.uuid   :product_id
      t.uuid   :campaign_id
      t.string :category_key
      t.string :piece_type_key
      t.string :style_key
      t.string :framework_key
      t.string :title, null: false
      t.column :status, :copy_status, null: false, default: "rascunho"
      t.integer :score  # 0-100, preditivo
      t.jsonb  :tags, null: false, default: []
      t.uuid   :created_by
      t.timestamps
    end
    add_index :copies, [:workspace_id, :status]
    add_index :copies, [:workspace_id, :category_key]
    add_index :copies, :product_id
    add_index :copies, :campaign_id
    add_foreign_key :copies, :workspaces, on_delete: :cascade
    add_foreign_key :copies, :products,   on_delete: :nullify
    add_foreign_key :copies, :campaigns,  on_delete: :nullify
    add_foreign_key :copies, :piece_types, column: :piece_type_key, primary_key: :key, on_delete: :nullify
    add_foreign_key :copies, :styles,      column: :style_key,      primary_key: :key, on_delete: :nullify
    add_foreign_key :copies, :frameworks,  column: :framework_key,  primary_key: :key, on_delete: :nullify
    add_foreign_key :copies, :app_users,   column: :created_by,     on_delete: :nullify

    create_table :copy_versions, id: :uuid, default: -> { "gen_random_uuid()" } do |t|
      t.uuid    :copy_id, null: false
      t.integer :n, null: false
      t.text    :content, null: false
      t.uuid    :author_id
      t.text    :note
      t.boolean :is_current, null: false, default: false
      t.string  :ai_model
      t.string  :prompt_version
      t.decimal :cost_usd, precision: 10, scale: 5
      t.timestamps
    end
    add_index :copy_versions, [:copy_id, :n], unique: true
    add_foreign_key :copy_versions, :copies, on_delete: :cascade
    add_foreign_key :copy_versions, :app_users, column: :author_id, on_delete: :nullify
    # Garante exatamente uma current por copy.
    execute <<~SQL
      CREATE UNIQUE INDEX one_current_version_per_copy
        ON copy_versions (copy_id) WHERE is_current;
    SQL

    create_table :copy_comments, id: :uuid, default: -> { "gen_random_uuid()" } do |t|
      t.uuid    :copy_id, null: false
      t.uuid    :version_id
      t.uuid    :author_id
      t.text    :text, null: false
      t.boolean :resolved, null: false, default: false
      t.timestamps
    end
    add_index :copy_comments, :copy_id
    add_foreign_key :copy_comments, :copies, on_delete: :cascade
    add_foreign_key :copy_comments, :copy_versions, column: :version_id, on_delete: :nullify
    add_foreign_key :copy_comments, :app_users, column: :author_id, on_delete: :nullify

    # ---------------------------------------------------------------
    # 10. reference_item — swipe file
    # ---------------------------------------------------------------
    create_table :reference_items, id: :uuid, default: -> { "gen_random_uuid()" } do |t|
      t.uuid   :workspace_id, null: false
      t.string :title, null: false
      t.string :source
      t.string :url
      t.string :ref_type
      t.string :category_key
      t.jsonb  :tags, null: false, default: []
      t.text   :notes
      t.text   :content
      t.timestamps
    end
    add_index :reference_items, :workspace_id
    add_foreign_key :reference_items, :workspaces, on_delete: :cascade

    # ---------------------------------------------------------------
    # 11. audit — auditoria de página por URL
    # ---------------------------------------------------------------
    create_table :page_audits, id: :uuid, default: -> { "gen_random_uuid()" } do |t|
      t.uuid    :workspace_id, null: false
      t.string  :url, null: false
      t.string  :brand_name
      t.integer :score
      t.text    :summary
      t.jsonb   :sections, null: false, default: []
      t.uuid    :created_by
      t.timestamps
    end
    add_index :page_audits, :workspace_id
    add_foreign_key :page_audits, :workspaces, on_delete: :cascade
    add_foreign_key :page_audits, :app_users, column: :created_by, on_delete: :nullify

    # ---------------------------------------------------------------
    # 12. generation — log de chamadas IA + cost
    # ---------------------------------------------------------------
    create_table :generations, id: :uuid, default: -> { "gen_random_uuid()" } do |t|
      t.uuid    :workspace_id, null: false
      t.uuid    :copy_id
      t.string  :purpose, null: false  # generate_copy|name_generator|seo_describe|...
      t.string  :model, null: false    # haiku|sonnet|opus
      t.string  :prompt_version
      t.jsonb   :prompt
      t.text    :output
      t.integer :prompt_tokens
      t.integer :output_tokens
      t.decimal :cost_usd, precision: 10, scale: 5
      t.uuid    :created_by
      t.timestamps
    end
    add_index :generations, [:workspace_id, :created_at]
    add_index :generations, [:workspace_id, :purpose]
    add_foreign_key :generations, :workspaces, on_delete: :cascade
    add_foreign_key :generations, :copies, on_delete: :nullify
    add_foreign_key :generations, :app_users, column: :created_by, on_delete: :nullify

    # ---------------------------------------------------------------
    # 13. integration — credenciais cifradas de conectores externos
    # ---------------------------------------------------------------
    execute <<~SQL
      CREATE TYPE integration_type AS ENUM (
        'woocommerce','shopify','nuvemshop','tray','csv_manual'
      );
    SQL

    create_table :integrations, id: :uuid, default: -> { "gen_random_uuid()" } do |t|
      t.uuid   :workspace_id, null: false
      t.column :integration_type, :integration_type, null: false
      # config CIFRADO via MessageEncryptor — chave em TENANT_CREDENTIALS_KEY.
      # Schema do payload depende do tipo; validado em Integrations::*Adapter.
      t.text   :config_encrypted
      t.string :status, null: false, default: "connected"  # connected|disconnected|error
      t.text   :last_error
      t.datetime :last_sync_at
      t.timestamps
    end
    add_index :integrations, [:workspace_id, :integration_type], unique: true
    add_foreign_key :integrations, :workspaces, on_delete: :cascade

    # ---------------------------------------------------------------
    # 14. intelligence_record — PDPs concorrentes (extração ESTRUTURAL)
    # ---------------------------------------------------------------
    create_table :intelligence_records, id: :uuid, default: -> { "gen_random_uuid()" } do |t|
      t.uuid    :workspace_id, null: false
      t.string  :marca
      t.string  :produto
      t.string  :categoria
      t.string  :preco
      t.string  :url, null: false
      t.jsonb   :estrutura_pdp, null: false, default: {}
      t.jsonb   :copy_analysis, null: false, default: {}
      t.jsonb   :ativos, null: false, default: []
      t.jsonb   :seo, null: false, default: {}
      t.jsonb   :geo, null: false, default: {}
      t.integer :score_competitivo
      t.string  :faixa  # competitivo|bom|fraco|critico
      t.text    :observacoes
      t.uuid    :created_by
      t.datetime :collected_at, null: false, default: -> { "now()" }
      t.timestamps
    end
    add_index :intelligence_records, :workspace_id
    add_index :intelligence_records, [:workspace_id, :categoria]
    add_foreign_key :intelligence_records, :workspaces, on_delete: :cascade
    add_foreign_key :intelligence_records, :app_users, column: :created_by, on_delete: :nullify

    # ---------------------------------------------------------------
    # 15. ai_job — tracking de jobs Sidekiq AI (cost cap + idempotência)
    # ---------------------------------------------------------------
    create_table :ai_jobs, id: :uuid, default: -> { "gen_random_uuid()" } do |t|
      t.uuid    :workspace_id, null: false
      t.string  :sidekiq_jid     # ID do job Sidekiq
      t.string  :task_kind, null: false
      t.string  :status, null: false, default: "queued"  # queued|running|done|error|cap_reached
      t.string  :model
      t.integer :prompt_tokens
      t.integer :output_tokens
      t.decimal :cost_usd_estimated, precision: 10, scale: 5
      t.decimal :cost_usd_actual, precision: 10, scale: 5
      t.jsonb   :payload, null: false, default: {}
      t.jsonb   :result
      t.text    :error
      t.datetime :started_at
      t.datetime :finished_at
      t.timestamps
    end
    add_index :ai_jobs, [:workspace_id, :status]
    add_index :ai_jobs, [:workspace_id, :created_at]
    add_index :ai_jobs, :sidekiq_jid
    add_foreign_key :ai_jobs, :workspaces, on_delete: :cascade

    # ---------------------------------------------------------------
    # 16. audit_log — log de ações sensíveis (Fase 8 expande)
    # ---------------------------------------------------------------
    create_table :audit_logs, id: :uuid, default: -> { "gen_random_uuid()" } do |t|
      t.uuid   :workspace_id, null: false
      t.uuid   :user_id
      t.string :action, null: false
      t.jsonb  :metadata, null: false, default: {}
      t.string :ip
      t.string :user_agent, limit: 512
      t.datetime :created_at, null: false, default: -> { "now()" }
    end
    add_index :audit_logs, [:workspace_id, :created_at]
    add_index :audit_logs, [:workspace_id, :action]
    add_foreign_key :audit_logs, :workspaces, on_delete: :cascade
    add_foreign_key :audit_logs, :app_users, column: :user_id, on_delete: :nullify

    # ---------------------------------------------------------------
    # 17. seo_playbook_template (global) + seo_playbook (workspace)
    # ---------------------------------------------------------------
    create_table :seo_playbook_templates, id: :uuid, default: -> { "gen_random_uuid()" } do |t|
      t.string :category_key, null: false  # ex: 'vestuario', 'eletronicos', 'infoproduto'
      t.string :name, null: false
      t.text   :description
      t.text   :keywords            # CSV-style ou texto livre
      t.text   :geo_questions
      t.text   :blocos              # blocos vencedores
      t.string :schema_suggested    # 'Product+FAQPage+HowTo'
      t.text   :faq_questions
      t.string :version, null: false, default: "1.0"
      t.timestamps
    end
    add_index :seo_playbook_templates, :category_key, unique: true

    create_table :seo_playbooks, id: :uuid, default: -> { "gen_random_uuid()" } do |t|
      t.uuid   :workspace_id, null: false
      t.uuid   :template_id  # nullable: pode ser AI-bootstrapped sem template
      t.string :category_key, null: false
      t.text   :keywords
      t.text   :geo_questions
      t.text   :blocos
      t.string :schema_suggested
      t.text   :faq_questions
      t.string :source, null: false, default: "template_clone"  # template_clone|ai_bootstrap|manual
      t.uuid   :created_by
      t.timestamps
    end
    add_index :seo_playbooks, [:workspace_id, :category_key], unique: true
    add_foreign_key :seo_playbooks, :workspaces, on_delete: :cascade
    add_foreign_key :seo_playbooks, :seo_playbook_templates, column: :template_id, on_delete: :nullify
    add_foreign_key :seo_playbooks, :app_users, column: :created_by, on_delete: :nullify

    # ---------------------------------------------------------------
    # 18. RAG — documento + chunks com embeddings (pgvector)
    # ---------------------------------------------------------------
    create_table :rag_documents, id: :uuid, default: -> { "gen_random_uuid()" } do |t|
      t.uuid   :workspace_id, null: false
      t.string :source_kind, null: false  # site|onboarding_qna|woo_product|csv_upload|manual_note|campaign_context|brand_dna
      t.string :source_ref    # URL, product_id, file_path, etc
      t.string :title
      t.text   :full_text, null: false
      t.jsonb  :metadata, null: false, default: {}
      t.string :status, null: false, default: "pending"  # pending|chunked|embedded|failed
      t.text   :error
      t.timestamps
    end
    add_index :rag_documents, :workspace_id
    add_index :rag_documents, [:workspace_id, :source_kind]
    add_foreign_key :rag_documents, :workspaces, on_delete: :cascade

    # Embeddings: vector(1536) compat com OpenAI text-embedding-3-small.
    # Voyage AI (1024) requer ALTER TABLE quando trocar provider — fica como
    # decisão consciente, não silenciosa.
    create_table :rag_chunks, id: :uuid, default: -> { "gen_random_uuid()" } do |t|
      t.uuid    :workspace_id, null: false  # denormalizado para policies RLS
      t.uuid    :rag_document_id, null: false
      t.integer :idx, null: false       # ordem dentro do documento
      t.text    :content, null: false
      t.integer :token_count
      t.jsonb   :metadata, null: false, default: {}
      t.timestamps
    end
    add_index :rag_chunks, :workspace_id
    add_index :rag_chunks, [:rag_document_id, :idx], unique: true
    add_foreign_key :rag_chunks, :workspaces, on_delete: :cascade
    add_foreign_key :rag_chunks, :rag_documents, on_delete: :cascade
    # Embedding como coluna pgvector via SQL bruto.
    execute "ALTER TABLE rag_chunks ADD COLUMN embedding vector(1536);"
    # IVFFlat index — lists ~ sqrt(N). 100 = bom default p/ até 10k chunks.
    # HNSW seria melhor para escala — Fase 8 troca quando workspace passar 100k.
    execute <<~SQL
      CREATE INDEX idx_rag_chunks_embedding_cosine
        ON rag_chunks USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100);
    SQL

    # ---------------------------------------------------------------
    # 19. billing_event — idempotência de webhooks do gateway próprio
    # ---------------------------------------------------------------
    create_table :billing_events, id: :uuid, default: -> { "gen_random_uuid()" } do |t|
      t.string :gateway, null: false, default: "internal"  # internal|stripe (futuro)
      t.string :event_id, null: false  # UNIQUE — idempotência
      t.string :event_type, null: false
      t.uuid   :workspace_id  # opcional — evento de "novo cliente" pode não ter ws ainda
      t.jsonb  :payload, null: false, default: {}
      t.boolean :processed, null: false, default: false
      t.text   :error
      t.datetime :received_at, null: false, default: -> { "now()" }
      t.datetime :processed_at
    end
    add_index :billing_events, [:gateway, :event_id], unique: true
    add_index :billing_events, :workspace_id, where: "workspace_id IS NOT NULL"
    add_foreign_key :billing_events, :workspaces, on_delete: :nullify

    # ===============================================================
    # ROW LEVEL SECURITY — toda tabela tenant-scoped com FORCE.
    # FORCE aplica policy ao owner (incl. migrations). Bypass só via
    # BYPASSRLS role ou superuser. Em CI/prod, app role é NOSUPERUSER.
    # ===============================================================
    workspace_scoped = %w[
      workspaces workspace_members workspace_api_keys
      brand_dnas categories products campaigns
      copies copy_versions copy_comments reference_items
      page_audits generations integrations intelligence_records
      ai_jobs audit_logs seo_playbooks
      rag_documents rag_chunks
    ]

    workspace_scoped.each do |tbl|
      execute "ALTER TABLE #{tbl} ENABLE ROW LEVEL SECURITY;"
      execute "ALTER TABLE #{tbl} FORCE ROW LEVEL SECURITY;"
    end

    # Policy padrão: is_member(workspace_id). Tabelas que herdam
    # workspace via FK (copy_versions, copy_comments) usam o copy do parent.
    direct_ws_tables = %w[
      brand_dnas categories products campaigns copies reference_items
      page_audits generations integrations intelligence_records
      ai_jobs audit_logs seo_playbooks rag_documents rag_chunks
      workspace_api_keys
    ]

    direct_ws_tables.each do |tbl|
      execute <<~SQL
        CREATE POLICY #{tbl}_member_all ON #{tbl}
          FOR ALL
          USING (is_member(workspace_id))
          WITH CHECK (is_member(workspace_id));
      SQL
    end

    # Workspaces: o próprio id é o tenant.
    execute <<~SQL
      CREATE POLICY workspaces_member_select ON workspaces
        FOR SELECT USING (is_member(id));
      CREATE POLICY workspaces_member_modify ON workspaces
        FOR ALL USING (is_member(id)) WITH CHECK (is_member(id));
    SQL

    # workspace_members: ver membros do ws do qual sou membro.
    execute <<~SQL
      CREATE POLICY workspace_members_visible ON workspace_members
        FOR ALL
        USING (is_member(workspace_id))
        WITH CHECK (is_member(workspace_id));
    SQL

    # copy_versions herda do parent copy.workspace_id.
    execute <<~SQL
      CREATE POLICY copy_versions_via_copy ON copy_versions
        FOR ALL
        USING (EXISTS (SELECT 1 FROM copies c WHERE c.id = copy_versions.copy_id AND is_member(c.workspace_id)))
        WITH CHECK (EXISTS (SELECT 1 FROM copies c WHERE c.id = copy_versions.copy_id AND is_member(c.workspace_id)));

      CREATE POLICY copy_comments_via_copy ON copy_comments
        FOR ALL
        USING (EXISTS (SELECT 1 FROM copies c WHERE c.id = copy_comments.copy_id AND is_member(c.workspace_id)))
        WITH CHECK (EXISTS (SELECT 1 FROM copies c WHERE c.id = copy_comments.copy_id AND is_member(c.workspace_id)));
    SQL

    # ---------------------------------------------------------------
    # SECURITY DEFINER function — cria workspace + owner + DNA atômico.
    # Necessária porque RLS bloqueia o INSERT em workspace_members até
    # que o membership exista (chicken-and-egg).
    # ---------------------------------------------------------------
    execute <<~SQL
      CREATE OR REPLACE FUNCTION create_workspace(
        p_name text, p_slug text, p_site_url text, p_locale text, p_plan text
      )
      RETURNS workspaces
      LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
      DECLARE
        uid uuid := app_current_user_id();
        w workspaces;
      BEGIN
        IF uid IS NULL THEN
          RAISE EXCEPTION 'app.user_id não definido — operação não autenticada';
        END IF;

        INSERT INTO workspaces(name, slug, site_url, default_locale, plan, owner_id)
        VALUES (
          p_name,
          COALESCE(p_slug, lower(regexp_replace(p_name, '[^a-zA-Z0-9]+', '-', 'g'))),
          p_site_url,
          COALESCE(p_locale, 'pt-BR'),
          COALESCE(p_plan, 'entry'),
          uid
        )
        RETURNING * INTO w;

        INSERT INTO workspace_members(workspace_id, user_id, role, accepted_at)
        VALUES (w.id, uid, 'owner', now());

        INSERT INTO brand_dnas(workspace_id, kind, marca) VALUES
          (w.id, 'atual',    p_name),
          (w.id, 'proposto', p_name);

        RETURN w;
      END $$;
    SQL
  end

  def down
    # Reverse — drop tudo em ordem dependente. Função antes pra evitar trigger.
    execute "DROP FUNCTION IF EXISTS create_workspace(text,text,text,text,text);"
    execute "DROP FUNCTION IF EXISTS is_member(uuid);"
    execute "DROP FUNCTION IF EXISTS app_current_workspace_id();"
    execute "DROP FUNCTION IF EXISTS app_current_user_id();"

    drop_table :billing_events
    drop_table :rag_chunks
    drop_table :rag_documents
    drop_table :seo_playbooks
    drop_table :seo_playbook_templates
    drop_table :audit_logs
    drop_table :ai_jobs
    drop_table :intelligence_records
    drop_table :integrations
    drop_table :generations
    drop_table :page_audits
    drop_table :reference_items
    drop_table :copy_comments
    drop_table :copy_versions
    drop_table :copies
    drop_table :campaigns
    drop_table :products
    drop_table :categories
    drop_table :piece_types
    drop_table :frameworks
    drop_table :styles
    drop_table :brand_dnas
    drop_table :workspace_api_keys
    drop_table :workspace_members
    drop_table :workspaces
    drop_table :app_users

    execute "DROP TYPE IF EXISTS copy_status;"
    execute "DROP TYPE IF EXISTS dna_kind;"
    execute "DROP TYPE IF EXISTS integration_type;"
    execute "DROP TYPE IF EXISTS member_role;"

    disable_extension "vector"
    disable_extension "pg_trgm"
    disable_extension "pgcrypto"
  end
end
