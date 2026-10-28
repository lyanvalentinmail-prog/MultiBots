#!/data/data/com.termux/files/usr/bin/bash
# Script de instalación para Termux
set -e

echo "🔄 Actualizando paquetes..."
pkg update -y && pkg upgrade -y

echo "📦 Instalando Node.js y Git..."
pkg install -y nodejs git

echo "📂 Entrando en MultiBots..."
cd "$(dirname "$0")"

echo "📥 Instalando dependencias npm..."
npm install

echo ""
echo "✅ Instalación completada."
echo "Ejecuta el bot con:"
echo "  npm start"
echo "O directamente Satoru Gojo con:"
echo "  npm run satoru"
