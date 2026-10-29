import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { MessageHandler } from '../src/handler.js'
import { PluginRegistry } from '../src/plugins.js'
import { DEFAULT_CONFIG, normalizeConfig } from '../src/config.js'

/**
 * Flujo completo del menú de MultiBots a través del handler real:
 *   .menu -> banner + 3 botones separados + tarjeta HTML -> pulsar -> su comando
 */
const registry = await new PluginRegistry().load()
const SENDER = '59896719709@s.whatsapp.net'

function buildHandler(menuMode = 'interactive', menu = {}) {
  const relayed = []
  const sent = []
  const tracked = []
  const uploads = []
  const config = normalizeConfig({
    ...structuredClone(DEFAULT_CONFIG),
    menuMode,
    autoRead: false,
    cooldownMs: 0,
    menu,
  })
  const database = {
    data: { users: {}, chats: {}, stats: { commands: {}, totalCommands: 0 } },
    touchMessage() {},
    trackCommand(_m, command) { tracked.push(command) },
    scheduleSave() {},
    hasRules() { return false },
  }
  const sock = {
    user: { id: SENDER, jid: SENDER },
    // lia sube el archivo cifrado desde disco: leerlo deja ver qué imagen viajó
    waUploadToServer: async encFilePath => {
      uploads.push(await readFile(encFilePath))
      return { mediaUrl: 'https://example.invalid/m', directPath: '/m' }
    },
    relayMessage: async (jid, message, options) => { relayed.push({ jid, message, options }); return 'ID' },
    sendMessage: async (jid, content, options) => { sent.push({ jid, content, options }); return { key: { id: 'K' } } },
    groupMetadata: async jid => ({ id: jid, subject: 'Grupo', participants: [] }),
    readMessages: async () => {},
  }
  // ConfigStore mínimo pero real: .menustyle guarda ahí el estilo elegido
  const configStore = {
    data: config,
    async update(mutator) {
      const draft = structuredClone(this.data)
      const changed = await mutator(draft)
      this.data = normalizeConfig(changed || draft)
      return this.data
    },
  }
  const handler = new MessageHandler({ registry, configStore, database, startedAt: Date.now() - 1000 })
  return { handler, sock, relayed, sent, tracked, uploads, config, configStore }
}

const textOf = content => String(content?.text || content?.caption || '')
const htmlOf = sent => sent.find(item => item.content?.mimetype === 'text/html')
const sha1 = buffer => createHash('sha1').update(buffer).digest('hex')

function templateOf(message) {
  return message?.templateMessage?.hydratedFourRowTemplate
}

function templateButtons(message) {
  return (templateOf(message)?.hydratedButtons || [])
    .map(button => button.quickReplyButton)
    .filter(Boolean)
}

const quickReplies = message => (message?.interactiveMessage?.nativeFlowMessage?.buttons || [])
  .map(button => ({ name: button.name, params: JSON.parse(button.buttonParamsJson || '{}') }))

async function sendMenu(handler, sock, text = '.menu', id = 'A1') {
  await handler.handle(sock, {
    key: { id, remoteJid: SENDER, fromMe: false },
    pushName: 'Lyann',
    message: { conversation: text },
  })
}

test('.menu entrega la tarjeta y, detrás, los 3 botones en vertical (native flow)', async () => {
  const { handler, sock, relayed } = buildHandler('interactive')
  await sendMenu(handler, sock)
  assert.equal(relayed.length, 2, 'tarjeta-imagen + mensaje de botones, como en el ejemplo')
  const card = relayed[0].message
  assert.ok(card.imageMessage, 'el primer mensaje es la tarjeta como imagen')
  assert.ok(!card.imageMessage.caption, 'la imagen no lleva caption')
  const message = relayed[1].message
  const interactive = message?.interactiveMessage
  assert.ok(interactive, 'por defecto el menú viaja como interactiveMessage: botones en vertical')
  assert.ok(interactive.header?.imageMessage, 'la cabecera lleva el banner')
  assert.equal(interactive.header.title, 'Satoru Gojo')
  assert.equal(interactive.header.subtitle, '¡Buenos días! ☀️ Lyann')
  assert.match(interactive.body.text, /Selecciona el menu que necesites/)
  assert.match(interactive.footer?.text || '', /Ⓒ Satoru gojo/)
  // Tres botones quick_reply, cada uno en su fila: separados, no pegados
  const buttons = quickReplies(message)
  assert.deepEqual(buttons.map(button => button.params.display_text), ['☰ Menu', '☆ Fast command', '✦ Support'])
  assert.deepEqual(buttons.map(button => button.params.id), ['menu_full', 'menu_fast', 'menu_support'])
  assert.ok(buttons.every(button => button.name === 'quick_reply'))
})

