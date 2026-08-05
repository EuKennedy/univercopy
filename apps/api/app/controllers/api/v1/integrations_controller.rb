module Api
  module V1
    class IntegrationsController < WorkspaceScopedController
      # Conectores disponíveis + feature flag por plano.
      AVAILABLE = [
        { type: "woocommerce", feature: :connector_woo,       label: "WooCommerce" },
        { type: "wordpress",   feature: :connector_wordpress, label: "WordPress" },
        { type: "csv_manual",  feature: :connector_csv,       label: "CSV import" },
        { type: "shopify",     feature: :connector_shopify,   label: "Shopify" },
        { type: "nuvemshop",   feature: :connector_nuvemshop, label: "Nuvemshop" },
        { type: "tray",        feature: :connector_tray,      label: "Tray" },
      ].freeze

      # Conectores que alimentam catálogo de produtos. O WordPress fica de fora:
      # é destino de publicação de conteúdo, não origem de produtos.
      SYNCABLE = %w[woocommerce shopify nuvemshop tray csv_manual].freeze

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
          }
        end
        render json: { connectors: list, products_count: current_workspace.products.count }
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

      # POST /integrations/wordpress — testa, cifra e salva.
      # Sem job de sync: WordPress aqui é destino de publicação, não catálogo.
      def connect_wordpress
        PlanFeatures.require!(current_workspace, :connector_wordpress)

        config = wp_params
        Connectors::Wordpress.new(config).test_connection # valida antes de salvar

        integration = current_workspace.integrations.find_or_initialize_by(integration_type: "wordpress")
        integration.config     = config
        integration.status     = "connected"
        integration.last_error = nil
        integration.save!

        render json: { ok: true, type: "wordpress", status: "connected" }, status: :created
      rescue Connectors::Wordpress::ConnectionError => e
        render json: { ok: false, error: "connection_failed", message: e.message }, status: :unprocessable_entity
      end

      # POST /integrations/:type/sync — re-sincroniza catálogo.
      def sync
        type = params.require(:type)
        unless SYNCABLE.include?(type)
          return render json: { ok: false, error: "not_syncable", message: "#{type} não sincroniza catálogo." },
                        status: :unprocessable_entity
        end

        integration = current_workspace.integrations.find_by!(integration_type: type)
        Connectors::SyncProductsJob.perform_later(
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
    end
  end
end
