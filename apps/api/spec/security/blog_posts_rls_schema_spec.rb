require "rails_helper"

# O spec de isolamento cross-tenant depende de um role sem BYPASSRLS e está
# skipado (ver rls_cross_tenant_spec). Enquanto isso, esta prova roda: garante
# que a tabela nova nasceu com RLS ligada, FORÇADA e com policy de membership.
#
# Sem isso, `blog_posts` seria a única tabela tenant-scoped sem proteção no
# banco — e ninguém perceberia, porque o filtro da association mascara o furo
# em todo teste de request.
RSpec.describe "blog_posts — RLS no schema", type: :model do
  def pg_class_row
    ActiveRecord::Base.connection.exec_query(<<~SQL).first
      SELECT relrowsecurity, relforcerowsecurity
      FROM pg_class
      WHERE oid = 'public.blog_posts'::regclass
    SQL
  end

  it "tem ROW LEVEL SECURITY habilitada" do
    expect(pg_class_row["relrowsecurity"]).to be_truthy
  end

  it "tem RLS FORÇADA — policy vale até para o dono da tabela" do
    expect(pg_class_row["relforcerowsecurity"]).to be_truthy
  end

  it "tem policy de membership cobrindo leitura e escrita" do
    policies = ActiveRecord::Base.connection.exec_query(<<~SQL).to_a
      SELECT policyname, cmd, qual, with_check
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'blog_posts'
    SQL

    expect(policies.size).to eq(1)
    policy = policies.first

    expect(policy["cmd"]).to eq("ALL")
    expect(policy["qual"]).to include("is_member")
    expect(policy["with_check"]).to include("is_member"),
      "sem WITH CHECK, um tenant conseguiria INSERIR linha no workspace de outro"
  end

  it "tem índice único parcial impedindo o mesmo post do WordPress duas vezes" do
    index = ActiveRecord::Base.connection.indexes(:blog_posts).find { |i| i.name == "idx_blog_posts_uniq_wp" }

    expect(index).to be_present
    expect(index.unique).to be(true)
    expect(index.columns).to eq(%w[workspace_id wp_post_id])
    expect(index.where).to include("wp_post_id IS NOT NULL")
  end

  it "apaga o acervo junto com o workspace — sem post órfão apontando pra tenant morto" do
    fk = ActiveRecord::Base.connection.foreign_keys(:blog_posts).find { |f| f.to_table == "workspaces" }

    expect(fk).to be_present
    expect(fk.on_delete).to eq(:cascade)
  end
end
