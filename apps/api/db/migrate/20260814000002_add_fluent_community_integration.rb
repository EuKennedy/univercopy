# Fluent Community como conector próprio, separado do WordPress.
#
# São dois WordPress diferentes na prática: o blog mora num site e a comunidade
# em outro (na Lizzon, o blog é lizzon.com.br e o Fluent Community está em
# univerhair.com.br). Reusar a integração `wordpress` obrigaria a escolher um
# dos dois — por isso base_url e credencial próprias.
#
# disable_ddl_transaction! é obrigatório: o Postgres não deixa usar um valor
# recém-adicionado ao enum na mesma transação que o adicionou.
class AddFluentCommunityIntegration < ActiveRecord::Migration[8.1]
  disable_ddl_transaction!

  def up
    execute "ALTER TYPE integration_type ADD VALUE IF NOT EXISTS 'fluent_community';"

    # Rastro da publicação na comunidade no próprio post. Sem isso, a tela não
    # tem como saber que aquele post já foi compartilhado e ofereceria o botão
    # de novo, gerando post duplicado no feed.
    change_table :blog_posts, bulk: true do |t|
      t.bigint   :community_post_id
      t.string   :community_url
      t.string   :community_space          # slug do space onde saiu
      t.text     :community_message        # o resumo que foi publicado
      t.datetime :community_published_at
    end

    add_index :blog_posts, [:workspace_id, :community_post_id],
              unique: true, where: "community_post_id IS NOT NULL",
              name: "idx_blog_posts_uniq_community"
  end

  def down
    remove_index :blog_posts, name: "idx_blog_posts_uniq_community"
    change_table :blog_posts, bulk: true do |t|
      t.remove :community_post_id, :community_url, :community_space,
               :community_message, :community_published_at
    end
    # O valor do enum fica: Postgres não suporta remover valor de enum.
  end
end
