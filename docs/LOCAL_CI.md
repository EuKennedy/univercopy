# Local CI — UniverCopy

Roda offline o equivalente ao `.github/workflows/ci.yml`. Adotado enquanto o billing do GitHub Actions não está ativo. Quando reativar, o workflow remoto volta intacto — este script é complementar, não substituto.

## Pré-requisitos

- **Docker** com daemon ativo (Desktop no macOS / `docker.io` no Linux).
- **Node 22+** e **pnpm 10+** (Corepack instala automaticamente).
- **Ruby 3.3.6** via `rbenv` em `~/.rbenv` (compilado com libyaml em `~/.local`).
- Imagens já em cache (pré-pulled pelo bootstrap): `pgvector/pgvector:pg16`, `redis:7-alpine`, `zricethezav/gitleaks:latest`, `returntocorp/semgrep:latest`, `aquasec/trivy:latest`.

## Bootstrap + primeira execução (copia-cola)

```bash
chmod +x scripts/install-ci-deps.sh scripts/local-ci.sh
./scripts/install-ci-deps.sh
./scripts/local-ci.sh
```

## Gates

| # | Gate | Cobre | Espelhado em GH Actions? |
|---|------|-------|--------------------------|
| 1 | `gitleaks`  | secrets no histórico git | ✓ |
| 2 | `semgrep`   | SAST (OWASP Top 10 + JS/TS/Node + secrets) | ✓ |
| 3 | `shared`    | type-check de `packages/shared` | ✓ |
| 4 | `admin`     | Next.js admin: lint + type-check + Vitest + build | ✓ |
| 5 | `landing`   | Next.js landing: lint + type-check + build | ✓ |
| 6 | `api`       | Rails: `db:prepare` + Brakeman + bundler-audit + RSpec | ✓ |
| 7 | `docker`    | build `apps/api/Dockerfile` (BuildKit, multi-stage) | extra |
| 8 | `trivy`     | FS + image scan, severity CRITICAL/HIGH | extra |

Os gates 7 e 8 não estão no workflow remoto da Fase 1 — entram aqui pra blindar deploy local antes do Coolify.

## Uso

```bash
# Tudo (fail-fast no primeiro erro)
./scripts/local-ci.sh

# Subconjunto
./scripts/local-ci.sh --only lint typecheck
./scripts/local-ci.sh --only shared admin landing

# Pular gates pesados (Docker / Trivy)
./scripts/local-ci.sh --skip docker trivy

# Roda tudo mesmo com falha (vê todos os erros do push)
./scripts/local-ci.sh --continue-on-error

# Exit code como bitmask (CI agregador)
./scripts/local-ci.sh --bitmask
echo "bit 4 = api gate falhou? $((($? >> 5) & 1))"

# Override de porta (evita colisão com docker-compose.dev.yml)
UC_CI_PG_PORT=56000 UC_CI_REDIS_PORT=56001 ./scripts/local-ci.sh --only api
```

## Saída

- `.local-ci-logs/<UTC-timestamp>/<gate>.log` — log completo por gate.
- `.local-ci-logs/latest` — symlink pra última execução.
- `.local-ci-logs/latest/gitleaks-report.json` — relatório JSON do gitleaks.
- Tabela ASCII no terminal: gate / status / tempo / link pro log.

## Diferenças vs GH Actions remoto

| Item | GH Actions | Local CI |
|------|-----------|----------|
| Postgres | service container | `docker-compose.ci.yml` (tmpfs, sem volume) |
| Redis | service container | idem |
| Ruby | `ruby/setup-ruby@v1` + bundler cache | rbenv local + `vendor/bundle` |
| Node/pnpm | actions oficiais | host (Corepack) |
| Docker build | não roda | gate dedicado |
| Trivy | não roda | gate dedicado |
| Cache de imagens | runner provisiona | pré-pull idempotente |

Tudo o resto (lint, typecheck, test, build, brakeman, bundler-audit, RSpec) é byte-equivalente.

## Limitações conhecidas

- **RSpec RLS specs** estão `skip` até a Fase 2.5 (debt registrada). `SET LOCAL ROLE` dentro de savepoint do DatabaseCleaner `:transaction` não demota o superuser que abriu a outer-transaction; refator vai usar `:truncation` + conexão dedicada.
- **Semgrep ruleset** local difere ligeiramente do remoto (`p/owasp-top-ten + p/javascript + p/typescript + p/nodejs + p/secrets` localmente vs `p/r2c-ci` remoto, que é um subset).
- **Trivy image scan** só roda se o gate `docker` passou. Sem imagem, faz só FS scan.
- **gitleaks** roda em `--no-banner --redact`. Para histórico completo, `git fetch --unshallow` antes.

## Reativando GH Actions

Quando o billing voltar:

```bash
# Garante que workflow remoto ainda está válido
cat .github/workflows/ci.yml | head

# Trigger explícito (sem código novo)
git commit --allow-empty -m "ci: re-trigger after billing restore"
git push origin worldclass

# Confirma run no GitHub
gh run list --branch worldclass --limit 5   # ou pelo browser
```

O CI local continua disponível sempre — fail-fast no host, fail-completo no remoto.
