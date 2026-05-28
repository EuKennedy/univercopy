class Style < ApplicationRecord
  self.table_name = "styles"
  self.primary_key = "key"

  has_many :piece_types, foreign_key: :default_style, primary_key: :key
end
