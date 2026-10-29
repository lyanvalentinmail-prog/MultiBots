import { EventEmitter } from 'node:events'
import { readFile, mkdir, writeFile, rename } from 'node:fs/promises'
import { watch } from 'node:fs'
import path from 'node:path'
import { BUTTON_STYLES } from './menu.js'
import { cleanNumber } from './utils/format.js'
import { resolveBot } from './utils/paths.js'

export const DEFAULT_CONFIG = {
  botName: 'Satoru Gojo',
  prefix: '.',
  owners: [{ number: '59896719709', name: 'Lyann' }],
  ownerLids: [],
  mods: [],
  language: 'es',
  banner: './assets/banner.jpg',
  menuMode: 'interactive',
  mode: 'public',
  sessionDir: './sessions',
  autoRead: true,
  cooldownMs: 1200,
  logLevel: 'silent',
  footer: 'Ⓒ Satoru gojo',
  // Menú propio de MultiBots (Satoru Gojo)
  menu: {
    title: 'Satoru gojo',
    greeting: '¡Buenos días! ☀️',
    selectMenu: 'Selecciona el menu que necesites',
    copyright: 'Ⓒ Satoru gojo',
    supportText: '📞 Soporte: wa.me/59896719709',
    buttons: [
      { id: 'menu_full', label: 'Menu', command: 'menufull' },
      { id: 'menu_fast', label: 'Fast command', command: 'fastcommand' },
      { id: 'menu_support', label: 'Support', command: 'support' },
    ],
    // Tarjeta HTML que se adjunta al menú (assets/menu.html)
    htmlEnabled: true,
    htmlTemplate: './assets/menu.html',
    // Tipo de botones: native | template | buttons | sheet | carousel
    buttonStyle: 'template',
    optionsText: '☾ Selecciona una opción',
  },
  api: {
    baseUrl: 'https://velirius-api-sd8u.vercel.app',
    timeoutMs: 120000,
    maxMediaMB: 64,
  },
}

const cloneDefaults = () => structuredClone(DEFAULT_CONFIG)
const validMenuModes = new Set(['interactive', 'list', 'text'])
const validModes = new Set(['public', 'self'])
const validLogLevels = new Set(['silent', 'fatal', 'error', 'warn', 'info', 'debug', 'trace'])

function boundedNumber(value, fallback, min, max, integer = true) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  const result = integer ? Math.round(number) : number
  return Math.min(max, Math.max(min, result))
}

