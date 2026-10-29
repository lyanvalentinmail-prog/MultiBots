import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import sharp from 'sharp'
import opentype from 'opentype.js'
import { isHttpUrl } from './format.js'
import { packageVersion, resolveBot } from './paths.js'
import { fetchWeather } from './weather.js'

/**
 * Tarjeta del menú compuesta en local, calcada del diseño del HTML que está en
 * Drive (HtmlExample): banner arriba y debajo las fichas ESTADO / MODO /
 * COMANDOS TOTALES / TIEMPO DE ACTIVIDAD, CLIMA, la fila verde de HORA y fecha,
 * el aviso de `.menu <categoría>` y los 3 botones en vertical, separados.
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
const TILE_HEIGHT = 148
const HINT_HEIGHT = 120
const BUTTON_HEIGHT = 96
const BODY_BACKGROUND = '#0d1117'

const COLORS = {
  title: '#c9c2ff',
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
  button: '#161b22',
  buttonBorder: '#262d37',
  buttonLabel: '#ffffff',
  buttonHint: '#9ca3af',
  supportBorder: '#3b82f6',
  supportLabel: '#60a5fa',
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
const CARD_CHAR_SUBSTITUTIONS = { 'Ⓒ': '©' }

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
function segmentsPath(font, segments, { x, y, size, maxWidth = CARD_WIDTH - PAD * 2 }) {
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
  if (!clean.length) return { svg: '', height: size }
  let current = size
  // drawableText recorta los espacios de los bordes: se miden aparte para que
  // "Escribe " + ".menu <categoría>" + " para ver…" no queden pegados.
  const space = () => textWidth(font, ' ', current)
  const total = () => clean.reduce((sum, segment) => {
    const edges = (segment.lead ? space() : 0) + (segment.trail ? space() : 0)
    return sum + textWidth(font, segment.text, current) + edges
  }, 0)
  while (current > size * 0.6 && total() > maxWidth) current -= 1
  let offset = 0
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
  return { svg: parts.filter(Boolean).join('\n'), height: current }
}

/* --- Iconos: formas SVG simples (resvg wasm no dibuja texto ni emoji) ----- */

const icon = (x, y, color, body) => `  <g transform="translate(${x} ${y})" fill="none" stroke="${color}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">${body}</g>`
const dot = (x, y, color, r = 3) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}" stroke="none"/>`

const ICONS = {
  person: (x, y, color) => icon(x, y, color, '<circle cx="28" cy="16" r="11"/><path d="M9 47 a19 19 0 0 1 38 0"/>'),
  chat: (x, y, color) => icon(x, y, color, `<rect x="7" y="9" width="42" height="30" rx="9"/><path d="M17 39 l-4 10 l13 -10"/>${dot(20, 24, color)}${dot(28, 24, color)}${dot(36, 24, color)}`),
  gear: (x, y, color) => icon(x, y, color, '<circle cx="28" cy="28" r="11" stroke-width="6"/><path d="M28 7 v6 M28 43 v6 M7 28 h6 M43 28 h6 M13 13 l4 4 M39 39 l4 4 M43 13 l-4 4 M17 39 l-4 4"/>'),
  clock: (x, y, color) => icon(x, y, color, '<circle cx="28" cy="28" r="19"/><path d="M28 16 v12 l9 6"/>'),
  weather: (x, y, color) => icon(x, y, color, '<circle cx="19" cy="17" r="8"/><path d="M19 3 v3 M33 17 h-3 M29 7 l-2 2 M9 7 l2 2"/><path d="M17 45 a8 8 0 0 1 -1 -16 a11 11 0 0 1 21 -2 a8 8 0 0 1 2 18 z"/>'),
  bulb: (x, y, color) => icon(x, y, color, '<circle cx="28" cy="21" r="13"/><path d="M28 34 v-9 M22 40 h12 M24 46 h8"/>'),
  calendar: (x, y, color) => icon(x, y, color, `<rect x="9" y="12" width="38" height="33" rx="7"/><path d="M9 23 h38 M19 8 v8 M37 8 v8"/>${dot(19, 31, color)}${dot(28, 31, color)}${dot(37, 31, color)}${dot(19, 38, color)}${dot(28, 38, color)}`),
}

/* --- Datos vivos de las fichas ------------------------------------------- */

const WEEKDAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const pad2 = value => String(value).padStart(2, '0')

/** "2d 4h 12m" / "12m 5s" / "40s": tiempo de actividad corto. */
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

