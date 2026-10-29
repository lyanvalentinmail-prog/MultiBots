import test from 'node:test'
import assert from 'node:assert/strict'
import { MessageHandler } from '../src/handler.js'
import { PluginRegistry } from '../src/plugins.js'
import { DEFAULT_CONFIG, normalizeConfig } from '../src/config.js'

test('el handler ejecuta .menu y conserva el rol de moderador en el contexto', async () => {
  const registry = new PluginRegistry('./plugins')
  await registry.load()
  const sender = '59811111111@s.whatsapp.net'
  const config = normalizeConfig({
    ...DEFAULT_CONFIG,
    menuMode: 'text',
    autoRead: false,
    cooldownMs: 0,
    mods: ['59811111111'],
  })
  const sent = []
  let trackedCommand = ''
  const database = {
    data: { users: {}, chats: {}, stats: { commands: {}, totalCommands: 0 } },
    touchMessage() {},
    trackCommand(_m, command) { trackedCommand = command },
    scheduleSave() {},
  }
  const sock = {
    user: { id: '59899999999@s.whatsapp.net' },
    sendMessage: async (chat, content, options) => {
      sent.push({ chat, content, options })
      return { key: { id: `sent-${sent.length}` } }
    },
  }
  const handler = new MessageHandler({
    registry,
    configStore: { data: config },
    database,
    startedAt: Date.now() - 1000,
  })

  await handler.handle(sock, {
    key: { id: 'menu-request', remoteJid: sender, fromMe: false },
    pushName: 'Moderador',
    message: { conversation: '.menu' },
  })

  assert.equal(trackedCommand, 'menu')
  // Menú de texto de MultiBots: banner con nuestro caption + los tres comandos
  assert.equal(sent.length, 2)
  assert.match(sent[0].content.caption, /\*Satoru gojo\*/)
  assert.match(sent[0].content.caption, /¡Buenos días! ☀️ Moderador/)
  assert.match(sent[0].content.caption, /Selecciona el menu que necesites/)
  assert.match(sent[1].content.text, /\.menufull — \*Menu\*/)
  assert.match(sent[1].content.text, /\.fastcommand — \*Fast command\*/)
  assert.match(sent[1].content.text, /\.support — \*Support\*/)
  assert.match(sent[1].content.text, /Ⓒ Satoru gojo/)
  assert.ok(!sent.some(({ content }) => String(content.text || '').includes('isMod is not defined')))
})
