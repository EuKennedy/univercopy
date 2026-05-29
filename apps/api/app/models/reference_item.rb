class ReferenceItem < ApplicationRecord
  self.table_name = "reference_items"

  belongs_to :workspace

  validates :title, presence: true
end
