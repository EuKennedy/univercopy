class Integration < ApplicationRecord
  self.table_name = "integrations"

  belongs_to :workspace

  # Coluna enum PG `integration_type` mapeada para o atributo `integration_type`.
  enum :integration_type,
       %w[woocommerce shopify nuvemshop tray csv_manual].index_with(&:itself),
       prefix: :type

  enum :status,
       %w[connected disconnected error].index_with(&:itself),
       prefix: :status

  validates :integration_type, presence: true
  validates :workspace_id, uniqueness: { scope: :integration_type }

  # Credenciais cifradas em repouso via MessageEncryptor. Chave derivada de
  # TENANT_CREDENTIALS_KEY. Nunca persistir config em claro.
  def config=(hash)
    self.config_encrypted = self.class.encryptor.encrypt_and_sign(hash.to_json)
  end

  def config
    return {} if config_encrypted.blank?

    JSON.parse(self.class.encryptor.decrypt_and_verify(config_encrypted))
  rescue ActiveSupport::MessageEncryptor::InvalidMessage, JSON::ParserError
    {}
  end

  def self.encryptor
    @encryptor ||= begin
      secret = ENV.fetch("TENANT_CREDENTIALS_KEY")
      key    = ActiveSupport::KeyGenerator.new(secret).generate_key("tenant-credentials", 32)
      ActiveSupport::MessageEncryptor.new(key)
    end
  end
end
