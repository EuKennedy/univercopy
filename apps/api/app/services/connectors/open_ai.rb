# Conector OpenAI — geração de imagem para capa de post.
#
# Modelo gpt-image-2 (o mais avançado da OpenAI para imagem, lançado em
# abril/2026): raciocina antes de desenhar, renderiza texto de forma confiável
# e sai em até 2K.
#
# A chave é credencial POR WORKSPACE, cadastrada no painel em Configurações →
# Integrações e cifrada em repouso pelo model Integration. Não existe
# OPENAI_API_KEY em ENV.
#
# config: { "api_key" => "sk-..." }
#
# Cobrança é por TOKEN, não por imagem — por isso lemos `usage` da resposta e
# calculamos o custo real em vez de estimar. Esse custo é gravado num AiJob
# para contar no AiCostCap do workspace.

require "faraday"
require "faraday/retry"

module Connectors
  class OpenAi
    class ConnectionError < StandardError; end
    class GenerationError < StandardError; end

    BASE_URL   = "https://api.openai.com/v1".freeze
    MODEL      = "gpt-image-2".freeze
    USER_AGENT = "UniverCopyBot/1.0 (+https://univercopy.com)".freeze

    CONNECT_TIMEOUT = 10
    # Geração de imagem é lenta (o modelo raciocina antes de desenhar). Se o
    # proxy do Coolify cortar antes disso, mover para um job Sidekiq com polling.
    READ_TIMEOUT = 120

    SIZES     = %w[1024x1024 1536x1024 1024x1536 2048x2048 auto].freeze
    QUALITIES = %w[low medium high auto].freeze
    FORMATS   = %w[png jpeg webp].freeze

    DEFAULT_SIZE    = "1536x1024" # paisagem — proporção de capa de blog
    DEFAULT_QUALITY = "high"
    DEFAULT_FORMAT  = "webp"      # menor que png, com qualidade boa pra web

    # USD por 1M tokens. Conferido em developers.openai.com/api/docs/pricing
    # em 2026-08-05. Atualizar quando a OpenAI mexer na tabela.
    COST_USD_PER_M = { text_input: 5.0, image_input: 8.0, output: 30.0 }.freeze

    MAX_PROMPT_CHARS = 4_000

    def initialize(config)
      @api_key = config["api_key"].to_s.strip
      raise ConnectionError, "api_key obrigatória" if @api_key.blank?
    end

    # Valida a chave sem gastar geração — lista de modelos é chamada barata.
    def test_connection
      resp = http.get("#{BASE_URL}/models")
      return { ok: true } if resp.success?

      raise_for_status(resp)
    rescue Faraday::TimeoutError
      raise ConnectionError, "timeout falando com a OpenAI"
    rescue Faraday::ConnectionFailed => e
      raise ConnectionError, "conexão com a OpenAI falhou: #{e.message}"
    end

    # Retorna { data: <bytes binários>, mime:, format:, usage:, cost_usd: }.
    def generate_image(prompt:, size: DEFAULT_SIZE, quality: DEFAULT_QUALITY, format: DEFAULT_FORMAT)
      prompt = prompt.to_s.strip
      raise GenerationError, "prompt obrigatório" if prompt.blank?
      raise GenerationError, "prompt excede #{MAX_PROMPT_CHARS} caracteres" if prompt.length > MAX_PROMPT_CHARS

      size    = SIZES.include?(size.to_s)        ? size.to_s    : DEFAULT_SIZE
      quality = QUALITIES.include?(quality.to_s) ? quality.to_s : DEFAULT_QUALITY
      format  = FORMATS.include?(format.to_s)    ? format.to_s  : DEFAULT_FORMAT

      body = {
        model:         MODEL,
        prompt:        prompt,
        size:          size,
        quality:       quality,
        n:             1,
        output_format: format,
      }

      resp = http.post("#{BASE_URL}/images/generations") { |r| r.body = body.to_json }
      raise_for_status(resp) unless resp.success?

      parsed = parse_json(resp.body)
      b64    = parsed.dig("data", 0, "b64_json")
      raise GenerationError, "OpenAI não retornou imagem" if b64.blank?

      usage = parsed["usage"] || {}

      {
        data:     Base64.decode64(b64),
        mime:     mime_for(format),
        format:   format,
        usage:    usage,
        cost_usd: cost_from_usage(usage),
      }
    rescue Faraday::TimeoutError
      raise ConnectionError, "a OpenAI demorou mais de #{READ_TIMEOUT}s para gerar a imagem"
    rescue Faraday::ConnectionFailed => e
      raise ConnectionError, "conexão com a OpenAI falhou: #{e.message}"
    end

    # Custo real a partir dos tokens reportados. Sem `usage` na resposta,
    # devolve nil — melhor registrar desconhecido do que inventar número.
    def cost_from_usage(usage)
      return nil if usage.blank?

      details    = usage["input_tokens_details"] || {}
      text_in    = (details["text_tokens"]  || usage["input_tokens"] || 0).to_i
      image_in   = (details["image_tokens"] || 0).to_i
      out_tokens = (usage["output_tokens"]  || 0).to_i

      total = (text_in    * COST_USD_PER_M[:text_input] +
               image_in   * COST_USD_PER_M[:image_input] +
               out_tokens * COST_USD_PER_M[:output]) / 1_000_000.0

      total.round(5)
    end

    private

    def mime_for(format)
      { "png" => "image/png", "jpeg" => "image/jpeg", "webp" => "image/webp" }.fetch(format, "image/png")
    end

    def raise_for_status(resp)
      detail = extract_message(resp.body)

      case resp.status
      when 401
        raise ConnectionError, "chave da OpenAI recusada (401). Confira a chave em Integrações. #{detail}".strip
      when 403
        raise ConnectionError, "chave sem permissão para gerar imagens (403). #{detail}".strip
      when 429
        raise ConnectionError, "limite de uso da OpenAI atingido (429). #{detail}".strip
      when 400
        raise GenerationError, "a OpenAI recusou o pedido: #{detail.presence || 'sem detalhe'}"
      else
        raise ConnectionError, "OpenAI HTTP #{resp.status}: #{detail.presence || resp.body.to_s.slice(0, 300)}"
      end
    end

    def extract_message(body)
      parsed = parse_json(body)
      return "" unless parsed.is_a?(Hash)

      parsed.dig("error", "message").to_s.strip
    rescue StandardError
      ""
    end

    def parse_json(body)
      raw = body.to_s
      return {} if raw.blank?

      JSON.parse(raw)
    rescue JSON::ParserError
      {}
    end

    def http
      @http ||= Faraday.new do |f|
        f.request :authorization, "Bearer", @api_key
        f.headers["User-Agent"]   = USER_AGENT
        f.headers["Content-Type"] = "application/json"
        f.headers["Accept"]       = "application/json"
        f.options.timeout         = READ_TIMEOUT
        f.options.open_timeout    = CONNECT_TIMEOUT
        f.request :retry, max: 1, interval: 1.0, retry_statuses: [500, 502, 503, 504], methods: %i[get]
        f.adapter Faraday.default_adapter
      end
    end
  end
end
