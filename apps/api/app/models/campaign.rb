class Campaign < ApplicationRecord
  self.table_name = "campaigns"

  belongs_to :workspace
  belongs_to :creator, class_name: "AppUser", foreign_key: :created_by, optional: true

  has_many :copies, dependent: :nullify

  enum :status,
       %w[planejada ativa concluida arquivada].index_with(&:itself),
       prefix: :status

  validates :name, presence: true
end
