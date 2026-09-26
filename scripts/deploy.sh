#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# VulgoFer - deploy: puxa o commit novo do GitHub e reinicia o bot.
# Usado a mao ou pelo timer vulgofer-update.timer.
# Sai em silencio (exit 0) quando nao ha nada novo.
# ---------------------------------------------------------------------------
set -euo pipefail

APP_DIR="${APP_DIR:-/home/ubuntu/VulgoFer}"
BRANCH="${BRANCH:-main}"

cd "$APP_DIR"

git fetch --quiet origin "$BRANCH"
LOCAL="$(git rev-parse HEAD)"
REMOTE="$(git rev-parse "origin/$BRANCH")"

if [ "$LOCAL" = "$REMOTE" ]; then
  echo "[deploy] ja esta na ultima versao ($(git rev-parse --short HEAD))"
  exit 0
fi

echo "[deploy] $(git rev-parse --short HEAD) -> $(git rev-parse --short "origin/$BRANCH")"
# --ff-only: se alguem editou direto na VM, o deploy falha em vez de apagar o trabalho
git pull --ff-only origin "$BRANCH"

if ! git diff --quiet "$LOCAL" "$REMOTE" -- package-lock.json package.json; then
  echo "[deploy] dependencias mudaram - npm ci"
  npm ci --omit=dev
fi

if ! git diff --quiet "$LOCAL" "$REMOTE" -- src/commands.js src/deploy-commands.js; then
  echo "[deploy] comandos slash mudaram - registrando"
  npm run deploy:commands
fi

echo "[deploy] reiniciando servico"
sudo systemctl restart vulgofer-bot.service
sleep 3
systemctl is-active --quiet vulgofer-bot.service \
  && echo "[deploy] ok - rodando em $(git rev-parse --short HEAD)" \
  || { echo "[deploy] FALHOU - ultimos logs:"; journalctl -u vulgofer-bot -n 30 --no-pager; exit 1; }
