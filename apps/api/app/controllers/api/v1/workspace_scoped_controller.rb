module Api
  module V1
    # Base pra controllers que operam dentro de UM workspace.
    # Resolve workspace pelo :workspace_slug e wrap todas queries em
    # with_workspace_rls(workspace.id, user_id). Sem isso RLS Forçada
    # filtra tudo (não vê nada).
    class WorkspaceScopedController < BaseController
      around_action :scope_to_workspace!

      private

      def current_workspace
        @current_workspace ||= current_app_user.workspaces.find_by!(slug: params.require(:workspace_slug))
      end

      def scope_to_workspace!
        ApplicationRecord.with_workspace_rls(
          current_workspace.id,
          user_id: current_app_user.id
        ) { yield }
      end
    end
  end
end
