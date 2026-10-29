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
import { BUTTON_STYLES } from '../src/menu.js'
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

/** Sin tarjeta HTML: estos tests miran sólo el mensaje del menú. */
const noHtml = { config: { menu: { htmlEnabled: false } } }

function wireKind(message) {
  if (message?.templateMessage) return 'templateMessage'
  if (message?.buttonsMessage) return 'buttonsMessage'
  if (message?.interactiveMessage?.carouselMessage) return 'carouselMessage'
  if (message?.interactiveMessage) return 'interactiveMessage'
  return Object.keys(message || {})[0]
}

function wireButtons(message) {
  const parse = json => JSON.parse(json || '{}')
  const template = message?.templateMessage?.hydratedFourRowTemplate
  if (template) {
    return template.hydratedButtons.map(button => ({
      text: button.quickReplyButton?.displayText,
      id: button.quickReplyButton?.id,
    }))
  }
  const legacy = message?.buttonsMessage
  if (legacy) {
    return legacy.buttons.map(button => ({ text: button.buttonText?.displayText, id: button.buttonId }))
  }
  const carousel = message?.interactiveMessage?.carouselMessage
  if (carousel) {
    return carousel.cards.map(card => {
      const params = parse(card.nativeFlowMessage.buttons[0].buttonParamsJson)
      return { text: params.display_text, id: params.id }
    })
  }
  const flow = message?.interactiveMessage?.nativeFlowMessage
  if (flow) {
    return flow.buttons.map(button => {
      const params = parse(button.buttonParamsJson)
      return { text: params.display_text, id: params.id, name: button.name }
    })
  }
  return []
}

function wireBanner(message) {
  return Boolean(
    message?.templateMessage?.hydratedFourRowTemplate?.imageMessage
    || message?.buttonsMessage?.imageMessage
    || message?.interactiveMessage?.header?.imageMessage
    || message?.interactiveMessage?.carouselMessage?.cards?.[0]?.header?.imageMessage,
  )
}

/** Sólo etiqueta e id: `name` existe únicamente en native flow. */
const labelsOf = message => wireButtons(message).map(({ text, id }) => ({ text, id }))

const OUR_BUTTONS = [
  { text: 'Menu', id: 'menu_full' },
  { text: 'Fast command', id: 'menu_fast' },
  { text: 'Support', id: 'menu_support' },
]

test('el menú usa por defecto los 3 botones en vertical (native flow), separados', async () => {
  const ctx = menuContext(noHtml)
  assert.equal(ctx.config.menu.buttonStyle, 'native', 'el estilo por defecto es native')
  await deliverMenu(ctx)
  assert.equal(ctx.sock.sent.length, 1)
  const message = ctx.sock.sent[0].message
  assert.equal(wireKind(message), 'interactiveMessage')
  const flow = message.interactiveMessage?.nativeFlowMessage
  assert.ok(flow, 'native flow: una fila por botón, en vertical y separadas')
  assert.ok(wireButtons(message).every(button => button.name === 'quick_reply'), 'son quick_reply')
  assert.deepEqual(labelsOf(message), OUR_BUTTONS, 'los 3 botones, uno por fila')
  assert.ok(wireBanner(message), 'la cabecera lleva la tarjeta')
  assert.match(message.interactiveMessage.body.text, /\*Satoru gojo\*/)
  assert.match(message.interactiveMessage.body.text, /¡Buenos días! ☀️ Lyann/)
  assert.match(message.interactiveMessage.body.text, /Selecciona el menu que necesites/)
})

test('con buttonStyle template vuelve la plantilla hidratada con sus chips', async () => {
  const ctx = menuContext({ config: { menu: { buttonStyle: 'template', htmlEnabled: false } } })
  await deliverMenu(ctx)
  const message = ctx.sock.sent[0].message
  assert.equal(wireKind(message), 'templateMessage')
  const template = message.templateMessage.hydratedFourRowTemplate
  assert.deepEqual(labelsOf(message), OUR_BUTTONS, 'los 3 botones de siempre')
  assert.ok(template.hydratedButtons.every(button => button.quickReplyButton), 'son quickReplyButton')
  assert.ok(wireBanner(message), 'la plantilla lleva el banner')
  assert.equal(template.hydratedFooterText, 'Ⓒ Satoru gojo')
})

