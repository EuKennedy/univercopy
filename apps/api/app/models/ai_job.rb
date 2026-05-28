class AiJob < ApplicationRecord
  self.table_name = "ai_jobs"

  belongs_to :workspace

  enum :status, %w[queued running done error cap_reached].index_with(&:itself), prefix: :status
end
