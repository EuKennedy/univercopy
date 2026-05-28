class AppUser < ApplicationRecord
  self.table_name = "app_users"

  has_many :workspace_memberships, class_name: "WorkspaceMember", foreign_key: :user_id, dependent: :destroy
  has_many :workspaces, through: :workspace_memberships
  has_many :owned_workspaces, class_name: "Workspace", foreign_key: :owner_id

  enum :preferred_ai_model, %w[auto haiku sonnet opus].index_with(&:itself), prefix: :ai_model

  validates :email, presence: true, uniqueness: { case_sensitive: false }
  validates :default_locale, inclusion: { in: %w[pt-BR en-US es-AR] }
end
