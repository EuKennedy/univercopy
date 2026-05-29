class AuditLog < ApplicationRecord
  self.table_name = "audit_logs"

  belongs_to :workspace
  belongs_to :user, class_name: "AppUser", foreign_key: :user_id, optional: true

  validates :action, presence: true
end
