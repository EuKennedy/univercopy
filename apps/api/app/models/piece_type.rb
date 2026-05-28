class PieceType < ApplicationRecord
  self.table_name = "piece_types"
  self.primary_key = "key"

  belongs_to :framework, foreign_key: :default_framework, primary_key: :key, optional: true
  belongs_to :style,     foreign_key: :default_style,     primary_key: :key, optional: true
end
