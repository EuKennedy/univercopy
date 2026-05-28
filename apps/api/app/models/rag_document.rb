class RagDocument < ApplicationRecord
  self.table_name = "rag_documents"

  belongs_to :workspace
  has_many :rag_chunks, dependent: :destroy

  enum :source_kind, {
    site: "site",
    onboarding_qna: "onboarding_qna",
    woo_product: "woo_product",
    csv_upload: "csv_upload",
    manual_note: "manual_note",
    campaign_context: "campaign_context",
    brand_dna: "brand_dna",
  }

  enum :status, %w[pending chunked embedded failed].index_with(&:itself), prefix: :status

  validates :full_text, presence: true
end
