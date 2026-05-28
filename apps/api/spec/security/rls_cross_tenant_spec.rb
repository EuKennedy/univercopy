require "rails_helper"

# Prova material que workspace A NÃO acessa dados de workspace B mesmo se
# o atacante conhecer o id de B. RLS é FORÇADO no Postgres — não confiamos
# em filtros de ActiveRecord.
#
# O spec usa o role `rls_test_role` (NOSUPERUSER, NOBYPASSRLS) — o superuser
# do test db pula RLS, então rodando como ele a prova é vazia.
RSpec.describe "RLS cross-tenant isolation", type: :rls do
  let!(:user_a)      { create(:app_user) }
  let!(:user_b)      { create(:app_user) }
  let!(:workspace_a) { create(:workspace, owner: user_a, name: "Workspace A") }
  let!(:workspace_b) { create(:workspace, owner: user_b, name: "Workspace B") }

  def set_app_user(uid)
    ActiveRecord::Base.connection.execute(
      ActiveRecord::Base.sanitize_sql(["SET LOCAL app.user_id = ?", uid.to_s])
    )
  end

  it "membro de A NÃO enxerga workspaces de B" do
    ActiveRecord::Base.transaction do
      ActiveRecord::Base.connection.execute("SET LOCAL ROLE rls_test_role")
      set_app_user(user_a.id)

      visible = Workspace.pluck(:id)
      expect(visible).to include(workspace_a.id)
      expect(visible).not_to include(workspace_b.id),
        "vazamento entre tenants — A vê B (visible=#{visible.inspect})"
    end
  end

  it "membro de B NÃO enxerga brand_dnas de A" do
    ActiveRecord::Base.transaction do
      ActiveRecord::Base.connection.execute("SET LOCAL ROLE rls_test_role")
      set_app_user(user_b.id)

      dnas = BrandDna.where(workspace_id: workspace_a.id).pluck(:id)
      expect(dnas).to be_empty,
        "RLS furada: B leu brand_dnas de A (#{dnas.inspect})"
    end
  end

  it "membro de A NÃO consegue INSERIR brand_dna em B (WITH CHECK)" do
    ActiveRecord::Base.transaction do
      ActiveRecord::Base.connection.execute("SET LOCAL ROLE rls_test_role")
      set_app_user(user_a.id)

      expect {
        ActiveRecord::Base.connection.execute(
          ActiveRecord::Base.sanitize_sql([
            "INSERT INTO brand_dnas(workspace_id, kind, marca) VALUES (?, 'atual', 'spoof')",
            workspace_b.id
          ])
        )
      }.to raise_error(ActiveRecord::StatementInvalid, /row.*security|row violates|violates row-level/i)
    end
  end

  it "sem app.user_id setado, NADA é visível" do
    ActiveRecord::Base.transaction do
      ActiveRecord::Base.connection.execute("SET LOCAL ROLE rls_test_role")
      # NÃO seta app.user_id

      expect(Workspace.count).to eq(0)
      expect(BrandDna.count).to eq(0)
    end
  end
end
