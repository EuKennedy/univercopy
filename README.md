# UniverCopy

Central de geração, revisão e organização de copy — **1 marca = 1 workspace**.
Stack 100% open-source, self-hosted no **Coolify**.

> Repo: https://github.com/univerbeauty777/univercopy

## Arquitetura

```
Coolify (seu servidor)
├── db    · PostgreSQL 16  → banco multi-tenant (RLS por workspace)
├── cache · Redis 7        → cache de geração, rate limit e fila (lote)
├── api   · Node/Hono      → auth, workspaces, DNA, geração (Claude), auditoria, WooCommerce
└── web   · protótipo/React→ frontend que consome a API
        └─ integra com: WooCommerce (REST) · UniverReviews · Claude API
```

## Estrutura

```
univercopy/
├── docker-compose.yml        # orquestra os 4 serviços (Coolify)
├── .env.example              # variáveis de ambiente
├── db/
│   ├── 01_schema.sql         # schema multi-tenant (Postgres, RLS via current_setting)
│   └── 02_seed.sql           # bibliotecas globais: 44 estilos, 17 frameworks, 59 peças, 7 categorias
├── api/                      # API Node/TypeScript (Hono)
│   ├── Dockerfile
│   └── src/
│       ├── index.ts          # app + /health + /auth/login + /me
│       ├── db.ts             # pool pg + withUser() (seta app.user_id p/ RLS)
│       ├── auth.ts           # JWT
│       ├── prompt.ts         # montagem do prompt em camadas
│       ├── claude.ts         # chamada ao Claude (saída → variações)
│       └── routes/           # libraries, workspaces, dna, copies, generate, audit
└── web/
    ├── Dockerfile            # nginx servindo o protótipo
    └── index.html
```

## Rodando localmente

```bash
cp .env.example .env          # preencha as variáveis
docker compose up -d          # sobe db + cache + api + web
# o Postgres aplica db/01_schema.sql e db/02_seed.sql na primeira subida
```

A API sobe em `:8080`. Teste:

```bash
curl localhost:8080/health
# login de dev (cria o usuário):
curl -X POST localhost:8080/auth/login -H 'content-type: application/json' -d '{"email":"diego@lizzon.com.br","name":"Diego"}'
# use o token retornado:
curl localhost:8080/workspaces -H "authorization: Bearer <TOKEN>"
```

## Deploy no Coolify

Ver `DEPLOY_COOLIFY.md` (na raiz dos entregáveis). Resumo: conectar o repo, Nova Resource → Docker Compose, definir as variáveis, apontar domínios (`app.` → web, `api.` → api) e dar deploy. Ative o backup automático do Postgres.

## Endpoints (resumo)

| Método + rota | Descrição |
|---|---|
| `POST /auth/login` · `GET /me` | Login (dev) e usuário corrente |
| `GET/POST /workspaces` · `GET/PATCH/DELETE /workspaces/:id` | Marcas (workspaces) + membros |
| `GET/PUT /workspaces/:id/dna/:kind` · `POST /workspaces/:id/dna/use` | DNA Atual/Proposto e qual usar |
| `GET /styles · /frameworks · /piece-types · /categories` | Bibliotecas globais |
| `GET/POST /workspaces/:id/copies` · `POST /copies/:id/versions` · `PATCH /copies/:id/status` | Acervo, versões, status |
| `POST /workspaces/:id/generate` | Geração server-side (DNA+estilo+framework+peça → variações) |
| `POST /workspaces/:id/audit` | Auditoria de página por URL |
| `POST /workspaces/:id/integrations/woocommerce` | Conectar a loja (url/key/secret) |
| `POST /workspaces/:id/products/sync` · `GET .../products` | Sincronizar e listar o catálogo |
| `POST /workspaces/:id/products/bulk-generate` | Gerar descrições em lote (limite de segurança) |
| `POST /products/:id/publish` | Publicar a copy de volta no WooCommerce |

### SDK de frontend

`web/app/api.js` traz um cliente JS completo da API (auth, workspaces, dna, copies, generate, audit, woo). Uso:

```js
import { UniverCopy } from './app/api.js';
const uc = new UniverCopy('https://api.univercopy.com.br');
await uc.login('diego@lizzon.com.br', 'Diego');
const wss = await uc.workspaces.list();
const out = await uc.generate(wss[0].id, { brief: 'Volume Control', pieceTypeKey: 'ecom:desc-prod-longa' });
```

## Notas

- **RLS:** cada tabela de conteúdo é isolada por `workspace_id`. A API seta `app.user_id` por transação (`withUser`) e o banco impõe a fronteira. *(Usando Supabase self-hosted, troque para o schema com `auth.uid()`.)*
- **Frontend:** hoje serve o protótipo (localStorage). Próximo passo (Sprint 1): migrar para consumir a API.
- **Segredos:** nunca commitar `.env`. A chave do Claude vive só no servidor.
