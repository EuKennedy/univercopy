-- =====================================================================
-- UniverCopy — Schema multi-tenant (PostgreSQL 15+)
-- Modelo: 1 marca/empresa = 1 workspace (tenant isolado)
-- Isolamento por Row Level Security (RLS) baseado em participação no workspace.
-- Compatível com Supabase (auth.uid()) — ver nota em is_member().
-- =====================================================================

create extension if not exists "pgcrypto";        -- gen_random_uuid()
create extension if not exists "pg_trgm";          -- busca textual (trigram)

-- ---------------------------------------------------------------------
-- 1. USUÁRIOS
-- (No Supabase, espelha auth.users; aqui mantemos um perfil de aplicação.)
-- ---------------------------------------------------------------------
create table app_user (
  id           uuid primary key default gen_random_uuid(),
  email        text unique not null,
  name         text,
  avatar_url   text,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. WORKSPACES (o tenant = a marca)
-- ---------------------------------------------------------------------
create table workspace (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  slug         text unique not null,
  icon         text default '🧬',
  site_url     text,                         -- ex.: https://lizzon.com.br
  owner_id     uuid not null references app_user(id) on delete restrict,
  settings     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index on workspace (owner_id);

-- 2.1 Membros e papéis (RBAC)
create type member_role as enum ('owner','admin','editor','reviewer','viewer');
create table workspace_member (
  workspace_id uuid not null references workspace(id) on delete cascade,
  user_id      uuid not null references app_user(id) on delete cascade,
  role         member_role not null default 'editor',
  created_at   timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index on workspace_member (user_id);

-- Helper de RLS: o usuário corrente participa do workspace?
create or replace function is_member(ws uuid) returns boolean
language sql stable as $$
  select exists (
    select 1 from workspace_member m
    where m.workspace_id = ws and m.user_id = nullif(current_setting('app.user_id', true),'')::uuid
  );
$$;

-- ---------------------------------------------------------------------
-- 3. DNA DA MARCA (Atual x Proposto) — 1 linha por (workspace, kind)
-- ---------------------------------------------------------------------
create type dna_kind as enum ('atual','proposto');
create table brand_dna (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspace(id) on delete cascade,
  kind          dna_kind not null,
  marca         text,
  missao        text,
  posicionamento text,
  tom           text,
  publico       text,
  consciencia   text,
  valores       jsonb not null default '[]'::jsonb,
  produtos      jsonb not null default '[]'::jsonb,
  ofertas       jsonb not null default '[]'::jsonb,
  provas        jsonb not null default '[]'::jsonb,
  objecoes      jsonb not null default '[]'::jsonb,
  evitar        jsonb not null default '[]'::jsonb,
  framework     text,                          -- framework de DNA usado (Sinek, Kapferer...)
  source_url    text,                          -- origem do auto-fetch
  updated_at    timestamptz not null default now(),
  unique (workspace_id, kind)
);
-- Qual DNA alimenta o Gerador (atual|proposto) fica em workspace.settings->>'dna_in_use'.

-- ---------------------------------------------------------------------
-- 4. BIBLIOTECAS GLOBAIS (compartilhadas entre todos os workspaces)
-- ---------------------------------------------------------------------
create table style (                            -- especialistas de copy (44)
  key          text primary key,               -- 'schwartz','ogilvy',...
  name         text not null,
  era          text,
  grp          text,                            -- dr|brand|modern|strategy|br
  description  text,
  principles   jsonb not null default '[]'::jsonb,
  when_to_use  text
);
create table framework (                        -- frameworks de copy (17)
  key          text primary key,               -- 'aida','pas','pastor',...
  name         text not null,
  structure    text
);
create table piece_type (                       -- catálogo de peças (59)
  key              text primary key,            -- 'desc-prod-longa',...
  category_key     text not null,               -- 'ecom','pv','ads','email','social','marca','seo'
  name             text not null,
  description      text,
  structure        text,
  default_framework text references framework(key),
  default_style     text references style(key),
  length_hint      text
);
create table category (                         -- assuntos (global + custom por ws)
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspace(id) on delete cascade,  -- null = global
  key          text not null,
  name         text not null,
  icon         text,
  color        text
);

-- ---------------------------------------------------------------------
-- 5. PRODUTOS (catálogo importado — ex.: WooCommerce)
-- ---------------------------------------------------------------------
create table product (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references workspace(id) on delete cascade,
  source            text not null default 'woocommerce',
  external_id       text,                       -- id no WooCommerce
  sku               text,
  name              text not null,
  description       text,
  short_description text,
  price             numeric(12,2),
  permalink         text,
  categories        jsonb not null default '[]'::jsonb,
  images            jsonb not null default '[]'::jsonb,
  rating_avg        numeric(3,2),               -- vindo do UniverReviews
  reviews_count     int default 0,
  synced_at         timestamptz,
  created_at        timestamptz not null default now(),
  unique (workspace_id, source, external_id)
);
create index on product (workspace_id);
create index on product using gin (to_tsvector('portuguese', coalesce(name,'') || ' ' || coalesce(description,'')));

-- ---------------------------------------------------------------------
-- 6. ACERVO DE COPY + versões + comentários
-- ---------------------------------------------------------------------
create type copy_status as enum ('rascunho','revisao','aprovado','publicado');
create table copy (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspace(id) on delete cascade,
  product_id    uuid references product(id) on delete set null,
  category_key  text,
  piece_type_key text references piece_type(key),
  title         text not null,
  status        copy_status not null default 'rascunho',
  style_key     text references style(key),
  framework_key text references framework(key),
  score         int,                            -- score preditivo (0-100), nullable
  tags          jsonb not null default '[]'::jsonb,
  created_by    uuid references app_user(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on copy (workspace_id, status);
create index on copy (workspace_id, category_key);
create index on copy (product_id);

create table copy_version (
  id          uuid primary key default gen_random_uuid(),
  copy_id     uuid not null references copy(id) on delete cascade,
  n           int not null,
  content     text not null,
  author_id   uuid references app_user(id),
  note        text,
  is_current  boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (copy_id, n)
);
create unique index one_current_version_per_copy
  on copy_version (copy_id) where is_current;

create table comment (
  id          uuid primary key default gen_random_uuid(),
  copy_id     uuid not null references copy(id) on delete cascade,
  version_id  uuid references copy_version(id) on delete set null,
  author_id   uuid references app_user(id),
  text        text not null,
  resolved    boolean not null default false,
  created_at  timestamptz not null default now()
);
create index on comment (copy_id);

-- ---------------------------------------------------------------------
-- 7. BIBLIOTECA DE REFERÊNCIAS (swipe file)
-- ---------------------------------------------------------------------
create table reference_item (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspace(id) on delete cascade,
  title         text not null,
  source        text,
  url           text,
  type          text,
  category_key  text,
  tags          jsonb not null default '[]'::jsonb,
  notes         text,
  content       text,
  created_at    timestamptz not null default now()
);
create index on reference_item (workspace_id);

-- ---------------------------------------------------------------------
-- 8. AUDITORIAS DE PÁGINA (Analisar Página)
-- ---------------------------------------------------------------------
create table audit (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspace(id) on delete cascade,
  url           text not null,
  brand_name    text,
  score         int,
  summary       text,
  sections      jsonb not null default '[]'::jsonb,  -- [{nome,sev,cat,tipo,atual,diag,brief}]
  created_by    uuid references app_user(id),
  created_at    timestamptz not null default now()
);
create index on audit (workspace_id);

-- ---------------------------------------------------------------------
-- 9. LOG DE GERAÇÕES (IA) — auditoria, custo e cache
-- ---------------------------------------------------------------------
create table generation (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspace(id) on delete cascade,
  copy_id       uuid references copy(id) on delete set null,
  model         text,
  prompt        jsonb,                          -- camadas montadas (DNA, estilo, framework, peça, tarefa)
  output        text,
  prompt_tokens int,
  output_tokens int,
  cost_usd      numeric(10,5),
  created_by    uuid references app_user(id),
  created_at    timestamptz not null default now()
);
create index on generation (workspace_id, created_at);

-- ---------------------------------------------------------------------
-- 10. INTEGRAÇÕES (WooCommerce, UniverReviews) — segredos cifrados
-- ---------------------------------------------------------------------
create type integration_type as enum ('woocommerce','univerreviews');
create table integration (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspace(id) on delete cascade,
  type          integration_type not null,
  config        jsonb not null default '{}'::jsonb,  -- url, key/secret CIFRADOS (KMS/Vault)
  status        text not null default 'connected',
  last_sync_at  timestamptz,
  created_at    timestamptz not null default now(),
  unique (workspace_id, type)
);

-- ---------------------------------------------------------------------
-- 11. JOBS (processamento em lote: importar, gerar, auditar, publicar)
-- ---------------------------------------------------------------------
create type job_status as enum ('queued','running','done','error');
create table job (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspace(id) on delete cascade,
  type          text not null,                  -- 'sync_woo'|'bulk_generate'|'bulk_audit'|'publish_woo'
  status        job_status not null default 'queued',
  payload       jsonb not null default '{}'::jsonb,
  progress      int not null default 0,         -- 0-100
  result        jsonb,
  error         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on job (workspace_id, status);

-- =====================================================================
-- ROW LEVEL SECURITY — isolamento por workspace
-- Toda tabela com workspace_id só é visível/editável por membros do workspace.
-- =====================================================================
alter table workspace          enable row level security;
alter table workspace_member   enable row level security;
alter table brand_dna          enable row level security;
alter table product            enable row level security;
alter table copy               enable row level security;
alter table copy_version       enable row level security;
alter table comment            enable row level security;
alter table reference_item     enable row level security;
alter table audit              enable row level security;
alter table generation         enable row level security;
alter table integration        enable row level security;
alter table job                enable row level security;

-- Workspace: membro vê; só owner/admin altera (simplificado).
create policy ws_select on workspace for select using (is_member(id));
create policy ws_modify on workspace for all using (is_member(id)) with check (is_member(id));

-- Padrão para tabelas filhas (workspace_id direto):
create policy dna_all   on brand_dna      for all using (is_member(workspace_id)) with check (is_member(workspace_id));
create policy prod_all  on product        for all using (is_member(workspace_id)) with check (is_member(workspace_id));
create policy copy_all  on copy           for all using (is_member(workspace_id)) with check (is_member(workspace_id));
create policy ref_all   on reference_item for all using (is_member(workspace_id)) with check (is_member(workspace_id));
create policy audit_all on audit          for all using (is_member(workspace_id)) with check (is_member(workspace_id));
create policy gen_all   on generation     for all using (is_member(workspace_id)) with check (is_member(workspace_id));
create policy intg_all  on integration    for all using (is_member(workspace_id)) with check (is_member(workspace_id));
create policy job_all   on job            for all using (is_member(workspace_id)) with check (is_member(workspace_id));
create policy mem_all   on workspace_member for all using (is_member(workspace_id)) with check (is_member(workspace_id));

-- Versões e comentários: herdam o workspace via copy.
create policy cv_all on copy_version for all
  using (exists (select 1 from copy c where c.id = copy_version.copy_id and is_member(c.workspace_id)))
  with check (exists (select 1 from copy c where c.id = copy_version.copy_id and is_member(c.workspace_id)));
create policy cm_all on comment for all
  using (exists (select 1 from copy c where c.id = comment.copy_id and is_member(c.workspace_id)))
  with check (exists (select 1 from copy c where c.id = comment.copy_id and is_member(c.workspace_id)));

-- Bibliotecas globais (style, framework, piece_type, category global) ficam
-- legíveis por todos (sem RLS) ou com policy de leitura pública. Categorias
-- custom por workspace seguem o padrão de is_member(workspace_id).

-- ---------------------------------------------------------------------
-- Função de criação de workspace (SECURITY DEFINER) — evita o impasse de
-- RLS na criação (o membro/owner ainda não existe no momento do insert).
-- Cria workspace + membership de owner + DNA (atual/proposto) atomicamente.
-- ---------------------------------------------------------------------
create or replace function create_workspace(p_name text, p_slug text, p_icon text, p_site_url text)
returns workspace
language plpgsql security definer set search_path = public as $$
declare uid uuid := nullif(current_setting('app.user_id', true),'')::uuid; w workspace;
begin
  if uid is null then raise exception 'sem usuário (app.user_id não definido)'; end if;
  insert into workspace(name, slug, icon, site_url, owner_id)
  values (p_name,
          coalesce(p_slug, lower(regexp_replace(p_name, '[^a-zA-Z0-9]+', '-', 'g'))),
          coalesce(p_icon, '🧬'), p_site_url, uid)
  returning * into w;
  insert into workspace_member(workspace_id, user_id, role) values (w.id, uid, 'owner');
  insert into brand_dna(workspace_id, kind, marca) values (w.id,'atual',p_name), (w.id,'proposto',p_name);
  return w;
end $$;
