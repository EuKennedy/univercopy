# Escreve o post de comunidade que anuncia um post do blog.
#
# NÃO republica o texto do blog. O feed do Fluent Community aceita markdown com
# teto de 15.000 caracteres, então despejar o HTML do post renderiza a marcação
# literal e ainda corre risco de estourar o limite. O que sai daqui é um post
# curto, nativo de feed, que dá o gancho e manda pro artigo completo.
#
# Passa pelo Ai::TextRouter como o resto: o workspace decide se o texto sai no
# Anthropic (padrão) ou na OpenAI, e o custo cai no mesmo AiCostCap.

module Ai
  class CommunityWriter
    MAX_TOKENS = 1_200

    # Bem abaixo do teto do plugin de propósito: post de feed que precisa de
    # "ver mais" perde o engajamento que justifica publicar lá.
    TARGET_CHARS = 900

    LOCALE_LABEL = {
      "pt-BR" => "Português do Brasil",
      "en-US" => "Inglês (Estados Unidos)",
      "es-AR" => "Espanhol (Argentina)",
      "fr-FR" => "Francês",
    }.freeze

    Result = Struct.new(:text, :ai_result, keyword_init: true)

    class << self
      def call(workspace:, title:, content: nil, url: nil, model: :auto)
        user = <<~PROMPT
          Escreva um post curto para o feed da comunidade anunciando o artigo abaixo.

          TÍTULO DO ARTIGO: #{title.to_s.strip}
          #{content_block(content)}
          Regras:
          - Markdown simples: parágrafos, **negrito**, listas com "-". Nada de HTML, nada de título com #.
          - No máximo #{TARGET_CHARS} caracteres. Curto é melhor que completo.
          - Abra com o gancho — o problema ou a promessa concreta. Nada de "acabamos de publicar".
          - No meio, 2 ou 3 pontos do que a pessoa vai levar do artigo.
          - Termine convidando pra leitura#{url.present? ? " e inclua este link em markdown: #{url}" : ''}.
          - Escreva como quem conversa na comunidade, não como quem faz anúncio institucional.
          - Não invente dado, número ou resultado que não esteja no artigo.
          - Responda APENAS com o texto do post.
        PROMPT

        result = Ai::TextRouter.call(
          workspace:   workspace,
          prompt:      user,
          system:      system_prompt(workspace),
          model:       model.presence || :auto,
          task:        :generate_copy,
          max_tokens:  MAX_TOKENS,
          temperature: 0.7
        )

        Result.new(text: clean(result.text), ai_result: result)
      end

      private

      # O corpo entra recortado: o modelo precisa do assunto, não do artigo
      # inteiro — e artigo inteiro em toda chamada é token queimado à toa.
      def content_block(content)
        stripped = ActionController::Base.helpers.strip_tags(content.to_s).squish
        return "" if stripped.blank?

        "CONTEÚDO DO ARTIGO (resumido): #{stripped.slice(0, 3_000)}\n"
      end

      def system_prompt(workspace)
        dna    = workspace.active_brand_dna
        locale = LOCALE_LABEL[workspace.default_locale.to_s] || LOCALE_LABEL["pt-BR"]

        lines = ["Você escreve para a comunidade da marca abaixo. Escreva em #{locale}."]

        if dna
          lines << "Marca: #{dna.marca}"                              if dna.marca.present?
          lines << "Tom de voz: #{dna.tom}"                           if dna.tom.present?
          lines << "Público: #{dna.publico}"                          if dna.publico.present?
          lines << "NÃO USE, em hipótese alguma: #{list(dna.evitar)}" if list(dna.evitar).present?

          restricoes = list(dna.restricoes_regulatorias)
          lines << "Restrições regulatórias obrigatórias: #{restricoes}" if restricoes.present?
        end

        lines << "Nunca invente dado, número, estudo ou depoimento."
        lines.join("\n")
      end

      def list(value)
        Array(value).map { |v| v.is_a?(Hash) ? v.values.join(" — ") : v.to_s }
                    .map(&:strip).reject(&:blank?).join("; ")
      end

      # O modelo às vezes devolve o post dentro de cerca de markdown.
      def clean(raw)
        raw.to_s.strip
           .sub(/\A```(?:markdown|md)?\s*/i, "")
           .sub(/```\s*\z/, "")
           .strip
      end
    end
  end
end
