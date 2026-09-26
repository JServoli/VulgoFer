#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# VulgoFer - setup da VM (Ubuntu 22.04 / Oracle Cloud Always Free)
#
# Idempotente: pode rodar quantas vezes quiser.
#   curl -fsSL https://raw.githubusercontent.com/JServoli/VulgoFer/main/scripts/setup-vm.sh | bash
# ou, ja com o repo clonado:
#   bash scripts/setup-vm.sh
# ---------------------------------------------------------------------------
set -euo pipefail

APP_USER="${APP_USER:-ubuntu}"
APP_DIR="${APP_DIR:-/home/$APP_USER/VulgoFer}"
REPO_URL="${REPO_URL:-https://github.com/JServoli/VulgoFer.git}"
BRANCH="${BRANCH:-main}"
NODE_MAJOR="${NODE_MAJOR:-20}"
ENABLE_AUTO_UPDATE="${ENABLE_AUTO_UPDATE:-0}"   # 1 = liga o timer de auto-deploy

log() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }

# --- 1. Node -----------------------------------------------------------------
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | sed 's/v\([0-9]*\).*/\1/')" -lt "$NODE_MAJOR" ]; then
  log "Instalando Node.js $NODE_MAJOR"
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | sudo -E bash -
  sudo apt-get install -y nodejs
else
  log "Node ja instalado: $(node -v)"
fi
command -v git >/dev/null 2>&1 || sudo apt-get install -y git

# --- 2. Swap (1 GB de RAM nao perdoa) ---------------------------------------
if ! sudo swapon --show | grep -q swapfile; then
  log "Criando swap de 1 GB"
  sudo fallocate -l 1G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
else
  log "Swap ja configurado"
fi

# --- 3. Codigo ---------------------------------------------------------------
if [ -d "$APP_DIR/.git" ]; then
  log "Atualizando repositorio em $APP_DIR"
  git -C "$APP_DIR" fetch --quiet origin "$BRANCH"
  git -C "$APP_DIR" pull --ff-only origin "$BRANCH"
else
  log "Clonando repositorio em $APP_DIR"
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
fi
cd "$APP_DIR"

# --- 4. .env -----------------------------------------------------------------
if [ ! -f .env ]; then
  cp .env.example .env
  chmod 600 .env
  log "!! .env criado a partir do .env.example - preencha o DISCORD_TOKEN antes de subir:"
  echo "   nano $APP_DIR/.env"
  NEEDS_ENV=1
else
  chmod 600 .env
  log ".env ja existe (mantido intacto)"
  NEEDS_ENV=0
fi

# --- 5. Dependencias + comandos slash ---------------------------------------
log "Instalando dependencias"
npm ci --omit=dev
if [ "$NEEDS_ENV" = "0" ]; then
  log "Registrando comandos slash"
  npm run deploy:commands || echo "!! deploy:commands falhou - confira o token no .env"
fi

# --- 6. systemd --------------------------------------------------------------
log "Instalando servico systemd"
sudo install -m 644 deploy/vulgofer-bot.service /etc/systemd/system/vulgofer-bot.service
sudo install -m 644 deploy/vulgofer-update.service /etc/systemd/system/vulgofer-update.service
sudo install -m 644 deploy/vulgofer-update.timer  /etc/systemd/system/vulgofer-update.timer
chmod +x scripts/*.sh
sudo systemctl daemon-reload
sudo systemctl enable --now vulgofer-bot.service

if [ "$ENABLE_AUTO_UPDATE" = "1" ]; then
  log "Ligando auto-deploy (checa o GitHub a cada 10 min)"
  sudo systemctl enable --now vulgofer-update.timer
fi

# --- 7. Status ---------------------------------------------------------------
sleep 3
sudo systemctl --no-pager --full status vulgofer-bot.service || true
log "Pronto. Logs ao vivo:  journalctl -u vulgofer-bot -f"
