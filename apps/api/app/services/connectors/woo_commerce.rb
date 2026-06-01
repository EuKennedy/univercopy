# Conector WooCommerce — REST API v3 com BasicAuth (consumer key/secret).
# Toda URL passa por Security::SsrfGuard antes do request. Normaliza produtos
# Woo → atributos do model Product (campos ricos em `metadata` jsonb).
# Suporta write-back (publish) via PUT.
#
# config: { "base_url" => "https://loja.com", "consumer_key" => "ck_...",
#           "consumer_secret" => "cs_..." }
#
# Meta do plugin Univer About Product (lidas/escritas via meta_data):
#   _about_product_title, _about_product_description (HTML),
#   _about_product_accordions (array de {title,icon_type,icon_value,icon_attachment_id,content}).

require "faraday"
require "faraday/retry"

module Connectors
  class WooCommerce
    class ConnectionError < StandardError; end

    USER_AGENT      = "UniverCopyBot/1.0 (+https://univercopy.com)"
    CONNECT_TIMEOUT = 5
    READ_TIMEOUT    = 25
    PER_PAGE        = 100
    MAX_PAGES       = 50 # teto duro: 5000 produtos por sync

    META_ABOUT_TITLE = "_about_product_title"
    META_ABOUT_DESC  = "_about_product_description"
    META_ACCORDIONS  = "_about_product_accordions"

    def initialize(config)
      @base_url        = config["base_url"].to_s.strip.chomp("/")
      @consumer_key    = config["consumer_key"].to_s.strip
      @consumer_secret = config["consumer_secret"].to_s.strip
      raise ConnectionError, "base_url, consumer_key e consumer_secret obrigatórios" if
        @base_url.blank? || @consumer_key.blank? || @consumer_secret.blank?
    end

    def test_connection
      resp = request(:get, "products", params: { per_page: 1 })
      { ok: true, total: resp.headers["x-wp-total"].to_i }
    end

    # Itera todas as páginas, yield de cada produto normalizado.
    def each_product
      return enum_for(:each_product) unless block_given?

      page = 1
      loop do
        resp  = request(:get, "products", params: { per_page: PER_PAGE, page: page, status: "publish" })
        items = JSON.parse(resp.body.to_s)
        break if items.blank?

        items.each { |raw| yield normalize(raw) }

        total_pages = resp.headers["x-wp-totalpages"].to_i
        break if page >= total_pages || page >= MAX_PAGES

        page += 1
      end
    end

    # Busca 1 produto completo (inclui meta_data) e normaliza.
    def fetch_one(external_id)
      resp = request(:get, "products/#{external_id}")
      normalize(JSON.parse(resp.body.to_s))
    end

    # Write-back. `attrs` usa nossos nomes de campo; mapeia → payload Woo e PUT.
    # Só envia chaves presentes (patch parcial). Retorna o produto normalizado.
    def update_product(external_id, attrs)
      payload = build_update_payload(attrs)
      resp = request(:put, "products/#{external_id}", body: payload)
      normalize(JSON.parse(resp.body.to_s))
    end

    private

    def request(method, path, params: {}, body: nil)
      uri = Security::SsrfGuard.safe!("#{@base_url}/wp-json/wc/v3/#{path}")
      resp =
        case method
        when :get then http.get(uri.to_s, params)
        when :put then http.put(uri.to_s) { |r| r.body = body.to_json }
        else raise ArgumentError, "método não suportado: #{method}"
        end
      unless resp.success?
        raise ConnectionError, "WooCommerce HTTP #{resp.status}: #{resp.body.to_s.slice(0, 300)}"
      end

      resp
    rescue Faraday::TimeoutError
      raise ConnectionError, "timeout conectando na loja"
    rescue Faraday::ConnectionFailed => e
      raise ConnectionError, "conexão falhou: #{e.message}"
    end

    def http
      @http ||= Faraday.new do |f|
        f.request :authorization, :basic, @consumer_key, @consumer_secret
        f.headers["User-Agent"]   = USER_AGENT
        f.headers["Accept"]       = "application/json"
        f.headers["Content-Type"] = "application/json"
        f.options.timeout         = READ_TIMEOUT
        f.options.open_timeout    = CONNECT_TIMEOUT
        f.request :retry, max: 1, interval: 0.5, retry_statuses: [502, 503, 504], methods: %i[get]
        f.adapter Faraday.default_adapter
      end
    end

    # -----------------------------------------------------------------
    # Normalização Woo → nosso shape. Campos ricos vão em `metadata`.
    # -----------------------------------------------------------------
    def normalize(raw)
      meta = meta_hash(raw["meta_data"])

      {
        source:            "woocommerce",
        external_id:       raw["id"].to_s,
        sku:               raw["sku"].presence,
        name:              raw["name"].to_s,
        description:       strip_html(raw["description"]),        # texto p/ busca/preview
        short_description: strip_html(raw["short_description"]),
        price:             parse_price(raw["price"]),
        permalink:         raw["permalink"],
        categories:        Array(raw["categories"]).filter_map { |c| c["name"] },
        images:            Array(raw["images"]).filter_map { |i| i["src"] }.first(12),
        rating_avg:        parse_price(raw["average_rating"]),
        reviews_count:     raw["rating_count"].to_i,
        metadata: {
          "type"                  => raw["type"],
          "status"                => raw["status"],
          "description_html"      => raw["description"].to_s,
          "short_description_html"=> raw["short_description"].to_s,
          "regular_price"         => parse_price(raw["regular_price"]),
          "sale_price"            => parse_price(raw["sale_price"]),
          "stock_status"          => raw["stock_status"],
          "manage_stock"          => raw["manage_stock"],
          "stock_quantity"        => raw["stock_quantity"],
          "backorders"            => raw["backorders"],
          "weight"                => raw["weight"].presence,
          "dimensions"            => {
            "length" => raw.dig("dimensions", "length"),
            "width"  => raw.dig("dimensions", "width"),
            "height" => raw.dig("dimensions", "height"),
          },
          "categories_full"       => Array(raw["categories"]).map { |c| { "id" => c["id"], "name" => c["name"] } },
          "tags"                  => Array(raw["tags"]).filter_map { |t| t["name"] },
          "tags_full"             => Array(raw["tags"]).map { |t| { "id" => t["id"], "name" => t["name"] } },
          "attributes"            => Array(raw["attributes"]).map { |a|
            { "name" => a["name"], "options" => Array(a["options"]), "visible" => a["visible"] }
          },
          "images_full"           => Array(raw["images"]).map { |i| { "id" => i["id"], "src" => i["src"], "alt" => i["alt"] } }.first(12),
          "about" => {
            "title"       => meta[META_ABOUT_TITLE].to_s,
            "description" => meta[META_ABOUT_DESC].to_s,
          },
          "faq" => normalize_accordions(meta[META_ACCORDIONS]),
        },
      }
    end

    # meta_data (array de {key,value}) → hash {key => value}.
    def meta_hash(meta_data)
      Array(meta_data).each_with_object({}) do |m, h|
        next unless m.is_a?(Hash)

        h[m["key"]] = m["value"]
      end
    end

    def normalize_accordions(value)
      Array(value).filter_map do |a|
        next unless a.is_a?(Hash)

        {
          "title"   => a["title"].to_s,
          "content" => a["content"].to_s,
          "icon_type"          => a["icon_type"] || "preset",
          "icon_value"         => a["icon_value"] || "help-circle",
          "icon_attachment_id" => a["icon_attachment_id"] || 0,
        }
      end
    end

    # -----------------------------------------------------------------
    # Monta payload de update (patch parcial) a partir dos nossos campos.
    # -----------------------------------------------------------------
    def build_update_payload(attrs)
      a = attrs.with_indifferent_access
      out = {}

      out[:name]              = a[:name]                          if a.key?(:name)
      out[:description]       = a[:description_html]              if a.key?(:description_html)
      out[:short_description] = a[:short_description_html]        if a.key?(:short_description_html)
      out[:sku]               = a[:sku].to_s                      if a.key?(:sku)
      out[:regular_price]     = a[:regular_price].to_s            if a.key?(:regular_price)
      out[:sale_price]        = a[:sale_price].to_s               if a.key?(:sale_price)
      out[:manage_stock]      = !!a[:manage_stock]                if a.key?(:manage_stock)
      out[:stock_quantity]    = a[:stock_quantity].to_i           if a.key?(:stock_quantity) && a[:stock_quantity].present?
      out[:backorders]        = a[:backorders]                    if a.key?(:backorders)
      out[:weight]            = a[:weight].to_s                   if a.key?(:weight)

      if a[:dimensions].is_a?(Hash)
        out[:dimensions] = {
          length: a.dig(:dimensions, :length).to_s,
          width:  a.dig(:dimensions, :width).to_s,
          height: a.dig(:dimensions, :height).to_s,
        }
      end

      # Categorias/tags por id (evita criar duplicadas). Tags por nome criam se não existir.
      out[:categories] = Array(a[:category_ids]).map { |id| { id: id.to_i } } if a.key?(:category_ids)
      out[:tags]       = Array(a[:tags]).map { |name| { name: name.to_s } }   if a.key?(:tags)

      if a.key?(:attributes)
        out[:attributes] = Array(a[:attributes]).map do |attr|
          { name: attr[:name].to_s, options: Array(attr[:options]), visible: true }
        end
      end

      # Meta do plugin (about + faq) — write-back via meta_data.
      meta = []
      meta << { key: META_ABOUT_TITLE, value: a.dig(:about, :title).to_s }       if a[:about].is_a?(Hash)
      meta << { key: META_ABOUT_DESC,  value: a.dig(:about, :description).to_s }  if a[:about].is_a?(Hash)
      if a.key?(:faq)
        meta << {
          key:   META_ACCORDIONS,
          value: Array(a[:faq]).map { |f|
            {
              title:              f[:title].to_s,
              content:            f[:content].to_s,
              icon_type:          f[:icon_type] || "preset",
              icon_value:         f[:icon_value] || "help-circle",
              icon_attachment_id: f[:icon_attachment_id] || 0,
            }
          },
        }
      end
      out[:meta_data] = meta if meta.any?

      out
    end

    def parse_price(val)
      return nil if val.blank?

      Float(val)
    rescue ArgumentError, TypeError
      nil
    end

    def strip_html(html)
      html.to_s
          .gsub(/<[^>]+>/, " ")
          .gsub(/&nbsp;/, " ")
          .gsub(/\s+/, " ")
          .strip
    end
  end
end
