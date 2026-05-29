# Sincroniza catálogo de uma integração → tabela products. Idempotente:
# upsert por (workspace_id, source, external_id). Roda no RLS scope do
# workspace. Atualiza integration.status + last_sync_at.

module Connectors
  class SyncProductsJob < ApplicationJob
    queue_as :default

    def perform(workspace_id:, integration_id:)
      with_workspace_rls(workspace_id) do
        integration = Integration.find(integration_id)
        adapter     = adapter_for(integration)
        upserted    = 0

        adapter.each_product do |attrs|
          product = Product.find_or_initialize_by(
            workspace_id: workspace_id,
            source:       attrs[:source],
            external_id:  attrs[:external_id],
          )
          product.assign_attributes(attrs.except(:source, :external_id))
          product.synced_at = Time.current
          product.save!
          upserted += 1
        end

        integration.update!(status: "connected", last_error: nil, last_sync_at: Time.current)
        Rails.logger.info({ connector_sync: "ok", workspace_id:, integration_id:, upserted: }.to_json)
      end
    rescue StandardError => e
      with_workspace_rls(workspace_id) do
        Integration.where(id: integration_id).update_all(status: "error", last_error: e.message.slice(0, 500))
      end
      Rails.logger.error({ connector_sync: "fail", workspace_id:, integration_id:, error: e.message }.to_json)
      raise
    end

    private

    def adapter_for(integration)
      case integration.integration_type
      when "woocommerce" then Connectors::WooCommerce.new(integration.config)
      else
        raise ArgumentError, "conector não suportado: #{integration.integration_type}"
      end
    end
  end
end
