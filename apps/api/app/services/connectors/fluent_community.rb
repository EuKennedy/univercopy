# Conector Fluent Community — REST oficial do plugin, em
# /wp-json/fluent-community/v2/.
#
# É REST do WordPress de verdade (registrada com `rest_namespace` =
# 'fluent-community'), não AJAX interno: Application Password autentica por
# HTTP Basic igual ao conector do blog. O gate do lado do plugin é a
# PortalPolicy — qualquer método diferente de GET exige usuário logado COM
# acesso ao portal. Credencial de admin que nunca entrou na comunidade é
# recusada mesmo estando correta, e o erro do plugin não deixa isso óbvio;
# por isso `test_connection` valida escrita indiretamente lendo os spaces
# do usuário autenticado.
#
# Diferenças que importam em relação ao conector do blog:
#   - `message` é MARKDOWN, não HTML, com teto de 15.000 caracteres.
#     Mandar o corpo HTML de um post renderiza a marcação literal no feed.
#   - `space` é o SLUG do space, não o id.
#   - `topic_ids` vira obrigatório quando o space tem topic_required.
#
# config: { "base_url" => "https://site.com", "username" => "usuario",
#           "application_password" => "xxxx xxxx xxxx xxxx xxxx xxxx",
#           "default_space" => "slug-opcional" }

require "faraday"
require "faraday/retry"

module Connectors
  class FluentCommunity
    class ConnectionError < StandardError; end
    class PublishError    < StandardError; end

    USER_AGENT      = "UniverCopyBot/1.0 (+https://univercopy.com)"
    CONNECT_TIMEOUT = 5
    READ_TIMEOUT    = 30

    API_PREFIX = "wp-json/fluent-community/v2".freeze

    # Teto do próprio plugin (filtro fluent_community/max_post_length).
    # Repetido aqui pra recusar antes do round-trip em vez de depois.
    MAX_MESSAGE_CHARS = 15_000
    MAX_TITLE_CHARS   = 192

    # Só space `community` recebe post de feed. `course`, `space_group` e
    # `sidebar_link` aparecem na mesma listagem e publicar neles não faz
    # sentido — filtramos aqui pra tela não oferecer o que vai falhar.
    POSTABLE_TYPES = %w[community].freeze

    def initialize(config)
      @base_url      = config["base_url"].to_s.strip.chomp("/")
      @username      = config["username"].to_s.strip
      @app_pass      = config["application_password"].to_s.strip
      @default_space = config["default_space"].to_s.strip.presence

      raise ConnectionError, "base_url, username e application_password são obrigatórios" if
        @base_url.blank? || @username.blank? || @app_pass.blank?
    end

    attr_reader :default_space

    # Valida credencial E acesso ao portal de uma vez: `all-spaces` responde
    # sob a mesma PortalPolicy que governa a publicação. Credencial válida sem
    # acesso à comunidade falha aqui, que é onde o usuário ainda pode corrigir.
    def test_connection
      list = spaces
      { ok: true, site: @base_url, spaces: list.size }
    end

    # Spaces onde dá pra publicar. Devolve [{ id:, title:, slug:, type:, privacy: }].
    def spaces
      payload = parse_json(request(:get, "spaces/all-spaces").body)
      raw     = extract_spaces(payload)

      raw.filter_map do |s|
        next unless s.is_a?(Hash)

        type = s["type"].to_s
        next unless POSTABLE_TYPES.include?(type)

        {
          id:      s["id"].to_i,
          title:   sanitize_name(s["title"]),
          slug:    s["slug"].to_s,
          type:    type,
          privacy: s["privacy"].to_s,
        }
      end
    end

    # Publica no feed. `message` em markdown; `space` é slug.
    def publish(message:, space: nil, title: nil, topic_ids: [])
      message = message.to_s.strip
      space   = (space.presence || @default_space).to_s.strip

      raise PublishError, "mensagem obrigatória" if message.blank?
      raise PublishError, "space obrigatório — escolha onde publicar" if space.blank?
      raise PublishError, "mensagem excede #{MAX_MESSAGE_CHARS} caracteres" if message.length > MAX_MESSAGE_CHARS

      payload = { message: message, space: space }
      payload[:title]     = title.to_s.strip.slice(0, MAX_TITLE_CHARS) if title.to_s.strip.present?
      payload[:topic_ids] = Array(topic_ids).map(&:to_i).reject(&:zero?) if Array(topic_ids).any?

      created = parse_json(request(:post, "feeds", body: payload).body)
      feed    = created["feed"] || created["post"] || created

      {
        id:    feed["id"].to_i,
        url:   feed["permalink"].presence || feed["url"].presence,
        slug:  feed["slug"].to_s,
        space: space,
      }
    end

    private

    # O plugin já devolveu a lista em formatos diferentes entre versões: array
    # direto, { spaces: [...] } e agrupada por space_group. Normaliza os três
    # em vez de amarrar numa versão.
    def extract_spaces(payload)
      return payload if payload.is_a?(Array)
      return [] unless payload.is_a?(Hash)

      direct = payload["spaces"] || payload["data"]
      return direct if direct.is_a?(Array)

      groups = payload["space_groups"] || payload["groups"]
      return Array(groups).flat_map { |g| Array(g.is_a?(Hash) ? g["spaces"] : nil) } if groups.is_a?(Array)

      []
    end

    def request(method, path, body: nil)
      uri = Security::SsrfGuard.safe!("#{@base_url}/#{API_PREFIX}/#{path}")

      resp =
        case method
        when :get  then http.get(uri.to_s)
        when :post then http.post(uri.to_s) { |r| r.body = body.to_json }
        else raise ArgumentError, "método não suportado: #{method}"
        end

      return resp if resp.success?

      raise_for_status(resp)
    rescue Faraday::TimeoutError
      raise ConnectionError, "timeout conectando na comunidade"
    rescue Faraday::ConnectionFailed => e
      raise ConnectionError, "conexão falhou: #{e.message}"
    end

    def raise_for_status(resp)
      detail = extract_message(resp.body)

      case resp.status
      when 401
        raise ConnectionError,
              "credenciais recusadas (401). Confira o usuário e gere uma nova senha de aplicação. #{detail}".strip
      when 403
        raise ConnectionError,
              "usuário autenticado mas sem acesso à comunidade (403). Confirme que ele é membro do portal " \
              "do Fluent Community, não apenas admin do WordPress. #{detail}".strip
      when 404
        raise ConnectionError,
              "API do Fluent Community não encontrada em #{@base_url}/#{API_PREFIX}. " \
              "Confira se o plugin está ativo NESTE site. #{detail}".strip
      when 422, 400
        raise PublishError, "a comunidade recusou o post: #{detail.presence || 'sem detalhe'}"
      else
        raise ConnectionError, "Fluent Community HTTP #{resp.status}: #{detail.presence || resp.body.to_s.slice(0, 300)}"
      end
    end

    def extract_message(body)
      parsed = parse_json(body)
      return "" unless parsed.is_a?(Hash)

      (parsed["message"].presence || parsed.dig("errors", "message").presence).to_s.strip
    rescue StandardError
      ""
    end

    def parse_json(body)
      raw = body.to_s
      return nil if raw.blank?

      JSON.parse(raw)
    rescue JSON::ParserError
      raise ConnectionError, "resposta não-JSON da comunidade (WAF ou REST bloqueada?): #{raw.slice(0, 200)}"
    end

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
