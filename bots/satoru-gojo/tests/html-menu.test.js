import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_CONFIG, normalizeConfig } from '../src/config.js'
import { PluginRegistry } from '../src/plugins.js'
import {
  bannerSource,
  escapeHtml,
  fillTemplate,
  menuButtonsHtml,
  menuHtmlFileName,
  renderMenuHtml,
} from '../src/html.js'
import { deliverMenu, sendMenuHtml } from '../src/interactive.js'

/**
 * Tarjeta HTML del menú: el mismo diseño que el banner + saludo +
 * "Selecciona el menu que necesites" + los tres botones separados.
 */
const registry = await new PluginRegistry().load()
const CHAT = '59896719709@s.whatsapp.net'

function htmlContext(overrides = {}) {
  const { config: configOverrides, ...rest } = overrides
  const messages = []
  const config = normalizeConfig({ ...structuredClone(DEFAULT_CONFIG), ...configOverrides })
  return {
    config,
    registry,
    usedPrefix: config.prefix,
    messages,
    sock: { sendMessage: async (chat, content, options) => { messages.push({ chat, content, options }); return { key: { id: 'K' } } } },
    m: { chat: CHAT, sender: CHAT, senderDisplay: CHAT, name: 'Lyann', raw: { key: { id: 'Q', remoteJid: CHAT, fromMe: false }, message: { conversation: '.menu' } } },
    ...rest,
  }
}

test('escapeHtml neutraliza el markup que venga de un usuario', () => {
  assert.equal(escapeHtml('<script>alert("x")</script>'), '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;')
  assert.equal(escapeHtml("a & b 'c'"), 'a &amp; b &#39;c&#39;')
  assert.equal(escapeHtml(), '')
})

test('fillTemplate rellena los marcadores y deja intactos los desconocidos', () => {
  assert.equal(fillTemplate('hola {name}, {unknown}', { name: 'Lyann' }), 'hola Lyann, {unknown}')
})

test('bannerSource incrusta el banner local y respeta las URLs', async () => {
  const embedded = await bannerSource('./assets/banner.jpg')
  assert.match(embedded, /^data:image\/jpeg;base64,\/9j\//)
  assert.ok(embedded.length > 1000, 'el banner viaja dentro del HTML')
  assert.equal(await bannerSource('https://example.com/banner.jpg'), 'https://example.com/banner.jpg')
  await assert.rejects(() => bannerSource('./assets/no-existe.jpg'))
})

test('los botones del HTML van uno por fila, con su comando y Support enlazado', () => {
  const ctx = htmlContext()
  const html = menuButtonsHtml(ctx)
  const rows = html.split('\n').filter(Boolean)
  assert.equal(rows.length, 3, 'un botón por fila')
  assert.match(rows[0], /<div class="btn"><span>Menu<\/span><small>\.menufull<\/small><\/div>/)
  assert.match(rows[1], /<span>Fast command<\/span><small>\.fastcommand<\/small>/)
  assert.match(rows[2], /<a class="btn support" href="https:\/\/wa\.me\/59896719709"><span>Support<\/span>/)
})

test('renderMenuHtml entrega la tarjeta completa sin marcadores sueltos', async () => {
  const ctx = htmlContext()
  const html = await renderMenuHtml(ctx)
  assert.ok(!/\{\w+\}/.test(html), 'todos los marcadores se rellenan')
  assert.match(html, /<title>Satoru gojo<\/title>/)
  assert.match(html, /<h1>Satoru gojo \d+\.\d+\.\d+<\/h1>/, 'el h1 trae nombre y versión')
  assert.match(html, /<p class="hello">¡Buenos días! ☀️ <strong>Lyann<\/strong> · Selecciona el menu que necesites<\/p>/)
  assert.match(html, /<span class="lbl">ESTADO<\/span><span class="val">Activo<\/span>/)
  assert.match(html, /<span class="lbl">COMANDOS TOTALES<\/span><span class="val">\d+<\/span>/)
  assert.match(html, /<span class="lbl">CLIMA<\/span>/, 'la ficha del clima del diseño de Drive')
  assert.match(html, /<span class="lbl">HORA<\/span><span class="val">\d{2}:\d{2}<\/span>/)
  assert.match(html, /<code>\.menu &lt;categoría&gt;<\/code>/)
  // Los conteos salen del registro real, así el test no se rompe al añadir plugins
  assert.ok(html.includes(`${registry.count} comandos · ${registry.commands.size} alias ·`), 'debe informar los comandos del registro')
  assert.match(html, /data:image\/jpeg;base64,/)
  assert.match(html, /✦ Satoru Gojo \d+\.\d+\.\d+ ✦ · Ⓒ Satoru gojo · /)
  assert.equal(menuHtmlFileName(ctx), 'satoru-gojo-menu.html')
})

test('el nombre de archivo se deriva del nombre del bot', () => {
  assert.equal(menuHtmlFileName(htmlContext({ config: { botName: 'Ñandú Bot!' } })), 'nandu-bot-menu.html')
  assert.equal(menuHtmlFileName(htmlContext({ config: { botName: '⚡' } })), 'bot-menu.html')
})

test('el pushName del usuario se escapa dentro del HTML', async () => {
  const ctx = htmlContext()
  ctx.m.name = '<img src=x onerror=alert(1)>'
  const html = await renderMenuHtml(ctx)
  assert.ok(!html.includes('<img src=x'), 'no debe colarse markup del usuario')
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/)
})

