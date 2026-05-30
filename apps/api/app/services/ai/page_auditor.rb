# Audita uma página (própria ou concorrente). Pipeline:
#   1) SsrfGuard valida URL  2) Scraper baixa+strip HTML
#   3) Anthropic analisa copy/SEO/GEO contra o DNA da marca em uso
#   4) JsonExtractor parseia → { score, summary, sections[] }
#
# Não persiste — controller salva PageAudit. Não checa plano/cap (controller).

module Ai
  class PageAuditor
    SYSTEM = <<~PROMPT.freeze
      Você é auditor de páginas de conversão sênior (copy + SEO + GEO — otimização
      para motores de resposta de IA). Avalie a página REAL fornecida contra o DNA
      da marca. Seja específico e acionável; nunca invente conteúdo que não esteja
      na página.

      Responda APENAS em JSON válido, sem markdown, com EXATAMENTE estas chaves:
      {
        "brand_name": "",
        "score": 0,
        "summary": "diagnóstico geral em 1-2 frases",
        "sections": [
          { "title": "Proposta de valor", "score": 0, "notes": "o que está bom/ruim + recomendação" },
          { "title": "Copy & persuasão",  "score": 0, "notes": "" },
          { "title": "SEO",               "score": 0, "notes": "" },
          { "title": "GEO (resposta IA)", "score": 0, "notes": "" },
          { "title": "CTA & conversão",   "score": 0, "notes": "" }
        ]
      }

      Regras: score 0-100 (inteiro). "notes" objetivo, com recomendação priorizada.
    PROMPT

    def self.call(url:, dna: nil, model: :auto)
      new.call(url:, dna:, model:)
    end

    def call(url:, dna:, model:)
      text = Ai::Scraper.fetch_text(url)
      raise Ai::CallFailed, "conteúdo insuficiente: #{text.length} chars" if text.length < 120

      user_prompt = [
        ("DNA DA MARCA (referência):\n#{dna_block(dna)}" if dna),
        "URL auditada: #{url}",
        "Conteúdo extraído da página:\n#{text}",
        "Faça a auditoria agora no formato JSON especificado.",
      ].compact.join("\n\n")

      result = Ai::AnthropicClient.call(
        prompt:      user_prompt,
        model:       model,
        task:        :page_audit,
        system:      SYSTEM,
        max_tokens:  2500,
        temperature: 0.4,
      )

      parsed = Ai::JsonExtractor.parse(result.text)
      { audit: normalize(parsed, url), ai_result: result }
    end

    private

    def dna_block(dna)
      {
        marca:          dna.marca,
        posicionamento: dna.posicionamento,
        tom:            dna.tom,
        publico:        dna.publico,
      }.compact_blank.map { |k, v| "#{k}: #{v}" }.join("\n")
    end

    def normalize(raw, url)
      raw = raw.is_a?(Hash) ? raw : {}
      sections = Array(raw["sections"]).filter_map do |s|
        next unless s.is_a?(Hash)

        { title: s["title"].to_s.strip, score: s["score"].to_i, notes: s["notes"].to_s.strip }
      end
      {
        "url"        => url,
        "brand_name" => raw["brand_name"].to_s.strip,
        "score"      => raw["score"].to_i,
        "summary"    => raw["summary"].to_s.strip,
        "sections"   => sections,
      }
    end
  end
end
