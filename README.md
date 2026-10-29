# MultiBots

Colección de bots modulares de WhatsApp construidos con [Baileys](https://github.com/WhiskeySockets/Baileys), preparados para correr en **Termux** (Android). Autenticación por **pairing code** (8 dígitos, sin escanear) o **código QR**.

Cada bot es autónomo dentro de `bots/<nombre>/` y sigue la misma arquitectura: motor en `src/`, funcionalidad en `plugins/`, configuración en `config.json` y tests en `tests/`.

## Bots incluidos

- 🌀 **Satoru Gojo** — `bots/satoru-gojo/` · 225 plugins · 412 alias · 18 categorías

## Requisitos

- **Node.js 20.9 o superior** (el motor usa la Web Crypto global y `--watch`)
- FFmpeg (para stickers de video y notas de voz)

En Termux:

```bash
pkg update && pkg upgrade -y
pkg install -y nodejs git nano ffmpeg
```

## Instalación

```bash
git clone <tu-repo> MultiBots
cd MultiBots
npm ci            # o: npm install

# o todo de una vez (Termux):
chmod +x install_termux.sh && ./install_termux.sh
```

El instalador verifica la versión de Node, prepara **sharp** (nativo o WebAssembly en Termux) y ejecuta `npm run check`.

## Ejecutar

```bash
npm start                                  # menú de bots: eliges cuál arrancar
npm run satoru                             # Satoru Gojo (con prepare-sharp)
npm run satoru:raw                         # sin preparar sharp
npm run dev                                # con --watch (reinicia al editar)
./bots/satoru-gojo/start.sh                # bucle con reinicio automático
```

### Vinculación con WhatsApp

```bash
npm run pairing -- --phone=59896719709     # 🔢 código de 8 dígitos (recomendado en Termux)
npm run qr                                 # 📷 escanear QR
npm start                                  # te pregunta el método
PAIRING_NUMBER=59896719709 npm run pairing # por variable de entorno
```

Con el pairing code: *WhatsApp → ⋮ → Dispositivos vinculados → Vincular un dispositivo → **Vincular con código de teléfono*** y escribes el código. Caduca a los ~60 s.

La sesión queda en `bots/<bot>/sessions/`. Para volver a vincular: `.delsession` (owner, desde WhatsApp) o borra esa carpeta.

### Utilidades

```bash
npm run setup      # asistente interactivo para config.json
npm run check      # sintaxis + config válida + banner + plugins (alias: npm run doctor)
npm run fix:sharp  # reintenta preparar sharp
npm test           # 111 tests (node --test)
```

`config.json` se **recarga solo** al editarlo, con el bot en marcha.

## Nuestro menú

Envía `menu` (también `.menu`, `!menu`, `#menu`, `/menu`) y el bot responde con:

- 🖼️ El banner de Satoru Gojo (`assets/banner.jpg`)
- Título **\*Satoru gojo\***
- Saludo **¡Buenos días! ☀️ {usuario}**
- **Selecciona el menu que necesites**
- Copyright **Ⓒ Satoru gojo**
- Tres botones:

| Botón | Comando equivalente | Qué hace |
|---|---|---|
| **Menu** | `.menufull` | Lista completa de comandos por categoría |
| **Fast command** | `.fastcommand` | Lista rápida de comandos frecuentes |
| **Support** | `.support` | Número de soporte con enlace a WhatsApp |

### Tipo de botones (`menu.buttonStyle`)

WhatsApp no dibuja igual cada tipo de botón, así que el estilo es configurable y se puede probar en vivo con **`.menustyle <tipo>`** (owner): guarda el estilo y envía el menú con él para que lo veas en tu teléfono.

| Tipo | Mensaje que viaja | Cómo se ve |
|---|---|---|
| **`template`** _(por defecto)_ | `templateMessage` (plantilla hidratada) | Los 3 botones **separados**, cada uno en su fila |
| `native` | `interactiveMessage` (native flow `quick_reply`) | Los 3 chips en una fila, pegados al mensaje |
| `buttons` | `buttonsMessage` clásico | Botones separados, hasta 3 |
| `sheet` | `interactiveMessage` con `bottom_sheet` | Un botón que abre una hoja con las 3 opciones separadas por divisores |
| `carousel` | `interactiveMessage` con `carouselMessage` | Una tarjeta por botón, cada una con su banner |

> `template` y `buttons` son los formatos clásicos: se ven en WhatsApp Web/Escritorio e iOS y en canales, pero **algunos clientes Android los ignoran**. Si en tu teléfono no aparecen, prueba `.menustyle native` (o `sheet`) y se guarda solo.

Pulsar cualquier botón responde igual sea cual sea el estilo: el handler lee `templateButtonReplyMessage`, `buttonsResponseMessage`, `listResponseMessage` e `interactiveResponseMessage`. Si el envío falla, el bot manda **automáticamente** el banner más un menú de texto con los tres comandos, que funcionan siempre.

### La tarjeta aparece con el menú (sin mandar archivos)

Cada `.menu` se ve en el chat como una **tarjeta-imagen** compuesta en el propio bot (`src/utils/card.js`): el banner arriba, fundido con el cuerpo oscuro, y debajo el título, el saludo con tu nombre, *Selecciona el menu que necesites*, el conteo de comandos, el copyright y **los tres botones separados, uno por fila** (con su comando al lado, y Support con su enlace). Los botones reales de WhatsApp van debajo, pulsables.

- No se envía ningún archivo: la tarjeta *es* la imagen del mensaje. Si no se puede componer (falta la fuente, falla sharp), el menú usa el banner de siempre y nada se rompe.
- `menu.cardEnabled: false` vuelve al banner original; `menu.cardFont` cambia la fuente.
- Detalle de Termux: el sharp de WebAssembly usa resvg, que **no carga fuentes**, así que `<text>` saldría en blanco. Por eso cada texto se convierte en trayectorias `<path>` con `opentype.js` y la DejaVu Sans que vive en `assets/fonts/`: se ve igual en nativo y en wasm. Los glifos que la fuente no tiene (emoji, CJK…) se descartan sólo en la imagen; en el texto del mensaje siguen intactos.

El HTML (`assets/menu.html`) queda como versión para navegador, **sólo si la pedís**:

- `.menuhtml` (o `.menu html`) la envía como documento.
- `.setmenuhtml on|off` (owner) hace que vuelva a adjuntarse con cada menú; también `config.json → menu.htmlEnabled`.
- `menu.htmlTemplate` permite usar otra plantilla. Se rellenan los marcadores `{title}`, `{botName}`, `{greeting}`, `{usuario}`, `{selectMenu}`, `{copyright}`, `{stats}`, `{banner}`, `{buttons}` y `{year}`; todo lo que venga del usuario se escapa.

Todo el texto del menú es configurable en `config.json → menu`.

Además:

- `.menu <categoría>` muestra una categoría (ej. `.menu rpg`, `.menu descargas`).
- Con `menuMode: "list"` (`.setmenu lista`) el menú usa la lista desplegable de categorías (sin tarjeta HTML).
- Con `menuMode: "text"` (`.setmenu texto`) siempre va en texto.

### Reglas de reconocimiento

- Prefijo por defecto `.` (configurable); los comandos **exigen prefijo**.
- Excepción: `menu` y `help` funcionan sin prefijo (`noPrefix: true`).
- Coincidencia por palabra completa: `sol` no dispara `.s`, `identidad` no dispara `.id`.
- Gana el alias más largo (`bot on` antes que `bot`).
- Los comandos también funcionan como **leyenda** de imagen/video y dentro de `ephemeralMessage` / `viewOnceMessage`.
- Cooldown por usuario y comando (`cooldownMs`), salvo owner/mods.

## Estructura

```
MultiBots/
├── index.js                     # Manager: elige el bot y lo lanza (libera stdin antes)
├── package.json                 # ESM ("type": "module"), deps y scripts
├── install_termux.sh            # Instalador para Termux
└── bots/
    └── satoru-gojo/
        ├── index.js             # Entrada: vinculación (QR/pairing), socket, reconexión
        ├── config.json          # Identidad, prefijo, owners, banner, menú, API
        ├── start.sh             # Arranque con reinicio automático
        ├── assets/
        │   ├── banner.jpg       # Imagen del menú
        │   ├── menu.html        # 🔶 Plantilla de la tarjeta HTML del menú
        │   ├── fonts/           # 🔶 DejaVu Sans: la tarjeta dibuja sus textos con ella
        │   └── characters.json  # Personajes del gacha
        ├── plugins/             # ⬅ TODA la funcionalidad (22 archivos, 225 plugins, 412 alias)
        │   ├── main.js          # (10) menu, menuhtml, menufull, fastcommand, support, ping, infobot, estadoapi, owner, id
        │   ├── moderation.js    # (24) mod, sban, warn/delwarn/warnings, mute/delmute, fijar/desfijar,
        │   │                    #      photogp, grupo, soloadmin, welcome + los 11 antis
        │   ├── owner.js         # (15) setprefix, setbotname, setfooter, setbanner, setmenu, menustyle,
        │   │                    #      setmenuhtml, setmode, setautoread, setapi, addowner, delowner,
        │   │                    #      reload, restart, config
        │   ├── system.js        # (4) delsession, join, bot on/off/info, setlen
        │   ├── subbots.js       # (3) qr, code, bots
        │   ├── group.js         # (12) kick, add, promote, demote, open, close, setgroupname,
        │   │                    #      setgroupdesc, tagall, delete, link, infogroup
        │   ├── economy.js       # (10) balance, daily, work, transf, banco, unirsebank, change,
        │   │                    #      deposit, withdraw, topcoins
        │   ├── games.js         # (14) dado, adivinanza, pescar, miner, suerte, crimen, cazar, cofre,
        │   │                    #      ppt, ahorcado, prestamo, pagar, robar, sorpresa
        │   ├── gacha.js         # (2) w, claim
        │   ├── characters.js    # (8) harem, vharem, darhr, vender, cancelarg, tiendag, comprarg, topharem
        │   ├── pokemon.js       # (3) catch, pokedex, pokemonbattle
        │   ├── profile.js       # (13) perfil, setdesc/setfav/setname/setage/setgenre/delgenre,
        │   │                    #      setbirth/delbirth, birthdays, allbirthdays, marry, divorce
        │   ├── search.js        # (5) google, yts, ttsearch, wiki, pinterest
        │   ├── downloads.js     # (9) play, mp3, mp4, tiktok, tiktokaudio, facebook, instagram, pindl, letra
        │   ├── reactions.js     # (26) hug, kiss, pat, slap, cuddle, wave, wink, blush, smile, happy,
        │   │                    #      dance, cry, poke, tickle, highfive, handhold, nom, bite, bonk,
        │   │                    #      baka, smug, laugh, shrug, sleep, think, thumbsup
        │   ├── stickersmaker.js # (13) brat, bratvideo, bratestirado, bratanime, bratcoyote,
        │   │                    #      bratpinguino, bratboy, attp, ttp, absolutecinema, bobesponja,
        │   │                    #      sgay, emojimix
        │   ├── stickerseditor.js# (4) sticker, toimg, tovid, pack
        │   ├── canvas.js        # (20) quotly, iqc/iqcblue/iqcpink, messengerquote, profilenote, pov, x,
        │   │                    #      cuentatiktok, storyreply, canvaimagen, laptop, pc, googleimg,
        │   │                    #      searched, pokemoncard, ship, friendship, gaycard, resize
        │   ├── effects.js       # (16) gay, invert, grayscale, blur, pixel, deepfry, sketch, swirl,
        │   │                    #      liquify, glitch, rata, banana, arandano, pan, galletita, minions
        │   ├── extras.js        # (6) nota, delnota, reveal, topactivos, topinactivos, meme
        │   ├── fun.js           # (3) topgays, topotakus, topfemboys
        │   └── tools.js         # (5) calc, traducir, tts, stt, morse
        ├── src/                 # Motor (no se toca para añadir comandos)
        │   ├── handler.js       # Dispatch: permisos, cooldown, antis, contexto
        │   ├── plugins.js       # PluginRegistry: carga y valida plugins/
        │   ├── menu.js          # 🔶 Nuestro menú: header, botones, fast, categorías
        │   ├── interactive.js   # 🔶 Entrega del menú (5 tipos de botones + respaldos)
        │   ├── html.js          # 🔶 Tarjeta HTML del menú (plantilla + banner base64)
        │   ├── config.js        # config.json con validación, escritura atómica y watch
        │   ├── database.js      # data/database.json (usuarios, chats, stats)
        │   ├── moderation.js    # Motor de antis (antilink, antispam, antidelete…)
        │   ├── subbots.js       # Gestor de sub-bots con sesiones propias
        │   ├── api.js           # Cliente de Velirius API (fetch, timeouts, límites)
        │   └── utils/           # card (🔶 tarjeta del menú), format, jid, media,
        │                        # messages, sticker, canvas, characters, chat,
        │                        # economy, gif, group, paths, welcome
        ├── scripts/
        │   ├── ensure-sharp.js  # sharp nativo o WebAssembly (Termux)
        │   ├── configure.js     # `npm run setup`
        │   ├── check.js         # `npm run check`
        │   └── install-termux.sh
        ├── sessions/            # credenciales (gitignored)
        ├── data/                # database.json (gitignored)
        └── tests/               # 22 suites, 111 tests (node --test)
```

🔶 = archivos donde vive **nuestro** menú; el resto del motor es el original.

### Rutas independientes del directorio de trabajo

`npm start` lanza el bot desde la raíz del repositorio y `npm test` también corre desde ahí, así que ninguna ruta depende de `process.cwd()`: `src/utils/paths.js` expone `BOT_ROOT` y `resolveBot()`, y por ahí se resuelven `config.json`, `plugins/`, `assets/`, `sessions/` y `data/`.

## Cómo añadir un comando

Crea (o edita) un archivo en `bots/<bot>/plugins/` y exporta un arreglo de definiciones:

```js
export default [
  {
    commands: ['hola', 'hello'],        // el primero es el canonical; el resto, alias
    category: 'general',
    description: 'Saluda al bot.',
    usage: '[nombre]',                  // opcional, aparece en el menú
    // Banderas opcionales:
    // owner: true        sólo owners (y mods si además pones mod: true)
    // admin: true        sólo admins del grupo
    // botAdmin: true     el bot debe ser admin
    // group: true        sólo en grupos
    // private: true      sólo en privado
    // noPrefix: true     funciona sin '.'
    // fast: true         aparece en "Fast command"
    // needsGroupMetadata: true
    async execute(ctx) {
      const nombre = ctx.text || 'usuario'
      await ctx.react('👋')
      return ctx.reply(`¡Hola, ${nombre}! Soy ${ctx.config.botName}.`)
    },
  },
]
```

`ctx` trae: `sock`, `m` (mensaje serializado), `config`, `configStore`, `db`, `registry`, `api` (Velirius), `args`, `text`, `usedPrefix`, `isOwner`, `isMod`, `isGroup`, `isAdmin`, `isBotAdmin`, `groupMetadata`, `participants`, `send()`, `reply()`, `react()`.

El loader valida que exista `execute()` y `commands`, y **falla si un alias está duplicado** en dos plugins. Para que aparezca en el menú, añádelo a `MENU_LAYOUT` en `src/menu.js`.

## Configuración (`config.json`)

| Campo | Descripción |
|---|---|
| `botName`, `prefix`, `footer` | Identidad del bot |
| `owners`, `ownerLids`, `mods` | Números con permisos |
| `banner` | Ruta o URL de la imagen del menú |
| `menu` | `title`, `greeting`, `selectMenu`, `copyright`, `supportText`, `buttons` |
| `menu.buttonStyle` | `template` (botones separados, por defecto), `native`, `buttons`, `sheet` o `carousel` — se prueba con `.menustyle` |
| `menu.cardEnabled`, `menu.cardFont` | Tarjeta-imagen que aparece con el menú y su fuente (`assets/fonts/`) |
| `menu.htmlEnabled`, `menu.htmlTemplate` | HTML para navegador: por defecto no se envía (`.menuhtml` lo pide) — `.setmenuhtml on|off` |
| `menu.optionsText` | Título del botón cuando `buttonStyle` es `sheet` |
| `menuMode` | `interactive` (nuestro menú con botones), `list` o `text` |
| `mode` | `public` o `self` (sólo owners/mods) |
| `sessionDir`, `language`, `autoRead`, `cooldownMs`, `logLevel` | Comportamiento |
| `api` | `baseUrl`, `timeoutMs`, `maxMediaMB` de Velirius API |

La configuración se valida al cargar y al guardar (`normalizeConfig`): un valor inválido no rompe el bot en marcha, se conserva la última configuración válida.

## Solución de problemas

| Síntoma | Causa | Solución |
|---|---|---|
| `✖ Este bot necesita Node.js 20.9 o superior` | Node viejo (el motor usa Web Crypto global) | `pkg update && pkg install nodejs` |
| Escribes el número y no pasa nada al vincular | El proceso padre tenía el `readline` abierto y le robaba las teclas al bot | Ya corregido: el manager libera stdin antes de lanzar el hijo. Alternativa: `npm run pairing -- --phone=<número>` |
| No aparece el código de pairing | Número con `+`, espacios o el `0` de la troncal local | Usa sólo dígitos con código de país (ej. `59896719709`) |
| Se queda colgado al arrancar | Sin salida a `web.whatsapp.com` | Revisa la red; el bot reintenta con backoff |
| El menú llega sin botones | WhatsApp no habilitó `interactiveMessage` en esa cuenta | Automático: llega el banner + menú de texto con `.menufull`, `.fastcommand`, `.support` |
| Los stickers fallan | sharp no disponible | `npm run fix:sharp` (instala la variante WebAssembly) |
| Un comando no responde | Error dentro del plugin | El bot responde con el motivo y lo registra en consola |
| Cambios en un plugin no se aplican | El loader cachea módulos | `npm run dev` (watch) o reinicia el bot |

Diagnóstico rápido:

```bash
npm run check
# ✔ Sintaxis correcta: 49 archivos
# ✔ Configuración válida y banner disponible
# ✔ Plugins válidos: 225 comandos (412 alias)
```

## Tests

```bash
npm test     # 111 tests en 22 suites
```

Cubren el registro de plugins, el handler (permisos, cooldown, antis), el menú (nuestro diseño, botones, respaldos, filtros por rol), la API, economía, juegos, gacha, personajes, Pokémon, perfil, reacciones, stickers, canvas, sub-bots, moderación y configuración.

## Créditos

El motor (`src/`), los 22 archivos de `plugins/`, los `scripts/` y las suites de `tests/` de `bots/satoru-gojo/` provienen de [Velirius-bot-g](https://github.com/lyanvalentinmail-prog/Velirius-bot-g) (MIT, © Velirius Bot contributors), que se conserva en `bots/satoru-gojo/LICENSE`.

Sobre esa base, en MultiBots:

- La estructura se adaptó al layout multi-bot (`bots/<nombre>/` autónomo) y las rutas ya no dependen de `process.cwd()` (`src/utils/paths.js`).
- El menú es **nuestro**: banner de Satoru Gojo, saludo, "Selecciona el menu que necesites", copyright y los tres botones *Menu / Fast command / Support* con sus respaldos (`src/menu.js`, `src/interactive.js`).
- Los plugins `menufull`, `fastcommand` y `support`, y que `menu` funcione sin prefijo.
- El manager de la raíz (`index.js`) y el instalador de Termux.

Los datos de personajes/gacha y la API son de Velirius (`config.json → api.baseUrl`).

---
© MultiBots · MIT
