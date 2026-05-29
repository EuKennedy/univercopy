require "sidekiq"
require "sidekiq-scheduler"

redis_url = ENV.fetch("REDIS_URL") { "redis://localhost:6379/0" }

Sidekiq.configure_server do |config|
  config.redis = { url: redis_url, network_timeout: 5 }

  # Carrega o schedule (cron) em config/sidekiq.yml se existir.
  # `fetch(:schedule, {})` retorna nil quando o key existe mas value é nil
  # (acontece quando todos crons estão comentados no YAML); coalescemos
  # com `|| {}` pra evitar NoMethodError: undefined method `any?` for nil.
  schedule_file = Rails.root.join("config", "sidekiq.yml")
  config.on(:startup) do
    next unless File.exist?(schedule_file)

    yaml = YAML.load_file(schedule_file, permitted_classes: [Symbol], aliases: true) || {}
    schedule = yaml.fetch(:schedule, {}) || {}
    SidekiqScheduler::Scheduler.instance.reload_schedule! if schedule.any?
  rescue StandardError => e
    Rails.logger.warn("[sidekiq] failed to load schedule: #{e.class} #{e.message}")
  end
end

Sidekiq.configure_client do |config|
  config.redis = { url: redis_url, network_timeout: 5 }
end
