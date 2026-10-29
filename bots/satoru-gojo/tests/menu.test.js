import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_CONFIG } from '../src/config.js'
import { PluginRegistry } from '../src/plugins.js'
import {
  availablePlugins,
  CATEGORIES,
  buildCommandsText,
  buildFastCommandText,
  buildFullMenu,
  buildMenuHeader,
  buildMenuSections,
  buildSelectedCategory,
  buildSupportText,
  categoryFromSelection,
  fastEntries,
  FAST_COMMANDS,
  findCategory,
  MENU_LAYOUT,
  MENU_ROW_PREFIX,
  pluginsByCategory,
  selectionToCommand,
} from '../src/menu.js'

const registry = await new PluginRegistry().load()
const context = {
  registry,
  config: structuredClone(DEFAULT_CONFIG),
  m: { senderDisplay: '59890000000@s.whatsapp.net', sender: '59890000000@s.whatsapp.net', name: 'Usuario' },
  isOwner: false,
  isMod: false,
  isAdmin: false,
  isGroup: false,
  startedAt: Date.now() - 65000,
  usedPrefix: '.',
}
const ownerContext = {
  ...context,
  m: { senderDisplay: '59896719709@s.whatsapp.net', sender: '59896719709@s.whatsapp.net', name: 'Lyann' },
  isOwner: true,
  isAdmin: true,
  isGroup: true,
}

test('carga 222 comandos, 405 alias y todas las entradas del menú', () => {
  assert.equal(registry.count, 222)
  assert.equal(registry.commands.size, 405)
  for (const command of [
    'menu', 'menufull', 'fastcommand', 'support', 'play', 'tiktok', 'stt', 'bratvideo',
    'attp', 'emojimix', 'sticker', 'pack', 'catch', 'w', 'claim', 'balance', 'perfil',
    'mod', 'sban', 'warn', 'mute', 'fijar', 'photogp', 'antilink', 'antipalabra', 'qr',
    'code', 'bots', 'dado', 'adivinanza', 'pescar', 'miner', 'ppt', 'ahorcado', 'prestamo',
    'pagar', 'robar', 'setage', 'marry', 'nota', 'delnota', 'reveal', 'topactivos',
    'topinactivos', 'topgays', 'meme', 'sgay',
  ]) assert.ok(registry.get(command), `Falta ${command}`)
  for (const removed of ['waifu', 'neko', 'maid']) assert.equal(registry.get(removed), null)
  assert.equal(Object.keys(CATEGORIES).length, 18)
  for (const [category, entries] of MENU_LAYOUT) {
    assert.ok(CATEGORIES[category])
    for (const raw of entries) {
      const entry = typeof raw === 'string' ? { command: raw } : raw
      assert.ok(registry.get(entry.command), `${category}: ${entry.command} no está registrado`)
    }
  }
  for (const plugin of registry.list) {
    assert.ok(plugin.description.length > 0)
    assert.equal(typeof plugin.execute, 'function')
  }
})

test('el encabezado del menú es el de MultiBots (Satoru Gojo), no el de Velirius', () => {
  const header = buildMenuHeader(ownerContext)
  assert.equal(header, [
    '*Satoru gojo*',
    '¡Buenos días! ☀️ Lyann',
    'Selecciona el menu que necesites',
    '```Ⓒ Satoru gojo```',
  ].join('\n\n'))
  assert.match(header, /\*Satoru gojo\*/)
  assert.match(header, /¡Buenos días! ☀️ Lyann/)
  assert.match(header, /Selecciona el menu que necesites/)
  assert.match(header, /```Ⓒ Satoru gojo```/)
  // Ya no queda nada del diseño anterior
  for (const gone of ['BIENVENIDO/A', 'INFO USUARIO', 'TIEMPO ACTIVO', '𓂃', 'PROPIETARIOS']) {
    assert.ok(!header.includes(gone), `El encabezado todavía incluye ${gone}`)
  }
})

test('el encabezado saluda con el pushName del usuario y cae a "Usuario"', () => {
  assert.match(buildMenuHeader(context), /¡Buenos días! ☀️ Usuario/)
  const anonymous = { ...context, m: { ...context.m, name: '' } }
  assert.match(buildMenuHeader(anonymous), /¡Buenos días! ☀️ Usuario/)
})

test('el menú completo conserva el listado por categorías y nuestro copyright', () => {
  const full = buildFullMenu(ownerContext)
  assert.match(full, /──── MENÚ COMPLETO ────/)
  assert.match(full, /`✼ •• ┈┈ ⋯ General ⋯ ┈┈ •• ✼`/)
  assert.match(full, /`=>` `>` `\$` antis `Admins`/)
  assert.match(full, /`=>` `>` `\$` Pokemon `Juegos rpg`/)
  assert.match(full, /`✼ •• ┈┈ ⋯ stickers ⋯ ┈┈ •• ✼`/)
  assert.match(full, /> `\.brat\/bratv <texto>`/)
  assert.match(full, /> `\.pack <nombre.autor>`/)
  assert.match(full, /Ⓒ Satoru gojo/)
  assert.ok(full.includes('> `.delwarn`\n'))
  assert.ok(full.includes('> `.perfil`\n'))
  for (const removed of ['.waifu', '.neko', '.maid']) assert.ok(!full.includes(removed))
  const categories = pluginsByCategory(ownerContext)
  assert.equal(categories.length, 18)
  assert.equal(categories.reduce((total, category) => total + category.entries.length, 0), 192)
  assert.match(buildCommandsText(ownerContext), /Ⓒ Satoru gojo/)
})

