import test from 'node:test'
import assert from 'node:assert/strict'
import { bannerMedia, sendViaLia } from '../src/interactive.js'

function mockSocket() {
  const sent = []
  return {
    sent,
    user: { id: '59896719709@s.whatsapp.net', jid: '59896719709@s.whatsapp.net' },
    waUploadToServer: async () => ({ mediaUrl: 'https://example.invalid/media', directPath: '/media' }),
    relayMessage: async (jid, message, options) => sent.push({ jid, message, options }),
  }
}

test('genera menú nativeFlow con banner y nodo biz', async () => {
  const sock = mockSocket()
  const media = await bannerMedia('./assets/banner.jpg')
  await sendViaLia(sock, '123@s.whatsapp.net', {
    ...media,
    caption: 'Velirius',
    footer: 'Bot',
    nativeFlow: [{
      text: 'Ver comandos',
      sections: [{ title: 'Categorías', rows: [{ header: '', title: 'General', description: 'Menú', id: 'vlrs_menu_general' }] }],
    }],
  })
  assert.ok(sock.sent[0].message.interactiveMessage)
  assert.equal(sock.sent[0].options.additionalNodes[0].tag, 'biz')
  assert.ok(sock.sent[0].message.interactiveMessage.header.imageMessage)
})

test('genera listMessage clásico con nodo biz', async () => {
  const sock = mockSocket()
  await sendViaLia(sock, '123@s.whatsapp.net', {
    title: 'Velirius',
    text: 'Menú',
    buttonText: 'Ver',
    sections: [{ title: 'Categorías', rows: [{ title: 'General', description: 'Menú', rowId: 'vlrs_menu_general' }] }],
  })
  assert.ok(sock.sent[0].message.listMessage)
  assert.equal(sock.sent[0].message.listMessage.sections[0].rows[0].rowId, 'vlrs_menu_general')
  assert.equal(sock.sent[0].options.additionalNodes[0].tag, 'biz')
})

/* ------------------------------------------------------------------ *
 * Menú propio de MultiBots (Satoru Gojo)
 * ------------------------------------------------------------------ */
import { DEFAULT_CONFIG, normalizeConfig } from '../src/config.js'
import { PluginRegistry } from '../src/plugins.js'
import { deliverMenu, buildButtonTextMenu } from '../src/interactive.js'

const registry = await new PluginRegistry().load()

function menuContext(overrides = {}) {
  // `config` se fusiona con DEFAULT_CONFIG y NO se pasa por el spread final,
  // para que un override parcial no reemplace la configuración normalizada.
  const { config: configOverrides, ...rest } = overrides
  const sock = mockSocket()
  const messages = []
  sock.sendMessage = async (chat, content, options) => { messages.push({ chat, content, options }); return { key: { id: 'K' } } }
  const config = normalizeConfig({ ...structuredClone(DEFAULT_CONFIG), autoRead: false, cooldownMs: 0, ...configOverrides })
  return {
    sock,
    messages,
    config,
    registry,
    usedPrefix: config.prefix,
    startedAt: Date.now() - 1000,
    isOwner: true,
    isMod: false,
    isAdmin: false,
    isGroup: false,
    m: {
      chat: '59896719709@s.whatsapp.net',
      sender: '59896719709@s.whatsapp.net',
      senderDisplay: '59896719709@s.whatsapp.net',
      name: 'Lyann',
      // raw debe traer `message`: es lo que usa Baileys al citar el mensaje
      raw: {
        key: { id: 'Q', remoteJid: '59896719709@s.whatsapp.net', fromMe: false },
        message: { conversation: '.menu' },
      },
    },
    reply: text => messages.push({ chat: 'reply', content: { text } }),
    ...rest,
  }
}

function buttonsOf(message) {
  const flow = message?.interactiveMessage?.nativeFlowMessage
  return (flow?.buttons || []).map(button => ({
    name: button.name,
    params: JSON.parse(button.buttonParamsJson || '{}'),
  }))
}