/** "mié 28 oct 2026" sin depender del ICU que traiga el Node de Termux. */
export function spanishDate(date = new Date()) {
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`
}

export function spanishTime(date = new Date()) {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

export function botVersion(config = {}) {
  return String(config.version || packageVersion() || '').trim()
}

/* --- Bloques de la tarjeta ------------------------------------------------ */

function tile(font, { x, y, width, height = TILE_HEIGHT, background = COLORS.tile, border = COLORS.tileBorder, icon: iconName, iconColor = COLORS.label, label, value, right }) {
  const parts = [`  <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="24" fill="${background}" stroke="${border}" stroke-width="2"/>`]
  if (ICONS[iconName]) parts.push(ICONS[iconName](x + 30, y + (height - 56) / 2, iconColor))
  const textX = x + 112
  const textWidthMax = width - 112 - (right ? 220 : 40)
  parts.push(textPath(font, label, { x: textX, y: y + 60, size: 25, fill: iconColor === COLORS.label ? COLORS.label : iconColor, maxWidth: textWidthMax }).svg)
  parts.push(textPath(font, value, { x: textX, y: y + 108, size: 40, fill: COLORS.value, fauxBold: 1.4, maxWidth: textWidthMax }).svg)
  if (right) parts.push(right)
  return parts.filter(Boolean).join('\n')
}

function buttonRow(font, button, { x, y, width, height = BUTTON_HEIGHT, prefix, supportUrl }) {
  const isSupport = button.command === 'support' || Boolean(button.url)
  const border = isSupport ? COLORS.supportBorder : COLORS.buttonBorder
  const label = isSupport ? COLORS.supportLabel : COLORS.buttonLabel
  const hint = isSupport ? (button.url || supportUrl) : `${prefix}${button.command}`
  const radius = Math.round(height * 0.3)

  const labelPath = textPath(font, button.label, {
    x: x + 34,
    y: y + height / 2 + 12,
    size: 34,
    fill: label,
    fauxBold: 1.1,
    maxWidth: width * 0.5,
  })
  const hintPath = textPath(font, hint, {
    x: x + width - 34,
    y: y + height / 2 + 9,
    size: 24,
    fill: COLORS.buttonHint,
    anchor: 'end',
    maxWidth: width * 0.38,
  })

  return [
    `  <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" fill="${COLORS.button}" stroke="${border}" stroke-width="2"/>`,
    labelPath.svg,
    hintPath.svg,
  ].filter(Boolean).join('\n')
}

/**
 * Devuelve el SVG del cuerpo de la tarjeta (lo que va debajo del banner: el
 * banner lo pone sharp debajo) y las alturas. Todo son rectángulos, formas y
 * trayectorias — nada de `<text>`, que es lo que el sharp wasm no puede dibujar.
 */
