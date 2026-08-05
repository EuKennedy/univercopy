# Adiciona 'openai' ao enum PG integration_type.
#
# A chave da OpenAI é credencial por workspace (cadastrada no painel, em
# Configurações → Integrações) e não variável de ambiente — mesmo caminho
# cifrado das outras integrações.
#
# disable_ddl_transaction! é obrigatório: o Postgres não deixa usar um valor
# recém-adicionado ao enum na mesma transação que o adicionou.
class AddOpenaiToIntegrationType < ActiveRecord::Migration[8.1]
  disable_ddl_transaction!

  def up
    execute "ALTER TYPE integration_type ADD VALUE IF NOT EXISTS 'openai';"
  end

  def down
    raise ActiveRecord::IrreversibleMigration,
          "Postgres não suporta remover valor de enum; reverta recriando integration_type manualmente."
  end
end
