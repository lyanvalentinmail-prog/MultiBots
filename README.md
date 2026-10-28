# MultiBots

Colección de bots de WhatsApp construidos con [@whiskeysockets/baileys](https://github.com/WhiskeySockets/Baileys), preparados para correr en **Termux** (Android). Soportan autenticación por **código QR** y por **pairing code** (código de 8 dígitos, sin escanear).

## Bots incluidos

- 🌀 **Satoru Gojo** — `bots/satoru-gojo/`

## Instalación en Termux

```bash
pkg update && pkg upgrade -y
pkg install nodejs git -y
git clone <tu-repo>
cd MultiBots
npm install
```

## Instalación rápida (Termux)
También puedes usar el script automático:
```bash
chmod +x install_termux.sh
./install_termux.sh
```

## Ejecutar

```bash
# Menú interactivo (elige qué bot correr)
npm start

# Ejecutar directo a Satoru Gojo
npm run satoru
```

### Autenticación
La primera vez, el bot te preguntará el método:
1. **Pairing code (recomendado para Termux)** — introduce tu número con código de país sin `+` (ej: `59896719709`). El bot te dará un código de 8 dígitos que debes pegar en *WhatsApp → Dispositivos vinculados → Vincular con código*.
2. **Código QR** — muestra un QR para escanear como normalmente se hace.

La sesión se guarda en `bots/satoru-gojo/auth/` para no volver a iniciar sesión. Si quieres re-vincular, borra esa carpeta.

## Comandos del bot Satoru Gojo
Envía `menu` (también válido `.menu`) en cualquier chat y el bot responderá:
- 🖼️ Imagen de Satoru Gojo con el título **"Satoru gojo"**
- Saludo: **¡Buenos días! ☀️ {usuario}**
- Texto: **Selecciona el menu que necesites**
- Copyright gris: **Ⓒ Satoru gojo**
- Tres botones separados:
  - **Menu** → muestra la lista completa de comandos (General, Owners, Admins, Antis, Sub bot, RPG, Pokémon, Perfil, Tops, Búsquedas, Descargas, Adicionales, Stickers, Diversión, Canvas, Imágenes)
  - **Fast command** → lista rápida de comandos frecuentes
  - **Support** → envía el número `59896719709` con enlace directo a WhatsApp

Otros comandos rápidos: `.ping`, `.id`, `.infobot`, `.owner`.

## Estructura

```
MultiBots/
├── index.js                 # Selector interactivo de bots
├── package.json
├── install_termux.sh        # Instalador automático para Termux
└── bots/
    └── satoru-gojo/
        ├── index.js         # Conexión a WhatsApp (QR + Pairing code)
        ├── config.js        # Configuración (nombre, owner, API, mensajes)
        ├── menu-data.js     # Listas de comandos
        ├── message-handler.js # Lógica de comandos y menú HTML-like
        └── assets/
            ├── banner.jpg   # Imagen de Satoru Gojo
            └── menu.html    # Plantilla HTML de referencia del menú
```

---
© MultiBots
