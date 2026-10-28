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
├── index.js                   # Selector interactivo de bots
├── package.json
├── install_termux.sh        # Instalador automático para Termux
└── bots/
    └── satoru-gojo/
        ├── index.js         # Conexión a WhatsApp (QR + Pairing code)
        ├── config.js        # Configuración (nombre, owner, API, mensajes)
        ├── message-handler.js # Lógica de comandos y menú
        ├── commands/        # 📂 Carpeta de comandos (organizados por categoría)
        │   ├── index.js     # Punto de entrada (re-exporta loader)
        │   ├── loader.js    # Loader automático: detecta y registra comandos
        │   ├── general.js   # Comandos generales (.ping, .id, .infobot, .owner...)
        │   ├── owners.js    # Comandos de dueño
        │   ├── admins.js    # Comandos de admins de grupo
        │   ├── antis.js     # Antilinks, antispam, etc.
        │   ├── subbot.js    # Comandos de sub-bots
        │   ├── rpg.js       # Juegos RPG (monedas, diario, pescar, banco...)
        │   ├── pokemon.js   # Comandos de Pokémon
        │   ├── perfil.js    # Perfil, cumpleaños, matrimonio
        │   ├── tops.js      # Rankings
        │   ├── busquedas.js # Google, wiki, YouTube...
        │   ├── descargas.js # MP3, MP4, tiktok...
        │   ├── adicionales.js # Notas, translate, tts, calculadora
        │   ├── stickers.js  # Creador de stickers
        │   ├── diversion.js # Ship, memes, tops divertidos
        │   ├── canvas.js    # Edición de imágenes
        │   └── imagenes.js  # Filtros (blur, glitch, pixel...)
        └── assets/
            ├── banner.jpg   # Imagen de Satoru Gojo
            └── menu.html    # Plantilla HTML de referencia del menú
```

## Funcionalidades activas (189 comandos en 17 categorías)

- ✅ **General**: ping, id, infobot, menu, owner, estadoapi
- ✅ **Owners**: mod, delsession, join, bot on/off, setlen, setmenu
- ✅ **Admins de grupo**: ban, sban, warn/delwarn (3 strikes → ban), mute/delmute, open/close, fijar/desfijar, namegp, desgp, photogp, grupo on/off, soloadmin, welcome
- ✅ **Antis**: antilink, antiimg, antiaudio, antivideo, antisticker, antispam, antibot, antidocs, antipalabras con lista personalizable + auto-eliminación + advertencia
- ✅ **Anti-delete**: anuncia cuando alguien borra un mensaje en el grupo
- ✅ **Bienvenida** automática al entrar al grupo
- ✅ **Sub-bots**: qr, code, bots, bot info, setbotname, setbotimg, autoread
- ✅ **RPG/Economía**: balance, coins, transfer, dado, daily, adivinanza, pescar, miner, work, suerte, crimen, cazar, cofre, ppt, banco, deposit, robar, sorpresa, w/rw, claim, tiendag, comprarg, préstamos
- ✅ **Pokémon**: catch (captura aleatoria), pokedex (Velirius API), pokemonbattle
- ✅ **Perfil**: perfil, setbirth/age/desc/fav/genre, birthdays, marry/divorce
- ✅ **Tops**: topcoins, topinactivos, topactivos
- ✅ **Búsquedas**: google, pinterestbuscar, tiktokbuscar, wiki (Wikipedia ES), youtube
- ✅ **Descargas**: facebook, instagram, letra, mp3, mp4, play, tiktok, tiktokaudio, pinterest (todos vía Velirius API)
- ✅ **Reacciones**: 26 reacciones anime (abrazar, besar, golpear, bailar, llorar, reir, etc.) + reacción aleatoria
- ✅ **Adicionales**: nota/delnota, infogrupo, reveal, translate, calculator, tts (Google TTS), stt
- ✅ **Stickers**: .sticker (imagen/video → sticker), s (atajo), brat, bratv (video), bratestirado, attp, ttp, bobesponja/bratcoyote/bratanime/bratpinguino/bratboy, pack, toimg, tovid
- ✅ **Diversión**: ship, topgays, topotakus, topfemboys, meme (Reddit random)
- ✅ **Canvas** (Velirius API): canvaimagen, cuentatiktok, friendship, gaycard, googleimg, iqc/iqcblue/iqcpink, laptop, messengerquote, pc, pov, profilenote, quotly, searched, storyreply, x (tweet)
- ✅ **Filtros de imagen** (Velirius): blur, deepfry, gay, glitch, grayscale, invert, liquify, pixel, sketch, swirl

Todas las funciones se almacenan en `database.json` (usuarios, grupos, monedas, notas, configuraciones) — no necesita base de datos externa.

## ¿Cómo agregar un nuevo comando?

Cada archivo en `bots/<bot>/commands/` exporta un objeto con:
- `title`: título de la categoría (se muestra en el menú)
- `commands`: array de objetos con:
  - `pattern`: nombre del comando (ej: `'hola <nombre>'`). Soporta comandos multi-palabra como `'bot on'`
  - `desc`: descripción que aparece en el menú
  - `fast`: `true` para que aparezca en *Fast command*
  - `handler`: función async `(sock, jid, args, msg) => { ... }` con la lógica

Ejemplo (nuevo archivo `commands/saludos.js`):
```js
module.exports = {
  title: '✺ •• ┈┈ ⋯ Saludos ⋯ ┈┈ •• ✺',
  commands: [
    {
      pattern: 'hola',
      desc: 'Saluda al bot',
      fast: true,
      handler: async (sock, jid) => {
        await sock.sendMessage(jid, { text: '¡Hola! 👋 Soy Satoru Gojo.' });
      }
    }
  ]
};
```
No necesitas importar nada más: el loader lo detecta automáticamente al reiniciar el bot.

### Helpers disponibles
En `bots/satoru-gojo/lib/`:
- `database.js` — `getUser(jid)`, `getGroup(jid)`, `db`, `save()` para persistencia
- `helpers.js` — `isOwner`, `isAdmin(sock,jid,participant)`, `isGroup`, `rand(min,max)`, `pick(array)`, `formatTime(ms)`
- `media.js` — `downloadMsg(msg)`, `sendTextSticker(sock,jid,text,type)`, `sendImageAsSticker(...)`
- `velirius.js` — cliente de la API Velirius: `request(endpoint,params)`, `getImage(endpoint,params)`, `getSticker(endpoint,params)`

---
© MultiBots
