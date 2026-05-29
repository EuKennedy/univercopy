# Orquestra a geração de copy (Fase 5). Resolve bibliotecas (estilo,
# framework, tipo de peça), DNA em uso, produto/campanha opcionais; monta
# prompt via PromptBuilder; chama AnthropicClient (task :generate_copy);
# parseia N variações. NÃO persiste — devolve variações pro usuário escolher
# e salvar como Copy depois. NÃO checa plano/cap (controller faz isso antes).
#
# Roda dentro do RLS scope do workspace (controller garante).

module Ai
  class CopyGenerator
    MAX_TOKENS = 3000

    Result = Struct.new(:variations, :ai_result, :resolved, keyword_init: true)

    def self.call(**kwargs)
      new(**kwargs).call
    end

    def initialize(workspace:, piece_type_key:, style_key: nil, framework_key: nil, product_id: nil, campaign_id: nil, brief: nil, n: 2, model: :auto)
      @workspace      = workspace
      @piece_type_key = piece_type_key
      @style_key      = style_key
      @framework_key  = framework_key
      @product_id     = product_id
      @campaign_id    = campaign_id
      @brief          = brief
      @n              = n
      @model          = (model.presence || :auto).to_sym
    end

    def call
      piece_type = @piece_type_key.present? ? PieceType.find_by(key: @piece_type_key) : nil
      style      = resolve(Style,     @style_key,     piece_type&.default_style)
      framework  = resolve(Framework, @framework_key, piece_type&.default_framework)
      product    = @product_id.present?  ? @workspace.products.find_by(id: @product_id)   : nil
      campaign   = @campaign_id.present? ? @workspace.campaigns.find_by(id: @campaign_id) : nil
      dna        = @workspace.active_brand_dna

      prompt = Ai::PromptBuilder.call(
        workspace:  @workspace,
        dna:        dna,
        piece_type: piece_type,
        style:      style,
        framework:  framework,
        product:    product,
        campaign:   campaign,
        brief:      @brief,
        n:          @n,
        locale:     @workspace.default_locale,
      )

      ai = Ai::AnthropicClient.call(
        prompt:      prompt[:user],
        system:      prompt[:system],
        model:       @model,
        task:        :generate_copy,
        max_tokens:  MAX_TOKENS,
        temperature: 0.8,
      )

      Result.new(
        variations: parse_variations(ai.text),
        ai_result:  ai,
        resolved: {
          piece_type_key: piece_type&.key,
          style_key:      style&.key,
          framework_key:  framework&.key,
          category_key:   piece_type&.category_key,
          product_id:     product&.id,
          campaign_id:    campaign&.id,
        },
      )
    end

    private

    def resolve(klass, explicit_key, fallback_key)
      key = explicit_key.presence || fallback_key.presence
      key && klass.find_by(key: key)
    end

    def parse_variations(text)
      parsed = Ai::JsonExtractor.parse(text)
      raw = parsed.is_a?(Hash) ? (parsed["variations"] || parsed[:variations]) : parsed
      Array(raw).filter_map do |v|
        next unless v.is_a?(Hash)

        content = (v["content"] || v[:content]).to_s.strip
        next if content.empty?

        {
          title:   (v["title"]  || v[:title]).to_s.strip.presence || "Variação",
          angle:   (v["angle"]  || v[:angle]).to_s.strip,
          content: content,
        }
      end
    end
  end
end
