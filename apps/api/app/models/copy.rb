class Copy < ApplicationRecord
  self.table_name = "copies"

  belongs_to :workspace
  belongs_to :product,  optional: true
  belongs_to :campaign, optional: true
  belongs_to :creator, class_name: "AppUser", foreign_key: :created_by, optional: true

  has_many :copy_versions, dependent: :destroy
  has_many :copy_comments, dependent: :destroy

  enum :status,
       %w[rascunho revisao aprovado publicado arquivado].index_with(&:itself),
       prefix: :status

  validates :title, presence: true

  # Versão marcada is_current — fonte de verdade do conteúdo exibido.
  def current_version
    copy_versions.find_by(is_current: true)
  end
end
