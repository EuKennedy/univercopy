# Puma config — workers (forks) + threads. Sidekiq não roda dentro do Puma.
# WEB_CONCURRENCY = workers (forks); RAILS_MAX_THREADS = threads por worker.

workers ENV.fetch("WEB_CONCURRENCY", 2).to_i
threads_count = ENV.fetch("RAILS_MAX_THREADS", 5).to_i
threads threads_count, threads_count

port ENV.fetch("PORT", 3000)

# preload_app + on_worker_boot mantém conexões DB limpas após fork.
preload_app!

before_fork do
  ActiveRecord::Base.connection_pool.disconnect! if defined?(ActiveRecord)
end

on_worker_boot do
  ActiveRecord::Base.establish_connection if defined?(ActiveRecord)
end

# Restart limpo via SIGUSR2 (graceful) e SIGTERM (kamal/coolify deploy).
plugin :tmp_restart

pidfile ENV["PIDFILE"] if ENV["PIDFILE"]