test('por defecto el menú NO manda el archivo HTML: aparece como tarjeta-imagen', async () => {
  const ctx = htmlContext()
  const relayed = []
  ctx.sock.relayMessage = async (jid, message) => { relayed.push(message); return 'ID' }
  ctx.sock.waUploadToServer = async () => ({ mediaUrl: 'https://example.invalid/m', directPath: '/m' })
  ctx.sock.user = { id: CHAT, jid: CHAT }
  await deliverMenu(ctx)
  assert.equal(ctx.messages.length, 0, 'sin documentos adjuntos')
  assert.equal(relayed.length, 1, 'el menú se ve en el chat como tarjeta con botones')
})

test('sendMenuHtml envía la tarjeta como documento text/html', async () => {
  const ctx = htmlContext()
  await sendMenuHtml(ctx)
  assert.equal(ctx.messages.length, 1)
  const { content, chat, options } = ctx.messages[0]
  assert.equal(chat, CHAT)
  assert.equal(content.mimetype, 'text/html')
  assert.equal(content.fileName, 'satoru-gojo-menu.html')
  assert.match(content.caption, /menú en HTML/)
  assert.ok(Buffer.isBuffer(content.document))
  assert.match(content.document.toString('utf8'), /<h1>Satoru gojo \d+\.\d+\.\d+<\/h1>/)
  assert.equal(options.quoted, ctx.m.raw, 'responde al mensaje del usuario')
})

test('con htmlEnabled en true, deliverMenu adjunta el archivo HTML detrás del menú', async () => {
  const ctx = htmlContext({ config: { menu: { htmlEnabled: true } } })
  const relayed = []
  ctx.sock.relayMessage = async (jid, message) => { relayed.push(message); return 'ID' }
  ctx.sock.waUploadToServer = async () => ({ mediaUrl: 'https://example.invalid/m', directPath: '/m' })
  ctx.sock.user = { id: CHAT, jid: CHAT }
  await deliverMenu(ctx)
  assert.equal(relayed.length, 1, 'primero el menú con sus botones')
  assert.equal(ctx.messages.length, 1, 'después el archivo HTML (activado)')
  assert.equal(ctx.messages[0].content.mimetype, 'text/html')
})

test('si la plantilla HTML falta, el menú se entrega igual', async () => {
  const ctx = htmlContext({ config: { menu: { htmlEnabled: true, htmlTemplate: './assets/no-existe.html' } } })
  const relayed = []
  ctx.sock.relayMessage = async (jid, message) => { relayed.push(message); return 'ID' }
  ctx.sock.waUploadToServer = async () => ({ mediaUrl: 'https://example.invalid/m', directPath: '/m' })
  ctx.sock.user = { id: CHAT, jid: CHAT }
  const warnings = []
  const originalWarn = console.warn
  console.warn = message => warnings.push(String(message))
  try {
    await deliverMenu(ctx)
  } finally {
    console.warn = originalWarn
  }
  assert.equal(relayed.length, 1, 'el menú no se pierde por el HTML')
  assert.equal(ctx.messages.length, 0)
  assert.match(warnings.join('\n'), /No se pudo enviar el menú HTML/)
})
