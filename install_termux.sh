#!/data/data/com.termux/files/usr/bin/bash
# Script de instalación para Termux (también funciona en Linux/macOS)
set -e

cd "$(dirname "$0")"

IS_TERMUX=0
if [ -d "/data/data/com.termux/files/usr" ]; then IS_TERMUX=1; fi

echo "🔄 Actualizando paquetes..."
if [ "$IS_TERMUX" = "1" ]; then
  pkg update -y && pkg upgrade -y
  echo "📦 Instalando Node.js y Git..."
  # `nodejs` (no `nodejs-lts`): garantiza Node >= 19, que trae la Web Crypto
  # global que necesita el *pairing code* de Baileys.
  pkg install -y nodejs git
else
  echo "ℹ️  Entorno no-Termux detectado: se asume que node/npm ya están instalados."
fi

echo "📥 Instalando dependencias npm..."
npm install --no-audit --no-fund

echo ""
echo "🩺 Comprobando que el pairing code funcionará..."
if npm run doctor --silent; then
  DOCTOR_OK=1
else
  DOCTOR_OK=0
fi

# Aviso si el Node es viejo (18): el bot parchea la Web Crypto igualmente,
# pero conviene actualizar.
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
if [ "$NODE_MAJOR" -lt 19 ]; then
  echo ""
  echo "⚠️  Tienes Node $(node -v). El pairing code necesita la Web Crypto global"
  echo "   (Node 19+). El bot la parchea automáticamente, pero lo recomendado es:"
  if [ "$IS_TERMUX" = "1" ]; then
    echo "     pkg uninstall -y nodejs-lts && pkg install -y nodejs"
  else
    echo "     actualiza Node a una versión 20 o superior"
  fi
fi

echo ""
if [ "$DOCTOR_OK" = "1" ]; then
  echo "✅ Instalación completada."
else
  echo "⚠️  Instalación completada, pero el diagnóstico falló (revisa arriba)."
fi
echo ""
echo "Ejecuta el bot con:"
echo "  npm start                            # menú interactivo"
echo "  npm run pairing                      # directo al pairing code (8 dígitos)"
echo "  npm run pairing -- 59896719709       # sin que te pregunte el número"
echo "  npm run qr                           # directo al código QR"
echo "  npm run doctor                       # diagnóstico"
echo "  npm run reset                        # borra la sesión y vuelve a vincular"
