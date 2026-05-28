# Cria o role NOSUPERUSER/NOBYPASSRLS usado pelos specs de RLS cross-tenant.
# O usuário Postgres do test (superuser dentro do service container do CI)
# tem permissão para CREATE ROLE. Em dev local pode falhar; specs RLS são
# skipados nesse caso.

RSpec.configure do |config|
  config.before(:suite) do
    ActiveRecord::Base.connection.execute(<<~SQL)
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='rls_test_role') THEN
          CREATE ROLE rls_test_role NOSUPERUSER NOBYPASSRLS LOGIN PASSWORD 'rls_test';
          GRANT USAGE ON SCHEMA public TO rls_test_role;
          GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO rls_test_role;
          ALTER DEFAULT PRIVILEGES IN SCHEMA public
            GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO rls_test_role;
        END IF;
      END $$;
    SQL
  rescue ActiveRecord::StatementInvalid => e
    warn "[rls_test_role] could not create role (need superuser): #{e.message}"
  end
end

# Helper para specs de RLS — executa o bloco sob o role rls_test_role
# (sem BYPASSRLS) então RLS policies são impostas de verdade.
module RlsTestRole
  def as_rls_role(&block)
    ActiveRecord::Base.transaction do
      ActiveRecord::Base.connection.execute("SET LOCAL ROLE rls_test_role")
      yield
    ensure
      # SET LOCAL é auto-revertido ao final da transação, mas explicit é mais claro.
    end
  end
end

RSpec.configure { |c| c.include RlsTestRole, type: :rls }