test('cada tipo de botones del menú genera su mensaje y conserva los 3 botones', async () => {
  const expected = {
    native: 'interactiveMessage',
    template: 'templateMessage',
    buttons: 'buttonsMessage',
    sheet: 'interactiveMessage',
    carousel: 'carouselMessage',
  }
  for (const style of BUTTON_STYLES) {
    const ctx = menuContext({ config: { menu: { buttonStyle: style, htmlEnabled: false } } })
    await deliverMenu(ctx)
    const message = ctx.sock.sent[0].message
    assert.equal(wireKind(message), expected[style], `estilo ${style}`)
    assert.deepEqual(labelsOf(message), OUR_BUTTONS, `estilo ${style}: botones`)
    assert.ok(wireBanner(message), `estilo ${style}: banner`)
    if (style === 'sheet') {
      const params = JSON.parse(message.interactiveMessage.nativeFlowMessage.messageParamsJson)
      assert.ok(params.bottom_sheet, 'sheet envuelve los botones en una hoja inferior')
      assert.deepEqual(params.bottom_sheet.divider_indices, [0, 1, 2], 'cada opción va separada por un divisor')
      assert.equal(params.bottom_sheet.button_title, '☾ Selecciona una opción')
    }
    if (style === 'carousel') {
      assert.equal(message.interactiveMessage.carouselMessage.cards.length, 3, 'una tarjeta por botón')
    }
    if (style === 'native') {
      assert.ok(wireButtons(message).every(button => button.name === 'quick_reply'))
    }
  }
})

test('un estilo desconocido cae a native en vez de romper el menú', async () => {
  const ctx = menuContext(noHtml)
  ctx.config.menu.buttonStyle = 'invento'
  await deliverMenu(ctx)
  assert.equal(wireKind(ctx.sock.sent[0].message), 'interactiveMessage')
  assert.deepEqual(labelsOf(ctx.sock.sent[0].message), OUR_BUTTONS)
})

test('si el menú interactivo falla, cae al banner + texto con los 3 comandos', async () => {
  const ctx = menuContext(noHtml)
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

test('si además falla el banner, la tarjeta se compone igual con cabecera lisa', async () => {
  const ctx = menuContext({ config: { banner: './assets/no-existe.jpg', menu: { htmlEnabled: false } } })
  ctx.sock.relayMessage = async () => { throw new Error('interactive no soportado') }
  await deliverMenu(ctx)
  assert.equal(ctx.messages.length, 2, 'tarjeta con cabecera lisa + menú de texto')
  assert.ok(Buffer.isBuffer(ctx.messages[0].content.image), 'la tarjeta no depende del banner')
  assert.match(ctx.messages[0].content.caption, /\*Satoru gojo\*/)
  assert.match(ctx.messages[1].content.text, /\.menufull — \*Menu\*/)
})

test('menuMode text no intenta botones y menuMode list conserva las categorías', async () => {
  const text = menuContext({ config: { menuMode: 'text', menu: { htmlEnabled: false } } })
  await deliverMenu(text)
  assert.equal(text.sock.sent.length, 0, 'en modo texto no se hace relayMessage')
  assert.equal(text.messages.length, 2)

  const list = menuContext({ config: { menuMode: 'list', menu: { htmlEnabled: false } } })
  await deliverMenu(list)
  assert.equal(list.sock.sent.length, 1)
  const buttons = wireButtons(list.sock.sent[0].message)
  assert.equal(buttons.length, 1)
  assert.equal(buttons[0].name, 'single_select')
  const rows = JSON.parse(list.sock.sent[0].message.interactiveMessage.nativeFlowMessage.buttons[0].buttonParamsJson)
    .sections.flatMap(section => section.rows)
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