export async function buildCardSvg(ctx, options = {}) {
  const { config, m, registry } = ctx
  const menu = config.menu || {}
  const font = await loadCardFont(menu.cardFont || DEFAULT_CARD_FONT)
  const width = options.width || CARD_WIDTH
  const bannerHeight = options.bannerHeight ?? CARD_BANNER_HEIGHT
  const userName = String(m?.name || 'Usuario').trim() || 'Usuario'
  const prefix = ctx.usedPrefix || config.prefix
  const supportUrl = `https://wa.me/${config.owners?.[0]?.number || ''}`
  const contentWidth = width - PAD * 2
  const tileWidth = (contentWidth - GAP) / 2
  const version = botVersion(config)
  const fullName = version ? `${config.botName} ${version}` : String(config.botName || 'Bot')

  const weather = menu.weatherEnabled === false
    ? null
    : await fetchWeather({ lat: menu.weatherLat, lon: menu.weatherLon }).catch(() => null)

  const parts = []
  parts.push(`  <rect x="0" y="0" width="${width}" height="${bannerHeight}" fill="${BODY_BACKGROUND}"/>`)

  let y = PAD
  const title = textPath(font, fullName, { x: PAD, y: y + 62, size: 64, fill: COLORS.title, fauxBold: 2 })
  parts.push(title.svg)
  y += 62 + 34

  const greeting = segmentsPath(font, [
    { text: `${menu.greeting || '¡Hola,'} `, fill: COLORS.muted },
    { text: userName, fill: COLORS.name, fauxBold: 1.4 },
    { text: ` · ${menu.selectMenu || '¿En qué puedo ayudarte hoy?'}`, fill: COLORS.muted },
  ], { x: PAD, y: y + 40, size: 38 })
  parts.push(greeting.svg)
  y += 40 + GAP + 18

  // Fichas 2×2: estado, modo, comandos y actividad
  const mode = config.mode === 'self' ? 'Privado' : 'Público'
  const commands = registry?.count ?? registry?.commands?.size ?? 0
  const tiles = [
    { icon: 'person', label: 'ESTADO', value: 'Activo' },
    { icon: 'chat', label: 'MODO', value: mode },
    { icon: 'gear', label: 'COMANDOS TOTALES', value: String(commands) },
    { icon: 'clock', label: 'TIEMPO DE ACTIVIDAD', value: formatUptime() },
  ]
  tiles.forEach((data, index) => {
    const x = PAD + (index % 2) * (tileWidth + GAP)
    const rowY = y + Math.floor(index / 2) * (TILE_HEIGHT + GAP)
    parts.push(tile(font, { x, y: rowY, width: tileWidth, ...data }))
  })
  y += TILE_HEIGHT * 2 + GAP * 2 + GAP

  // Clima a lo ancho
  parts.push(tile(font, {
    x: PAD,
    y,
    width: contentWidth,
    icon: 'weather',
    label: 'CLIMA',
    value: weather || 'Sin datos',
  }))
  y += TILE_HEIGHT + GAP

  // Fila verde de hora + fecha
  const dateRight = textPath(font, spanishDate(), {
    x: PAD + contentWidth - 40,
    y: y + TILE_HEIGHT / 2 + 10,
    size: 30,
    fill: COLORS.hourAccent,
    anchor: 'end',
    maxWidth: 320,
  })
  parts.push(tile(font, {
    x: PAD,
    y,
    width: contentWidth,
    background: COLORS.hourTile,
    border: COLORS.hourBorder,
    icon: 'clock',
    iconColor: COLORS.hourAccent,
    label: 'HORA',
    value: spanishTime(),
    right: [
      dateRight.svg,
      ICONS.calendar(PAD + contentWidth - 40 - dateRight.width - 68, y + (TILE_HEIGHT - 56) / 2, COLORS.hourAccent),
    ].filter(Boolean).join('\n'),
  }))
  y += TILE_HEIGHT + GAP

  // Aviso de .menu <categoría>
  parts.push(`  <rect x="${PAD}" y="${y}" width="${contentWidth}" height="${HINT_HEIGHT}" rx="24" fill="${COLORS.tile}" stroke="${COLORS.tileBorder}" stroke-width="2"/>`)
  parts.push(ICONS.bulb(PAD + 30, y + (HINT_HEIGHT - 56) / 2, COLORS.amber))
  const hint = segmentsPath(font, [
    { text: 'Escribe ', fill: COLORS.muted },
    { text: `${prefix}menu <categoría>`, fill: COLORS.amber, fauxBold: 1.2 },
    { text: ' para ver las funciones.', fill: COLORS.muted },
  ], { x: PAD + 112, y: y + HINT_HEIGHT / 2 + 12, size: 32, maxWidth: contentWidth - 150 })
  parts.push(hint.svg)
  y += HINT_HEIGHT + GAP + 8

  // Los 3 botones: en vertical y separados, uno por fila
  for (const button of menu.buttons || []) {
    parts.push(buttonRow(font, button, { x: PAD, y, width: contentWidth, prefix, supportUrl }))
    y += BUTTON_HEIGHT + GAP
  }
  y += 8

  const diamond = ['✦', '◆', '·'].find(character => font.charToGlyph(character).index !== 0) || '·'
  const foot = textPath(font, `${diamond}  ${fullName}  ${diamond}`, {
    x: width / 2,
    y: y + 26,
    size: 28,
    fill: COLORS.foot,
    anchor: 'middle',
  })
  parts.push(foot.svg)
  y += 26 + PAD

  const bodyHeight = Math.round(y)
  const svg = `<svg width="${width}" height="${bodyHeight}" viewBox="0 0 ${width} ${bodyHeight}" xmlns="http://www.w3.org/2000/svg">
${parts.filter(Boolean).join('\n')}
</svg>`
  return { svg, width, height: bannerHeight + bodyHeight, bodyHeight, bannerHeight }
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
 * Tarjeta del menú como imagen JPEG: banner arriba y el cuerpo del diseño de
 * Drive debajo (fichas, hora, aviso y los 3 botones separados en vertical).
 * Devuelve `null` si no se puede componer (sin fuente, sin sharp...), y quien
 * llama usa entonces el banner de siempre.
 */
export async function composeMenuCard(ctx) {
  const { config } = ctx
  const { svg, width, bodyHeight, bannerHeight } = await buildCardSvg(ctx)
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
    .extend({ bottom: bodyHeight, background: BODY_BACKGROUND })
    .composite([{ input: Buffer.from(svg), top: bannerHeight, left: 0 }])
    .jpeg({ quality: 92 })
    .toBuffer()

  if (cardCache.size >= CARD_CACHE_LIMIT) cardCache.delete(cardCache.keys().next().value)
  cardCache.set(key, card)
  return card
}

export function clearCardCache() {
  cardCache.clear()
}
