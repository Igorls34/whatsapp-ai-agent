#!/usr/bin/env bash
# Deploy do whatsapp-ai-agent no homesrv.
#
# Roda como igordev (unit systemd de usuário), chamado pelo CI/CD (runner
# self-hosted) ou manualmente. Nunca usa sudo.
#
# O que faz:
#   1. git fetch + reset para origin/master (limpa qualquer mudança local no código;
#      .env, .sessions/ e data/ são gitignored e ficam intactos).
#   2. npm ci (reconstrói node_modules, inclusive better-sqlite3).
#   3. restart da unit de usuário.
#   4. healthcheck com rollback automático para o commit anterior em caso de falha.
set -euo pipefail

export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"

APP_DIR="/home/igordev/apps/whatsapp-ai-agent"
SERVICE="whatsapp-ai-agent"
BRANCH="master"
WAIT_TOTAL_S=60
WAIT_STEP_S=3
# Healthcheck do app unificado (ajuste se HTTP_PORT/HTTP_HOST mudarem no .env).
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:4000/health}"

cd "$APP_DIR"

OLD_COMMIT="$(git rev-parse HEAD 2>/dev/null || echo '')"

echo "==> [deploy] fetch origin e checkout ${BRANCH}"
git fetch origin --quiet
git checkout -q "${BRANCH}"
git reset --hard -q "origin/${BRANCH}"

echo "==> [deploy] npm ci"
npm ci --no-audit --no-fund

echo "==> [deploy] restart do serviço (systemd --user)"
systemctl --user restart "${SERVICE}"

echo "==> [deploy] healthcheck (até ${WAIT_TOTAL_S}s)"
elapsed=0
while [ "$elapsed" -lt "$WAIT_TOTAL_S" ]; do
  sleep "$WAIT_STEP_S"
  elapsed=$((elapsed + WAIT_STEP_S))

  if systemctl --user is-active --quiet "${SERVICE}"; then
    if curl -sf "${HEALTH_URL}" >/dev/null 2>&1; then
      echo "==> [deploy] OK: serviço ativo e /health respondendo (HTTP unificado)."
      exit 0
    fi
    echo "    serviço ativo, aguardando /health responder..."
  else
    echo "    serviço inativo, aguardando..."
  fi
done

echo "!! [deploy] healthcheck falhou — executando rollback"
if [ -n "$OLD_COMMIT" ] && [ "$OLD_COMMIT" != "$(git rev-parse HEAD)" ]; then
  git reset --hard -q "$OLD_COMMIT"
  npm ci --no-audit --no-fund
  systemctl --user restart "${SERVICE}"
  echo "!! [deploy] rollback para ${OLD_COMMIT} concluído."
else
  echo "!! [deploy] sem commit anterior para rollback (primeiro deploy?)."
fi
exit 1
