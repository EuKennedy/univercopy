module Api
  module V1
    class ProductsController < WorkspaceScopedController
      # GET /products?q=&source=
      def index
        scope = current_workspace.products.order(updated_at: :desc)
        scope = scope.where(source: params[:source]) if params[:source].present?
        if params[:q].present?
          like = "%#{params[:q].to_s.strip}%"
          scope = scope.where("name ILIKE ? OR sku ILIKE ?", like, like)
        end

        products = scope.limit(200).map { |p| list_payload(p) }
        render json: { products: products, total: current_workspace.products.count }
      end

      # GET /products/:id — puxa estado ATUAL da loja (inclui meta about/faq).
      def show
        p = current_workspace.products.find(params[:id])
        refresh_from_store!(p)
        render json: detail_payload(p)
      end

      # POST /products/:id/publish — write-back pro WooCommerce.
      def publish
        integ = woo_integration
        return render(json: { error: "no_connector", message: "Conecte uma loja WooCommerce primeiro." }, status: :unprocessable_entity) unless integ

        p = current_workspace.products.find(params[:id])
        updated = Connectors::WooCommerce.new(integ.config).update_product(p.external_id, publish_params)
        p.assign_attributes(updated.except(:source, :external_id))
        p.synced_at = Time.current
        p.save!
        render json: detail_payload(p)
      rescue Connectors::WooCommerce::ConnectionError => e
        render json: { error: "connection_failed", message: e.message }, status: :unprocessable_entity
      end

      # POST /products/:id/generate-field — "Gerar com IA" de um campo.
      # body: { field, instruction?, model? }
      def generate_field
        PlanFeatures.require!(current_workspace, :ai_generate)
        AiCostCap.require!(current_workspace)

        p = current_workspace.products.find(params[:id])
        res = Ai::ProductFieldWriter.call(
          workspace:   current_workspace,
          product:     p,
          field:       params.require(:field),
          instruction: params[:instruction],
          model:       (params[:model].presence || "auto"),
        )
        ai = res[:ai_result]
        current_workspace.ai_jobs.create!(
          task_kind: "product_field", status: "done", model: ai.model.to_s,
          prompt_tokens: ai.input_tokens, output_tokens: ai.output_tokens,
          cost_usd_actual: ai.cost_usd, payload: { field: res[:field] }, finished_at: Time.current,
        )

        render json: { field: res[:field], kind: res[:kind], value: res[:value], cost: AiCostCap.report(current_workspace) }
      end

      private

      def woo_integration
        current_workspace.integrations.find_by(integration_type: "woocommerce", status: "connected")
      end

      # Refresh best-effort do produto a partir da loja (não falha a request).
      def refresh_from_store!(product)
        integ = woo_integration
        return unless integ && product.source == "woocommerce" && product.external_id.present?

        attrs = Connectors::WooCommerce.new(integ.config).fetch_one(product.external_id)
        product.assign_attributes(attrs.except(:source, :external_id))
        product.synced_at = Time.current
        product.save!
      rescue Connectors::WooCommerce::ConnectionError => e
        Rails.logger.warn({ product_refresh: "fail", id: product.id, error: e.message }.to_json)
      end

      def publish_params
        params.permit(
          :name, :description_html, :short_description_html, :sku,
          :regular_price, :sale_price, :manage_stock, :stock_quantity, :backorders, :weight,
          dimensions: %i[length width height],
          category_ids: [],
          tags: [],
          attributes: [:name, { options: [] }],
          about: %i[title description],
          faq: %i[title content icon_type icon_value icon_attachment_id],
        ).to_h
      end

      def list_payload(p)
        {
          id:            p.id,
          name:          p.name,
          sku:           p.sku,
          price:         p.price&.to_f,
          source:        p.source,
          permalink:     p.permalink,
          image:         Array(p.images).first,
          categories:    p.categories,
          reviews_count: p.reviews_count,
          rating_avg:    p.rating_avg&.to_f,
          synced_at:     p.synced_at,
        }
      end

      def detail_payload(p)
        m = p.metadata || {}
        {
          id:                p.id,
          external_id:       p.external_id,
          name:              p.name,
          sku:               p.sku,
          permalink:         p.permalink,
          price:             p.price&.to_f,
          images:            p.images,
          images_full:       m["images_full"] || [],
          categories:        p.categories,
          categories_full:   m["categories_full"] || [],
          tags:              m["tags"] || [],
          # Conteúdo editável (HTML cru quando aplicável).
          description_html:        m["description_html"].to_s,
          short_description_html:  m["short_description_html"].to_s,
          attributes:        m["attributes"] || [],
          # Geral
          regular_price:     m["regular_price"],
          sale_price:        m["sale_price"],
          # Estoque
          manage_stock:      m["manage_stock"],
          stock_quantity:    m["stock_quantity"],
          stock_status:      m["stock_status"],
          backorders:        m["backorders"],
          # Entrega
          weight:            m["weight"],
          dimensions:        m["dimensions"] || { "length" => "", "width" => "", "height" => "" },
          # Plugin Univer About Product
          about:             m["about"] || { "title" => "", "description" => "" },
          faq:               m["faq"] || [],
          synced_at:         p.synced_at,
        }
      end
    end
  end
end
