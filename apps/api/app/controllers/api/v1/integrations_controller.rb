module Api
  module V1
    class IntegrationsController < WorkspaceScopedController
      # Conectores disponíveis + feature flag por plano.
      AVAILABLE = [
        { type: "woocommerce", feature: :connector_woo,       label: "WooCommerce" },
        { type: "wordpress",   feature: :connector_wordpress, label: "WordPress" },
        { type: "openai",      feature: :connector_openai,    label: "OpenAI" },
        { type: "csv_manual",  feature: :connector_csv,       label: "CSV import" },
        { type: "shopify",     feature: :connector_shopify,   label: "Shopify" },
        { type: "nuvemshop",   feature: :connector_nuvemshop, label: "Nuvemshop" },
        { type: "tray",        feature: :connector_tray,      label: "Tray" },
      ].freeze

      # Conectores que alimentam o catálogo de produtos.
      SYNCABLE = %w[woocommerce shopify nuvemshop tray csv_manual].freeze

      # O WordPress também sincroniza, mas traz POSTS, não produtos — job
      # diferente, tabela diferente. Fica numa lista própria pra não cair no
      # SyncProductsJob, que não sabe o que fazer com ele.
      BLOG_SYNCABLE = %w[wordpress].freeze

      # GET /integrations — estado de cada conector (sem vazar credenciais).
      def index
        connected = current_workspace.integrations.index_by(&:integration_type)
        list = AVAILABLE.map do |c|
          i = connected[c[:type]]
          {
            type:         c[:type],
            label:        c[:label],
            allowed:      PlanFeatures.allow?(current_workspace, c[:feature]),
            status:       i&.status || "disconnected",
            last_sync_at: i&.last_sync_at,
            last_error:   i&.last_error,
            # Só ajustes seguros de expor. Credencial nenhuma sai daqui.
            settings:     safe_settings(c[:type], i),
          }
        end

        render json: {
          connectors:      list,
          products_count:  current_workspace.products.count,
          openai_models:   Connectors::OpenAi::TEXT_MODELS.map { |id, m| { id: id, label: m[:label], input: m[:input], output: m[:output] } },
          text_provider:   Ai::TextRouter.provider_for(current_workspace),
        }
      end

      # POST /integrations/woocommerce/test — valida credenciais sem salvar.
      def test_woocommerce
        PlanFeatures.require!(current_workspace, :connector_woo)
        result = Connectors::WooCommerce.new(woo_params).test_connection
        render json: result
      rescue Connectors::WooCommerce::ConnectionError => e
        render json: { ok: false, error: "connection_failed", message: e.message }, status: :unprocessable_entity
      end

      # POST /integrations/woocommerce — testa, cifra e salva; dispara sync.
      def connect_woocommerce
        PlanFeatures.require!(current_workspace, :connector_woo)

        config = woo_params
        Connectors::WooCommerce.new(config).test_connection # valida antes de salvar

        integration = current_workspace.integrations.find_or_initialize_by(integration_type: "woocommerce")
        integration.config = config
        integration.status = "connected"
        integration.last_error = nil
        integration.save!

        Connectors::SyncProductsJob.perform_later(
          workspace_id:   current_workspace.id,
          user_id:        current_app_user.id,
          integration_id: integration.id,
        )

        render json: { ok: true, type: "woocommerce", status: "connected", sync: "queued" }, status: :created
      rescue Connectors::WooCommerce::ConnectionError => e
        render json: { ok: false, error: "connection_failed", message: e.message }, status: :unprocessable_entity
      end

      # POST /integrations/wordpress/test — valida credenciais sem salvar.
      def test_wordpress
        PlanFeatures.require!(current_workspace, :connector_wordpress)
        render json: Connectors::Wordpress.new(wp_params).test_connection
      rescue Connectors::Wordpress::ConnectionError => e
        render json: { ok: false, error: "connection_failed", message: e.message }, status: :unprocessable_entity
      end

      # POST /integrations/wordpress — testa, cifra, salva e importa o blog.
      #
      # O sync do acervo de posts entra aqui: conectar o WordPress significa
      # "esse blog é meu", e o painel precisa mostrar o que já existe lá antes
      # de o usuário escrever a primeira linha. Vai em background porque um
      # blog com centenas de posts leva minutos.
      def connect_wordpress
        PlanFeatures.require!(current_workspace, :connector_wordpress)

        config = wp_params
        Connectors::Wordpress.new(config).test_connection # valida antes de salvar

        integration = current_workspace.integrations.find_or_initialize_by(integration_type: "wordpress")
        integration.config     = config
        integration.status     = "connected"
        integration.last_error = nil
        integration.save!

        Connectors::SyncBlogPostsJob.perform_later(
          workspace_id:   current_workspace.id,
          user_id:        current_app_user.id,
          integration_id: integration.id,
        )

        render json: { ok: true, type: "wordpress", status: "connected", sync: "queued" }, status: :created
      rescue Connectors::Wordpress::ConnectionError => e
        render json: { ok: false, error: "connection_failed", message: e.message }, status: :unprocessable_entity
      end

      # POST /integrations/openai/test — valida a chave sem gastar geração.
      def test_openai
        PlanFeatures.require!(current_workspace, :connector_openai)
        render json: Connectors::OpenAi.new(openai_params).test_connection
      rescue Connectors::OpenAi::ConnectionError => e
        render json: { ok: false, error: "connection_failed", message: e.message }, status: :unprocessable_entity
      end

      # POST /integrations/openai — testa, cifra e salva a chave.
      # Usada só para gerar capa de post; o texto continua no Anthropic.
      def connect_openai
        PlanFeatures.require!(current_workspace, :connector_openai)

        config = openai_params
        Connectors::OpenAi.new(config).test_connection # valida antes de salvar

        integration = current_workspace.integrations.find_or_initialize_by(integration_type: "openai")
        integration.config     = config
        integration.status     = "connected"
        integration.last_error = nil
        integration.save!

        render json: { ok: true, type: "openai", status: "connected" }, status: :created
      rescue Connectors::OpenAi::ConnectionError => e
        render json: { ok: false, error: "connection_failed", message: e.message }, status: :unprocessable_entity
      end

      # PATCH /integrations/openai — troca só o modelo de texto.
      #
      # Existe separado do connect porque a chave nunca volta pro cliente:
      # exigir reenvio dela só pra mudar de modelo seria pedir que o usuário
      # fosse buscar a chave de novo a cada ajuste.
      def update_openai_settings
        PlanFeatures.require!(current_workspace, :connector_openai)

        integration = current_workspace.integrations.find_by!(integration_type: "openai")
        model       = params.require(:openai).permit(:text_model).to_h["text_model"].to_s.strip
        model       = "" unless Connectors::OpenAi::TEXT_MODELS.key?(model)

        integration.config = integration.config.merge("text_model" => model)
        integration.save!

        render json: { ok: true, text_model: model, text_provider: Ai::TextRouter.provider_for(current_workspace) }
      end

      # POST /integrations/:type/sync — re-sincroniza. Catálogo de produtos ou
      # acervo de posts, conforme o conector.
      def sync
        type = params.require(:type)
        job  = sync_job_for(type)

        if job.nil?
          return render json: { ok: false, error: "not_syncable", message: "#{type} não sincroniza." },
                        status: :unprocessable_entity
        end

        integration = current_workspace.integrations.find_by!(integration_type: type)
        job.perform_later(
          workspace_id:   current_workspace.id,
          user_id:        current_app_user.id,
          integration_id: integration.id,
        )
        render json: { ok: true, sync: "queued" }
      end

      # DELETE /integrations/:type — desconecta (limpa credenciais, mantém produtos).
      def disconnect
        integration = current_workspace.integrations.find_by!(integration_type: params.require(:type))
        integration.update!(config_encrypted: nil, status: "disconnected")
        render json: { ok: true, status: "disconnected" }
      end

      private

      def sync_job_for(type)
        return Connectors::SyncProductsJob  if SYNCABLE.include?(type)
        return Connectors::SyncBlogPostsJob if BLOG_SYNCABLE.include?(type)

        nil
      end

      # Lista branca do que pode voltar pro cliente. `config` guarda credencial
      # cifrada — nada dele sai por padrão, só o que for explicitamente seguro.
      def safe_settings(type, integration)
        return {} if integration.blank?

        case type
        when "openai"    then { text_model: integration.config["text_model"].to_s }
        when "wordpress" then { base_url: integration.config["base_url"].to_s }
        else {}
        end
      end

      def woo_params
        p = params.require(:woocommerce).permit(:base_url, :consumer_key, :consumer_secret).to_h
        {
          "base_url"        => p["base_url"],
          "consumer_key"    => p["consumer_key"],
          "consumer_secret" => p["consumer_secret"],
        }
      end

      def wp_params
        p = params.require(:wordpress).permit(:base_url, :username, :application_password).to_h
        {
          "base_url"             => p["base_url"],
          "username"             => p["username"],
          "application_password" => p["application_password"],
        }
      end

      # text_model vazio = OpenAI só para imagem; o texto continua no Anthropic.
      # Modelo desconhecido é descartado em vez de salvo — a lista da OpenAI
      # muda e não queremos gravar lixo que o roteador teria que contornar.
      def openai_params
        p     = params.require(:openai).permit(:api_key, :text_model).to_h
        model = p["text_model"].to_s.strip

        {
          "api_key"    => p["api_key"],
          "text_model" => Connectors::OpenAi::TEXT_MODELS.key?(model) ? model : "",
        }
      end
    end
  end
end
