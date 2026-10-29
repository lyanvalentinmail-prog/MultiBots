import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import sharp from 'sharp'
import { DEFAULT_CONFIG, normalizeConfig } from '../src/config.js'
import { PluginRegistry } from '../src/plugins.js'
import { menuCardMedia } from '../src/interactive.js'
import {
  buildCardSvg,
  composeMenuCard,
  drawableText,
  fitText,
  formatUptime,
  loadCardFont,
  spanishDate,
  spanishTime,
} from '../src/utils/card.js'

/**
 * La tarjeta del menú se compone en local (banner + textos + botones) para que
 * aparezca en el chat. El sharp de Termux es WebAssembly y su resvg no carga
 * fuentes: por eso el SVG no puede llevar <text>, sólo trayectorias.
 */
const registry = await new PluginRegistry().load()
const CHAT = '59896719709@s.whatsapp.net'
const sha1 = buffer => createHash('sha1').update(buffer).digest('hex')

function cardContext(overrides = {}) {
  const { config: configOverrides, ...rest } = overrides
  const config = normalizeConfig({ ...structuredClone(DEFAULT_CONFIG), ...configOverrides })
  return { config, registry, usedPrefix: config.prefix, m: { chat: CHAT, sender: CHAT, name: 'Lyann' }, ...rest }
}

test('drawableText descarta lo que la fuente no tiene y sustituye Ⓒ por ©', async () => {
  const font = await loadCardFont()
  assert.equal(drawableText(font, 'Ⓒ Satoru gojo'), '© Satoru gojo')
  assert.equal(drawableText(font, '超长の名前'), '')
  assert.equal(drawableText(font, 'Lyann   ✨ múltiple'), 'Lyann múltiple')
  assert.equal(drawableText(font, '¡Buenos días! ☀'), '¡Buenos días! ☀')
})

test('fitText achica el cuerpo de letra y recorta con … si no entra', async () => {
  const font = await loadCardFont()
  const corto = fitText(font, 'Menu', 34, 500)
  assert.equal(corto.size, 34, 'lo que entra no se toca')
  const largo = fitText(font, 'Nombre larguísimo de alguien con apodo y todo', 34, 200)
  assert.ok(largo.size <= 34 && largo.width <= 200, 'se ajusta al ancho')
  const imposible = fitText(font, 'x'.repeat(400), 34, 150)
  assert.ok(imposible.text.endsWith('…'), 'recorta con puntos suspensivos')
  assert.ok(imposible.width <= 150)
})

test('el SVG de la tarjeta no lleva <text> (el sharp wasm no lo dibuja)', async () => {
  const ctx = cardContext()
  const { svg, width, height, bodyHeight, bannerHeight } = await buildCardSvg(ctx)
  assert.equal(width, 1080)
  assert.equal(bannerHeight, 608)
  assert.equal((svg.match(/<text/g) || []).length, 0, 'nada de <text>')
  assert.ok((svg.match(/<path /g) || []).length >= 10, 'los textos van como trayectorias')
  assert.equal((svg.match(/<rect /g) || []).length, 13, 'cuerpo + 6 fichas + aviso + 3 botones + 2 iconos')
  assert.ok(!svg.includes('linearGradient'), 'el diseño de Drive corta el banner en seco')
  assert.match(svg, /stroke="#2ea043"/, 'la fila de HORA lleva su borde verde')
  assert.match(svg, /stroke="#3b82f6"/, 'el botón Support lleva su borde azul')
  assert.equal(height, bannerHeight + bodyHeight, 'la altura total es banner + cuerpo')
})

test('formatUptime, spanishTime y spanishDate no dependen del ICU', async () => {
  assert.equal(formatUptime(0), '0s')
  assert.equal(formatUptime(65), '1m')
  assert.equal(formatUptime(5), '5s')
  assert.equal(formatUptime(90061), '1d 1h 1m')
  assert.equal(spanishTime(new Date(2026, 9, 28, 19, 5)), '19:05')
  assert.equal(spanishDate(new Date(2026, 9, 28)), 'mié 28 oct 2026')
})

test('con menu.weatherEnabled en false la tarjeta se compone sin tocar la red', async () => {
  const card = await composeMenuCard(cardContext({ config: { menu: { weatherEnabled: false } } }))
  assert.equal(card.subarray(0, 3).toString('hex'), 'ffd8ff', 'JPEG')
})

test('composeMenuCard entrega un JPEG 1080 con contenido', async () => {
  const card = await composeMenuCard(cardContext())
  assert.equal(card.subarray(0, 3).toString('hex'), 'ffd8ff', 'JPEG')
  const meta = await sharp(card).metadata()
  assert.equal(meta.width, 1080)
  assert.ok(meta.height > 1200, 'banner + cuerpo + botones')
  const stats = await sharp(card).stats()
  assert.ok(stats.channels.every(channel => channel.stdev > 5), 'no está en blanco')
})

test('la tarjeta se cachea y cambia cuando cambia el usuario', async () => {
  const ctx = cardContext()
  const first = await composeMenuCard(ctx)
  const second = await composeMenuCard(ctx)
  assert.equal(first, second, 'misma tarjeta = mismo buffer cacheado')
  const other = await composeMenuCard(cardContext({ m: { name: 'Otra persona' } }))
  assert.notEqual(sha1(first), sha1(other), 'otro nombre, otra tarjeta')
})

test('sin banner la tarjeta se compone igual con cabecera lisa', async () => {
  const card = await composeMenuCard(cardContext({ config: { banner: './assets/no-existe.jpg' } }))
  const meta = await sharp(card).metadata()
  assert.equal(meta.width, 1080)
  const stats = await sharp(card).stats()
  assert.ok(stats.channels.every(channel => channel.stdev > 5), 'sigue teniendo contenido')
})

test('menuCardMedia usa la tarjeta y con cardEnabled en false el banner original', async () => {
  const banner = await readFile(new URL('../assets/banner.jpg', import.meta.url))
  const card = await menuCardMedia(cardContext())
  assert.equal(card.mimetype, 'image/jpeg')
  assert.notEqual(sha1(card.image), sha1(banner), 'no es el banner suelto')
  const raw = await menuCardMedia(cardContext({ config: { menu: { cardEnabled: false } } }))
  assert.equal(sha1(raw.image), sha1(banner), 'con la tarjeta apagada viaja el banner')
})

test('si la fuente falta, menuCardMedia cae al banner en vez de romper', async () => {
  const banner = await readFile(new URL('../assets/banner.jpg', import.meta.url))
  await assert.rejects(() => loadCardFont('./assets/fonts/no-existe.ttf'))
  const media = await menuCardMedia(cardContext({ config: { menu: { cardFont: './assets/fonts/no-existe.ttf' } } }))
  assert.equal(sha1(media.image), sha1(banner), 'el menú no se queda sin imagen')
})
