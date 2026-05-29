class PageAudit < ApplicationRecord
  self.table_name = "page_audits"

  belongs_to :workspace
  belongs_to :creator, class_name: "AppUser", foreign_key: :created_by, optional: true

  validates :url, presence: true
end
