# Wrapper fino sobre o SDK oficial Anthropic. Centraliza:
#   - escolha de modelo (haiku|sonnet|opus|auto)
#   - logging estruturado de tokens + custo estimado
#   - retry policy (1 retry em 529/overloaded; nenhum em 4xx)
#   - timeout absoluto via configuração do SDK
#
# Faraday/retry NÃO usado aqui — o SDK já tem retry built-in. Mantemos
# uma camada só.

require "anthropic"

module Ai
  # CallFailed / CapReached vivem em arquivos próprios (Zeitwerk strict).
  class AnthropicClient
    # ID exato dos modelos. Atualizar quando Anthropic publicar nova versão
    # major do Sonnet/Opus.
    MODEL_IDS = {
      haiku:  "claude-haiku-4-5-20251001",
      sonnet: "claude-sonnet-4-6",
      opus:   "claude-opus-4-7",
    }.freeze

    # Custo USD por 1M tokens (input, output). Mantido aqui pra rastreamento;
    # pricing real vem do dashboard Anthropic.
    COST_USD_PER_M = {
      haiku:  { in: 1.0,  out: 5.0 },
      sonnet: { in: 3.0,  out: 15.0 },
      opus:   { in: 15.0, out: 75.0 },
    }.freeze

    DEFAULT_MAX_TOKENS = 2048

    Result = Struct.new(
      :text, :model, :input_tokens, :output_tokens, :cost_usd, :stop_reason,
      keyword_init: true,
    )

    def self.call(prompt:, model: :auto, task: :generic, max_tokens: DEFAULT_MAX_TOKENS, system: nil, temperature: 0.7)
      new.call(prompt:, model:, task:, max_tokens:, system:, temperature:)
    end

    def call(prompt:, model:, task:, max_tokens:, system:, temperature:)
      chosen = resolve_model(model, task)
      params = {
        model:       MODEL_IDS.fetch(chosen),
        max_tokens:  max_tokens,
        messages:    [{ role: "user", content: prompt }],
        temperature: temperature,
      }
      # API Anthropic exige `system` como array de content blocks (não string).
      #
      # O contexto temporal entra em TODA chamada, com ou sem system próprio.
      # Sem ele o modelo responde a partir do corte de treino e escreve como se
      # fosse outro ano — vira "tendências de 2025" em post publicado hoje.
      params[:system] = [{ type: "text", text: [temporal_preamble, system.presence].compact.join("\n\n") }]

      response = anthropic.messages.create(**params)

      # `type` pode vir como Symbol (:text) ou String ("text") conforme versão
      # do SDK — normaliza pra string antes de comparar.
      text = response.content.filter_map { |c| c.text if c.type.to_s == "text" }.join("\n").strip
      usage = response.usage
      cost  = cost_for(chosen, usage.input_tokens, usage.output_tokens)

      Rails.logger.info({
        ai: "ok", model: chosen, task: task,
        input_tokens: usage.input_tokens, output_tokens: usage.output_tokens,
        cost_usd: cost,
      }.to_json)

      Result.new(
        text:           text,
        model:          chosen,
        input_tokens:   usage.input_tokens,
        output_tokens:  usage.output_tokens,
        cost_usd:       cost,
        stop_reason:    response.stop_reason,
      )
    rescue Anthropic::Errors::APIError => e
      Rails.logger.error({ ai: "fail", model: chosen, task: task, error: e.class.name, message: e.message }.to_json)
      raise CallFailed, e.message
    end

    private

    # Data real de hoje, injetada em todo prompt. Em UTC porque é o fuso da
    # aplicação (config.time_zone) — dizemos qual é para o modelo não supor.
    #
    # A última frase importa tanto quanto a data: saber que ano é hoje não faz
    # o modelo conhecer o que aconteceu depois do treino dele. Sem esse freio,
    # informar a data só troca "acha que é 2023" por "inventa fato de 2026".
    def temporal_preamble
      now = Time.current.utc
      <<~TXT.strip
        CONTEXTO TEMPORAL — hoje é #{now.strftime('%d/%m/%Y')} (ISO #{now.strftime('%Y-%m-%d')}, UTC). O ano corrente é #{now.year}.
        Trate esta como a data real e ignore qualquer data que você suponha a partir do seu treinamento.
        "Hoje" = #{now.strftime('%d/%m/%Y')}. "Este ano" = #{now.year}. "Ano passado" = #{now.year - 1}. "Ano que vem" = #{now.year + 1}.
        Saber a data NÃO significa conhecer o que aconteceu recentemente: se algo depender de fato posterior ao seu conhecimento, diga que não sabe em vez de inventar.
      TXT
    end

    def anthropic
      @anthropic ||= ::Anthropic::Client.new(api_key: ENV.fetch("ANTHROPIC_API_KEY"))
    end

    # Auto Router — escolhe modelo por tipo de task. Pode ser sobreposto
    # explicitamente. Espelha @univer/shared/ai-models.ts:AiTaskKind.
    AUTO_BY_TASK = {
      bulk_generate:        :haiku,
      import_from_url:      :haiku,
      extract_dna_from_url: :haiku,
      rag_embed:            :haiku,
      generate_copy:        :sonnet,
      dna_improve:          :sonnet,
      product_profile:      :sonnet,
      name_generator:       :sonnet,
      seo_describe:         :sonnet,
      seo_review:           :sonnet,
      page_audit:           :sonnet,
      intelligence_ingest:  :sonnet,
      intelligence_compare: :opus,
    }.freeze

    def resolve_model(choice, task)
      return choice if MODEL_IDS.key?(choice.to_sym) && choice.to_sym != :auto
      AUTO_BY_TASK[task.to_sym] || :sonnet
    end

    def cost_for(model, in_tokens, out_tokens)
      rates = COST_USD_PER_M[model]
      return nil unless rates
      ((in_tokens * rates[:in]) + (out_tokens * rates[:out])) / 1_000_000.0
    end
  end
end
