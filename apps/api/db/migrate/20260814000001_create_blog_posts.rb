class CreateBlogPosts < ActiveRecord::Migration[8.1]
  # Acervo de posts de blog do workspace. Duas origens na mesma tabela:
  #
  #   origin=wordpress  → veio do sync da REST API do site conectado.
  #   origin=univercopy → nasceu aqui (editor ou agente).
  #
  # Dois estados que NÃO são a mesma coisa e por isso não compartilham coluna:
  #   status    = ciclo de vida local  — draft (só aqui) | published (foi pro WP).
  #   wp_status = o que o WordPress diz — publish|draft|pending|private|future.
  # Um post nosso publicado como rascunho no WP fica status=published +
  # wp_status=draft: já saiu daqui, ainda não está no ar.
  def up
    create_table :blog_posts, id: :uuid, default: -> { "gen_random_uuid()" } do |t|
      t.uuid    :workspace_id, null: false
      t.string  :origin, null: false, default: "univercopy"
      t.bigint  :wp_post_id
      t.string  :title, null: false
      t.text    :content
      t.text    :excerpt
      t.string  :slug
      t.string  :status, null: false, default: "draft"
      t.string  :wp_status
      t.string  :url
      t.jsonb   :category_ids, null: false, default: []
      t.jsonb   :tag_ids,      null: false, default: []
      t.bigint  :featured_media_id
      t.string  :featured_media_url
      t.text    :brief            # tema que originou a geração (só origin=univercopy)
      t.uuid    :created_by
      t.uuid    :ai_job_id        # lote do agente que gerou (nullable)
      t.text    :last_error       # falha da última tentativa de publicação
      t.datetime :published_at
      t.datetime :wp_modified_at
      t.datetime :synced_at
      t.timestamps
    end

    add_index :blog_posts, :workspace_id
    add_index :blog_posts, [:workspace_id, :origin]
    add_index :blog_posts, [:workspace_id, :status]
    add_index :blog_posts, [:workspace_id, :updated_at]  # ordenação padrão da lista
    # Parcial: só posts que existem no WP disputam unicidade. Rascunhos locais
    # têm wp_post_id NULL e não colidem entre si.
    add_index :blog_posts, [:workspace_id, :wp_post_id],
              unique: true, where: "wp_post_id IS NOT NULL", name: "idx_blog_posts_uniq_wp"

    add_foreign_key :blog_posts, :workspaces, on_delete: :cascade

    execute "ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;"
    execute "ALTER TABLE blog_posts FORCE ROW LEVEL SECURITY;"
    execute <<~SQL
      CREATE POLICY blog_posts_member_all ON blog_posts
        FOR ALL
        USING (is_member(workspace_id))
        WITH CHECK (is_member(workspace_id));
    SQL
  end

  def down
    execute "DROP POLICY IF EXISTS blog_posts_member_all ON blog_posts;"
    drop_table :blog_posts
  end
end
