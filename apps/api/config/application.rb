require_relative "boot"

require "rails"
require "active_model/railtie"
require "active_job/railtie"
require "active_record/railtie"
require "action_controller/railtie"
require "action_mailer/railtie"
require "action_view/railtie"

Bundler.require(*Rails.groups)

module Api
  class Application < Rails::Application
    config.load_defaults 8.1

    config.autoload_lib(ignore: %w[assets tasks])

    # API-only: dispensa middleware de sessão/flash/cookies por padrão.
    config.api_only = true

    # Timezone fixo em UTC. Conversão pra timezone do usuário é cliente.
    config.time_zone = "UTC"
    config.active_record.default_timezone = :utc

    # Logger estruturado em JSON em produção (Sentry + grep amigável).
    if Rails.env.production?
      logger = ActiveSupport::Logger.new($stdout)
      logger.formatter = proc do |severity, datetime, _progname, msg|
        { level: severity, time: datetime.utc.iso8601, msg: msg }.to_json + "\n"
      end
      config.logger = ActiveSupport::TaggedLogging.new(logger)
    end

    # Sidekiq como Active Job backend. Filas priorizadas em config/sidekiq.yml.
    config.active_job.queue_adapter = :sidekiq

    # Filter params: nunca logar segredos. Lista expandida no
    # config/initializers/filter_parameter_logging.rb.
    config.filter_parameters += %i[
      password password_confirmation token api_key secret access_token
      refresh_token authorization cookie consumer_key consumer_secret
      stripe_signature webhook_secret
    ]
  end
end
