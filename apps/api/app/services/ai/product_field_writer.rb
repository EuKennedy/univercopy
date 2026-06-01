# Gera o conteúdo de UM campo do produto com IA, respeitando o DNA da marca
# e os dados do produto. Usado pelo botão "Gerar com IA" do editor de produto.
#
# Campos de texto devolvem string. `faq` devolve array de {title, content}.
# `tags`/`bullets` devolvem array de strings.

module Ai
  class ProductFieldWriter
    # field => [instrução, kind]
    FIELDS = {
      "name"              => ["um título de produto curto, claro e vendedor (máx 70 caracteres)", :text],
      "description_html"  => ["a descrição longa e persuasiva do produto em HTML simples (parágrafos <p>, listas <ul><li> quando fizer sentido)", :html],
      "short_description_html" => ["a descrição curta do produto em bullet points HTML (<ul><li>...</li></ul>), 3 a 5 itens de benefício", :html],
      "additional_info"   => ["informações técnicas/adicionais do produto em pares atributo: valor, uma por linha", :text],
      "about_title"       => ["uma frase de impacto para o bloco 'Sobre o Produto' (máx 90 caracteres)", :text],
      "about_description" => ["o parágrafo do bloco 'Sobre o Produto' em HTML simples (1-2 parágrafos)", :html],
      "tags"              => ["de 4 a 8 tags curtas de busca para o produto", :list],
      "faq"              => ["de 4 a 6 perguntas e respostas (FAQ) reais sobre o produto", :faq],
    }.freeze

    def self.call(**kwargs)
      new(**kwargs).call
    end

    def initialize(workspace:, product:, field:, instruction: nil, model: :auto)
      @workspace   = workspace
      @product     = product
      @field       = field.to_s
      @instruction = instruction.to_s
      @model       = (model.presence || :auto).to_sym
    end

    def call
      spec = FIELDS[@field]
      raise Ai::CallFailed, "campo não suportado: #{@field}" unless spec

      what, kind = spec
      result = Ai::AnthropicClient.call(
        prompt:      user_prompt(what, kind),
        system:      system_prompt,
        model:       @model,
        task:        :generate_copy,
        max_tokens:  1800,
        temperature: 0.75,
      )

      { field: @field, kind: kind, value: parse(result.text, kind), ai_result: result }
    end

    private

    def system_prompt
      <<~TXT.strip
        Você é copywriter de e-commerce sênior escrevendo em #{locale_label}. Respeite
        RIGOROSAMENTE o DNA da marca. Nunca invente fatos, números ou garantias que não
        estejam no contexto. Seja específico e persuasivo, sem clichê.
      TXT
    end

    def user_prompt(what, kind)
      sections = []
      sections << "DNA DA MARCA:\n#{dna_block}"
      sections << "PRODUTO:\n#{product_block}"
      sections << "Direção do usuário: #{@instruction}" if @instruction.present?
      sections << output_instruction(what, kind)
      sections.join("\n\n")
    end

    def output_instruction(what, kind)
      case kind
      when :faq
        %(Gere #{what}. Responda APENAS com JSON válido: {"faq":[{"title":"pergunta","content":"resposta"}]})
      when :list
        %(Gere #{what}. Responda APENAS com JSON válido: {"items":["..."]})
      when :html
        "Gere #{what}. Responda APENAS com o HTML, sem markdown, sem ```."
      else
        "Gere #{what}. Responda APENAS com o texto puro, sem aspas, sem markdown."
      end
    end

    def parse(text, kind)
      case kind
      when :faq
        raw = Ai::JsonExtractor.parse(text)
        Array(raw.is_a?(Hash) ? (raw["faq"] || raw[:faq]) : raw).filter_map do |f|
          next unless f.is_a?(Hash)

          { "title" => f["title"].to_s.strip, "content" => f["content"].to_s.strip }
        end
      when :list
        raw = Ai::JsonExtractor.parse(text)
        Array(raw.is_a?(Hash) ? (raw["items"] || raw[:items]) : raw).map { |i| i.to_s.strip }.reject(&:empty?)
      else
        text.to_s.strip
      end
    rescue ArgumentError, JSON::ParserError
      kind == :text || kind == :html ? text.to_s.strip : []
    end

    def dna_block
      d = @workspace.active_brand_dna
      return "(sem DNA)" unless d

      {
        marca: d.marca, posicionamento: d.posicionamento, tom: d.tom,
        publico: d.publico, evitar: d.evitar,
      }.compact_blank.map { |k, v| "#{k}: #{v.is_a?(Array) ? v.join(', ') : v}" }.join("\n")
    end

    def product_block
      m = @product.metadata || {}
      {
        nome:       @product.name,
        preco:      @product.price,
        categorias: @product.categories,
        descricao:  @product.description,
        sobre:      m.dig("about", "title"),
      }.compact_blank.map { |k, v| "#{k}: #{v.is_a?(Array) ? v.join(', ') : v}" }.join("\n")
    end

    def locale_label
      { "pt-BR" => "Português do Brasil", "en-US" => "Inglês", "es-AR" => "Espanhol" }
        .fetch(@workspace.default_locale, "Português do Brasil")
    end
  end
end
