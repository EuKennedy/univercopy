class Category < ApplicationRecord
  self.table_name = "categories"

  belongs_to :workspace, optional: true  # NULL = global

  scope :global, -> { where(workspace_id: nil) }
  scope :for_workspace, ->(ws_id) { where(workspace_id: [nil, ws_id]) }
end
