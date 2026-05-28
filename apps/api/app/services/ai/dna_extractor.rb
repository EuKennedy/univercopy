# Extrai o DNA da marca a partir do conteúdo público da home/site. Pipeline:
#   1) Security::SsrfGuard valida URL
#   2) Ai::Scraper baixa + strip HTML
#   3) Ai::AnthropicClient com prompt focado em DNA
#   4) Ai::JsonExtractor parseia (tolerante a truncamento)
#   5) Sanitiza estrutura — retorna hash com shape canônico do brand_dnas

module Ai
  class DnaExtractor
    DNA_SHAPE = %w[
      marca missao posicionamento tom publico consciencia
      valores produtos ofertas provas objecoes evitar
    ].freeze

    SYSTEM = <<~PROMPT.freeze
      Você é estrategista de marca e copywriter sênior. A partir do conteúdo REAL do site da marca, extraia o DNA. Baseie-se SOMENTE no que o site comunica — NUNCA invente fatos. Quando uma seção não puder ser inferida, deixe vazia ("" ou []).

      Responda APENAS em JSON válido, sem markdown, sem texto antes/depois, com EXATAMENTE estas chaves:
      {
        "marca":"",
        "missao":"",
        "posicionamento":"",
        "tom":"",
        "publico":"",
        "consciencia":"estágio (não-consciente | problema | solução | produto | totalmente)",
        "valores": [],
        "produtos": [],
        "ofertas": [],
        "provas": [],
        "objecoes": ["objeção real do cliente + como o site responde"],
        "evitar": ["palavras/clichês que a marca deveria evitar com base no posicionamento"]
      }

      Regras finas:
      - "tom": adjetivos curtos separados por vírgula (ex.: "acolhedor, técnico, confiante").
      - "valores"/"produtos"/"ofertas": listas de strings curtas.
      - "provas": números, depoimentos curtos, certificações que apareçam no site.
      - "objecoes": no formato "objeção: como respondemos".
      - "consciencia": escolha 1 estágio (Schwartz).
    PROMPT

    def self.call(url, model: :auto)
      new.call(url, model: model)
    end

    def call(url, model: :auto)
      text = Ai::Scraper.fetch_text(url)
      raise Ai::CallFailed, "conteúdo insuficiente: #{text.length} chars" if text.length < 120

      user_prompt = "URL: #{url}\nConteúdo extraído do site:\n#{text}"

      result = Ai::AnthropicClient.call(
        prompt:      user_prompt,
        model:       model,
        task:        :extract_dna_from_url,
        system:      SYSTEM,
        max_tokens:  2200,
        temperature: 0.4,
      )

      parsed = Ai::JsonExtractor.parse(result.text)
      dna    = normalize(parsed)
      dna["source_url"] = url

      { dna: dna, scraped_text: text, ai_result: result }
    end

    private

    def normalize(raw)
      raw = raw.is_a?(Hash) ? raw : {}
      DNA_SHAPE.each_with_object({}) do |key, h|
        value = raw[key] || raw[key.to_s]
        h[key] = case key
                 when "valores", "produtos", "ofertas", "provas", "objecoes", "evitar"
                   coerce_list(value)
                 else
                   value.to_s.strip
                 end
      end
    end

    def coerce_list(value)
      case value
      when Array  then value.map { |v| v.to_s.strip }.reject(&:empty?).first(12)
      when String then value.split(/[;\n]/).map(&:strip).reject(&:empty?).first(12)
      else []
      end
    end
  end
end
