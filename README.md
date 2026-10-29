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

# Ir directo al pairing code / al QR / borrar la sesión
npm run pairing
npm run pairing -- 59896719709     # sin que te pregunte el número
npm run qr
npm run reset

# Diagnóstico (Node, Web Crypto, Baileys, estado de la sesión)
npm run doctor
```

### Autenticación
La primera vez, el bot te preguntará el método:
1. **Pairing code (recomendado para Termux)** — introduce tu número con código de país sin `+` (ej: `59896719709`). El bot te dará un código de 8 dígitos que debes pegar en *WhatsApp → Dispositivos vinculados → Vincular un dispositivo → Vincular con código de teléfono*. Caduca a los ~60 segundos; si expira, el bot pide uno nuevo automáticamente (hasta 3 intentos) y después cambia solo al método QR.
2. **Código QR** — muestra un QR para escanear como normalmente se hace.

La sesión se guarda en `bots/satoru-gojo/auth/` para no volver a iniciar sesión. Si quieres re-vincular, usa `npm run reset` o borra esa carpeta.

### 🔧 Solución de problemas con el pairing code en Termux

| Síntoma | Causa | Solución |
|---|---|---|
| `TypeError: Cannot destructure property 'subtle' of 'globalThis.crypto'` o `ReferenceError: crypto is not defined` | Node 18 o inferior: Baileys usa la Web Crypto **global**, que sólo existe por defecto desde Node 19 | Ya está parcheado en `lib/runtime.js`. Aun así, lo ideal es `pkg install nodejs` (Node 20+) |
| Escribes el número y no pasa nada / se queda colgado en `Número:` | El proceso padre (`npm start`) tenía su `readline` abierto y le robaba las teclas al bot | Corregido: el padre libera stdin antes de lanzar el bot. Alternativa sin menú: `npm run pairing -- <número>` |
| Al reiniciar dice *"Sesión guardada detectada"* y entra en bucle sin pedir el código | Un intento de pairing fallido deja `creds.json` con `registered: false`, y la carpeta `auth/` ya no está vacía | Corregido: sólo se considera válida una sesión con `registered: true` y las claves completas; si no, se limpia sola. Manual: `npm run reset` |
| Se queda colgado al arrancar antes de mostrar nada | `fetchLatestBaileysVersion()` consulta `raw.githubusercontent.com` sin timeout (a menudo lento/bloqueado) | Corregido: timeout de 5 s y respaldo a la versión integrada en Baileys |
| `El código caduca` una y otra vez | Tardaste más de ~60 s en introducirlo, o el número no es el de WhatsApp | Corregido: reintenta solo y cae a QR tras 3 fallos. Revisa el número con `npm run doctor` |
| El número tiene `0` delante (ej. `0598...`) | Formato local en vez de internacional | Corregido: se eliminan los ceros de troncal y el prefijo `00`, y avisa si a un `54`/`52` le falta el `9`/`1` del móvil |
| Cada reconexión consume más memoria | Se creaba un socket nuevo sin cerrar el anterior | Corregido: se cierra el socket anterior y la reconexión usa backoff (2 s → 30 s) |

Comprobación rápida:

```bash
npm run doctor
```

Salida esperada:

```
🩺 MultiBots — diagnóstico de pairing code

  Node:            v22.x.x
  Plataforma:      linux (Termux detectado)
  Web Crypto nativa (Node>=19): sí
  PBKDF2/subtle (lo que usa Baileys): ✅ OK
  Baileys:         v6.7.24
  Sesión: ✅ válida (59896719709)

✅ Todo listo para usar el pairing code.
```

## Comandos del bot Satoru Gojo
Envía `menu` (también válido `.menu`, `!menu`, `#menu`, `/menu`) en cualquier chat y el bot responderá:
- 🖼️ Imagen de Satoru Gojo con el título **"Satoru gojo"**
- Saludo: **¡Buenos días! ☀️ {usuario}**
- Texto: **Selecciona el menu que necesites**
- Copyright gris: **Ⓒ Satoru gojo**
- Tres botones separados:
  - **Menu** → muestra la lista completa de comandos (General, Owners, Admins, Antis, Sub bot, RPG, Pokémon, Perfil, Tops, Búsquedas, Descargas, Adicionales, Stickers, Diversión, Canvas, Imágenes)
  - **Fast command** → lista rápida de comandos frecuentes
  - **Support** → envía el número `59896719709` con enlace directo a WhatsApp

