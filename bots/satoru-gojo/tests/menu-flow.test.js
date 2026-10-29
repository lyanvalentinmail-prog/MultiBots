import test from 'node:test'
import assert from 'node:assert/strict'
import { MessageHandler } from '../src/handler.js'
import { PluginRegistry } from '../src/plugins.js'
import { DEFAULT_CONFIG, normalizeConfig } from '../src/config.js'

/**
 * Flujo completo del menú de MultiBots a través del handler real:
 *   .menu -> banner + 3 botones -> pulsar un botón -> ejecuta su comando
 */
const registry = await new PluginRegistry().load()
const SENDER = '59896719709@s.whatsapp.net'

function buildHandler(menuMode = 'interactive') {
  const relayed = []
  const sent = []
  const tracked = []
  const config = normalizeConfig({
    ...structuredClone(DEFAULT_CONFIG),
    menuMode,
    autoRead: false,
    cooldownMs: 0,
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
    waUploadToServer: async () => ({ mediaUrl: 'https://example.invalid/m', directPath: '/m' }),
    relayMessage: async (jid, message, options) => { relayed.push({ jid, message, options }); return 'ID' },
    sendMessage: async (jid, content, options) => { sent.push({ jid, content, options }); return { key: { id: 'K' } } },
    groupMetadata: async jid => ({ id: jid, subject: 'Grupo', participants: [] }),
    readMessages: async () => {},
  }
  const handler = new MessageHandler({ registry, configStore: { data: config }, database, startedAt: Date.now() - 1000 })
  return { handler, sock, relayed, sent, tracked, config }
}

const textOf = content => String(content?.text || content?.caption || '')
const quickReplies = message => (message?.interactiveMessage?.nativeFlowMessage?.buttons || [])
  .map(button => ({ name: button.name, params: JSON.parse(button.buttonParamsJson || '{}') }))

test('.menu interactivo entrega banner + caption nuestro + 3 botones', async () => {
  const { handler, sock, relayed } = buildHandler('interactive')
  await handler.handle(sock, {
    key: { id: 'A1', remoteJid: SENDER, fromMe: false },
    pushName: 'Lyann',
    message: { conversation: '.menu' },
  })
  assert.equal(relayed.length, 1, 'debe retransmitir un interactiveMessage')
  const message = relayed[0].message
  assert.ok(message.interactiveMessage.header?.imageMessage, 'debe llevar el banner')
  const body = message.interactiveMessage.body.text
  assert.match(body, /\*Satoru gojo\*/)
  assert.match(body, /¡Buenos días! ☀️ Lyann/)
  assert.match(body, /Selecciona el menu que necesites/)
  assert.match(body, /```Ⓒ Satoru gojo```/)
  const buttons = quickReplies(message)
  assert.deepEqual(buttons.map(b => b.params.display_text), ['Menu', 'Fast command', 'Support'])
  assert.deepEqual(buttons.map(b => b.params.id), ['menu_full', 'menu_fast', 'menu_support'])
})

test('pulsar cada botón ejecuta el comando que le corresponde', async () => {
  const cases = [
    ['menu_full', /──── MENÚ COMPLETO ────/, 'menufull'],
    ['menu_fast', /⚡ \*Fast Commands\* ⚡/, 'fastcommand'],
    ['menu_support', /https:\/\/wa\.me\/59896719709/, 'support'],
  ]
  for (const [id, pattern, expected] of cases) {
    const { handler, sock, sent, tracked } = buildHandler('interactive')
    await handler.handle(sock, {
      key: { id: 'B-' + id, remoteJid: SENDER, fromMe: false },
      pushName: 'Lyann',
      message: {
        interactiveResponseMessage: {
          nativeFlowResponseMessage: { paramsJson: JSON.stringify({ display_text: 'x', id }) },
        },
      },
    })
    const text = sent.map(item => textOf(item.content)).join('\n')
    assert.match(text, pattern, `el botón ${id} no produjo lo esperado`)
    assert.deepEqual(tracked, [expected], `el botón ${id} no ejecutó ${expected}`)
  }
})

test('los comandos del menú funcionan escribiéndolos a mano', async () => {
  for (const [command, pattern] of [['.menufull', /MENÚ COMPLETO/], ['.fastcommand', /Fast Commands/], ['.support', /wa\.me\/59896719709/]]) {
    const { handler, sock, sent } = buildHandler('interactive')
    await handler.handle(sock, {
      key: { id: 'C-' + command, remoteJid: SENDER, fromMe: false },
      pushName: 'Lyann',
      message: { conversation: command },
    })
    assert.match(sent.map(item => textOf(item.content)).join('\n'), pattern, `${command} no respondió`)
  }
})

test('si el envío interactivo falla, el usuario recibe igualmente un menú utilizable', async () => {
  const { handler, sock, relayed, sent } = buildHandler('interactive')
  sock.relayMessage = async () => { throw new Error('interactive no soportado') }
  await handler.handle(sock, {
    key: { id: 'D1', remoteJid: SENDER, fromMe: false },
    pushName: 'Lyann',
    message: { conversation: '.menu' },
  })
  assert.equal(relayed.length, 0)
  assert.equal(sent.length, 2, 'banner + menú de texto')
  assert.ok(sent[0].content.image)
  const fallback = textOf(sent[1].content)
  assert.match(fallback, /\.menufull — \*Menu\*/)
  assert.match(fallback, /\.fastcommand — \*Fast command\*/)
  assert.match(fallback, /\.support — \*Support\*/)
})

test('"menu" a secas abre el menú (está documentado sin prefijo)', async () => {
  const { handler, sock, relayed, tracked } = buildHandler('interactive')
  await handler.handle(sock, {
    key: { id: 'G1', remoteJid: SENDER, fromMe: false },
    pushName: 'Lyann',
    message: { conversation: 'menu' },
  })
  assert.equal(relayed.length, 1, 'menu sin prefijo debe abrir el menú')
  assert.deepEqual(tracked, ['menu'])
})

test('el resto del texto normal no dispara ningún comando', async () => {
  const { handler, sock, sent, relayed } = buildHandler('interactive')
  for (const text of ['hola', 'si', 'sol', 'identidad', 'ping', 'nota', 'work', 'sticker', 'menu completo']) {
    await handler.handle(sock, {
      key: { id: 'E-' + text, remoteJid: SENDER, fromMe: false },
      pushName: 'Lyann',
      message: { conversation: text },
    })
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
})