test('deliverMenu envía banner + caption nuestro + los 3 botones quick_reply', async () => {
  const ctx = menuContext()
  await deliverMenu(ctx)
  assert.equal(ctx.sock.sent.length, 1)
  const message = ctx.sock.sent[0].message
  assert.ok(message.interactiveMessage, 'debe ser un interactiveMessage')
  assert.ok(message.interactiveMessage.header?.imageMessage, 'debe llevar el banner en el header')
  assert.match(message.interactiveMessage.body.text, /\*Satoru gojo\*/)
  assert.match(message.interactiveMessage.body.text, /¡Buenos días! ☀️ Lyann/)
  assert.match(message.interactiveMessage.body.text, /Selecciona el menu que necesites/)
  assert.match(message.interactiveMessage.body.text, /```Ⓒ Satoru gojo```/)
  assert.equal(message.interactiveMessage.footer.text, 'Ⓒ Satoru gojo')

  const buttons = buttonsOf(message)
  assert.deepEqual(buttons.map(button => button.params.display_text), ['Menu', 'Fast command', 'Support'])
  assert.deepEqual(buttons.map(button => button.params.id), ['menu_full', 'menu_fast', 'menu_support'])
  assert.ok(buttons.every(button => button.name === 'quick_reply'))
})

test('si el menú interactivo falla, cae al banner + texto con los 3 comandos', async () => {
  const ctx = menuContext()
  ctx.sock.relayMessage = async () => { throw new Error('interactive no soportado') }
  await deliverMenu(ctx)
  assert.equal(ctx.messages.length, 2, 'banner + menú de texto')
  assert.ok(ctx.messages[0].content.image, 'primero va el banner')
  assert.match(ctx.messages[0].content.caption, /\*Satoru gojo\*/)
  assert.match(ctx.messages[1].content.text, /\.menufull — \*Menu\*/)
  assert.match(ctx.messages[1].content.text, /\.fastcommand — \*Fast command\*/)
  assert.match(ctx.messages[1].content.text, /\.support — \*Support\*/)
  assert.match(ctx.messages[1].content.text, /Ⓒ Satoru gojo/)
})

test('si además falla el banner, envía un único mensaje de texto completo', async () => {
  const ctx = menuContext({ config: { banner: './assets/no-existe.jpg' } })
  ctx.sock.relayMessage = async () => { throw new Error('interactive no soportado') }
  await deliverMenu(ctx)
  assert.equal(ctx.messages.length, 1)
  assert.match(ctx.messages[0].content.text, /\*Satoru gojo\*/)
  assert.match(ctx.messages[0].content.text, /\.menufull — \*Menu\*/)
})

test('menuMode text no intenta botones y menuMode list conserva las categorías', async () => {
  const text = menuContext({ config: { menuMode: 'text' } })
  await deliverMenu(text)
  assert.equal(text.sock.sent.length, 0, 'en modo texto no se hace relayMessage')
  assert.equal(text.messages.length, 2)

  const list = menuContext({ config: { menuMode: 'list' } })
  await deliverMenu(list)
  assert.equal(list.sock.sent.length, 1)
  const buttons = buttonsOf(list.sock.sent[0].message)
  assert.equal(buttons.length, 1)
  assert.equal(buttons[0].name, 'single_select')
  const rows = buttons[0].params.sections.flatMap(section => section.rows)
  assert.ok(rows.length >= 18)
  assert.ok(rows.every(row => row.id.startsWith('vlrs_menu_')))
})

test('buildButtonTextMenu refleja los botones configurados', () => {
  const ctx = menuContext()
  const text = buildButtonTextMenu(ctx)
  assert.match(text, /Selecciona el menu que necesites/)
  assert.equal(text.split('\n').filter(line => line.startsWith('> .')).length, 3)
  assert.match(text, /Ⓒ Satoru gojo$/)
})