test('con buttonStyle template el mensaje de botones vuelve a la plantilla hidratada', async () => {
  const { handler, sock, relayed } = buildHandler('interactive', { buttonStyle: 'template' })
  await sendMenu(handler, sock)
  const message = relayed[1].message
  const template = templateOf(message)
  assert.ok(template, 'con template el mensaje de botones viaja como templateMessage')
  assert.ok(template.imageMessage, 'debe llevar el banner')
  assert.match(template.hydratedContentText, /Selecciona el menu que necesites/)
  assert.equal(template.hydratedFooterText, 'Ⓒ Satoru gojo')
  assert.deepEqual(templateButtons(message).map(button => button.displayText), ['☰ Menu', '☆ Fast command', '✦ Support'])
  assert.deepEqual(templateButtons(message).map(button => button.id), ['menu_full', 'menu_fast', 'menu_support'])
})

test('.menu aparece en el chat como tarjeta-imagen y sube también el banner de la cabecera', async () => {
  const { handler, sock, uploads, sent, relayed } = buildHandler('interactive')
  await sendMenu(handler, sock)
  assert.equal(relayed.length, 2)
  assert.equal(htmlOf(sent), undefined, 'no se manda ningún archivo: la tarjeta aparece en el mensaje')
  assert.equal(uploads.length, 2, 'la tarjeta y el banner de la cabecera de botones')
  // lia cifra el archivo antes de subirlo: alcanza con verificar los tamaños
  // (los píxeles se miran en tests/card.test.js)
  assert.ok(uploads[0].length > 100_000, 'la tarjeta pesa más que el banner suelto')
  assert.ok(uploads[1].length < 40_000, 'la segunda subida es el banner')
})

