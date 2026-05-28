require "simplecov"
SimpleCov.start "rails" do
  add_filter "/spec/"
  add_filter "/config/"
  add_filter "/db/migrate/"
  add_filter "/vendor/"
  minimum_coverage ENV.fetch("COVERAGE_FLOOR", "30").to_f
end

require "spec_helper"
ENV["RAILS_ENV"] ||= "test"
require_relative "../config/environment"

abort("Rails environment is production!") if Rails.env.production?

require "rspec/rails"
require "webmock/rspec"
require "shoulda/matchers"
require "database_cleaner/active_record"

Rails.root.glob("spec/support/**/*.rb").each { |f| require f }

WebMock.disable_net_connect!(allow_localhost: true)

begin
  ActiveRecord::Migration.maintain_test_schema!
rescue ActiveRecord::PendingMigrationError => e
  abort e.to_s.strip
end

RSpec.configure do |config|
  config.fixture_paths = [Rails.root.join("spec/fixtures")]
  config.use_transactional_fixtures = false
  config.filter_rails_from_backtrace!
  config.infer_spec_type_from_file_location!

  config.include FactoryBot::Syntax::Methods
  config.include Rails.application.routes.url_helpers, type: :request

  config.before(:suite) do
    DatabaseCleaner.strategy = :transaction
    DatabaseCleaner.clean_with(:truncation)
  end

  config.around(:each) do |example|
    DatabaseCleaner.cleaning { example.run }
  end
end

Shoulda::Matchers.configure do |config|
  config.integrate do |with|
    with.test_framework :rspec
    with.library :rails
  end
end
