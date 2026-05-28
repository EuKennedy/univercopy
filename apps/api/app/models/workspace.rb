class Workspace < ApplicationRecord
  self.table_name = "workspaces"

  belongs_to :owner, class_name: "AppUser", foreign_key: :owner_id

  has_many :workspace_members, dependent: :destroy
  has_many :members, through: :workspace_members, source: :app_user
  has_many :brand_dnas, dependent: :destroy
  has_many :copies, dependent: :destroy
  has_many :campaigns, dependent: :destroy
  has_many :products, dependent: :destroy
  has_many :categories, dependent: :destroy
  has_many :reference_items, dependent: :destroy
  has_many :page_audits, dependent: :destroy
  has_many :generations, dependent: :destroy
  has_many :integrations, dependent: :destroy
  has_many :intelligence_records, dependent: :destroy
  has_many :ai_jobs, dependent: :destroy
  has_many :audit_logs, dependent: :destroy
  has_many :workspace_api_keys, dependent: :destroy
  has_many :seo_playbooks, dependent: :destroy
  has_many :rag_documents, dependent: :destroy
  has_many :rag_chunks, dependent: :destroy

  enum :plan, %w[entry medium ultra].index_with(&:itself)
  enum :status, %w[active suspended deleted].index_with(&:itself), prefix: :status
  enum :onboarding_status, %w[pending dna_loaded qa_done done].index_with(&:itself), prefix: :onboarding

  validates :slug, presence: true, uniqueness: true, format: { with: /\A[a-z0-9-]+\z/ }
  validates :name, presence: true
  validates :default_locale, inclusion: { in: %w[pt-BR en-US es-AR] }

  # DNA "em uso" pelo gerador (atual ou proposto). Padrão = atual.
  def dna_in_use
    (settings || {}).fetch("dna_in_use", "atual")
  end

  def active_brand_dna
    brand_dnas.find_by(kind: dna_in_use)
  end
end
