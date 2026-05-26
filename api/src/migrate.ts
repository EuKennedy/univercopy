import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { PoolClient } from "pg";
import { pool } from "./db.js";

// DDL aditivo idempotente — roda a CADA boot (create ... if not exists), para
// evoluir o schema sem depender de re-rodar o init. Acrescente blocos aqui.
const ADDITIVE = `
create table if not exists intelligence_record (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspace(id) on delete cascade,
  collected_at  timestamptz not null default now(),
  marca         text,
  produto       text,
  categoria     text,
  preco         text,
  url           text,
  estrutura_pdp jsonb not null default '{}'::jsonb,
  copy          jsonb not null default '{}'::jsonb,
  ativos        jsonb not null default '[]'::jsonb,
  seo           jsonb not null default '{}'::jsonb,
  geo           jsonb not null default '{}'::jsonb,
  score_competitivo int,
  faixa         text,
  observacoes   text,
  created_by    uuid,
  created_at    timestamptz not null default now()
);
create index if not exists idx_intel_ws  on intelligence_record(workspace_id);
create index if not exists idx_intel_cat on intelligence_record(workspace_id, categoria);
alter table intelligence_record enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'intelligence_record' and policyname = 'intel_all') then
    create policy intel_all on intelligence_record for all using (is_member(workspace_id)) with check (is_member(workspace_id));
  end if;
end $$;

create table if not exists campaign (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspace(id) on delete cascade,
  name          text not null,
  objective     text,
  audience      text,
  status        text not null default 'planejada',
  starts_at     date,
  ends_at       date,
  created_by    uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_campaign_ws on campaign(workspace_id);
alter table campaign enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'campaign' and policyname = 'campaign_all') then
    create policy campaign_all on campaign for all using (is_member(workspace_id)) with check (is_member(workspace_id));
  end if;
end $$;
alter table campaign add column if not exists context text;
alter table copy add column if not exists campaign_id uuid references campaign(id) on delete set null;
create index if not exists idx_copy_campaign on copy(campaign_id);
alter table product add column if not exists profile jsonb;
`;

async function runAdditive(client: PoolClient): Promise<void> {
  try {
    await client.query(ADDITIVE);
    console.log("[migrate] DDL aditivo aplicado (intelligence_record).");
  } catch (e) {
    console.error("[migrate] DDL aditivo falhou (seguindo mesmo assim):", e);
  }
}

// Inicializa o banco no boot caso o schema ainda não exista, e SEMPRE aplica o
// DDL aditivo. Idempotente.
export async function migrate(): Promise<void> {
  const here = dirname(fileURLToPath(import.meta.url)); // /app/dist em produção
  const sqlDir = resolve(here, "../sql"); // /app/sql (copiado no Dockerfile)

  const client = await pool.connect();
  try {
    const exists = await client.query("select to_regclass('public.style') as t");
    if (exists.rows[0]?.t) {
      console.log("[migrate] schema já existe — pulando init.");
    } else {
      console.log("[migrate] schema ausente — aplicando 01_schema.sql + 02_seed.sql…");
      const schema = readFileSync(resolve(sqlDir, "01_schema.sql"), "utf8");
      const seed = readFileSync(resolve(sqlDir, "02_seed.sql"), "utf8");
      await client.query(schema);
      await client.query(seed);
      const styles = await client.query("select count(*)::int as n from style");
      console.log(`[migrate] concluído. styles=${styles.rows[0]?.n}`);
    }
    await runAdditive(client);
  } catch (e) {
    console.error("[migrate] falhou:", e);
    throw e;
  } finally {
    client.release();
  }
}
