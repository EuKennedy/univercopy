# Pega o DNA atual + framework + direção → propõe versão "proposto"
# mais forte. Não inventa fatos: refina + alinha. Output JSON estrito
# com mesmo shape do DNA_SHAPE.

module Ai
  class DnaImprover
    DNA_SHAPE = %w[
      marca missao posicionamento tom publico consciencia
      valores produtos ofertas provas objecoes evitar
    ].freeze

    SYSTEM = <<~PROMPT.freeze
      Você é estrategista de marca sênior. Recebe um DNA ATUAL de marca e
      devolve uma versão PROPOSTA mais forte: mais específica, concreta e
      persuasiva. NUNCA invente fatos novos — apenas refine, especifique e
      reorganize o que existe. Quando o framework solicitado pedir
      estrutura específica (Sinek Golden Circle, Kapferer prism, etc),
      reorganize o conteúdo nele.

      Responda APENAS com JSON válido, sem markdown, sem texto antes/depois,
      com EXATAMENTE estas chaves:
      {
        "marca":"",
        "missao":"",
        "posicionamento":"",
        "tom":"",
        "publico":"",
        "consciencia":"",
        "valores": [],
        "produtos": [],
        "ofertas": [],
        "provas": [],
        "objecoes": [],
        "evitar": []
      }
    PROMPT

    def self.call(workspace:, atual_dna:, framework: nil, direction: nil, model: :auto)
      new.call(workspace:, atual_dna:, framework:, direction:, model:)
    end

    def call(workspace:, atual_dna:, framework:, direction:, model:)
      atual = serialize(atual_dna)
      user_prompt =
        "DNA ATUAL (não invente nada além disto):\n#{JSON.pretty_generate(atual)}\n\n" \
        "#{framework ? "Framework alvo: #{framework}\n" : ''}" \
        "#{direction ? "Direção do aprimoramento: #{direction}\n" : ''}" \
        "Devolva o DNA PROPOSTO em JSON conforme spec do system prompt."

      result = Ai::AnthropicClient.call(
        prompt:      user_prompt,
        model:       model,
        task:        :dna_improve,
        system:      SYSTEM,
        max_tokens:  2500,
        temperature: 0.5,
      )

      parsed = Ai::JsonExtractor.parse(result.text)
      attrs  = normalize(parsed)
      attrs["framework"] = framework if framework

      { dna_attrs: attrs, ai_result: result }
    end

    private

    def serialize(dna)
      DNA_SHAPE.each_with_object({}) { |k, h| h[k] = dna.public_send(k) }
    end

    def normalize(raw)
      raw = raw.is_a?(Hash) ? raw : {}
      DNA_SHAPE.each_with_object({}) do |key, h|
        value = raw[key] || raw[key.to_s]
        h[key] = case key
                 when "valores", "produtos", "ofertas", "provas", "objecoes", "evitar"
                   Array(value).map { |v| v.to_s.strip }.reject(&:empty?).first(12)
                 else
                   value.to_s.strip
                 end
      end
    end
  end
end