test('los tres botones del menú están configurados y traducen a comandos reales', () => {
  const { buttons } = DEFAULT_CONFIG.menu
  assert.deepEqual(buttons.map(button => button.label), ['Menu', 'Fast command', 'Support'])
  assert.deepEqual(buttons.map(button => button.id), ['menu_full', 'menu_fast', 'menu_support'])
  for (const button of buttons) {
    assert.ok(registry.get(button.command), `El botón ${button.label} apunta a un comando inexistente: ${button.command}`)
    const parsed = selectionToCommand(button.id, DEFAULT_CONFIG)
    assert.equal(parsed.command, button.command)
    assert.equal(parsed.usedPrefix, DEFAULT_CONFIG.prefix)
  }
  // Las filas de categoría de una lista interactiva siguen funcionando
  assert.equal(categoryFromSelection(`${MENU_ROW_PREFIX}rpg`), 'rpg')
  assert.deepEqual(selectionToCommand(`${MENU_ROW_PREFIX}rpg`, DEFAULT_CONFIG).args, ['rpg'])
  assert.equal(selectionToCommand('cualquier_otra_cosa', DEFAULT_CONFIG), null)
  assert.equal(selectionToCommand('', DEFAULT_CONFIG), null)
})

test('"Fast command" lista los comandos frecuentes con descripción y copyright', () => {
  const text = buildFastCommandText(ownerContext)
  assert.match(text, /⚡ \*Fast Commands\* ⚡/)
  assert.match(text, /1\. \*\.ping\* — /)
  assert.match(text, /Ⓒ Satoru gojo$/)
  const entries = fastEntries(ownerContext)
  assert.ok(entries.length >= 15, `demasiados pocos comandos rápidos: ${entries.length}`)
  assert.ok(entries.every(entry => registry.get(entry.command)))
  assert.equal(new Set(entries.map(entry => entry.plugin)).size, entries.length, 'comandos rápidos duplicados')
  for (const command of ['ping', 'menu', 'owner', 'daily', 'balance']) {
    assert.ok(FAST_COMMANDS.includes(command))
    assert.match(text, new RegExp(`\\*\\.${command}`))
  }
  // Sin permisos no se filtran comandos de owner/admin
  const plain = buildFastCommandText(context)
  assert.ok(!plain.includes('.mod '))
})

test('"Support" entrega el número del owner con enlace directo a WhatsApp', () => {
  const text = buildSupportText(ownerContext)
  assert.match(text, /📞 Soporte: wa\.me\/59896719709/)
  assert.match(text, /https:\/\/wa\.me\/59896719709/)
})

test('el menú filtra comandos owner y admin para usuarios sin permisos', () => {
  const full = buildCommandsText(context)
  assert.ok(!availablePlugins(context).some(plugin => plugin.owner))
  assert.ok(!full.includes('.setprefix'))
  assert.ok(!full.includes('.mod @usuario'))
  assert.ok(!full.includes('.ban @usuario'))
  assert.ok(full.includes('.play <canción o artista>'))
  assert.ok(full.includes('.hug [@usuario]'))
})

test('la categoría seleccionada conserva entradas y no añade descripciones', () => {
  const category = findCategory(ownerContext, 'adicionales')
  const selected = buildSelectedCategory(ownerContext, category)
  const commandLines = selected.split('\n').filter(line => line.startsWith('> `'))
  assert.equal(commandLines.length, category.entries.length)
  assert.ok(!selected.includes('\n\n'))
  assert.ok(!selected.includes('Guarda una nota personal'))
  assert.ok(selected.includes('> `.nota <contenido>`'))
  assert.ok(selected.includes('> `.resize <imagen/sticker> 800x600`'))
})

test('las secciones nativas y los aliases de categoría funcionan', () => {
  const sections = buildMenuSections(ownerContext, true)
  assert.ok(sections.length >= 2)
  assert.ok(sections.every(section => section.rows.length > 0 && section.rows.length <= 10))
  for (const row of sections.flatMap(section => section.rows)) {
    assert.ok(row.id.startsWith(MENU_ROW_PREFIX))
    assert.ok(findCategory(ownerContext, categoryFromSelection(row.id)))
  }
  for (const alias of ['downloads', 'descargas', 'search', 'buscador', 'tootles', 'efectos']) {
    assert.ok(findCategory(ownerContext, alias), `Alias de categoría ausente: ${alias}`)
  }
  assert.equal(findCategory(ownerContext, 'reactions').id, 'reactions')
  assert.equal(findCategory(ownerContext, 'reacciones').id, 'reactions')
  assert.equal(findCategory(ownerContext, 'pokemon').id, 'pokemon')
  assert.equal(findCategory(ownerContext, 'economy').id, 'rpg')
  assert.equal(findCategory(ownerContext, 'characters').id, 'rpg')
  assert.equal(findCategory(ownerContext, 'profile').id, 'perfil')
  assert.equal(findCategory(ownerContext, 'rpg').id, 'rpg')
})
