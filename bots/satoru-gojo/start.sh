#!/usr/bin/env bash
# Arranca Satoru Gojo con reinicio automático.
# En MultiBots las dependencias viven en la raíz del repositorio, no en el bot.
set -u

BOT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$BOT_DIR/../.." && pwd)"
cd "$BOT_DIR"

if ! command -v node >/dev/null 2>&1; then
  echo "✖ Node.js no está instalado. En Termux ejecuta: pkg install nodejs"
  exit 1
fi

node -e "const [major, minor] = process.versions.node.split('.').map(Number); if (major < 20 || (major === 20 && minor < 9)) process.exit(1)" || {
  echo "✖ Se necesita Node.js 20.9 o superior (tienes $(node -v))."
  echo "  En Termux: pkg update && pkg install nodejs"
  exit 1
}

if [ ! -d "$ROOT_DIR/node_modules" ]; then
  echo "☾ Instalando dependencias en $ROOT_DIR …"
  (cd "$ROOT_DIR" && npm ci --no-audit --no-fund) || exit 1
fi

node scripts/ensure-sharp.js

while true; do
  node index.js "$@"
  code=$?
  if [ "$code" -eq 0 ]; then
    exit 0
  fi
  if [ "$code" -eq 42 ]; then
    echo "↻ Reinicio solicitado por el bot…"
  else
    echo "⚠ El proceso terminó con código $code. Reiniciando en 8 segundos…"
    sleep 8
  fi
done
