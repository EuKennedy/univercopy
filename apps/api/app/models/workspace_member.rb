class WorkspaceMember < ApplicationRecord
  self.table_name = "workspace_members"
  self.primary_keys = [:workspace_id, :user_id] if respond_to?(:primary_keys=)

  belongs_to :workspace
  belongs_to :app_user, foreign_key: :user_id

  enum :role, %w[owner admin editor reviewer viewer].index_with(&:itself), prefix: :role
end
