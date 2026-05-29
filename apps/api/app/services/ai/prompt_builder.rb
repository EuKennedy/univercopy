# Monta system + user prompt do gerador de copy. Combina:
#   DNA da marca (atual OU proposto, conforme dna_in_use) +
#   estilo (princípios do copywriter) + framework (estrutura) +
#   tipo de peça (estrutura + length_hint) + produto (opcional) +
#   campanha (opcional) + brief livre do usuário.
#
# Saída: { system:, user: } strings prontas pro AnthropicClient.
# Não chama IA. Pura montagem determinística → testável.

module Ai
  class PromptBuilder
    LOCALE_LABEL = {
      "pt-BR" => "Português do Brasil",
      "en-US" => "Inglês (Estados Unidos)",
      "es-AR" => "Espanhol",
    }.freeze

    def self.call(**kwargs)
      new(**kwargs).call
    end

    def initialize(workspace:, dna:, piece_type:, style:, framework:, product: nil, campaign: nil, brief: nil, n: 2, locale: "pt-BR")
      @workspace  = workspace
      @dna        = dna
      @piece_type = piece_type
      @style      = style
      @framework  = framework
      @product    = product
      @campaign   = campaign
      @brief      = brief.to_s.strip
      @n          = n.to_i.clamp(1, 5)
      @locale     = locale.presence || "pt-BR"
    end

    def call
      { system: system_prompt, user: user_prompt }
    end

    private

    attr_reader :workspace, :dna, :piece_type, :style, :framework, :product, :campaign, :brief, :n, :locale

    def system_prompt
      parts = []
      parts << <<~TXT.strip
        Você é um copywriter de elite escrevendo em #{LOCALE_LABEL.fetch(locale, 'Português do Brasil')}.
        Sua copy é específica, concreta e persuasiva — sem clichê, sem encheção,
        sem promessa vazia. Você respeita RIGOROSAMENTE o DNA da marca abaixo:
        nunca inventa fatos, números, garantias ou benefícios que não estejam
        no contexto fornecido.
      TXT

      if style
        principles = Array(style.principles).map { |p| "- #{p}" }.join("\n")
        parts << <<~TXT.strip
          ESTILO: #{style.name}#{style.era ? " (#{style.era})" : ''}
          #{style.description}
          #{principles.present? ? "Princípios a aplicar:\n#{principles}" : ''}
        TXT
      end

      if framework
        parts << "FRAMEWORK: #{framework.name}\nEstrutura a seguir:\n#{framework.structure}"
      end

      parts << output_spec
      parts.join("\n\n")
    end

    def output_spec
      <<~TXT.strip
        SAÍDA: responda APENAS com JSON válido, sem markdown, sem texto antes ou
        depois. Gere EXATAMENTE #{n} #{n == 1 ? 'variação' : 'variações'} distintas
        (ângulos diferentes), neste formato:
        {
          "variations": [
            { "title": "título curto da variação", "angle": "ângulo/abordagem em 1 frase", "content": "a copy completa" }
          ]
        }
      TXT
    end

    def user_prompt
      sections = []
      sections << "DNA DA MARCA (fonte da verdade — não invente nada além disto):\n#{dna_block}"
      sections << "PRODUTO:\n#{product_block}" if product
      sections << "CAMPANHA:\n#{campaign_block}" if campaign
      sections << piece_block
      sections << "BRIEF DO USUÁRIO:\n#{brief}" if brief.present?
      sections << "Gere as #{n} variações agora, em #{LOCALE_LABEL.fetch(locale, 'Português do Brasil')}."
      sections.join("\n\n")
    end

    def dna_block
      h = {
        marca:          dna&.marca,
        missao:         dna&.missao,
        posicionamento: dna&.posicionamento,
        tom:            dna&.tom,
        publico:        dna&.publico,
        consciencia:    dna&.consciencia,
        valores:        dna&.valores,
        produtos:       dna&.produtos,
        ofertas:        dna&.ofertas,
        provas:         dna&.provas,
        objecoes:       dna&.objecoes,
        evitar:         dna&.evitar,
        publico_alvo_detalhado:  dna&.publico_alvo_detalhado,
        restricoes_regulatorias: dna&.restricoes_regulatorias,
      }.compact_blank
      JSON.pretty_generate(h)
    end

    def product_block
      h = {
        nome:        product.name,
        descricao:   product.description,
        preco:       product.price,
        categorias:  product.categories,
        sku:         product.sku,
        rating:      product.rating_avg,
        avaliacoes:  product.reviews_count,
        ficha:       product.profile,
      }.compact_blank
      JSON.pretty_generate(h)
    end

    def campaign_block
      h = {
        nome:      campaign.name,
        objetivo:  campaign.objective,
        publico:   campaign.audience,
        contexto:  campaign.context,
        inicio:    campaign.starts_at,
        fim:       campaign.ends_at,
      }.compact_blank
      JSON.pretty_generate(h)
    end

    def piece_block
      return "TIPO DE PEÇA: copy livre" unless piece_type

      [
        "TIPO DE PEÇA: #{piece_type.name}",
        piece_type.description.presence && "Descrição: #{piece_type.description}",
        piece_type.structure.presence   && "Estrutura esperada:\n#{piece_type.structure}",
        piece_type.length_hint.presence && "Tamanho alvo: #{piece_type.length_hint}",
      ].compact.join("\n")
    end
  end
end
