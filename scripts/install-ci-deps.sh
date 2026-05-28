#!/usr/bin/env bash
# Bootstrap de dependências do CI local. Idempotente. Trata macOS (brew)
# e Linux (apt). Docker NÃO é instalado automaticamente — usuário precisa
# rodar Docker Desktop / docker.io manualmente (é uma instalação pesada).
#
# Trivy e Semgrep preferem rodar via Docker (aquasec/trivy + returntocorp/
# semgrep), evitando binários globais. Quando indisponíveis, instala via
# pipx (semgrep) ou tarball (trivy).

set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[0;33m'; RED='\033[0;31m'; DIM='\033[2m'; NC='\033[0m'

say()  { printf "${DIM}[bootstrap]${NC} %s\n" "$*"; }
ok()   { printf "${GREEN}✓${NC} %s\n" "$*"; }
warn() { printf "${YELLOW}…${NC} %s\n" "$*"; }
err()  { printf "${RED}✗${NC} %s\n" "$*" >&2; }

OS="$(uname -s)"
ARCH="$(uname -m)"

# ---------------------------------------------------------------------
# Docker — obrigatório para gates db / docker-build / trivy / semgrep.
# ---------------------------------------------------------------------
check_docker() {
  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    ok "docker ok ($(docker version --format '{{.Client.Version}}'))"
    return 0
  fi

  err "docker ausente ou daemon parado."
  case "$OS" in
    Darwin)
      cat <<EOF

  ► Instale Docker Desktop:  https://docs.docker.com/desktop/install/mac-install/
  ► Ou via brew (após brew estar saudável):  brew install --cask docker
  ► Depois inicie o app e re-rode este script.
EOF
      ;;
    Linux)
      cat <<EOF

  ► Ubuntu/Debian:  curl -fsSL https://get.docker.com | sh
  ► Adicione seu usuário ao grupo docker:  sudo usermod -aG docker \$USER
  ► Re-logue e re-rode.
EOF
      ;;
  esac
  return 1
}

# ---------------------------------------------------------------------
# pnpm + Node — node 22+, pnpm 10+. Não instala (suposto já presente).
# ---------------------------------------------------------------------
check_node() {
  local node_v pnpm_v
  if ! command -v node >/dev/null 2>&1; then
    err "node ausente — instale Node 22+. macOS: brew install node@22. Linux: NodeSource."
    return 1
  fi
  node_v="$(node -v | sed 's/v//')"
  ok "node $node_v"

  if ! command -v pnpm >/dev/null 2>&1; then
    warn "pnpm ausente — instalando via corepack…"
    corepack enable && corepack prepare pnpm@10.33.3 --activate
  fi
  pnpm_v="$(pnpm -v)"
  ok "pnpm $pnpm_v"
}

# ---------------------------------------------------------------------
# Ruby + Rails — rbenv local em ~/.rbenv (sem brew). Verifica versão.
# ---------------------------------------------------------------------
check_ruby() {
  local rbenv_dir="$HOME/.rbenv"
  if [[ ! -d "$rbenv_dir/versions/3.3.6" ]]; then
    err "Ruby 3.3.6 ausente em ~/.rbenv. Instale com:"
    cat <<'EOF'

  git clone --depth 1 https://github.com/rbenv/rbenv.git ~/.rbenv
  git clone --depth 1 https://github.com/rbenv/ruby-build.git ~/.rbenv/plugins/ruby-build
  # Pré-req libyaml: ./configure --prefix=$HOME/.local && make install na source de libyaml-0.2.5
  RUBY_CONFIGURE_OPTS="--with-libyaml-dir=$HOME/.local" ~/.rbenv/bin/rbenv install 3.3.6

EOF
    return 1
  fi
  ok "Ruby 3.3.6 ($rbenv_dir/versions/3.3.6/bin/ruby)"
}

# ---------------------------------------------------------------------
# Imagens de CI (pré-pull para falhar rápido no primeiro gate).
# ---------------------------------------------------------------------
prepull() {
  local images=(
    "pgvector/pgvector:pg16"
    "redis:7-alpine"
    "zricethezav/gitleaks:latest"
    "returntocorp/semgrep:latest"
    "aquasec/trivy:latest"
  )
  for img in "${images[@]}"; do
    if docker image inspect "$img" >/dev/null 2>&1; then
      ok "image cache: $img"
    else
      say "pulling $img …"
      docker pull --quiet "$img" >/dev/null
      ok "pulled $img"
    fi
  done
}

main() {
  say "OS=$OS arch=$ARCH"
  check_node    || exit 1
  check_ruby    || exit 1
  check_docker  || exit 1
  prepull
  ok "bootstrap completo — rode ./scripts/local-ci.sh"
}

main "$@"
