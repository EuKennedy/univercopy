# Gera uma SEQUÊNCIA (cadência ordenada) de copy para um canal de uma campanha.
# Diferente do CopyGenerator (N variações da mesma peça), aqui são N passos
# distintos que se complementam (ex: e-mail 1, 2, 3 de uma sequência).
# NÃO persiste — devolve os passos pro controller salvar como Copies ordenadas.
#
# Roda dentro do RLS scope do workspace (controller garante).
module Ai
  class SequenceGenerator
    MAX_TOKENS = 4000

    Result = Struct.new(:steps, :ai_result, :resolved, keyword_init: true)

    def self.call(**kwargs)
      new(**kwargs).call
    end

    def initialize(workspace:, campaign:, channel:, piece_type_key: nil, style_key: nil, framework_key: nil, product_id: nil, brief: nil, steps: 3, model: :auto)
      @workspace      = workspace
      @campaign       = campaign
      @channel        = channel.to_s
      @piece_type_key = piece_type_key
      @style_key      = style_key
      @framework_key  = framework_key
      @product_id     = product_id
      @brief          = brief
      @steps          = steps.to_i.clamp(1, 10)
      @model          = (model.presence || :auto).to_sym
    end

    def call
      piece_type = @piece_type_key.present? ? PieceType.find_by(key: @piece_type_key) : nil
      style      = resolve(Style,     @style_key,     piece_type&.default_style)
      framework  = resolve(Framework, @framework_key, piece_type&.default_framework)
      product    = @product_id.present? ? @workspace.products.find_by(id: @product_id) : nil
      dna        = @workspace.active_brand_dna

      prompt = Ai::PromptBuilder.call(
        workspace:  @workspace,
        dna:        dna,
        piece_type: piece_type,
        style:      style,
        framework:  framework,
        product:    product,
        campaign:   @campaign,
        brief:      @brief,
        n:          @steps,
        locale:     @workspace.default_locale,
        mode:       :sequence,
        channel:    @channel,
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
        steps:     parse_steps(ai.text),
        ai_result: ai,
        resolved: {
          channel:        @channel,
          piece_type_key: piece_type&.key,
          style_key:      style&.key,
          framework_key:  framework&.key,
          category_key:   piece_type&.category_key,
          product_id:     product&.id,
          campaign_id:    @campaign.id,
        },
      )
    end

    private

    def resolve(klass, explicit_key, fallback_key)
      key = explicit_key.presence || fallback_key.presence
      key && klass.find_by(key: key)
    end

    # Mesma tolerância do CopyGenerator: JSON {variations:[...]} ou prosa.
    def parse_steps(text)
      return [] if text.to_s.strip.empty?

      begin
        parsed = Ai::JsonExtractor.parse(text)
      rescue ArgumentError, JSON::ParserError
        return [{ title: "Passo 1", angle: "", content: text.to_s.strip }]
      end

      raw = parsed.is_a?(Hash) ? (parsed["variations"] || parsed[:variations] || parsed["steps"] || parsed[:steps]) : parsed
      steps = Array(raw).filter_map do |v|
        next unless v.is_a?(Hash)

        content = (v["content"] || v[:content]).to_s.strip
        next if content.empty?

        {
          title:   (v["title"] || v[:title]).to_s.strip.presence || "Passo",
          angle:   (v["angle"] || v[:angle]).to_s.strip,
          content: content,
        }
      end

      steps.presence || [{ title: "Passo 1", angle: "", content: text.to_s.strip }]
    end
  end
end
