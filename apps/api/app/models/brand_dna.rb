class BrandDna < ApplicationRecord
  self.table_name = "brand_dnas"

  belongs_to :workspace

  enum :kind, { atual: "atual", proposto: "proposto" }

  validates :kind, presence: true
  validates :workspace_id, uniqueness: { scope: :kind }
end
