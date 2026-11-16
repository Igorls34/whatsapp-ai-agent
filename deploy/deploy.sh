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
#   3. restart da unit de usuário (exportando o commit para o /health).
#   4. healthcheck em /health **conferindo a versão** que está no ar.
#   5. rollback automático para o commit anterior se o healthcheck/versão falhar.
set -euo pipefail

export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"

APP_DIR="/home/igordev/apps/whatsapp-ai-agent"
SERVICE="whatsapp-ai-agent"
BRANCH="master"
WAIT_TOTAL_S=60
WAIT_STEP_S=3
# Healthcheck do app unificado (ajuste se HTTP_PORT/HTTP_HOST mudarem no .env).
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:4000/health}"

# Lê um campo de app.* do JSON do /health (vazio se não existir/ inválido).
ler_health() {
  node -e '
    let dados = "";
    process.stdin.on("data", (c) => (dados += c)).on("end", () => {
      try {
        const j = JSON.parse(dados);
        process.stdout.write(String(j?.app?.[process.argv[1]] ?? ""));
      } catch {
        process.stdout.write("");
      }
    });
  ' "$1"
}

cd "$APP_DIR"

OLD_COMMIT="$(git rev-parse HEAD 2>/dev/null || echo '')"

echo "==> [deploy] fetch origin e checkout ${BRANCH}"
git fetch origin --quiet
git checkout -q "${BRANCH}"
git reset --hard -q "origin/${BRANCH}"

COMMIT="$(git rev-parse HEAD)"
VERSION="$(node -p "require('./package.json').version")"
echo "==> [deploy] commit ${COMMIT:0:7} (v${VERSION})"

echo "==> [deploy] npm ci"
npm ci --no-audit --no-fund

echo "==> [deploy] restart do serviço (systemd --user)"
# O app lê APP_COMMIT e reporta no /health (prova de qual código está rodando).
systemctl --user set-environment APP_COMMIT="${COMMIT}" 2>/dev/null || true
systemctl --user restart "${SERVICE}"

echo "==> [deploy] healthcheck em ${HEALTH_URL} (até ${WAIT_TOTAL_S}s)"
elapsed=0
while [ "$elapsed" -lt "$WAIT_TOTAL_S" ]; do
  sleep "$WAIT_STEP_S"
  elapsed=$((elapsed + WAIT_STEP_S))

  if ! systemctl --user is-active --quiet "${SERVICE}"; then
    echo "    serviço inativo, aguardando..."
    continue
  fi

  if ! corpo="$(curl -sf "${HEALTH_URL}" 2>/dev/null)"; then
    echo "    serviço ativo, aguardando /health responder..."
    continue
  fi

  no_ar="$(printf '%s' "$corpo" | ler_health versao)"
  if [ -z "$no_ar" ]; then
    echo "    /health sem app.versao (versão anterior à v0.6.1?) — aguardando..."
    continue
  fi
  if [ "$no_ar" != "$VERSION" ]; then
    echo "    no ar v${no_ar}, esperando v${VERSION}..."
    continue
  fi

  commit_no_ar="$(printf '%s' "$corpo" | ler_health commit)"
  if [ -n "$commit_no_ar" ] && [ "$commit_no_ar" != "$COMMIT" ]; then
    echo "    commit no ar ${commit_no_ar:0:7}, esperando ${COMMIT:0:7}..."
    continue
  fi

  echo "==> [deploy] OK: v${VERSION} (${COMMIT:0:7}) no ar e /health respondendo."
  exit 0
done

echo "!! [deploy] healthcheck/versão falhou — executando rollback"
if [ -n "$OLD_COMMIT" ] && [ "$OLD_COMMIT" != "$COMMIT" ]; then
  git reset --hard -q "$OLD_COMMIT"
  npm ci --no-audit --no-fund
  systemctl --user set-environment APP_COMMIT="${OLD_COMMIT}" 2>/dev/null || true
  systemctl --user restart "${SERVICE}"
  echo "!! [deploy] rollback para ${OLD_COMMIT:0:7} concluído."
else
  echo "!! [deploy] sem commit anterior para rollback (primeiro deploy?)."
fi
exit 1
