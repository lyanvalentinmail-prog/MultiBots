import { readFile } from 'node:fs/promises'
import { isHttpUrl } from './utils/format.js'
import { resolveBot } from './utils/paths.js'
import {
  buildCommandsText,
  buildFullMenu,
  buildMenuHeader,
  buildMenuSections,
  menuCopyright,
} from './menu.js'

let liaPromise

async function loadLia() {
  liaPromise ||= Promise.all([
    import('@itsliaaa/baileys'),
    import('@itsliaaa/baileys/lib/WABinary/generic-utils.js'),
  ])
  return liaPromise
}

export async function sendViaLia(sock, jid, content, options = {}) {
  const [lia, { getBizBinaryNode }] = await loadLia()
  const message = await lia.generateWAMessage(jid, content, {
    userJid: sock.user?.jid || sock.user?.id,
    upload: sock.waUploadToServer,
    quoted: options.quoted,
    logger: options.logger,
  })
  const normalized = lia.normalizeMessageContent(message.message) || message.message
  const relayOptions = { messageId: message.key.id }

  if (lia.shouldIncludeBizBinaryNode(normalized)) {
    relayOptions.additionalNodes = [getBizBinaryNode(normalized)]
  }

  await sock.relayMessage(jid, message.message, relayOptions)
  return message
}

/**
 * Banner del menú. Las rutas relativas se resuelven contra la raíz del bot, no
 * contra process.cwd(): MultiBots puede lanzarlo desde la raíz del repositorio.
 */
export async function bannerMedia(banner) {
  if (isHttpUrl(banner)) return { image: { url: banner } }
  const file = resolveBot(banner)
  return { image: await readFile(file), mimetype: 'image/jpeg' }
}

function menuButtons(config) {
  return (config.menu?.buttons || []).map(button => ({ text: button.label, id: button.id }))
}

/**
 * Nuestro menú: banner + caption (título, saludo, "Selecciona el menu que
 * necesites", copyright) y los tres botones Menu / Fast command / Support.
 */
async function sendOurMenu(ctx, withBanner = true) {
  const { sock, m, config } = ctx
  const caption = buildMenuHeader(ctx)
  const media = withBanner ? await bannerMedia(config.banner) : {}
  return sendViaLia(sock, m.chat, {
    ...media,
    ...(withBanner ? { caption } : { text: caption }),
    footer: config.footer,
    nativeFlow: menuButtons(config),
    contextInfo: { mentionedJid: [m.sender] },
  }, { quoted: m.raw })
}

/** Menú de texto equivalente: siempre funciona aunque WhatsApp no muestre botones. */
export function buildButtonTextMenu(ctx) {
  const prefix = ctx.usedPrefix || ctx.config.prefix
  const lines = (ctx.config.menu?.buttons || [])
    .map(button => `> ${prefix}${button.command} — *${button.label}*`)
  return `${ctx.config.menu?.selectMenu || ''}\n\n${lines.join('\n')}\n\n${menuCopyright(ctx)}`
}

async function sendTextMenu(ctx) {
  const { sock, m, config } = ctx
  const caption = buildMenuHeader(ctx)
  try {
    const media = await bannerMedia(config.banner)
    await sock.sendMessage(m.chat, {
      ...media,
      caption,
      contextInfo: { mentionedJid: [m.sender] },
    }, { quoted: m.raw })
  } catch (error) {
    console.warn(`⚠ No se pudo enviar el banner: ${error.message}`)
    return sock.sendMessage(m.chat, {
      text: `${caption}\n\n${buildButtonTextMenu(ctx)}`,
      contextInfo: { mentionedJid: [m.sender] },
    }, { quoted: m.raw })
  }
  return sock.sendMessage(m.chat, { text: buildButtonTextMenu(ctx) }, { quoted: m.raw })
}

/* --- Lista de categorías (menuMode: 'list'), se conserva del motor original --- */

async function sendCategoryList(ctx, native) {
  const sections = buildMenuSections(ctx, native)
  if (native) {
    return sendViaLia(ctx.sock, ctx.m.chat, {
      text: buildMenuHeader(ctx),
      footer: ctx.config.footer,
      nativeFlow: [{ text: '☾ VER COMANDOS', sections, icon: 'default' }],
      contextInfo: { mentionedJid: [ctx.m.sender] },
    }, { quoted: ctx.m.raw })
  }
  return sendViaLia(ctx.sock, ctx.m.chat, {
    title: ctx.config.botName,
    text: buildMenuHeader(ctx),
    footer: ctx.config.footer,
    buttonText: '☾ VER COMANDOS',
    sections,
    contextInfo: { mentionedJid: [ctx.m.sender] },
  }, { quoted: ctx.m.raw })
}

export async function deliverMenu(ctx) {
  const mode = ctx.config.menuMode

  if (mode === 'list') {
    try {
      return await sendCategoryList(ctx, true)
    } catch (error) {
      console.warn(`⚠ Lista nativa falló: ${error.message}`)
      try {
        return await sendCategoryList(ctx, false)
      } catch (secondError) {
        console.warn(`⚠ Lista clásica falló: ${secondError.message}`)
      }
    }
    return ctx.reply(buildCommandsText(ctx))
  }

  if (mode !== 'text') {
    try {
      return await sendOurMenu(ctx, true)
    } catch (error) {
      console.warn(`⚠ Menú con banner falló: ${error.message}`)
      try {
        return await sendOurMenu(ctx, false)
      } catch (secondError) {
        console.warn(`⚠ Menú interactivo falló: ${secondError.message}`)
      }
    }
  }

  return sendTextMenu(ctx)
}

/** Menú completo en texto (`.menufull`). */
export function fullMenuText(ctx) {
  return buildFullMenu(ctx)
}