Los botones se envían como `interactiveMessage` (native flow). WhatsApp los muestra de forma
intermitente según la cuenta, así que si no llegan el bot envía **automáticamente** el mismo menú
en texto con los tres comandos equivalentes, que funcionan siempre:

| Botón | Comando equivalente |
|---|---|
| Menu | `.menufull` |
| Fast command | `.fastcommand` |
| Support | `.support` |

Otros comandos rápidos: `.ping`, `.id`, `.infobot`, `.owner`.

### Cómo se reconocen los comandos
- Prefijos aceptados: `.`, `!`, `#`, `/` (el principal es `.`, configurable en `config.js`).
- La coincidencia es por **palabra completa**: `sol` no dispara `.s`, ni `identidad` dispara `.id`.
- Los mensajes **sin prefijo no disparan nada**, salvo los marcados con `noPrefix: true` (`menu`).
- Los comandos también funcionan como **leyenda de una imagen o video** (`.sticker` sobre una foto),
  y dentro de `ephemeralMessage` / `viewOnceMessage` (grupos con mensajes temporales).
- Entre varios candidatos gana el patrón más largo (`bot on` antes que `bot`).

### ¿Los comandos no responden?
1. Envía `.ping` — si no responde, mira la consola de Termux: ahora cualquier error del handler se
   registra **y** se le avisa al usuario en el chat (antes se tragaba en silencio).
2. `npm run doctor` — estado de Node/Baileys/sesión.
3. Si el bot está apagado (`.bot off`), sólo responde al owner hasta que haga `.bot on`.
4. En grupos, los admins y el owner no son censurados por los *antis*.

## Estructura

```
MultiBots/
├── index.js                   # Selector interactivo de bots (libera stdin antes de lanzar el bot)
├── package.json
├── install_termux.sh        # Instalador automático para Termux + verificación
└── bots/
    └── satoru-gojo/
        ├── index.js         # Conexión a WhatsApp (QR + Pairing code, reintentos y respaldo)
        ├── config.js        # Configuración (nombre, owner, API, mensajes)
        ├── message-handler.js # Lógica de comandos y menú
        ├── lib/
        │   ├── runtime.js   # 🩹 Parche Web Crypto (Node 18/Termux), sesión, teléfono, `npm run doctor`
        │   ├── database.js
        │   ├── helpers.js
        │   ├── media.js
        │   └── velirius.js
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

## Funcionalidades activas (192 comandos en 17 categorías)

- ✅ **General**: ping, id, infobot, menu, menufull, fastcommand, support, owner, estadoapi
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
  - `noPrefix`: `true` para que funcione sin `.` (por defecto hace falta prefijo)
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
- `runtime.js` — `patchWebCrypto()` (fix del pairing code en Node 18/Termux), `verifyPairingCrypto()`, `nodeInfo()`, `normalizePhone(raw)`, `sessionState(authDir)`, `clearSession(authDir)`. Ejecutable como diagnóstico: `npm run doctor`
- `database.js` — `getUser(jid)`, `getGroup(jid)`, `db`, `save()` para persistencia
- `helpers.js` — `isOwner`, `isAdmin(sock,jid,participant)`, `isGroup`, `rand(min,max)`, `pick(array)`, `formatTime(ms)`
- `media.js` — `downloadMsg(msg)`, `sendTextSticker(sock,jid,text,type)`, `sendImageAsSticker(...)`
- `velirius.js` — cliente de la API Velirius: `request(endpoint,params)`, `getImage(endpoint,params)`, `getSticker(endpoint,params)`

---
© MultiBots
