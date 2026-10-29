import { readFile } from 'node:fs/promises'
import { menuHtmlFileName, renderMenuHtml } from './html.js'
import { isHttpUrl } from './utils/format.js'
import { resolveBot } from './utils/paths.js'
import {
  BUTTON_STYLES,
  buildCommandsText,
  buildFullMenu,
  buildMenuHeader,
  buildMenuSections,
  menuCopyright,
} from './menu.js'

export { BUTTON_STYLES, BUTTON_STYLE_HINTS } from './menu.js'

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

/* ------------------------------------------------------------------ *
 * Tipos de botones del menú
 * ------------------------------------------------------------------ *
 * WhatsApp no dibuja igual cada tipo: por eso el estilo es configurable
 * (config.json -> menu.buttonStyle) y se puede probar con .menustyle.
 */

function menuButtons(config) {
  return (config.menu?.buttons || []).map(button => ({ text: button.label, id: button.id }))
}

/**
 * Arma el contenido según el estilo pedido. `media` trae el banner ya leído;
 * si no hay banner (falló la lectura) los estilos que lo exigen caen a native.
 */
export function buildMenuContent(ctx, style, caption, media) {
  const { config, m } = ctx
  const buttons = menuButtons(config)
  const base = {
    ...media,
    ...(media.image ? { caption } : { text: caption }),
    footer: config.footer,
    contextInfo: { mentionedJid: [m.sender] },
  }

  switch (style) {
    case 'template':
      // hydratedFourRowTemplate: título, contenido, pie y botones separados
      return { ...base, title: config.menu?.title, templateButtons: buttons }

    case 'buttons':
      // buttonsMessage clásico con cabecera de imagen
      return { ...base, buttons }

    case 'sheet':
      // native flow envuelto en una hoja inferior con divisores entre opciones
      return {
        ...base,
        optionText: config.menu?.optionsText || '☾ Selecciona una opción',
        optionTitle: config.menu?.selectMenu || config.menu?.title,
        nativeFlow: buttons,
      }

    case 'carousel': {
      if (!media.image) return { ...base, nativeFlow: buttons }
      return {
        text: caption,
        footer: config.footer,
        contextInfo: base.contextInfo,
        cards: buttons.map((button, index) => ({
          image: media.image,
          mimetype: media.mimetype,
          caption: index === 0 ? caption : (config.menu?.selectMenu || ''),
          footer: config.footer,
          nativeFlow: [button],
        })),
      }
    }

    default:
      return { ...base, nativeFlow: buttons }
  }
}

/**
 * Nuestro menú: banner + caption (título, saludo, "Selecciona el menu que
 * necesites", copyright) y los tres botones Menu / Fast command / Support.
 */
async function sendOurMenu(ctx, withBanner = true) {
  const { sock, m, config } = ctx
  const caption = buildMenuHeader(ctx)
  const media = withBanner ? await bannerMedia(config.banner) : {}
  const style = BUTTON_STYLES.includes(config.menu?.buttonStyle) ? config.menu.buttonStyle : 'native'
  const content = buildMenuContent(ctx, style, caption, media)
  return sendViaLia(sock, m.chat, content, { quoted: m.raw })
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

/* --- Tarjeta HTML del menú ---------------------------------------- */

/**
 * Envía el menú como documento HTML (assets/menu.html relleno): la tarjeta con
 * el banner incrustado y los tres botones separados, para abrir en el navegador.
 */
export async function sendMenuHtml(ctx) {
  const html = await renderMenuHtml(ctx)
  return ctx.sock.sendMessage(ctx.m.chat, {
    document: Buffer.from(html, 'utf8'),
    mimetype: 'text/html',
    fileName: menuHtmlFileName(ctx),
    caption: `☾ ${ctx.config.menu?.title || ctx.config.botName} — menú en HTML`,
    contextInfo: { mentionedJid: [ctx.m.sender] },
  }, { quoted: ctx.m.raw })
}

async function maybeSendMenuHtml(ctx) {
  const menu = ctx.config.menu || {}
  // En modo lista el menú es el de categorías del motor original: no se mezcla.
  if (menu.htmlEnabled === false || ctx.config.menuMode === 'list') return null
  try {
    return await sendMenuHtml(ctx)
  } catch (error) {
    console.warn(`⚠ No se pudo enviar el menú HTML: ${error.message}`)
    return null
  }
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

async function deliverMenuMessage(ctx) {
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

export async function deliverMenu(ctx) {
  const delivered = await deliverMenuMessage(ctx)
  await maybeSendMenuHtml(ctx)
  return delivered
}

/** Menú completo en texto (`.menufull`). */
export function fullMenuText(ctx) {
  return buildFullMenu(ctx)
}
