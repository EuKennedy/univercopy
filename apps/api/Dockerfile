# syntax=docker/dockerfile:1.7
#
# UniverCopy API — multi-stage Dockerfile. Context = monorepo root
# (declarado no docker-compose.yml). Não usar context apps/api/ diretamente
# porque o packages/ai-prompts/ é COPY-ado pra dentro da image também.

# ---------------------------------------------------------------------
# Stage 1 — Build: instala build tools, compila gems, precompila bootsnap.
# ---------------------------------------------------------------------
FROM ruby:3.3.6-slim AS build

ENV LANG=C.UTF-8 \
    RAILS_ENV=production \
    BUNDLE_DEPLOYMENT=1 \
    BUNDLE_PATH=/usr/local/bundle \
    BUNDLE_WITHOUT="development:test"

RUN apt-get update -qq && \
    apt-get install -y --no-install-recommends \
      build-essential libpq-dev libyaml-dev libffi-dev libssl-dev \
      pkg-config git curl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Gemfile primeiro (cache layer). Path explícito monorepo.
COPY apps/api/Gemfile apps/api/Gemfile.lock ./
RUN bundle config set --local without "$BUNDLE_WITHOUT" && \
    bundle install --jobs 4 --retry 3 && \
    rm -rf /usr/local/bundle/ruby/*/cache /usr/local/bundle/ruby/*/gems/*/doc

# Código da API.
COPY apps/api/ ./

# Prompts versionados (acessíveis via Rails.root.join("vendor/ai-prompts/...")).
COPY packages/ai-prompts ./vendor/ai-prompts

# Precompila bootsnap pra warm boot em prod (ignora erro se faltar SECRET).
RUN SECRET_KEY_BASE=dummy_for_bootsnap_precompile_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
    bundle exec bootsnap precompile -j 1 app/ lib/ config/ || true

# ---------------------------------------------------------------------
# Stage 2 — Runtime: imagem enxuta sem build tools.
# ---------------------------------------------------------------------
FROM ruby:3.3.6-slim AS runtime

ENV LANG=C.UTF-8 \
    RAILS_ENV=production \
    BUNDLE_DEPLOYMENT=1 \
    BUNDLE_PATH=/usr/local/bundle \
    BUNDLE_WITHOUT="development:test" \
    RAILS_LOG_TO_STDOUT=1

# openssh-client: o conector Connectors::WordpressSsh chama wp-cli via SSH.
RUN apt-get update -qq && \
    apt-get install -y --no-install-recommends \
      libpq5 libyaml-0-2 libjemalloc2 curl tini openssh-client && \
    rm -rf /var/lib/apt/lists/*

# jemalloc reduz fragmentação de memória do Ruby.
ENV LD_PRELOAD=libjemalloc.so.2

WORKDIR /app

# User UID 1000 sem privilégios.
RUN groupadd --system --gid 1000 app && \
    useradd --system --uid 1000 --gid 1000 --create-home --shell /bin/bash app

COPY --from=build /usr/local/bundle /usr/local/bundle
COPY --from=build --chown=app:app /app /app

USER app

# Health probe interno — Coolify usa.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl --fail http://localhost:3000/up || exit 1

EXPOSE 3000

# tini = init PID 1 (sinais + zumbis). Sidekiq override CMD em docker-compose.
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["bundle", "exec", "puma", "-C", "config/puma.rb"]
