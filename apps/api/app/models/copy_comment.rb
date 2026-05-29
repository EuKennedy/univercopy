class CopyComment < ApplicationRecord
  self.table_name = "copy_comments"

  belongs_to :copy
  belongs_to :version, class_name: "CopyVersion", foreign_key: :version_id, optional: true
  belongs_to :author,  class_name: "AppUser",     foreign_key: :author_id,  optional: true

  validates :text, presence: true
end
