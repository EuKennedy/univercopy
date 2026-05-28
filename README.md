# UniverCopy

Hub world-class de geração, revisão e organização de copy — multi-tenant, multi-canal, multi-idioma.

> Branch ativa de desenvolvimento: **`worldclass`** (refactor completo da stack v0.1 preservada em `main`).

## Stack

- **API**: Ruby 3.3 + Rails 8 (API-only) + Sidekiq + Postgres 16 + pgvector
- **Admin**: Next.js 15 (App Router) + React 19 + TypeScript estrito + Tailwind v4 + Better Auth + Drizzle
- **Landing**: Next.js 15
- **Domínio**: `univercopy.com` (`app.`, `api.`, raiz landing)
- **Deploy**: Coolify (Hostinger) + Docker Compose
- **Storage**: MinIO self-hosted (S3-compatible)
- **AI**: Anthropic Claude (Haiku/Sonnet/Opus com auto-router)

## Layout do monorepo

```
univer-copy/
├── apps/
│   ├── api/           Rails 8 API + Sidekiq + RLS Forçado
│   ├── admin/         Next.js 15 painel multi-tenant
│   └── landing/       Next.js 15 site público
├── packages/
│   ├── shared/        TS types compartilhados
│   └── ai-prompts/    Prompts versionados (markdown + JSON schemas)
├── docs/              API.md, INTEGRATION.md, SECURITY_DEPLOY_CHECKLIST.md
├── scripts/           db-backup.sh, audit-prod-env.sh
└── .github/workflows/ CI (lint, type-check, test, security scan)
```

## Início rápido

```bash
# 1. Instala deps
pnpm install

# 2. Sobe Postgres + Redis + MinIO locais
docker compose -f docker-compose.dev.yml up -d

# 3. Roda migrations + seed
cd apps/api && bin/rails db:create db:migrate db:seed

# 4. Em outro terminal: API
cd apps/api && bin/rails s -p 3001

# 5. Em outro terminal: admin
cd apps/admin && pnpm dev

# Admin: http://localhost:3000
# API:   http://localhost:3001
```

## Princípios

- **Padrão world-class em todas as camadas.** Se auditor abrisse pra comprar, não acharia o que enrubescer.
- **Segurança desde o commit 1.** RLS forçada, HMAC, SSRF guard, PII scrub — nada é "fase de hardening depois".
- **Performance é restrição de design.** N+1 = bug. Bulk = job em background. Cap de custo por workspace.
- **Honestidade > sucesso falso.** Quando IA falha, explicamos o porquê. Quando limite bate, mostramos a barra.
- **Dark-first, light cuidado.** Apple/Linear/Stripe como referência. Sem template, sem opção segura.
