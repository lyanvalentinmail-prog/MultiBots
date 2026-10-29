import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import sharp from 'sharp'
import opentype from 'opentype.js'
import { isHttpUrl } from './format.js'
import { packageVersion, resolveBot } from './paths.js'
import { fetchWeather } from './weather.js'

/**
 * Tarjeta del menú compuesta en local, calcada de los ejemplos reales de
 * WhatsApp que están en Drive (carpeta "Ejemplos"): el banner se funde con el
 * cuerpo oscuro, título en mayúsculas, saludo con la mano, fichas ESTADO /
 * MODO / TOTAL DE COMANDOS / TIEMPO DE ACTIVIDAD, ficha CLIMA con ciudad, la
 * fila verde con la HORA (con segundos) y la fecha, el aviso de
 * `.menu <categoría>` y el pie con el nombre del bot. Los botones NO viven en
 * la imagen: van en su mensaje aparte, en vertical y separados.
 *
 * Detalle importante: el sharp de Termux corre sobre WebAssembly y su
 * renderizador SVG (resvg) no carga fuentes, así que `<text>` sale en blanco.
 * Por eso cada texto se convierte en `<path>` con opentype.js y la fuente
 * DejaVu que viaja en assets/fonts/, y los iconos son formas SVG simples:
 * se ve igual en nativo y en wasm.
 */

export const CARD_WIDTH = 1080
export const CARD_BANNER_HEIGHT = 608
export const DEFAULT_CARD_FONT = './assets/fonts/DejaVuSans.ttf'

const PAD = 56
const GAP = 24
const TILE_HEIGHT = 132
const HINT_HEIGHT = 104
const BODY_BACKGROUND = '#0d1117'

const COLORS = {
  title: '#ffffff',
  name: '#ffffff',
  muted: '#9aa4b2',
  label: '#8b949e',
  value: '#e6edf3',
  tile: '#161b22',
  tileBorder: '#262d37',
  hourTile: '#0f2117',
  hourBorder: '#2ea043',
  hourAccent: '#3fb950',
  amber: '#e3b341',
  foot: '#8b7bd8',
  footName: '#3fb950',
}

const fontCache = new Map()

/** Fuente parseada y cacheada (parsear 760 KB en cada menú se nota). */
export async function loadCardFont(file = DEFAULT_CARD_FONT) {
  const key = String(file)
  if (!fontCache.has(key)) {
    const promise = readFile(resolveBot(key)).then(buffer => opentype.parse(new Uint8Array(buffer).buffer))
    fontCache.set(key, promise)
    promise.catch(() => fontCache.delete(key))
  }
  return fontCache.get(key)
}

/** Equivalencias para glifos que la fuente no trae (Ⓒ existe en el HTML, © en la tarjeta). */
const CARD_CHAR_SUBSTITUTIONS = { '\u24B8': '\u00A9' }

