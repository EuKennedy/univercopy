class ApplicationRecord < ActiveRecord::Base
  primary_abstract_class

  # Tenant scoping via PostgreSQL RLS. SEMPRE abra transação + SET LOCAL
  # antes de qualquer query workspace-scoped. SET LOCAL só persiste dentro
  # da transação aberta — loops de save! (transação implícita) NÃO veem o
  # setting. Sempre wrap.
  #
  # Exemplo em controller:
  #   ApplicationRecord.with_workspace_rls(current_workspace.id) do
  #     Copy.where(status: :rascunho).find_each { |c| ... }
  #   end
  def self.with_workspace_rls(workspace_id, user_id: nil)
    raise ArgumentError, "workspace_id required" if workspace_id.blank?

    transaction do
      connection.execute(
        sanitize_sql(["SET LOCAL app.workspace_id = ?", workspace_id.to_s])
      )
      if user_id.present?
        connection.execute(
          sanitize_sql(["SET LOCAL app.user_id = ?", user_id.to_s])
        )
      end
      yield
    end
  end

  # Versão só com user_id (sem workspace) — usado em hooks de auth global
  # como Better Auth user.create.after, que precisa de lookup cross-tenant.
  # Requer role com BYPASSRLS ou usar SECURITY DEFINER function.
  def self.with_user(user_id)
    raise ArgumentError, "user_id required" if user_id.blank?

    transaction do
      connection.execute(
        sanitize_sql(["SET LOCAL app.user_id = ?", user_id.to_s])
      )
      yield
    end
  end
end
