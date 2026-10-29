import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import sharp from 'sharp'
import opentype from 'opentype.js'
import { isHttpUrl } from './format.js'
import { resolveBot } from './paths.js'

/**
 * Tarjeta del menú compuesta en local (banner + textos + los 3 botones
 * separados), para que aparezca en el chat en vez de mandar un archivo.
 *
 * Detalle importante: el sharp de Termux corre sobre WebAssembly y su
 * renderizador SVG (resvg) no carga fuentes, así que `<text>` sale en blanco.
 * Por eso cada texto se convierte en `<path>` con opentype.js y la fuente
 * DejaVu que viaja en assets/fonts/: se ve igual en nativo y en wasm.
 */

export const CARD_WIDTH = 1080
export const CARD_BANNER_HEIGHT = 608
export const DEFAULT_CARD_FONT = './assets/fonts/DejaVuSans.ttf'

const PAD = 56
const BODY_BACKGROUND = '#0b0f14'
const COLORS = {
  title: '#a7f3d0',
  text: '#e6edf3',
  muted: '#c9d1d9',
  dim: '#7d8590',
  foot: '#4b5563',
  button: '#1f2937',
  buttonBorder: '#30363d',
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
const CARD_CHAR_SUBSTITUTIONS = { '\u24B8': '\u00A9' }

/** DejaVu no cubre todos los scripts: lo que no tiene glifo se descarta. */
export function drawableText(font, text = '') {
  return String(text)
    .replace(/[\u24B8]/g, character => CARD_CHAR_SUBSTITUTIONS[character] || character)
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
  if (!fitted.text) return { svg: '', height: size }
  const path = font.getPath(fitted.text, 0, 0, fitted.size).toPathData(2)
  const offsetX = anchor === 'middle' ? -fitted.width / 2 : anchor === 'end' ? -fitted.width : 0
  const stroke = fauxBold ? ` stroke="${fill}" stroke-width="${fauxBold}" stroke-linejoin="round"` : ''
  return {
    svg: `    <path d="${escapeAttribute(path)}" fill="${fill}"${stroke} transform="translate(${(x + offsetX).toFixed(2)} ${y.toFixed(2)})"/>`,
    height: size,
    width: fitted.width,
  }
}

function buttonRow(font, button, { x, y, width, height, prefix, supportUrl }) {
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
    `    <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" fill="${COLORS.button}" stroke="${border}" stroke-width="2"/>`,
    labelPath.svg,
    hintPath.svg,
  ].filter(Boolean).join('\n')
}

/**
 * Devuelve el SVG de la tarjeta (sin el banner: ése lo pone sharp debajo) y la
 * altura total. Todo son rectángulos, degradados y trayectorias — nada de
 * `<text>`, que es lo que el sharp wasm no puede dibujar.
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
  const buttonWidth = width - PAD * 2
  const buttonHeight = 96
  const buttonGap = 24

  const parts = []
  // Degradado que funde el banner con el cuerpo de la tarjeta
  parts.push(`    <rect x="0" y="${bannerHeight - 300}" width="${width}" height="300" fill="url(#fade)"/>`)

  let y = bannerHeight + PAD
  const title = textPath(font, menu.title || config.botName, { x: PAD, y: y + 62, size: 64, fill: COLORS.title, fauxBold: 2 })
  parts.push(title.svg)
  y += 62 + 40

  const greeting = textPath(font, `${menu.greeting || ''} ${userName}`.trim(), { x: PAD, y: y + 42, size: 42, fill: COLORS.text })
  parts.push(greeting.svg)
  y += 42 + 34

  const subtitle = textPath(font, menu.selectMenu || '', { x: PAD, y: y + 36, size: 34, fill: COLORS.muted })
  parts.push(subtitle.svg)
  y += 36 + 26

  if (registry) {
    const stats = `${registry.count} comandos · ${registry.commands.size} alias`
    const statsPath = textPath(font, stats, { x: PAD, y: y + 26, size: 26, fill: COLORS.dim })
    parts.push(statsPath.svg)
    y += 26 + 34
  }

  const copyright = textPath(font, menu.copyright || config.footer, { x: PAD, y: y + 26, size: 26, fill: COLORS.dim })
  parts.push(copyright.svg)
  y += 26 + 46

  for (const button of menu.buttons || []) {
    parts.push(buttonRow(font, button, { x: PAD, y, width: buttonWidth, height: buttonHeight, prefix, supportUrl }))
    y += buttonHeight + buttonGap
  }
  y += 16

  const foot = textPath(font, `${config.botName} · ${new Date().getFullYear()}`, {
    x: width / 2,
    y: y + 24,
    size: 24,
    fill: COLORS.foot,
    anchor: 'middle',
  })
  parts.push(foot.svg)
  y += 24 + PAD

  const height = Math.round(y)
  const svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${BODY_BACKGROUND}" stop-opacity="0"/>
      <stop offset="1" stop-color="${BODY_BACKGROUND}" stop-opacity="0.95"/>
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
 * Tarjeta del menú como imagen JPEG: banner arriba, textos y los tres botones
 * separados debajo. Devuelve `null` si no se puede componer (sin fuente, sin
 * sharp...), y quien llama usa entonces el banner de siempre.
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
    base = sharp({ create: { width, height: bannerHeight, channels: 3, background: '#111a23' } })
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
