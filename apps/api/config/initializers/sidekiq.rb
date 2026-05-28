require "sidekiq"
require "sidekiq-scheduler"

redis_url = ENV.fetch("REDIS_URL") { "redis://localhost:6379/0" }

Sidekiq.configure_server do |config|
  config.redis = { url: redis_url, network_timeout: 5 }

  # Carrega o schedule (cron) em config/sidekiq.yml se existir.
  schedule_file = Rails.root.join("config", "sidekiq.yml")
  config.on(:startup) do
    if File.exist?(schedule_file)
      schedule = YAML.load_file(schedule_file).fetch(:schedule, {})
      SidekiqScheduler::Scheduler.instance.reload_schedule! if schedule.any?
    end
  end
end

Sidekiq.configure_client do |config|
  config.redis = { url: redis_url, network_timeout: 5 }
end
