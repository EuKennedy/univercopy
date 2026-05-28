# Sentry com PII scrub recursivo. Refinado na Fase 9 (patterns CPF/CNPJ/email/cards).
# Em dev: DSN vazio = Sentry desabilitado silenciosamente.

return if ENV["SENTRY_DSN"].blank?

SENSITIVE_KEYS = %w[
  password password_confirmation token api_key secret access_token refresh_token
  authorization cookie email cpf cnpj rg passport credit_card card_number cvv
  consumer_key consumer_secret webhook_secret stripe_signature
  woo_key woo_secret shopify_token nuvemshop_token tray_token
].freeze

PII_PATTERNS = [
  /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/,        # CPF
  /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/, # CNPJ
  /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/,         # email
  /\b\d{13,19}\b/                          # card numbers
].freeze

def scrub(value)
  case value
  when Hash
    value.transform_values { |v| SENSITIVE_KEYS.include?(v.to_s.downcase) ? "[FILTERED]" : scrub(v) }
  when Array
    value.map { |v| scrub(v) }
  when String
    PII_PATTERNS.reduce(value) { |s, p| s.gsub(p, "[REDACTED]") }
  else
    value
  end
end

Sentry.init do |config|
  config.dsn = ENV["SENTRY_DSN"]
  config.environment = ENV.fetch("SENTRY_ENVIRONMENT", Rails.env)
  config.breadcrumbs_logger = [:active_support_logger, :http_logger]
  config.traces_sample_rate = ENV.fetch("SENTRY_TRACES_SAMPLE_RATE", "0.1").to_f
  config.send_default_pii = false

  config.before_send = lambda do |event, _hint|
    event.request&.data = scrub(event.request.data) if event.request&.data
    event
  end
end
