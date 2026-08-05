# Geração de título, corpo e prompt de capa para post de blog.
#
# Usa o mesmo Ai::AnthropicClient do resto do produto (auto-router de modelo,
# contabilidade de custo) e respeita o DNA da marca em uso no workspace. Não
# persiste nada — devolve o texto e o resultado da chamada pro controller
# registrar o AiJob e o custo entrar no AiCostCap.
#
# Não usa o Ai::PromptBuilder porque aquele é montado em torno de peça/estilo/
# framework de copy publicitária; post de blog tem estrutura própria.

module Ai
  class BlogWriter
    MAX_TOKENS_TITLE = 500
    MAX_TOKENS_BODY  = 8_000

    LOCALE_LABEL = {
      "pt-BR" => "Português do Brasil",
      "en-US" => "Inglês (Estados Unidos)",
      "es-AR" => "Espanhol (Argentina)",
      "fr-FR" => "Francês",
    }.freeze

    Result = Struct.new(:text, :ai_result, keyword_init: true)

    class << self
      # Devolve UM título. Curto, específico, sem clickbait vazio.
      def title(workspace:, brief: nil, model: :auto)
        user = <<~PROMPT
          Escreva UM título para um post de blog#{brief_clause(brief)}.

          Regras:
          - Entre 40 e 70 caracteres.
          - Específico e concreto. Nada de clickbait vazio nem promessa que o texto não cumpre.
          - Sem aspas, sem markdown, sem numeração.
          - Responda APENAS com o título, nada mais.
        PROMPT

        call(workspace: workspace, user: user, model: model, max_tokens: MAX_TOKENS_TITLE, task: :generate_copy)
          .then { |r| Result.new(text: clean_title(r.text), ai_result: r) }
      end

      # Devolve o corpo do post em HTML simples, pronto pro editor do WordPress.
      def content(workspace:, title: nil, brief: nil, model: :auto)
        user = <<~PROMPT
          Escreva o corpo de um post de blog#{title_clause(title)}#{brief_clause(brief)}.

          Regras:
          - HTML simples: <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em>. Nada de <html>, <head>, <body> ou <h1>.
          - Entre 600 e 1200 palavras, em seções com subtítulo.
          - Comece direto pelo primeiro parágrafo — não repita o título.
          - Concreto e útil. Sem encher linguiça e sem prometer o que a marca não entrega.
          - Responda APENAS com o HTML do corpo.
        PROMPT

        call(workspace: workspace, user: user, model: model, max_tokens: MAX_TOKENS_BODY, task: :generate_copy)
          .then { |r| Result.new(text: clean_html(r.text), ai_result: r) }
      end

      # Prompt de imagem montado deterministicamente (sem gastar chamada de IA).
      # O usuário pode sobrescrever pela tela.
      def cover_prompt(workspace:, title:, extra: nil)
        dna   = workspace.active_brand_dna
        tom   = dna&.tom.to_s.strip
        marca = dna&.marca.to_s.strip

        parts = [
          "Imagem de capa para um post de blog intitulado \"#{title.to_s.strip}\".",
          "Fotografia editorial moderna, iluminação natural, composição limpa com espaço negativo à esquerda.",
          marca.present? ? "Contexto da marca: #{marca}." : nil,
          tom.present?   ? "Tom visual: #{tom}." : nil,
          extra.to_s.strip.presence,
          "Sem nenhum texto, letra, palavra, logotipo ou marca d'água na imagem.",
        ].compact

        parts.join(" ")
      end

      private

      # Vai pelo TextRouter: o workspace decide se o texto sai no Anthropic
      # (padrão) ou na OpenAI, conforme o modelo escolhido em Integrações.
      def call(workspace:, user:, model:, max_tokens:, task:)
        Ai::TextRouter.call(
          workspace:   workspace,
          prompt:      user,
          system:      system_prompt(workspace),
          model:       model.presence || :auto,
          task:        task,
          max_tokens:  max_tokens,
          temperature: 0.7
        )
      end

      def system_prompt(workspace)
        dna    = workspace.active_brand_dna
        locale = LOCALE_LABEL[workspace.default_locale.to_s] || LOCALE_LABEL["pt-BR"]

        lines = ["Você escreve conteúdo de blog para a marca abaixo. Escreva em #{locale}."]

        if dna
          lines << "Marca: #{dna.marca}"                             if dna.marca.present?
          lines << "Posicionamento: #{dna.posicionamento}"           if dna.posicionamento.present?
          lines << "Tom de voz: #{dna.tom}"                          if dna.tom.present?
          lines << "Público: #{dna.publico}"                         if dna.publico.present?
          lines << "Valores: #{list(dna.valores)}"                   if list(dna.valores).present?
          lines << "Provas e diferenciais: #{list(dna.provas)}"      if list(dna.provas).present?
          lines << "Objeções a endereçar: #{list(dna.objecoes)}"     if list(dna.objecoes).present?
          lines << "NÃO USE, em hipótese alguma: #{list(dna.evitar)}" if list(dna.evitar).present?

          restricoes = list(dna.restricoes_regulatorias)
          lines << "Restrições regulatórias obrigatórias: #{restricoes}" if restricoes.present?
        end

        lines << "Nunca invente dado, número, estudo ou depoimento. Se não souber, escreva sem o dado."
        lines.join("\n")
      end

      def list(value)
        Array(value).map { |v| v.is_a?(Hash) ? v.values.join(" — ") : v.to_s }
                    .map(&:strip).reject(&:blank?).join("; ")
      end

      def title_clause(title)
        title.to_s.strip.present? ? " com o título \"#{title.to_s.strip}\"" : ""
      end

      def brief_clause(brief)
        brief.to_s.strip.present? ? " sobre: #{brief.to_s.strip}" : ""
      end

      # O modelo às vezes devolve o título entre aspas ou com bullet.
      def clean_title(raw)
        raw.to_s.strip.lines.first.to_s.strip
           .sub(/\A[-*•]\s*/, "")
           .gsub(/\A["'“”]|["'“”]\z/, "")
           .strip
      end

      # Tira cerca de markdown que o modelo às vezes envolve no HTML.
      def clean_html(raw)
        raw.to_s.strip
           .sub(/\A```(?:html)?\s*/i, "")
           .sub(/```\s*\z/, "")
           .strip
      end
    end
  end
end
