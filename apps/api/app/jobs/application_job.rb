# Padrão de jobs: deserialization-error é descartável (job órfão); outros
# erros têm retry exponencial com polynomial backoff até 3 tentativas.
# Subclasses sobrepoem queue_as e adicionam regras específicas.

class ApplicationJob < ActiveJob::Base
  discard_on ActiveJob::DeserializationError
  retry_on StandardError, wait: :polynomially_longer, attempts: 3

  # Helper canônico — sempre wrappa em transação + SET LOCAL.
  # Disponível como instance method porque `perform` é instance method.
  def with_workspace_rls(workspace_id, user_id: nil, &block)
    ApplicationRecord.with_workspace_rls(workspace_id, user_id: user_id, &block)
  end
end
