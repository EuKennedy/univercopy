# Preâmbulo com a data real de hoje, injetado no system de TODA chamada de IA,
# em qualquer provedor.
#
# Sem isso o modelo responde a partir do corte de treino dele e escreve como se
# fosse outro ano — é assim que sai "tendências de 2025" num post publicado
# hoje. Como o texto pode rodar no Anthropic ou na OpenAI, o preâmbulo vive
# aqui e não dentro de um cliente específico: um provedor novo não pode nascer
# sem contexto temporal.
#
# A última linha vale tanto quanto a data. Saber que ano é hoje não faz o modelo
# conhecer o que aconteceu depois do treino dele; sem esse freio, informar a
# data só troca "acha que é 2023" por "inventa fato de 2026".
#
# Data em UTC porque é o config.time_zone da aplicação — dito explicitamente
# para o modelo não supor fuso que não temos.

module Ai
  module TemporalContext
    module_function

    def preamble(now = Time.current.utc)
      <<~TXT.strip
        CONTEXTO TEMPORAL — hoje é #{now.strftime('%d/%m/%Y')} (ISO #{now.strftime('%Y-%m-%d')}, UTC). O ano corrente é #{now.year}.
        Trate esta como a data real e ignore qualquer data que você suponha a partir do seu treinamento.
        "Hoje" = #{now.strftime('%d/%m/%Y')}. "Este ano" = #{now.year}. "Ano passado" = #{now.year - 1}. "Ano que vem" = #{now.year + 1}.
        Saber a data NÃO significa conhecer o que aconteceu recentemente: se algo depender de fato posterior ao seu conhecimento, diga que não sabe em vez de inventar.
      TXT
    end

    # System final = preâmbulo temporal + system do chamador (se houver).
    def wrap(system = nil)
      [preamble, system.presence].compact.join("\n\n")
    end
  end
end
