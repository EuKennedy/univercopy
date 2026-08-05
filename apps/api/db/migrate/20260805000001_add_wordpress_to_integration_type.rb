# Adiciona 'wordpress' ao enum PG integration_type.
#
# disable_ddl_transaction! é obrigatório: o Postgres não permite usar um valor
# recém-adicionado ao enum dentro da mesma transação que o adicionou, e o Rails
# envolve migrations em transação por padrão.
#
# IF NOT EXISTS deixa a migration idempotente — o Coolify roda db:prepare a cada
# deploy e um retry não pode explodir.
class AddWordpressToIntegrationType < ActiveRecord::Migration[8.1]
  disable_ddl_transaction!

  def up
    execute "ALTER TYPE integration_type ADD VALUE IF NOT EXISTS 'wordpress';"
  end

  def down
    # Postgres não remove valor de enum. Reverter exigiria recriar o tipo e
    # reescrever a coluna — destrutivo demais pra um rollback automático.
    raise ActiveRecord::IrreversibleMigration,
          "Postgres não suporta remover valor de enum; reverta recriando integration_type manualmente."
  end
end
