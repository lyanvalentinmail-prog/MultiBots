import { readFile } from 'node:fs/promises'
import { CATEGORIES } from './menu.js'
import { isHttpUrl } from './utils/format.js'
import { resolveBot } from './utils/paths.js'
import { botVersion, formatUptime, spanishDate, spanishTime } from './utils/card.js'
import { fetchWeather } from './utils/weather.js'

/** Plantilla por defecto de la tarjeta HTML del menú. */
export const DEFAULT_MENU_HTML = './assets/menu.html'

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

/** Nada de lo que escriba un usuario (pushName, títulos) debe romper el markup. */
export function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, character => HTML_ESCAPES[character])
}

/** Rellena los marcadores `{clave}` de la plantilla. */
export function fillTemplate(template, values) {
  return String(template).replace(/\{(\w+)\}/g, (match, key) => (key in values ? values[key] : match))
}

/**
 * El HTML se envía como documento, así que el banner va incrustado en base64:
 * la tarjeta se ve completa aunque el usuario no tenga el banner al lado.
 */
export async function bannerSource(banner) {
  if (isHttpUrl(banner)) return banner
  const buffer = await readFile(resolveBot(banner))
  return `data:image/jpeg;base64,${buffer.toString('base64')}`
}

/** Un botón por fila: los de comando muestran qué escribir y Support enlaza a wa.me. */
export function menuButtonsHtml(ctx) {
  const prefix = ctx.usedPrefix || ctx.config.prefix
  const ownerNumber = ctx.config.owners?.[0]?.number || ''
  const supportUrl = `https://wa.me/${ownerNumber}`

  return (ctx.config.menu?.buttons || []).map(button => {
    const label = escapeHtml(button.label)
    if (button.command === 'support' || button.url) {
      const url = escapeHtml(button.url || supportUrl)
      return `        <a class="btn support" href="${url}"><span>${label}</span><small>${url}</small></a>`
    }
    const command = escapeHtml(`${prefix}${button.command}`)
    return `        <div class="btn"><span>${label}</span><small>${command}</small></div>`
  }).join('\n')
}

function menuStats(ctx) {
  const registry = ctx.registry
  if (!registry) return ''
  const categories = Object.keys(CATEGORIES).length
  return `${registry.count} comandos · ${registry.commands.size} alias · ${categories} categorías`
}

/** Nombre del archivo que recibe el usuario. */
export function menuHtmlFileName(ctx) {
  const slug = String(ctx.config.botName || 'bot')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `${slug || 'bot'}-menu.html`
}

/**
 * Tarjeta HTML del menú: la misma que muestra el banner, el saludo,
 * "Selecciona el menu que necesites" y los tres botones separados.
 */
export async function renderMenuHtml(ctx) {
  const { config, m } = ctx
  const menu = config.menu || {}
  const templatePath = menu.htmlTemplate || DEFAULT_MENU_HTML
  const template = await readFile(resolveBot(templatePath), 'utf8')
  const weather = menu.weatherEnabled === false
    ? null
    : await fetchWeather({ lat: menu.weatherLat, lon: menu.weatherLon }).catch(() => null)

  return fillTemplate(template, {
    version: escapeHtml(botVersion(config)),
    estado: 'Activo',
    modo: escapeHtml(config.mode === 'self' ? 'Privado' : 'Público'),
    comandos: String(ctx.registry?.count ?? ctx.registry?.commands?.size ?? 0),
    actividad: escapeHtml(formatUptime()),
    clima: escapeHtml(weather || 'Sin datos'),
    hora: spanishTime(),
    fecha: spanishDate(),
    prefix: escapeHtml(ctx.usedPrefix || config.prefix),
    title: escapeHtml(menu.title || config.botName),
    botName: escapeHtml(config.botName),
    greeting: escapeHtml(menu.greeting || ''),
    usuario: escapeHtml(m?.name || 'Usuario'),
    selectMenu: escapeHtml(menu.selectMenu || ''),
    copyright: escapeHtml(menu.copyright || config.footer),
    stats: escapeHtml(menuStats(ctx)),
    banner: await bannerSource(config.banner).catch(() => ''),
    buttons: menuButtonsHtml(ctx),
    year: new Date().getFullYear(),
  })
}
