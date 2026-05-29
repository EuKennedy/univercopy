class IntelligenceRecord < ApplicationRecord
  self.table_name = "intelligence_records"

  belongs_to :workspace
  belongs_to :creator, class_name: "AppUser", foreign_key: :created_by, optional: true

  validates :url, presence: true
end
