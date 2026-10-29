#!/usr/bin/env bash
# Instalador de MultiBots para Termux (también sirve en Linux/macOS).
set -euo pipefail

cd "$(dirname "$0")"
ROOT_DIR="$(pwd)"

IS_TERMUX=0
[ -d "/data/data/com.termux/files/usr" ] && IS_TERMUX=1

echo "🔄 Actualizando paquetes…"
if [ "$IS_TERMUX" = "1" ]; then
  pkg update -y && pkg upgrade -y
  echo "📦 Instalando Node.js, Git, nano y FFmpeg…"
  # `nodejs` (no `nodejs-lts`): este motor exige Node 20.9 o superior.
  pkg install -y nodejs git nano ffmpeg
else
  echo "ℹ️  Entorno no-Termux: se asume que node/npm ya están instalados."
fi

if ! command -v node >/dev/null 2>&1; then
  echo "✖ Node.js no está instalado. En Termux: pkg install nodejs"
  exit 1
fi

if ! node -e "const [M,m]=process.versions.node.split('.').map(Number); process.exit(M<20||(M===20&&m<9)?1:0)"; then
  echo "✖ Se necesita Node.js 20.9 o superior (tienes $(node -v))."
  if [ "$IS_TERMUX" = "1" ]; then
    echo "  Ejecuta: pkg update && pkg install nodejs"
  fi
  exit 1
fi
echo "✔ Node $(node -v)"

echo "📥 Instalando dependencias npm…"
if [ -f package-lock.json ]; then
  npm ci --no-audit --no-fund || npm install --no-audit --no-fund
else
  npm install --no-audit --no-fund
fi

echo "🖼️  Preparando sharp (nativo o WebAssembly en Termux)…"
npm run fix:sharp --silent || true

echo "🩺 Verificando el bot…"
if npm run check --silent; then
  echo "✔ Verificación correcta"
else
  echo "⚠ La verificación falló; revisa el mensaje anterior."
fi

cat <<EOF

✅ Instalación completada.

Ejecuta el bot con:
  npm start                                  # menú de bots (elige cuál arrancar)
  npm run satoru                             # Satoru Gojo con reinicio manual
  ./bots/satoru-gojo/start.sh                # con reinicio automático

Vinculación con WhatsApp:
  npm run pairing -- --phone=59896719709     # código de 8 dígitos (recomendado)
  npm run qr                                 # escanear QR

Utilidades:
  npm run setup                              # asistente de configuración
  npm run check    (alias: npm run doctor)   # sintaxis + config + plugins
  npm test                                   # $(ls bots/satoru-gojo/tests/*.test.js | wc -l | tr -d ' ') suites de tests
EOF
