class Product < ApplicationRecord
  self.table_name = "products"

  belongs_to :workspace

  has_many :copies, dependent: :nullify

  SOURCES = %w[woocommerce shopify nuvemshop tray csv site manual].freeze

  validates :name, presence: true
  validates :source, inclusion: { in: SOURCES }
end