test('con menu.htmlEnabled en true, el menú vuelve a adjuntar el archivo HTML', async () => {
  const { handler, sock, sent } = buildHandler('interactive', { htmlEnabled: true })
  await sendMenu(handler, sock)
  const html = htmlOf(sent)
  assert.ok(html, 'activado a mano, el HTML sí se adjunta')
  assert.equal(html.content.mimetype, 'text/html')
  assert.equal(html.content.fileName, 'satoru-gojo-menu.html')
  const document = html.content.document.toString('utf8')
  assert.match(document, /<h1>Satoru gojo \d+\.\d+\.\d+<\/h1>/)
  assert.match(document, /data:image\/jpeg;base64,/, 'el banner va incrustado')
  assert.equal((document.match(/class="btn/g) || []).length, 3, 'los 3 botones separados')
  assert.match(document, /href="https:\/\/wa\.me\/59896719709"/, 'Support enlaza al propietario')
  assert.ok(!/\{\w+\}/.test(document), 'no quedan marcadores sin rellenar')
})

test('con cardEnabled en false, el menú usa el banner original', async () => {
  const { handler, sock, uploads } = buildHandler('interactive', { cardEnabled: false })
  await sendMenu(handler, sock)
  // lia cifra antes de subir: el ciphertext del banner (26 KB) pesa mucho menos
  // que el de la tarjeta (>100 KB), así se distingue qué imagen viajó
  assert.equal(uploads.length, 2, 'tarjeta-fallback(banner) + cabecera')
  assert.ok(uploads.every(upload => upload.length < 40_000), `viaja el banner suelto, no la tarjeta (${uploads.map(u => u.length)})`)
})

test('la tarjeta HTML se puede pedir sola con .menuhtml y con ".menu html"', async () => {
  for (const [command, expected] of [['.menuhtml', 'menuhtml'], ['.menu html', 'menu']]) {
    const { handler, sock, sent, relayed, tracked } = buildHandler('interactive')
    await sendMenu(handler, sock, command, 'H-' + command)
    assert.equal(relayed.length, 0, `${command} no debe enviar el menú interactivo`)
    assert.deepEqual(tracked, [expected])
    assert.ok(htmlOf(sent), `${command} debe enviar la tarjeta HTML`)
    assert.equal(sent.filter(item => item.content?.mimetype === 'text/html').length, 1, 'una sola tarjeta')
  }
})

test('menu.htmlEnabled en off deja el menú sin tarjeta HTML', async () => {
  const { handler, sock, sent } = buildHandler('interactive', { htmlEnabled: false })
  await sendMenu(handler, sock)
  assert.equal(htmlOf(sent), undefined)
})

test('pulsar cada botón de la plantilla ejecuta el comando que le corresponde', async () => {
  const cases = [
    ['menu_full', /──── MENÚ COMPLETO ────/, 'menufull'],
    ['menu_fast', /⚡ \*Fast Commands\* ⚡/, 'fastcommand'],
    ['menu_support', /https:\/\/wa\.me\/59896719709/, 'support'],
  ]
  for (const [id, pattern, expected] of cases) {
    const { handler, sock, sent, tracked } = buildHandler('interactive')
    await handler.handle(sock, {
      key: { id: 'T-' + id, remoteJid: SENDER, fromMe: false },
      pushName: 'Lyann',
      message: { templateButtonReplyMessage: { selectedId: id, selectedIndex: 0 } },
    })
    const text = sent.map(item => textOf(item.content)).join('\n')
    assert.match(text, pattern, `el botón ${id} no produjo lo esperado`)
    assert.deepEqual(tracked, [expected], `el botón ${id} no ejecutó ${expected}`)
  }
})

test('los botones de native flow y los clásicos también responden al pulsarlos', async () => {
  const payloads = [
    ['native', { interactiveResponseMessage: { nativeFlowResponseMessage: { paramsJson: JSON.stringify({ id: 'menu_full' }) } } }],
    ['buttons', { buttonsResponseMessage: { selectedButtonId: 'menu_fast', type: 'RESPONSE' } }],
    ['list', { listResponseMessage: { singleSelectReply: { selectedRowId: 'menu_support' } } }],
  ]
  for (const [label, message] of payloads) {
    const { handler, sock, sent, tracked } = buildHandler('interactive')
    await handler.handle(sock, { key: { id: 'R-' + label, remoteJid: SENDER, fromMe: false }, pushName: 'Lyann', message })
    assert.equal(tracked.length, 1, `${label} debe ejecutar un comando`)
    assert.ok(sent.length, `${label} debe responder algo`)
  }
})

test('con buttonStyle native el menú vuelve a ser un interactiveMessage con quick_reply', async () => {
  const { handler, sock, relayed } = buildHandler('interactive', { buttonStyle: 'native' })
  await sendMenu(handler, sock)
  const message = relayed[1].message
  assert.ok(message.interactiveMessage.header?.imageMessage, 'debe llevar el banner')
  const buttons = quickReplies(message)
  assert.deepEqual(buttons.map(button => button.params.display_text), ['☰ Menu', '☆ Fast command', '✦ Support'])
  assert.deepEqual(buttons.map(button => button.params.id), ['menu_full', 'menu_fast', 'menu_support'])
  assert.ok(buttons.every(button => button.name === 'quick_reply'))
})

test('.menustyle guarda el tipo de botones y manda el menú con él', async () => {
  const { handler, sock, relayed, configStore, sent } = buildHandler('interactive')
  await sendMenu(handler, sock, '.menustyle carousel', 'S1')
  assert.equal(configStore.data.menu.buttonStyle, 'carousel', 'debe quedar guardado')
  const carousel = relayed.at(-1).message.interactiveMessage?.carouselMessage
  assert.ok(carousel, 'el menú de prueba usa el nuevo estilo')
  assert.equal(carousel.cards.length, 3, 'una tarjeta por botón')
  assert.match(sent.map(item => textOf(item.content)).join('\n'), /Tipo de botones: \*carousel\*/)
})

test('.menustyle sin argumento lista los tipos disponibles', async () => {
  const { handler, sock, sent, relayed } = buildHandler('interactive')
  await sendMenu(handler, sock, '.menustyle', 'S2')
  const text = sent.map(item => textOf(item.content)).join('\n')
  assert.equal(relayed.length, 0, 'no debe enviar ningún menú')
  for (const style of ['native', 'template', 'buttons', 'sheet', 'carousel']) {
    assert.match(text, new RegExp(`\\*${style}\\*`), `falta ${style} en la lista`)
  }
  assert.match(text, /native\* _\(actual\)_/)
})

test('.menustyle rechaza un estilo inexistente', async () => {
  const { handler, sock, sent, configStore } = buildHandler('interactive')
  await sendMenu(handler, sock, '.menustyle invento', 'S3')
  assert.equal(configStore.data.menu.buttonStyle, 'native', 'no debe cambiar nada')
  assert.match(sent.map(item => textOf(item.content)).join('\n'), /Tipos de botones del menú/)
})

test('.setmenuhtml apaga y enciende la tarjeta HTML', async () => {
  const { handler, sock, sent, configStore } = buildHandler('interactive')
  await sendMenu(handler, sock, '.setmenuhtml off', 'X1')
  assert.equal(configStore.data.menu.htmlEnabled, false)
  assert.match(sent.map(item => textOf(item.content)).join('\n'), /desactivada/)
  await sendMenu(handler, sock, '.setmenuhtml on', 'X2')
  assert.equal(configStore.data.menu.htmlEnabled, true)
})

test('los comandos del menú funcionan escribiéndolos a mano', async () => {
  for (const [command, pattern] of [['.menufull', /MENÚ COMPLETO/], ['.fastcommand', /Fast Commands/], ['.support', /wa\.me\/59896719709/]]) {
    const { handler, sock, sent } = buildHandler('interactive')
    await sendMenu(handler, sock, command, 'C-' + command)
    assert.match(sent.map(item => textOf(item.content)).join('\n'), pattern, `${command} no respondió`)
  }
})

test('si el envío interactivo falla, el usuario recibe igualmente un menú utilizable', async () => {
  const { handler, sock, relayed, sent } = buildHandler('interactive')
  sock.relayMessage = async () => { throw new Error('interactive no soportado') }
  await sendMenu(handler, sock)
  assert.equal(relayed.length, 0)
  assert.equal(sent.length, 2, 'tarjeta + menú de texto')
  assert.ok(Buffer.isBuffer(sent[0].content.image), 'la tarjeta aparece igual')
  assert.equal(htmlOf(sent), undefined, 'sin archivos adjuntos')
  const fallback = textOf(sent[1].content)
  assert.match(fallback, /\.menufull — \*Menu\*/)
  assert.match(fallback, /\.fastcommand — \*Fast command\*/)
  assert.match(fallback, /\.support — \*Support\*/)
  assert.ok(Buffer.isBuffer(sent[0].content.image), 'aunque fallen los botones, la tarjeta aparece')
})

test('"menu" a secas abre el menú (está documentado sin prefijo)', async () => {
  const { handler, sock, relayed, tracked } = buildHandler('interactive')
  await sendMenu(handler, sock, 'menu', 'G1')
  assert.equal(relayed.length, 2, 'menu sin prefijo debe abrir el menú (tarjeta + botones)')
  assert.deepEqual(tracked, ['menu'])
})

test('el resto del texto normal no dispara ningún comando', async () => {
  const { handler, sock, sent, relayed } = buildHandler('interactive')
  for (const text of ['hola', 'si', 'sol', 'identidad', 'ping', 'nota', 'work', 'sticker', 'menu completo', 'html']) {
    await sendMenu(handler, sock, text, 'E-' + text)
  }
  assert.equal(sent.length, 0, 'ningún mensaje sin prefijo debe ejecutar un comando')
  assert.equal(relayed.length, 0)
})

test('una fila de categoría de la lista interactiva sigue abriendo esa categoría', async () => {
  const { handler, sock, sent } = buildHandler('list')
  await handler.handle(sock, {
    key: { id: 'F1', remoteJid: SENDER, fromMe: false },
    pushName: 'Lyann',
    message: {
      listResponseMessage: {
        title: 'RPG',
        singleSelectReply: { selectedRowId: 'vlrs_menu_rpg' },
      },
    },
  })
  const text = sent.map(item => textOf(item.content)).join('\n')
  assert.match(text, /juegos rpg/i)
  assert.match(text, /> `\.balance`/)
  assert.equal(htmlOf(sent), undefined, 'el modo lista no adjunta la tarjeta HTML')
})
