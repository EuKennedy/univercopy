# Conector WooCommerce — REST API v3 com BasicAuth (consumer key/secret).
# Toda URL passa por Security::SsrfGuard antes do fetch. Normaliza produtos
# Woo → atributos do model Product. Paginação automática até esgotar.
#
# config: { "base_url" => "https://loja.com", "consumer_key" => "ck_...",
#           "consumer_secret" => "cs_..." }

require "faraday"
require "faraday/retry"

module Connectors
  class WooCommerce
    class ConnectionError < StandardError; end

    USER_AGENT      = "UniverCopyBot/1.0 (+https://univercopy.com)"
    CONNECT_TIMEOUT = 5
    READ_TIMEOUT    = 20
    PER_PAGE        = 100
    MAX_PAGES       = 50 # teto duro: 5000 produtos por sync

    def initialize(config)
      @base_url        = config["base_url"].to_s.strip.chomp("/")
      @consumer_key    = config["consumer_key"].to_s.strip
      @consumer_secret = config["consumer_secret"].to_s.strip
      raise ConnectionError, "base_url, consumer_key e consumer_secret obrigatórios" if
        @base_url.blank? || @consumer_key.blank? || @consumer_secret.blank?
    end

    # Testa credenciais. Retorna { ok:, total: } ou levanta ConnectionError.
    def test_connection
      resp = request(path: "products", params: { per_page: 1 })
      total = resp.headers["x-wp-total"].to_i
      { ok: true, total: total }
    end

    # Itera todas as páginas, yield de cada produto normalizado.
    def each_product
      return enum_for(:each_product) unless block_given?

      page = 1
      loop do
        resp = request(path: "products", params: { per_page: PER_PAGE, page: page, status: "publish" })
        items = JSON.parse(resp.body.to_s)
        break if items.blank?

        items.each { |raw| yield normalize(raw) }

        total_pages = resp.headers["x-wp-totalpages"].to_i
        break if page >= total_pages || page >= MAX_PAGES

        page += 1
      end
    end

    private

    def request(path:, params: {})
      uri = Security::SsrfGuard.safe!("#{@base_url}/wp-json/wc/v3/#{path}")
      resp = http.get(uri.to_s, params)
      unless resp.success?
        raise ConnectionError, "WooCommerce HTTP #{resp.status}: #{resp.body.to_s.slice(0, 200)}"
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
        f.headers["User-Agent"] = USER_AGENT
        f.headers["Accept"]     = "application/json"
        f.options.timeout       = READ_TIMEOUT
        f.options.open_timeout  = CONNECT_TIMEOUT
        f.request :retry, max: 1, interval: 0.5, retry_statuses: [502, 503, 504], methods: %i[get]
        f.adapter Faraday.default_adapter
      end
    end

    def normalize(raw)
      {
        source:            "woocommerce",
        external_id:       raw["id"].to_s,
        sku:               raw["sku"].presence,
        name:              raw["name"].to_s,
        description:       strip_html(raw["description"]),
        short_description: strip_html(raw["short_description"]),
        price:             parse_price(raw["price"]),
        permalink:         raw["permalink"],
        categories:        Array(raw["categories"]).filter_map { |c| c["name"] },
        images:            Array(raw["images"]).filter_map { |i| i["src"] }.first(8),
        rating_avg:        parse_price(raw["average_rating"]),
        reviews_count:     raw["rating_count"].to_i,
        metadata:          { type: raw["type"], stock_status: raw["stock_status"] },
      }
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
