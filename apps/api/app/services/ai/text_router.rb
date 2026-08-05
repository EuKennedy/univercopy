# Decide qual provedor gera texto para um workspace.
#
# Anthropic é o padrão e continua sendo o comportamento de quem não mexeu em
# nada. O workspace passa a usar a OpenAI quando escolhe um modelo de texto no
# card de Integrações — a escolha vive em `integrations.config["text_model"]`,
# cifrada junto com a chave.
#
# Os dois caminhos devolvem struct com os mesmos membros (text, model,
# input_tokens, output_tokens, cost_usd, stop_reason), então BlogWriter e
# BlogAgent não sabem — nem precisam saber — quem respondeu.
#
# O custo cai no mesmo AiCostCap dos dois jeitos: quem chama grava um AiJob com
# o cost_usd que vier daqui. Teto único por workspace, provedor indiferente.

module Ai
  module TextRouter
    module_function

    def call(workspace:, prompt:, system: nil, model: :auto, task: :generic,
             max_tokens: 4_000, temperature: 0.7)
      integration, text_model = openai_text_choice(workspace)

      if integration
        Connectors::OpenAi.new(integration.config).complete(
          prompt:     prompt,
          system:     system,
          model:      text_model,
          max_tokens: max_tokens
        )
      else
        Ai::AnthropicClient.call(
          prompt:      prompt,
          system:      system,
          model:       model,
          task:        task,
          max_tokens:  max_tokens,
          temperature: temperature
        )
      end
    end

    # Nome do provedor em uso — para log e para a tela mostrar sem adivinhar.
    def provider_for(workspace)
      openai_text_choice(workspace).first ? "openai" : "anthropic"
    end

    # Devolve [integration, text_model] quando a OpenAI está configurada E o
    # modelo escolhido é um que a gente reconhece. Modelo desconhecido cai no
    # Anthropic em vez de estourar — a lista pode mudar do lado da OpenAI.
    def openai_text_choice(workspace)
      return [nil, nil] if workspace.blank?

      integration = workspace.integrations.find_by(integration_type: "openai", status: "connected")
      return [nil, nil] if integration.blank?

      text_model = integration.config["text_model"].to_s.strip
      return [nil, nil] unless Connectors::OpenAi::TEXT_MODELS.key?(text_model)

      [integration, text_model]
    end
  end
end
