# Scraper de página pública — extrai texto bruto. Sempre passa por
# Security::SsrfGuard ANTES de fazer fetch (SSRF defesa em profundidade).
#
# Limites: 1.5MB de body, 12s total (connect + read), user-agent identificado.
# Retorna texto stripped de tags + script/style + whitespace colapsado.

require "faraday"
require "faraday/retry"

module Ai
  # ScrapeFailed vive em scrape_failed.rb (Zeitwerk strict).
  class Scraper
    USER_AGENT       = "UniverCopyBot/1.0 (+https://univercopy.com)"
    MAX_BODY_BYTES   = 1_572_864
    CONNECT_TIMEOUT  = 4
    READ_TIMEOUT     = 8
    TEXT_LIMIT_CHARS = 10_000

    class << self
      def fetch_text(url, char_limit: TEXT_LIMIT_CHARS)
        new.fetch_text(url, char_limit: char_limit)
      end
    end

    def fetch_text(url, char_limit: TEXT_LIMIT_CHARS)
      uri = Security::SsrfGuard.safe!(url)
      response = http.get(uri.to_s)
      raise ScrapeFailed, "HTTP #{response.status}" unless response.success?

      body = response.body.to_s
      raise ScrapeFailed, "resposta vazia" if body.empty?

      html_to_text(body).slice(0, char_limit)
    rescue Faraday::TimeoutError
      raise ScrapeFailed, "timeout buscando #{url}"
    rescue Faraday::ConnectionFailed => e
      raise ScrapeFailed, "conexão falhou: #{e.message}"
    rescue Security::SsrfBlocked
      raise
    rescue StandardError => e
      raise ScrapeFailed, "#{e.class}: #{e.message}"
    end

    private

    def http
      @http ||= Faraday.new(headers: { "User-Agent" => USER_AGENT, "Accept" => "text/html,*/*" }) do |f|
        f.options.timeout      = READ_TIMEOUT
        f.options.open_timeout = CONNECT_TIMEOUT
        f.request :retry, max: 1, interval: 0.3, backoff_factor: 2,
                          retry_statuses: [502, 503, 504],
                          methods: %i[get]
        f.response :raise_error
        f.adapter Faraday.default_adapter
      end
    end

    def html_to_text(html)
      html
        .force_encoding("UTF-8")
        .scrub("")
        .gsub(/<script[\s\S]*?<\/script>/i, " ")
        .gsub(/<style[\s\S]*?<\/style>/i, " ")
        .gsub(/<!--[\s\S]*?-->/, " ")
        .gsub(/<[^>]+>/, " ")
        .gsub(/&nbsp;|&#160;/, " ")
        .gsub(/&amp;/, "&")
        .gsub(/&lt;/, "<")
        .gsub(/&gt;/, ">")
        .gsub(/&quot;/, '"')
        .gsub(/&#39;|&apos;/, "'")
        .gsub(/\s+/, " ")
        .strip
    end
  end
end
