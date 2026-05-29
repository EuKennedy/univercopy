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

      # GET /products/:id
      def show
        p = current_workspace.products.find(params[:id])
        render json: detail_payload(p)
      end

      private

      def list_payload(p)
        {
          id:            p.id,
          name:          p.name,
          sku:           p.sku,
          price:         p.price,
          source:        p.source,
          permalink:     p.permalink,
          image:         Array(p.images).first,
          categories:    p.categories,
          reviews_count: p.reviews_count,
          rating_avg:    p.rating_avg,
          synced_at:     p.synced_at,
        }
      end

      def detail_payload(p)
        {
          id:                p.id,
          name:              p.name,
          sku:               p.sku,
          description:       p.description,
          short_description: p.short_description,
          price:             p.price,
          source:            p.source,
          permalink:         p.permalink,
          images:            p.images,
          categories:        p.categories,
          rating_avg:        p.rating_avg,
          reviews_count:     p.reviews_count,
          profile:           p.profile,
          synced_at:         p.synced_at,
          created_at:        p.created_at,
        }
      end
    end
  end
end
