class FixCreateWorkspaceFunction < ActiveRecord::Migration[8.1]
  # Função original tinha chicken-and-egg em RLS: INSERT em workspace_members
  # dispara WITH CHECK is_member(w.id), que verifica a própria tabela —
  # nenhuma row ainda existe (estamos criando ela mesma) → policy bloqueia.
  #
  # SECURITY DEFINER por si só não basta se row_security não estiver desligado
  # dentro da função (Postgres 9.5+ avalia policies mesmo no owner do objeto
  # quando FORCE ROW LEVEL SECURITY tá ativo).
  #
  # Fix: adicionar `SET row_security = off` na declaração da função. Roda
  # como superuser + bypassa RLS dentro do escopo da função, exclusivamente
  # pra esses 3 inserts atômicos (workspace + member + dnas).
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

  def down
    # Restaura função sem `SET row_security = off`.
    execute <<~SQL
      CREATE OR REPLACE FUNCTION create_workspace(
        p_name text, p_slug text, p_site_url text, p_locale text, p_plan text
      )
      RETURNS workspaces
      LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
