# syntax=docker/dockerfile:1.7
#
# UniverCopy Admin — Next.js 16 standalone monorepo. Context = monorepo root.
# Build precisa de TODO o monorepo (pnpm-workspace.yaml + packages/shared)
# pra resolver workspace deps.

# ---------------------------------------------------------------------
# Stage 1 — deps: instala apenas o que basta pro `pnpm install`.
# ---------------------------------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.33.3 --activate

# Lockfile + manifests primeiro (cache layer).
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/admin/package.json ./apps/admin/
COPY apps/landing/package.json ./apps/landing/
COPY packages/shared/package.json ./packages/shared/
COPY packages/ai-prompts/package.json ./packages/ai-prompts/

RUN pnpm install --frozen-lockfile --filter admin... --prefer-offline

# ---------------------------------------------------------------------
# Stage 2 — builder: copia código + build standalone.
# ---------------------------------------------------------------------
FROM node:22-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.33.3 --activate

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/admin/node_modules ./apps/admin/node_modules
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY apps/admin ./apps/admin
COPY packages/shared ./packages/shared

# Variáveis NEXT_PUBLIC_* viram inline no bundle no build — recebe via ARG.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_ADMIN_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_ADMIN_URL=$NEXT_PUBLIC_ADMIN_URL

# Build admin standalone — outputFileTracingRoot=monorepo root garante
# que packages/shared e node_modules entrem em .next/standalone/.
RUN pnpm --filter admin build

# ---------------------------------------------------------------------
# Stage 3 — runtime: imagem mínima Alpine + standalone output.
# ---------------------------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app

RUN apk add --no-cache curl tini && \
    addgroup -S -g 1001 nodejs && \
    adduser -S -G nodejs -u 1001 nextjs

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Standalone gera estrutura:
#   .next/standalone/  ← server.js minimal + apenas runtime deps
#   .next/static/      ← assets estáticos (precisa copiar separado)
#   public/            ← arquivos públicos
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin/.next/static ./apps/admin/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin/public ./apps/admin/public

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl --fail http://localhost:3000/login || exit 1

ENTRYPOINT ["tini", "--"]
CMD ["node", "apps/admin/server.js"]
