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
    MAX_MEDIA_BYTES  = 8 * 1_048_576 # 8MB — alinhado com o teto do upload no admin
    MAX_TERM_BYTES   = 200

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
      terms("categories")
    end

    def tags
      terms("tags")
    end

    # Cria categoria/tag. Se o WP recusar por já existir, aproveitamos o ID que
    # ele devolve no erro (`data.term_id`) em vez de estourar — do ponto de
    # vista de quem clicou no "+", o termo passou a estar disponível.
    def create_category(name)
      create_term("categories", name)
    end

    def create_tag(name)
      create_term("tags", name)
    end

    # Sobe a imagem pra biblioteca de mídia e devolve o attachment.
    # O corpo vai binário puro com Content-Disposition — é como o WP espera.
    def upload_media(data:, filename:, mime:, alt: nil)
      raise PublishError, "arquivo vazio" if data.blank?
      raise PublishError, "imagem excede #{MAX_MEDIA_BYTES / 1_048_576}MB" if data.bytesize > MAX_MEDIA_BYTES

      uri = Security::SsrfGuard.safe!("#{@base_url}/wp-json/wp/v2/media")

      resp = http.post(uri.to_s) do |r|
        r.headers["Content-Type"]        = mime
        r.headers["Content-Disposition"] = %(attachment; filename="#{sanitize_filename(filename)}")
        r.body = data
      end

      raise_for_status(resp) unless resp.success?

      created = parse_json(resp.body)
      media   = {
        id:  created["id"].to_i,
        url: created.dig("source_url").presence || created.dig("guid", "rendered").presence,
      }

      set_media_alt(media[:id], alt) if alt.present?
      media
    rescue Faraday::TimeoutError
      raise ConnectionError, "timeout enviando a imagem para o WordPress"
    rescue Faraday::ConnectionFailed => e
      raise ConnectionError, "conexão falhou ao enviar a imagem: #{e.message}"
    end

    # Cria o post. `status` é draft ou publish — quem decide é a tela.
    def publish(title:, content:, status: "draft", category_ids: [], tag_ids: [], excerpt: nil, featured_media: nil)
      title   = title.to_s.strip
      content = content.to_s
      status  = status.to_s.strip

      raise PublishError, "título obrigatório"                      if title.blank?
      raise PublishError, "conteúdo obrigatório"                    if content.strip.blank?
      raise PublishError, "status inválido: #{status.inspect}"      unless ALLOWED_STATUSES.include?(status)
      raise PublishError, "título excede #{MAX_TITLE_BYTES} bytes"  if title.bytesize > MAX_TITLE_BYTES
      raise PublishError, "conteúdo excede #{MAX_BODY_BYTES} bytes" if content.bytesize > MAX_BODY_BYTES

      payload = { title: title, content: content, status: status }
      payload[:excerpt]        = excerpt.to_s.strip if excerpt.to_s.strip.present?
      payload[:categories]     = Array(category_ids).map(&:to_i).reject(&:zero?).presence
      payload[:tags]           = Array(tag_ids).map(&:to_i).reject(&:zero?).presence
      payload[:featured_media] = featured_media.to_i if featured_media.to_i.positive?

      created = parse_json(request(:post, "posts", body: payload.compact).body)

      {
        id:     created["id"].to_i,
        url:    created["link"].presence,
        status: created["status"].presence || status,
      }
    end

    private

    def terms(taxonomy)
      out  = []
      page = 1

      loop do
        resp  = request(:get, taxonomy, params: { per_page: PER_PAGE, page: page })
        items = parse_json(resp.body)
        break if items.blank?

        out.concat(items.map do |t|
          { id: t["id"].to_i, name: sanitize_name(t["name"]), slug: t["slug"].to_s, count: t["count"].to_i }
        end)

        total_pages = resp.headers["x-wp-totalpages"].to_i
        break if page >= total_pages || page >= MAX_PAGES

        page += 1
      end

      out
    end

    def create_term(taxonomy, name)
      name = name.to_s.strip
      raise PublishError, "nome obrigatório"                     if name.blank?
      raise PublishError, "nome excede #{MAX_TERM_BYTES} bytes"  if name.bytesize > MAX_TERM_BYTES

      resp = http.post(Security::SsrfGuard.safe!("#{@base_url}/wp-json/wp/v2/#{taxonomy}").to_s) do |r|
        r.body = { name: name }.to_json
      end

      if resp.success?
        created = parse_json(resp.body)
        return { id: created["id"].to_i, name: sanitize_name(created["name"]), slug: created["slug"].to_s, count: 0 }
      end

      # `term_exists`: o WP devolve o ID do termo já existente. Reaproveitamos.
      parsed = parse_json(resp.body) rescue nil
      if parsed.is_a?(Hash) && parsed["code"].to_s == "term_exists"
        existing_id = parsed.dig("data", "term_id").to_i
        return { id: existing_id, name: name, slug: "", count: 0, existed: true } if existing_id.positive?
      end

      raise_for_status(resp)
    rescue Faraday::TimeoutError
      raise ConnectionError, "timeout criando termo no WordPress"
    end

    def set_media_alt(media_id, alt)
      http.post(Security::SsrfGuard.safe!("#{@base_url}/wp-json/wp/v2/media/#{media_id.to_i}").to_s) do |r|
        r.body = { alt_text: alt.to_s.strip.slice(0, 300) }.to_json
      end
    rescue StandardError => e
      # A imagem já subiu; alt é acessório. Não derruba a operação.
      Rails.logger.warn("[Wordpress] alt_text falhou p/ media #{media_id}: #{e.message}")
    end

    # WP recusa nome com caminho. Mantém só o basename e um conjunto seguro.
    def sanitize_filename(raw)
      base = File.basename(raw.to_s).gsub(/[^a-zA-Z0-9._-]/, "-").squeeze("-")
      base = "capa" if base.blank? || base.start_with?(".")
      base.slice(0, 120)
    end

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
