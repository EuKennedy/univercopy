# Lista de chaves que NUNCA aparecem em logs (Rails redact automaticamente).
# Expandido conforme novos secrets entram (Fase 6 cifra Woo key/secret, etc).

Rails.application.config.filter_parameters += %i[
  password password_confirmation
  token api_key secret access_token refresh_token
  authorization cookie
  consumer_key consumer_secret
  webhook_secret stripe_signature
  woo_key woo_secret shopify_token nuvemshop_token tray_token
  anthropic_api_key resend_api_key
  jwt better_auth_session_token
  cpf cnpj rg passport credit_card card_number cvv
]
