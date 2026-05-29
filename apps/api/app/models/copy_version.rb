class CopyVersion < ApplicationRecord
  self.table_name = "copy_versions"

  belongs_to :copy
  belongs_to :author, class_name: "AppUser", foreign_key: :author_id, optional: true

  validates :n, presence: true, uniqueness: { scope: :copy_id }
  validates :content, presence: true
end
