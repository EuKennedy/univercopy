class Generation < ApplicationRecord
  self.table_name = "generations"

  belongs_to :workspace
  belongs_to :copy, optional: true
  belongs_to :creator, class_name: "AppUser", foreign_key: :created_by, optional: true

  validates :purpose, presence: true
  validates :model, presence: true
end
