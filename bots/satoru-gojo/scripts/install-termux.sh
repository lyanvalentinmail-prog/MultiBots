#!/usr/bin/env bash
# Instalador de este bot. En MultiBots la instalación es del repositorio entero
# (las dependencias viven en la raíz), así que delega en install_termux.sh.
set -euo pipefail

BOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ROOT_DIR="$(cd "$BOT_DIR/../.." && pwd)"

if [ -f "$ROOT_DIR/install_termux.sh" ]; then
  exec bash "$ROOT_DIR/install_termux.sh" "$@"
fi

echo "✖ No se encontró $ROOT_DIR/install_termux.sh"
echo "  Clona el repositorio completo de MultiBots e instala desde su raíz."
exit 1
