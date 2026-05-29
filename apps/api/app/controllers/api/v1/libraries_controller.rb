module Api
  module V1
    # Bibliotecas globais — styles, frameworks, piece_types, categories.
    # Sem RLS (tabelas globais). Não exigem workspace_scope.
    class LibrariesController < BaseController
      def styles
        list = Style.order(:grp, :name).map do |s|
          s.slice(:key, :name, :era, :grp, :description, :principles, :when_to_use)
        end
        render json: { styles: list }
      end

      def frameworks
        list = Framework.order(:name).map { |f| f.slice(:key, :name, :structure) }
        render json: { frameworks: list }
      end

      def piece_types
        list = PieceType.order(:category_key, :name).map do |p|
          p.slice(:key, :category_key, :name, :description, :structure,
                  :default_framework, :default_style, :length_hint)
        end
        render json: { piece_types: list }
      end

      def categories
        list = Category.global.order(:name).map { |c| c.slice(:key, :name, :icon, :color) }
        render json: { categories: list }
      end
    end
  end
end