/** DejaVu no cubre todos los scripts: lo que no tiene glifo se descarta. */
export function drawableText(font, text = '') {
  return String(text)
    .replace(/[Ⓒ]/g, character => CARD_CHAR_SUBSTITUTIONS[character] || character)
    .replace(/[\uFE0F\u200D]/g, '')
    .split('')
    .filter(character => character === ' ' || font.charToGlyph(character).index !== 0)
    .join('')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export function textWidth(font, text, size) {
  return font.getAdvanceWidth(text, size)
}

/** Ajusta el cuerpo de letra (y recorta si hace falta) para entrar en `maxWidth`. */
export function fitText(font, text, size, maxWidth) {
  const clean = drawableText(font, text)
  if (!clean) return { text: '', size, width: 0 }
  let current = size
  while (current > size * 0.6 && textWidth(font, clean, current) > maxWidth) current -= 1
  let value = clean
  if (textWidth(font, value, current) > maxWidth) {
    while (value.length > 1 && textWidth(font, `${value}…`, current) > maxWidth) value = value.slice(0, -1)
    value = `${value.trim()}…`
  }
  return { text: value, size: current, width: textWidth(font, value, current) }
}

const escapeAttribute = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function textPath(font, text, { x, y, size, fill, fauxBold = 0, anchor = 'start', maxWidth = CARD_WIDTH - PAD * 2 }) {
  const fitted = fitText(font, text, size, maxWidth)
  if (!fitted.text) return { svg: '', height: size, width: 0 }
  const path = font.getPath(fitted.text, 0, 0, fitted.size).toPathData(2)
  const offsetX = anchor === 'middle' ? -fitted.width / 2 : anchor === 'end' ? -fitted.width : 0
  const stroke = fauxBold ? ` stroke="${fill}" stroke-width="${fauxBold}" stroke-linejoin="round"` : ''
  return {
    svg: `  <path d="${escapeAttribute(path)}" fill="${fill}"${stroke} transform="translate(${(x + offsetX).toFixed(2)} ${y.toFixed(2)})"/>`,
    height: size,
    width: fitted.width,
  }
}

/** Varios tramos de texto seguidos en la misma línea, cada uno con su color. */
function segmentsPath(font, segments, { x, y, size, maxWidth = CARD_WIDTH - PAD * 2, anchor = 'start' }) {
  const clean = segments
    .map(segment => {
      const raw = String(segment.text || '')
      return {
        ...segment,
        lead: raw.startsWith(' '),
        trail: raw.endsWith(' '),
        text: drawableText(font, raw),
      }
    })
    .filter(segment => segment.text)
  if (!clean.length) return { svg: '', height: size, width: 0 }
  let current = size
  // drawableText recorta los espacios de los bordes: se miden aparte para que
  // "Escribe " + ".menu <categoría>" + " para ver…" no queden pegados.
  const space = () => textWidth(font, ' ', current)
  const widthOf = segment => textWidth(font, segment.text, current) + (segment.lead ? space() : 0) + (segment.trail ? space() : 0)
  const total = () => clean.reduce((sum, segment) => sum + widthOf(segment), 0)
  while (current > size * 0.6 && total() > maxWidth) current -= 1
  let offset = anchor === 'middle' ? -total() / 2 : 0
  const parts = []
  for (const segment of clean) {
    if (segment.lead) offset += space()
    const drawn = textPath(font, segment.text, {
      x: x + offset,
      y,
      size: current,
      fill: segment.fill,
      fauxBold: segment.fauxBold || 0,
      maxWidth: maxWidth * 2,
    })
    parts.push(drawn.svg)
    offset += textWidth(font, segment.text, current)
    if (segment.trail) offset += space()
  }
  return { svg: parts.filter(Boolean).join('\n'), height: current, width: total() }
}

/* --- Iconos: formas SVG simples (resvg wasm no dibuja texto ni emoji) ----- */

const icon = (x, y, color, body) => `  <g transform="translate(${x} ${y})" fill="none" stroke="${color}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">${body}</g>`
const dot = (x, y, color, r = 3) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}" stroke="none"/>`

const ICONS = {
  person: (x, y, color) => icon(x, y, color, '<circle cx="28" cy="16" r="11"/><path d="M9 47 a19 19 0 0 1 38 0"/>'),
  chat: (x, y, color) => icon(x, y, color, `<rect x="7" y="9" width="42" height="30" rx="9"/><path d="M17 39 l-4 10 l13 -10"/>${dot(20, 24, color)}${dot(28, 24, color)}${dot(36, 24, color)}`),
  sun: (x, y, color) => `  <g transform="translate(${x} ${y})" stroke="${color}" stroke-width="4" stroke-linecap="round" fill="none"><circle cx="12" cy="12" r="6" fill="${color}" stroke="none"/><path d="M12 1 v3 M12 20 v3 M1 12 h3 M20 12 h3 M4 4 l2 2 M18 18 l2 2 M20 4 l-2 2 M6 18 l-2 2"/></g>`,
  bulb: (x, y, color) => icon(x, y, color, '<circle cx="28" cy="21" r="13"/><path d="M28 34 v-9 M22 40 h12 M24 46 h8"/>'),
  /** Mano saludando, amarilla como el emoji 👋 del ejemplo. */
  wave: (x, y) => `  <g transform="translate(${x} ${y})" fill="#ffca28"><rect x="7" y="8" width="7" height="20" rx="3.5" transform="rotate(-10 10 18)"/><rect x="16" y="4" width="7" height="24" rx="3.5" transform="rotate(-3 19 16)"/><rect x="25" y="6" width="7" height="22" rx="3.5" transform="rotate(4 28 17)"/><rect x="33" y="10" width="7" height="18" rx="3.5" transform="rotate(12 36 19)"/><path d="M9 26 q-1 12 8 16 t18 -1 q7 -4 7 -13 l0 -5 q-16 5 -33 3 z"/><rect x="0" y="24" width="7" height="14" rx="3.5" transform="rotate(40 3 31)"/></g>`,
}

