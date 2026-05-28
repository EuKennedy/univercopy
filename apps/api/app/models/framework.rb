class Framework < ApplicationRecord
  self.table_name = "frameworks"
  self.primary_key = "key"

  has_many :piece_types, foreign_key: :default_framework, primary_key: :key
end
