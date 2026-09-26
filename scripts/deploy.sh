#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# VulgoFer - deploy: puxa o commit novo do GitHub e reinicia o bot.
# Usado a mao ou pelo timer vulgofer-update.timer.
#
# So reinicia com alguem na call junto com o bot (scripts/call-guard.js),
# que recebe um aviso antes. Com a call vazia o codigo e atualizado, mas o
# restart fica pendente e e tentado de novo na proxima execucao.
# A versao que esta de fato rodando fica em .deployed-rev.
# ---------------------------------------------------------------------------
set -euo pipefail

APP_DIR="${APP_DIR:-/home/ubuntu/VulgoFer}"
BRANCH="${BRANCH:-main}"
STATE_FILE="$APP_DIR/.deployed-rev"

cd "$APP_DIR"

git fetch --quiet origin "$BRANCH"
[ -f "$STATE_FILE" ] || git rev-parse HEAD > "$STATE_FILE"

DEPLOYED="$(cat "$STATE_FILE")"
REMOTE="$(git rev-parse "origin/$BRANCH")"

if [ "$DEPLOYED" = "$REMOTE" ] && [ "$(git rev-parse HEAD)" = "$REMOTE" ]; then
  echo "[deploy] ja esta na ultima versao ($(git rev-parse --short HEAD))"
  exit 0
fi

if [ "$(git rev-parse HEAD)" != "$REMOTE" ]; then
  echo "[deploy] $(git rev-parse --short HEAD) -> $(git rev-parse --short "$REMOTE")"
  # --ff-only: se alguem editou direto na VM, o deploy falha em vez de apagar o trabalho
  git pull --ff-only origin "$BRANCH"
fi

set +e
node scripts/call-guard.js
GUARD=$?
set -e

case "$GUARD" in
  0) ;;
  3)
    echo "[deploy] restart adiado: ninguem na call com o bot. Codigo ja atualizado; tento de novo na proxima."
    exit 0
    ;;
  *)
    echo "[deploy] guarda da call falhou (codigo $GUARD) - restart cancelado."
    exit 1
    ;;
esac

if ! git diff --quiet "$DEPLOYED" HEAD -- package-lock.json package.json; then
  echo "[deploy] dependencias mudaram - npm ci"
  npm ci --omit=dev
fi

if ! git diff --quiet "$DEPLOYED" HEAD -- src/commands.js src/deploy-commands.js; then
  echo "[deploy] comandos slash mudaram - registrando"
  npm run deploy:commands
fi

echo "[deploy] reiniciando"
if systemctl is-enabled --quiet vulgofer-bot.service 2>/dev/null; then
  sudo systemctl restart vulgofer-bot.service
  sleep 5
  if ! systemctl is-active --quiet vulgofer-bot.service; then
    echo "[deploy] FALHOU - ultimos logs:"
    journalctl -u vulgofer-bot -n 30 --no-pager
    exit 1
  fi
elif command -v pm2 >/dev/null 2>&1 && pm2 describe vulgofer >/dev/null 2>&1; then
  pm2 restart vulgofer --update-env >/dev/null
  sleep 5
  if ! pm2 jlist | node -e 'const l=JSON.parse(require("fs").readFileSync(0,"utf8"));process.exit(l.some(p=>p.name==="vulgofer"&&p.pm2_env.status==="online")?0:1)'; then
    echo "[deploy] FALHOU - ultimos logs:"
    pm2 logs vulgofer --lines 30 --nostream
    exit 1
  fi
else
  echo "[deploy] nem o servico systemd nem o processo pm2 'vulgofer' foram encontrados."
  exit 1
fi

git rev-parse HEAD > "$STATE_FILE"
echo "[deploy] ok - rodando em $(git rev-parse --short HEAD)"