/* --- Datos vivos de las fichas ------------------------------------------- */

const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const pad2 = value => String(value).padStart(2, '0')

/** "2d 4h 12m" / "12m" / "40s": tiempo de actividad corto. */
export function formatUptime(seconds = process.uptime()) {
  const total = Math.max(0, Math.floor(seconds))
  const days = Math.floor(total / 86400)
  const hours = Math.floor((total % 86400) / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const parts = []
  if (days) parts.push(`${days}d`)
  if (hours) parts.push(`${hours}h`)
  if (minutes) parts.push(`${minutes}m`)
  if (!parts.length) parts.push(`${total % 60}s`)
  return parts.join(' ')
}

/** "miércoles, 28 de octubre de 2026" sin depender del ICU de Termux. */
export function spanishDate(date = new Date()) {
  return `${WEEKDAYS[date.getDay()]}, ${date.getDate()} de ${MONTHS[date.getMonth()]} de ${date.getFullYear()}`
}

/** "23:54:07": como la fila verde del ejemplo, con segundos. */
export function spanishTime(date = new Date()) {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`
}

export function botVersion(config = {}) {
  return String(config.version || packageVersion() || '').trim()
}

/** "Maldonado · parcialmente nublado 18°C" (o null sin red). */
export async function weatherLine(menu = {}) {
  const data = menu.weatherEnabled === false
    ? null
    : await fetchWeather({ lat: menu.weatherLat, lon: menu.weatherLon }).catch(() => null)
  if (!data) return null
  const label = String(data.label || '')
  const soft = label ? label.charAt(0).toLowerCase() + label.slice(1) : ''
  const city = String(menu.weatherCity || '').trim()
  return [city, soft, `${Math.round(data.temperature)}°C`].filter(Boolean).join(' · ')
}

/* --- Bloques de la tarjeta ------------------------------------------------ */

/** Icono reducido para acompañar al valor de una ficha. */
const scaled = (draw, factor) => (x, y, color) => `  <g transform="translate(${x} ${y}) scale(${factor})">${draw(0, 0, color).trim()}</g>`

function tile(font, { x, y, width, height = TILE_HEIGHT, background = COLORS.tile, border = COLORS.tileBorder, label, labelColor = COLORS.label, labelIcon, value, valueIcon, valueColor = COLORS.value, right }) {
  const parts = [`  <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="20" fill="${background}" stroke="${border}" stroke-width="2"/>`]
  const labelX = x + (labelIcon ? 62 : 28)
  if (labelIcon) parts.push(labelIcon(x + 26, y + 26, labelColor === COLORS.label ? COLORS.amber : labelColor))
  parts.push(textPath(font, label, { x: labelX, y: y + 46, size: 24, fill: labelColor, maxWidth: width - labelX + x - 30 }).svg)

  const valueX = x + (valueIcon ? 84 : 28)
  if (valueIcon) parts.push(scaled(valueIcon, 0.8)(x + 26, y + 56, COLORS.label))
  parts.push(textPath(font, value, { x: valueX, y: y + 100, size: 38, fill: valueColor, fauxBold: 1.4, maxWidth: width - valueX + x - (right ? 200 : 30) }).svg)
  if (right) parts.push(right)
  return parts.filter(Boolean).join('\n')
}

/**
 * Devuelve el SVG completo de la tarjeta (el degradado que funde el banner con
 * el cuerpo más todo lo demás) y las alturas. Todo son rectángulos, formas y
 * trayectorias — nada de `<text>`, que es lo que el sharp wasm no puede dibujar.
 */
export async function buildCardSvg(ctx, options = {}) {
  const { config, m, registry } = ctx
  const menu = config.menu || {}
  const font = await loadCardFont(menu.cardFont || DEFAULT_CARD_FONT)
  const width = options.width || CARD_WIDTH
  const bannerHeight = options.bannerHeight ?? CARD_BANNER_HEIGHT
  const userName = String(m?.name || 'Usuario').trim() || 'Usuario'
  const contentWidth = width - PAD * 2
  const tileWidth = (contentWidth - GAP) / 2
  const version = botVersion(config)
  const fullName = version ? `${config.botName} ${version}` : String(config.botName || 'Bot')

  const weather = await weatherLine(menu)

  const parts = []
  // Degradado que funde el banner con el cuerpo, como en el ejemplo
  parts.push(`  <rect x="0" y="${bannerHeight - 300}" width="${width}" height="300" fill="url(#fade)"/>`)

  let y = bannerHeight + PAD
  const title = textPath(font, fullName.toUpperCase(), { x: PAD, y: y + 58, size: 58, fill: COLORS.title, fauxBold: 2.2 })
  parts.push(title.svg)
  y += 58 + 34

  parts.push(ICONS.wave(PAD, y + 8))
  const greeting = segmentsPath(font, [
    { text: `${menu.greeting || '¡Hola,'} `, fill: COLORS.muted },
    { text: userName, fill: COLORS.name, fauxBold: 1.4 },
    { text: '!', fill: COLORS.muted },
  ], { x: PAD + 62, y: y + 40, size: 36 })
  parts.push(greeting.svg)
  y += 40 + GAP + 14

  // Fichas 2×2: estado, modo, comandos y actividad
  const mode = config.mode === 'self' ? 'Privado' : 'Público'
  const commands = registry?.count ?? registry?.commands?.size ?? 0
  const tiles = [
    { label: 'ESTADO', value: 'Activo', valueIcon: ICONS.person },
    { label: 'MODO', value: mode, valueIcon: ICONS.chat },
    { label: 'COMANDOS TOTALES', value: String(commands) },
    { label: 'TIEMPO DE ACTIVIDAD', value: formatUptime() },
  ]
  tiles.forEach((data, index) => {
    const x = PAD + (index % 2) * (tileWidth + GAP)
    const rowY = y + Math.floor(index / 2) * (TILE_HEIGHT + GAP)
    parts.push(tile(font, { x, y: rowY, width: tileWidth, ...data }))
  })
  y += TILE_HEIGHT * 2 + GAP * 2 + GAP

  // Clima a lo ancho, con el solcito antes del rótulo como en el ejemplo
  parts.push(tile(font, {
    x: PAD,
    y,
    width: contentWidth,
    label: 'CLIMA',
    labelIcon: ICONS.sun,
    value: weather || 'Sin datos',
  }))
  y += TILE_HEIGHT + GAP

  // Fila verde: hora con segundos a la izquierda, fecha a la derecha
  const dateRight = textPath(font, spanishDate(), {
    x: PAD + contentWidth - 36,
    y: y + TILE_HEIGHT / 2 + 12,
    size: 28,
    fill: COLORS.hourAccent,
    anchor: 'end',
    fauxBold: 1,
    maxWidth: 460,
  })
  parts.push(tile(font, {
    x: PAD,
    y,
    width: contentWidth,
    background: COLORS.hourTile,
    border: COLORS.hourBorder,
    label: 'HORA',
    labelColor: COLORS.hourAccent,
    value: spanishTime(),
    valueColor: COLORS.hourAccent,
    right: dateRight.svg,
  }))
  y += TILE_HEIGHT + GAP

  // Aviso de .menu <categoría> con el foco ámbar
  parts.push(`  <rect x="${PAD}" y="${y}" width="${contentWidth}" height="${HINT_HEIGHT}" rx="20" fill="${COLORS.tile}" stroke="${COLORS.tileBorder}" stroke-width="2"/>`)
  parts.push(ICONS.bulb(PAD + 26, y + (HINT_HEIGHT - 56) / 2, COLORS.amber))
  const hint = segmentsPath(font, [
    { text: 'Escribe ', fill: COLORS.muted },
    { text: `${ctx.usedPrefix || config.prefix}menu <categoría>`, fill: COLORS.amber, fauxBold: 1.2 },
    { text: ' para ver las funciones.', fill: COLORS.muted },
  ], { x: PAD + 84, y: y + HINT_HEIGHT / 2 + 11, size: 30, maxWidth: contentWidth - 140 })
  parts.push(hint.svg)
  y += HINT_HEIGHT + GAP + 14

  // Pie: ✦ nombre en verde · tagline ✦, centrado como en el ejemplo
  const diamond = ['✦', '◆', '·'].find(character => font.charToGlyph(character).index !== 0) || '·'
  const foot = segmentsPath(font, [
    { text: `${diamond} `, fill: COLORS.foot },
    { text: fullName, fill: COLORS.footName, fauxBold: 1.2 },
    { text: ` · ${menu.tagline || 'Premium WhatsApp Experience'} `, fill: COLORS.muted },
    { text: diamond, fill: COLORS.foot },
  ], { x: width / 2, y: y + 26, size: 26, anchor: 'middle' })
  parts.push(foot.svg)
  y += 26 + PAD

  const height = Math.round(y)
  const svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${BODY_BACKGROUND}" stop-opacity="0"/>
      <stop offset="1" stop-color="${BODY_BACKGROUND}" stop-opacity="0.96"/>
    </linearGradient>
  </defs>
${parts.filter(Boolean).join('\n')}
</svg>`
  return { svg, width, height, bannerHeight }
}

async function bannerBuffer(banner) {
  if (isHttpUrl(banner)) {
    const response = await fetch(banner)
    if (!response.ok) throw new Error(`banner HTTP ${response.status}`)
    return Buffer.from(await response.arrayBuffer())
  }
  return readFile(resolveBot(banner))
}

const cardCache = new Map()
const CARD_CACHE_LIMIT = 12

/**
 * Tarjeta del menú como imagen JPEG: el banner fundido con el cuerpo del
 * diseño de los ejemplos. Devuelve `null` si no se puede componer (sin fuente,
 * sin sharp...), y quien llama usa entonces el banner de siempre.
 */
export async function composeMenuCard(ctx) {
  const { config } = ctx
  const { svg, width, height, bannerHeight } = await buildCardSvg(ctx)
  const key = createHash('sha1').update(svg).digest('hex')
  if (cardCache.has(key)) return cardCache.get(key)

  let base
  try {
    const buffer = await bannerBuffer(config.banner)
    base = sharp(buffer).resize(width, bannerHeight, { fit: 'cover', position: 'centre' })
  } catch (error) {
    // Sin banner igual hay tarjeta: cabecera lisa con el color del cuerpo
    base = sharp({ create: { width, height: bannerHeight, channels: 3, background: BODY_BACKGROUND } })
  }

  const card = await base
    .extend({ bottom: height - bannerHeight, background: BODY_BACKGROUND })
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 92 })
    .toBuffer()

  if (cardCache.size >= CARD_CACHE_LIMIT) cardCache.delete(cardCache.keys().next().value)
  cardCache.set(key, card)
  return card
}

export function clearCardCache() {
  cardCache.clear()
}
