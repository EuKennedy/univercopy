class RagChunk < ApplicationRecord
  self.table_name = "rag_chunks"

  belongs_to :rag_document
  belongs_to :workspace

  validates :content, presence: true
  validates :idx, presence: true, numericality: { only_integer: true, greater_than_or_equal_to: 0 }

  # Coluna embedding (vector) é manipulada via neighbor gem na Fase 5.
  # Por agora, persiste NULL até o embedder rodar (Rag::Embedder).
end
