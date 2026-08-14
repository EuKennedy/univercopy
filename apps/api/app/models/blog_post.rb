class BlogPost < ApplicationRecord
  self.table_name = "blog_posts"

  belongs_to :workspace

  ORIGINS  = %w[univercopy wordpress].freeze
  STATUSES = %w[draft published].freeze
  # Estados que o WordPress usa. `future` é post agendado.
  WP_STATUSES = %w[publish draft pending private future].freeze

  validates :title, presence: true
  validates :origin, inclusion: { in: ORIGINS }
  validates :status, inclusion: { in: STATUSES }
  validates :wp_status, inclusion: { in: WP_STATUSES }, allow_blank: true

  scope :univercopy, -> { where(origin: "univercopy") }
  scope :from_wordpress, -> { where(origin: "wordpress") }
  scope :drafts, -> { where(status: "draft") }
  scope :recent, -> { order(updated_at: :desc) }

  # Só o que nasceu aqui e ainda não foi pro WordPress pode ser editado ou
  # publicado pela tela. Post sincronizado já é do WordPress — quem manda nele
  # é o WordPress, e não temos update_post no conector pra sobrescrever.
  def editable?
    origin == "univercopy" && status == "draft"
  end

  # Marca como publicado a partir do retorno do conector.
  def mark_published!(wp_result)
    update!(
      status:         "published",
      wp_post_id:     wp_result[:id],
      url:            wp_result[:url],
      wp_status:      wp_result[:status],
      published_at:   Time.current,
      last_error:     nil,
    )
  end
end
