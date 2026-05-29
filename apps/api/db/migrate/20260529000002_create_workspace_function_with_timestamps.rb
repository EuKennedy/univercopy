class CreateWorkspaceFunctionWithTimestamps < ActiveRecord::Migration[8.1]
  # Função create_workspace não inseria created_at/updated_at — schema
  # `t.timestamps` cria essas colunas NOT NULL sem default. AR preenche
  # automaticamente em INSERTs Ruby, mas SQL bruto dentro de PL/pgSQL não.
  #
  # PG::NotNullViolation: null value in column "created_at" of relation
  # "workspaces" violates not-null constraint
  #
  # Fix: incluir `now()` explicit nos 3 INSERTs da função (workspaces,
  # workspace_members, brand_dnas).
  def up
    execute <<~SQL
      CREATE OR REPLACE FUNCTION create_workspace(
        p_name text, p_slug text, p_site_url text, p_locale text, p_plan text
      )
      RETURNS workspaces
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      SET row_security = off
      AS $$
      DECLARE
        uid uuid := app_current_user_id();
        w workspaces;
      BEGIN
        IF uid IS NULL THEN
          RAISE EXCEPTION 'app.user_id não definido — operação não autenticada';
        END IF;

        INSERT INTO workspaces(
          name, slug, site_url, default_locale, plan, owner_id,
          created_at, updated_at
        )
        VALUES (
          p_name,
          COALESCE(p_slug, lower(regexp_replace(p_name, '[^a-zA-Z0-9]+', '-', 'g'))),
          p_site_url,
          COALESCE(p_locale, 'pt-BR'),
          COALESCE(p_plan, 'entry'),
          uid,
          now(), now()
        )
        RETURNING * INTO w;

        INSERT INTO workspace_members(
          workspace_id, user_id, role, accepted_at, created_at, updated_at
        )
        VALUES (w.id, uid, 'owner', now(), now(), now());

        INSERT INTO brand_dnas(
          workspace_id, kind, marca, created_at, updated_at
        )
        VALUES
          (w.id, 'atual',    p_name, now(), now()),
          (w.id, 'proposto', p_name, now(), now());

        RETURN w;
      END $$;
    SQL
  end

  def down
    # Restaura função sem timestamps explícitos (versão da migration anterior).
    execute <<~SQL
      CREATE OR REPLACE FUNCTION create_workspace(
        p_name text, p_slug text, p_site_url text, p_locale text, p_plan text
      )
      RETURNS workspaces
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      SET row_security = off
      AS $$
      DECLARE
        uid uuid := app_current_user_id();
        w workspaces;
      BEGIN
        IF uid IS NULL THEN
          RAISE EXCEPTION 'app.user_id não definido — operação não autenticada';
        END IF;

        INSERT INTO workspaces(name, slug, site_url, default_locale, plan, owner_id)
        VALUES (
          p_name,
          COALESCE(p_slug, lower(regexp_replace(p_name, '[^a-zA-Z0-9]+', '-', 'g'))),
          p_site_url,
          COALESCE(p_locale, 'pt-BR'),
          COALESCE(p_plan, 'entry'),
          uid
        )
        RETURNING * INTO w;

        INSERT INTO workspace_members(workspace_id, user_id, role, accepted_at)
        VALUES (w.id, uid, 'owner', now());

        INSERT INTO brand_dnas(workspace_id, kind, marca) VALUES
          (w.id, 'atual',    p_name),
          (w.id, 'proposto', p_name);

        RETURN w;
      END $$;
    SQL
  end
end
