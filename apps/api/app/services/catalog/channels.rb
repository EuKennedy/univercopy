# Taxonomia de canais de distribuição (produto-facing). Metadados de display
# (nome, ícone Lucide, cor, descrição) + se o canal é tipicamente sequencial.
# As peças (piece_types) de cada canal vêm do banco via coluna `channel`.
module Catalog
  module Channels
    LIST = [
      { key: "email",      name: "Email",          icon: "mail",           color: "#10b981", sequence: true,  description: "Sequências de e-mail, broadcasts e automações." },
      { key: "whatsapp",   name: "WhatsApp",       icon: "message-circle", color: "#22c55e", sequence: true,  description: "Cadências e disparos no WhatsApp." },
      { key: "sms",        name: "SMS",            icon: "smartphone",     color: "#06b6d4", sequence: true,  description: "Mensagens curtas e lembretes via SMS." },
      { key: "meta_ads",   name: "Meta Ads",       icon: "megaphone",      color: "#3b82f6", sequence: false, description: "Anúncios para Facebook e Instagram." },
      { key: "google_ads", name: "Google Ads",     icon: "search",         color: "#f59e0b", sequence: false, description: "Search, Performance Max e descrições." },
      { key: "social",     name: "Redes Sociais",  icon: "hash",           color: "#8b5cf6", sequence: false, description: "Conteúdo orgânico: feed, reels, carrossel." },
      { key: "landing",    name: "Página de Vendas", icon: "file-text",    color: "#ec4899", sequence: false, description: "Blocos de página de vendas e VSL." },
      { key: "ecommerce",  name: "E-commerce",     icon: "shopping-cart",  color: "#6366f1", sequence: false, description: "Descrições de produto, loja e ficha." },
      { key: "brand",      name: "Marca",          icon: "landmark",       color: "#14b8a6", sequence: false, description: "Institucional, manifesto e história." },
      { key: "seo",        name: "SEO / Blog",     icon: "search",         color: "#0ea5e9", sequence: false, description: "Artigos, títulos e meta para ranquear." },
    ].freeze

    KEYS = LIST.map { |c| c[:key] }.freeze

    def self.valid?(key)
      KEYS.include?(key.to_s)
    end

    # Canais + suas peças (piece_types do canal), na ordem da LIST.
    def self.with_piece_types
      by_channel = PieceType.where.not(channel: nil).order(:name).group_by(&:channel)
      LIST.map do |ch|
        pieces = (by_channel[ch[:key]] || []).map do |p|
          p.slice(:key, :category_key, :name, :description, :structure,
                  :default_framework, :default_style, :length_hint, :channel)
        end
        ch.merge(piece_types: pieces)
      end
    end
  end
end