export function normalizeConfig(input = {}) {
  const defaults = cloneDefaults()
  const config = {
    ...defaults,
    ...input,
    api: { ...defaults.api, ...(input.api || {}) },
  }

  config.botName = String(config.botName || '').trim()
  if (!config.botName || config.botName.length > 40) {
    throw new Error('botName debe tener entre 1 y 40 caracteres')
  }

  config.prefix = String(config.prefix || '')
  if (!config.prefix || /\s/.test(config.prefix) || [...config.prefix].length > 3) {
    throw new Error('prefix debe tener de 1 a 3 caracteres, sin espacios')
  }

  config.owners = (Array.isArray(config.owners) ? config.owners : []).map((owner, index) => {
    const raw = typeof owner === 'object' && owner ? owner : { number: owner, name: `Owner ${index + 1}` }
    const number = cleanNumber(raw.number)
    if (number.length < 8 || number.length > 15) {
      throw new Error(`Número de owner inválido: ${raw.number || '(vacío)'}`)
    }
    return { number, name: String(raw.name || `Owner ${index + 1}`).trim().slice(0, 40) }
  })

  config.ownerLids = [...new Set((Array.isArray(config.ownerLids) ? config.ownerLids : [])
    .map(cleanNumber)
    .filter(lid => lid.length >= 8 && lid.length <= 20))]
  config.mods = [...new Set((Array.isArray(config.mods) ? config.mods : [])
    .map(mod => cleanNumber(typeof mod === 'object' && mod ? mod.number : mod))
    .filter(number => number.length >= 8 && number.length <= 20))]
  config.language = String(config.language || 'es').toLowerCase()
  if (!['es', 'in', 'pt'].includes(config.language)) throw new Error('language debe ser es, in o pt')

  if (!config.owners.length && !config.ownerLids.length) {
    throw new Error('Debe existir al menos un owner o ownerLid')
  }

  config.banner = String(config.banner || '').trim()
  if (!config.banner) throw new Error('banner no puede estar vacío')
  if (!validMenuModes.has(config.menuMode)) throw new Error('menuMode debe ser interactive, list o text')
  if (!validModes.has(config.mode)) throw new Error('mode debe ser public o self')
  if (!validLogLevels.has(config.logLevel)) throw new Error('logLevel de Pino no es válido')

  config.sessionDir = String(config.sessionDir || '').trim()
  if (!config.sessionDir) throw new Error('sessionDir no puede estar vacío')
  config.autoRead = Boolean(config.autoRead)
  config.cooldownMs = boundedNumber(config.cooldownMs, 1200, 0, 10000)
  config.footer = String(config.footer || defaults.footer).slice(0, 200)

  // Menú: se fusiona con el predeterminado y se validan sus textos
  config.menu = { ...structuredClone(defaults.menu), ...(input.menu || {}) }
  for (const key of ['title', 'greeting', 'selectMenu', 'copyright']) {
    const value = String(config.menu[key] || '').trim()
    if (!value) throw new Error(`menu.${key} no puede estar vacío`)
    config.menu[key] = value.slice(0, 120)
  }
  config.menu.supportText = String(config.menu.supportText || defaults.menu.supportText).slice(0, 200)
  if (!Array.isArray(config.menu.buttons) || config.menu.buttons.length !== 3) {
    throw new Error('menu.buttons debe tener exactamente 3 botones')
  }
  config.menu.buttons = config.menu.buttons.map((button, index) => {
    const fallback = defaults.menu.buttons[index]
    const id = String(button?.id || fallback.id).trim()
    const label = String(button?.label || fallback.label).trim()
    const command = String(button?.command || fallback.command).trim()
    if (!id || !label || !command) throw new Error('menu.buttons necesita id, label y command')
    return { id, label: label.slice(0, 60), command }
  })

  // Tarjeta HTML y tipo de botones del menú
  config.menu.htmlEnabled = config.menu.htmlEnabled !== false
  config.menu.htmlTemplate = String(config.menu.htmlTemplate || defaults.menu.htmlTemplate).trim().slice(0, 200)
  if (!BUTTON_STYLES.includes(config.menu.buttonStyle)) {
    throw new Error(`menu.buttonStyle debe ser uno de: ${BUTTON_STYLES.join(', ')}`)
  }
  config.menu.optionsText = String(config.menu.optionsText || defaults.menu.optionsText).slice(0, 60)

  let apiUrl
  try {
    apiUrl = new URL(config.api.baseUrl)
  } catch {
    throw new Error('api.baseUrl debe ser una URL válida')
  }
  if (!['https:', 'http:'].includes(apiUrl.protocol)) throw new Error('api.baseUrl debe usar HTTP o HTTPS')
  config.api.baseUrl = apiUrl.toString().replace(/\/$/, '')
  config.api.timeoutMs = boundedNumber(config.api.timeoutMs, 120000, 5000, 300000)
  config.api.maxMediaMB = boundedNumber(config.api.maxMediaMB, 64, 1, 256)

  return config
}

export class ConfigStore extends EventEmitter {
  constructor(file = process.env.SATORU_CONFIG || process.env.VELIRIUS_CONFIG || './config.json') {
    super()
    this.file = resolveBot(file)
    this.data = null
    this.watcher = null
    this.watchTimer = null
    this.lastSerialized = ''
    this.writeQueue = Promise.resolve()
  }

  async init({ watch: enableWatch = true } = {}) {
    await this.reload()
    if (enableWatch) {
      this.watcher = watch(path.dirname(this.file), (_event, filename) => {
        if (filename && String(filename) !== path.basename(this.file)) return
        clearTimeout(this.watchTimer)
        this.watchTimer = setTimeout(() => this.#reloadExternal(), 250)
      })
    }
    return this
  }

  async reload() {
    const raw = await readFile(this.file, 'utf8')
    const serialized = `${JSON.stringify(JSON.parse(raw), null, 2)}\n`
    if (this.data && serialized === this.lastSerialized) return this.data
    const next = normalizeConfig(JSON.parse(raw))
    this.data = next
    this.lastSerialized = `${JSON.stringify(next, null, 2)}\n`
    return next
  }

  async update(mutator) {
    const operation = this.writeQueue.then(async () => {
      const draft = structuredClone(this.data)
      const changed = await mutator(draft)
      const next = normalizeConfig(changed || draft)
      const serialized = `${JSON.stringify(next, null, 2)}\n`
      await mkdir(path.dirname(this.file), { recursive: true })
      const temporary = `${this.file}.${process.pid}.tmp`
      await writeFile(temporary, serialized, { mode: 0o600 })
      await rename(temporary, this.file)
      this.data = next
      this.lastSerialized = serialized
      this.emit('change', next)
      return next
    })
    this.writeQueue = operation.catch(() => {})
    return operation
  }

  async #reloadExternal() {
    try {
      const previous = this.lastSerialized
      await this.reload()
      if (previous !== this.lastSerialized) {
        this.emit('change', this.data)
        console.log('☾ Configuración recargada desde config.json')
      }
    } catch (error) {
      console.error(`✖ No se pudo recargar config.json: ${error.message}`)
      console.error('  Se conserva la última configuración válida.')
    }
  }

  async close() {
    clearTimeout(this.watchTimer)
    await this.watcher?.close()
    this.watcher = null
    await this.writeQueue
  }
}
