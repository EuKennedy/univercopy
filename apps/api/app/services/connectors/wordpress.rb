# Conector WordPress — REST API v2 com Application Password.
#
# Autenticação é HTTP Basic (`Authorization: Basic base64(usuario:senha_app)`),
# não Bearer: é assim que o core do WordPress valida Application Password em
# `wp_authenticate_application_password`. Bearer não é reconhecido sem plugin
# de JWT. Os espaços que o WP mostra na senha são opcionais — ele mesmo os
# remove antes de comparar.
#
# config: { "base_url" => "https://site.com", "username" => "usuario",
#           "application_password" => "xxxx xxxx xxxx xxxx xxxx xxxx" }
#
# Credenciais são por workspace, cifradas em repouso pelo model Integration
# (MessageEncryptor + TENANT_CREDENTIALS_KEY). Nada de ENV global.
#
# Toda URL passa por Security::SsrfGuard antes do request — o base_url vem do
# usuário e poderia apontar pra rede interna.

require "faraday"
require "faraday/retry"

module Connectors
  class Wordpress
    class ConnectionError < StandardError; end
    class PublishError    < StandardError; end

    USER_AGENT      = "UniverCopyBot/1.0 (+https://univercopy.com)"
    CONNECT_TIMEOUT = 5
    READ_TIMEOUT    = 30
    PER_PAGE        = 100
    MAX_PAGES       = 10 # teto: 1000 categorias

    ALLOWED_STATUSES = %w[draft publish].freeze
    MAX_TITLE_BYTES  = 500
    MAX_BODY_BYTES   = 300_000

    def initialize(config)
      @base_url = config["base_url"].to_s.strip.chomp("/")
      @username = config["username"].to_s.strip
      @app_pass = config["application_password"].to_s.strip

      raise ConnectionError, "base_url, username e application_password são obrigatórios" if
        @base_url.blank? || @username.blank? || @app_pass.blank?
    end

    # Valida a credencial E a permissão de publicar de uma vez.
    #
    # Usa `posts?context=edit` de propósito: exige capability de edição (que é
    # o que precisamos) e devolve 401/403 limpo. Não usamos `/users/me` porque
    # hardening de segurança costuma bloquear os endpoints de usuário — no blog
    # da Lizzon ele responde 302 pra home, o que seria indistinguível de sucesso.
    def test_connection
      resp = request(:get, "posts", params: { context: "edit", per_page: 1 })
      { ok: true, total: resp.headers["x-wp-total"].to_i, site: @base_url }
    end

    def categories
      out  = []
      page = 1

      loop do
        resp  = request(:get, "categories", params: { per_page: PER_PAGE, page: page })
        items = parse_json(resp.body)
        break if items.blank?

        out.concat(items.map do |c|
          { id: c["id"].to_i, name: sanitize_name(c["name"]), slug: c["slug"].to_s, count: c["count"].to_i }
        end)

        total_pages = resp.headers["x-wp-totalpages"].to_i
        break if page >= total_pages || page >= MAX_PAGES

        page += 1
      end

      out
    end

    # Cria o post. `status` é draft ou publish — quem decide é a tela.
    def publish(title:, content:, status: "draft", category_ids: [], excerpt: nil)
      title   = title.to_s.strip
      content = content.to_s
      status  = status.to_s.strip

      raise PublishError, "título obrigatório"                      if title.blank?
      raise PublishError, "conteúdo obrigatório"                    if content.strip.blank?
      raise PublishError, "status inválido: #{status.inspect}"      unless ALLOWED_STATUSES.include?(status)
      raise PublishError, "título excede #{MAX_TITLE_BYTES} bytes"  if title.bytesize > MAX_TITLE_BYTES
      raise PublishError, "conteúdo excede #{MAX_BODY_BYTES} bytes" if content.bytesize > MAX_BODY_BYTES

      payload = { title: title, content: content, status: status }
      payload[:excerpt]    = excerpt.to_s.strip if excerpt.to_s.strip.present?
      payload[:categories] = Array(category_ids).map(&:to_i).reject(&:zero?).presence

      created = parse_json(request(:post, "posts", body: payload.compact).body)

      {
        id:     created["id"].to_i,
        url:    created["link"].presence,
        status: created["status"].presence || status,
      }
    end

    private

    def request(method, path, params: {}, body: nil)
      uri = Security::SsrfGuard.safe!("#{@base_url}/wp-json/wp/v2/#{path}")

      resp =
        case method
        when :get  then http.get(uri.to_s, params)
        when :post then http.post(uri.to_s) { |r| r.body = body.to_json }
        else raise ArgumentError, "método não suportado: #{method}"
        end

      return resp if resp.success?

      raise_for_status(resp)
    rescue Faraday::TimeoutError
      raise ConnectionError, "timeout conectando no WordPress"
    rescue Faraday::ConnectionFailed => e
      raise ConnectionError, "conexão falhou: #{e.message}"
    end

    # Mensagens específicas por status — genérico aqui vira suporte depois.
    def raise_for_status(resp)
      detail = extract_message(resp.body)

      case resp.status
      when 401
        raise ConnectionError,
              "credenciais recusadas (401). Confira o usuário e gere uma nova senha de aplicação. #{detail}".strip
      when 403
        raise ConnectionError,
              "usuário autenticado mas sem permissão para editar posts (403). #{detail}".strip
      when 404
        raise ConnectionError,
              "REST API não encontrada em #{@base_url}/wp-json/wp/v2. Confira a URL do site e se a REST API não está desativada. #{detail}".strip
      else
        raise ConnectionError, "WordPress HTTP #{resp.status}: #{detail.presence || resp.body.to_s.slice(0, 300)}"
      end
    end

    def extract_message(body)
      parsed = parse_json(body)
      return "" unless parsed.is_a?(Hash)

      parsed["message"].to_s.strip
    rescue StandardError
      ""
    end

    def parse_json(body)
      raw = body.to_s
      return nil if raw.blank?

      JSON.parse(raw)
    rescue JSON::ParserError
      # Hardening/WAF às vezes devolve HTML no lugar do JSON.
      raise ConnectionError, "resposta não-JSON do WordPress (WAF ou REST bloqueada?): #{raw.slice(0, 200)}"
    end

    # `name` vem com entidades HTML (&amp;, &#8211;) no payload da REST.
    def sanitize_name(raw)
      CGI.unescapeHTML(raw.to_s)
    end

    def http
      @http ||= Faraday.new do |f|
        f.request :authorization, :basic, @username, @app_pass
        f.headers["User-Agent"]   = USER_AGENT
        f.headers["Accept"]       = "application/json"
        f.headers["Content-Type"] = "application/json"
        f.options.timeout         = READ_TIMEOUT
        f.options.open_timeout    = CONNECT_TIMEOUT
        f.request :retry, max: 1, interval: 0.5, retry_statuses: [502, 503, 504], methods: %i[get]
        f.adapter Faraday.default_adapter
      end
    end
  end
end
