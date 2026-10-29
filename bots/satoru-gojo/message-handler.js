const path = require('path');
const fs = require('fs');
const config = require('./config');
const { categories, fastCommands, findCommand } = require('./commands');
const { isAdmin, isGroup, getSender, isOwner, unwrapMessage, getMessageText } = require('./lib/helpers');
const { getGroup } = require('./lib/database');

const SUPPORT_NUMBER = config.ownerNumber;

function getUserName(msg) {
  return msg.pushName || (msg.key.fromMe ? 'Dueño' : 'Usuario');
}

function getJid(msg) {
  return msg.key.remoteJid;
}

function buildFastCommandText() {
  let text = '⚡ *Fast Commands* ⚡\n\n';
  fastCommands.forEach((c, i) => {
    const base = (typeof c.pattern === 'string') ? c.pattern.split(/\s|</)[0] : String(c.pattern);
    text += `${i + 1}. *${config.prefix}${base}* — ${c.desc}\n`;
  });
  text += `\n${config.messages.copyright}`;
  return text;
}

function buildFullMenuText() {
  let text = '📜 *Menú completo de comandos* 📜\n\n';
  categories.forEach(cat => {
    text += `${cat.title}\n\n`;
    cat.commands.forEach(cmd => {
      const p = typeof cmd.pattern === 'string' ? cmd.pattern : String(cmd.pattern);
      text += `> ${config.prefix}${p}\n`;
    });
    text += '\n';
  });
  text += `\n${config.messages.copyright}`;
  return text;
}

/** Lee el banner sin romper si el archivo no está. */
function readBanner() {
  try {
    const bannerPath = path.join(__dirname, config.messages.welcomeFile);
    if (fs.existsSync(bannerPath)) return fs.readFileSync(bannerPath);
  } catch (e) {
    console.error('banner:', e.message);
  }
  return null;
}

const MENU_BUTTONS = [
  { buttonId: 'menu_full', displayText: 'Menu', command: 'menufull' },
  { buttonId: 'menu_fast', displayText: 'Fast command', command: 'fastcommand' },
  { buttonId: 'menu_support', displayText: 'Support', command: 'support' }
];

/**
 * Botones reales vía `interactiveMessage` (native flow).
 *
 * Baileys 6.7.x NO soporta la clave `buttons` en `sendMessage()`: la ignora en
 * silencio (generateWAMessageContent sólo maneja text/image/video/...). Por eso
 * el menú aparecía sin botones y `handleButtonReply` nunca se ejecutaba.
 */
async function sendInteractiveButtons(sock, jid, bodyText, footerText) {
  const { proto, generateWAMessageFromContent } = require('@whiskeysockets/baileys');
  const IM = proto.Message.InteractiveMessage;
  if (!IM || typeof generateWAMessageFromContent !== 'function' || typeof sock.relayMessage !== 'function') {
    throw new Error('interactiveMessage no disponible en esta versión de Baileys');
  }

  const content = {
    interactiveMessage: IM.create({
      body: IM.Body.create({ text: bodyText }),
      footer: IM.Footer.create({ text: footerText || '' }),
      nativeFlowMessage: IM.NativeFlowMessage.create({
        buttons: MENU_BUTTONS.map(b => ({
          name: 'quick_reply',
          buttonParamsJson: JSON.stringify({ display_text: b.displayText, id: b.buttonId })
        }))
      })
    })
  };

  const wa = generateWAMessageFromContent(jid, content, {});
  await sock.relayMessage(jid, wa.message, { messageId: wa.key.id });
}

/** Menú en texto: siempre funciona, aunque WhatsApp no muestre botones. */
function buildTextMenuFallback() {
  const lines = MENU_BUTTONS.map(b => `> ${config.prefix}${b.command} — *${b.displayText}*`);
  return (
    `${config.messages.selectMenu}\n\n` +
    lines.join('\n') +
    `\n\n${config.messages.copyright}`
  );
}

async function sendMainMenu(sock, jid, userName) {
  const bannerBuf = readBanner();

  const greeting = `${config.messages.greeting} ${userName}`;
  const captionText =
    `*Satoru gojo*\n\n` +
    `${greeting}\n\n` +
    `${config.messages.selectMenu}\n\n` +
    `\`\`\`${config.messages.copyright}\`\`\``;

  // 1) Imagen + caption (esto sí lo soporta Baileys)
  if (bannerBuf) {
    await sock.sendMessage(jid, { image: bannerBuf, caption: captionText });
  } else {
    await sock.sendMessage(jid, { text: captionText });
  }

  // 2) Los tres botones; si WhatsApp/Baileys no los acepta, menú de texto
  try {
    await sendInteractiveButtons(sock, jid, config.messages.selectMenu, config.messages.copyright);
  } catch (e) {
    try {
      await sock.sendMessage(jid, { text: buildTextMenuFallback() });
    } catch (e2) {
      console.error('menu fallback:', e2?.message || e2);
    }
  }
}

async function handleButtonReply(sock, jid, selectedButtonId) {
  if (selectedButtonId === 'menu_full') {
    await sock.sendMessage(jid, { text: buildFullMenuText() });
  } else if (selectedButtonId === 'menu_fast') {
    await sock.sendMessage(jid, { text: buildFastCommandText() });
  } else if (selectedButtonId === 'menu_support') {
    await sock.sendMessage(jid, {
      text: `${config.messages.supportText}\n\nhttps://wa.me/${SUPPORT_NUMBER}`,
      footer: config.messages.copyright
    });
  }
}

function extractText(msg) {
  const m = unwrapMessage(msg);
  if (!m) return '';

  if (m.buttonsResponseMessage) {
    return {
      buttonId: m.buttonsResponseMessage.selectedButtonId,
      text: m.buttonsResponseMessage.selectedDisplayText || ''
    };
  }
  if (m.interactiveResponseMessage) {
    const resp = m.interactiveResponseMessage;
    let buttonId = null;
    try {
      const parsed = JSON.parse(resp.nativeFlowResponseMessage?.paramsJson || '{}');
      buttonId = parsed.id;
    } catch {
      buttonId = resp.selectedButtonId || null;
    }
    return { buttonId, text: '' };
  }
  if (m.listResponseMessage) {
    return {
      buttonId: m.listResponseMessage.singleSelectReply?.selectedRowId || null,
      text: m.listResponseMessage.title || m.listResponseMessage.description || ''
    };
  }

  // conversation / extendedText / caption de imagen, video o documento.
  // Sin las captions, `.sticker` escrito sobre una foto no se detectaba.
  return getMessageText(msg);
}

async function handleMessage(sock, msg) {
  try {
    if (!msg.message) return;
    if (msg.key.fromMe) return;

    /* --- Datos básicos del mensaje ---
     * IMPORTANTE: `jid` y el texto se resuelven ANTES que nada. Antes estaban
     * declarados más abajo y el bloque de "Antis" los leía primero, así que
     * CADA mensaje reventaba con
     *   ReferenceError: Cannot access 'jid' before initialization
     * y el try/catch se lo tragaba: el bot no respondía a ningún comando. */
    const jid = getJid(msg);
    const sender = getSender(msg);

    const extracted = extractText(msg);
    let text = '';
    let buttonId = null;
    if (typeof extracted === 'string') {
      text = extracted;
    } else {
      text = extracted.text || '';
      buttonId = extracted.buttonId;
    }

    const trimmed = (text || '').trim();
    const lower = trimmed.toLowerCase();

    // Botones del menú principal
    if (buttonId) {
      await handleButtonReply(sock, jid, buttonId);
      return;
    }

    // Respetar "bot off": con el bot apagado sólo se procesa al owner
    // (que es quien puede volver a encenderlo con `.bot on`).
    const { db } = require('./lib/database');
    if (!db.global.botOn && !isOwner(sender)) return;

    // === Antis (solo en grupos) ===
    if (isGroup(jid) && !isOwner(sender)) {
      const g = getGroup(jid);
      const senderIsAdmin = await isAdmin(sock, jid, sender);
      if (!senderIsAdmin && g) {
        const m = unwrapMessage(msg);
        const hasLink = /https?:\/\/|chat\.whatsapp\.com|wa\.me/i.test(lower);
        const hasImg = !!(m?.imageMessage || m?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage);
        const hasVideo = !!(m?.videoMessage || m?.extendedTextMessage?.contextInfo?.quotedMessage?.videoMessage);
        const hasAudio = !!(m?.audioMessage);
        const hasSticker = !!(m?.stickerMessage);
        const hasDoc = !!(m?.documentMessage);
        let reason = null;
        if (g.antilink && hasLink) reason = 'enlaces prohibidos';
        else if (g.antiimg && hasImg) reason = 'imágenes prohibidas';
        else if (g.antivideo && hasVideo) reason = 'videos prohibidos';
        else if (g.antiaudio && hasAudio) reason = 'audios prohibidos';
        else if (g.antisticker && hasSticker) reason = 'stickers prohibidos';
        else if (g.antidocs && hasDoc) reason = 'documentos prohibidos';
        else if (g.antipalabras && Array.isArray(g.antipalabrasList) && g.antipalabrasList.some(w => w && lower.includes(String(w).toLowerCase()))) reason = 'palabra prohibida';
        if (reason) {
          try { await sock.sendMessage(jid, { delete: msg.key }); } catch {}
          await sock.sendMessage(jid, { text: `⚠️ @${sender.split('@')[0]} ${reason} (eliminado).`, mentions: [sender] });
          // Añadir warn
          g.mutes = g.mutes || {};
          g.mutes['w_' + sender] = (g.mutes['w_' + sender] || 0) + 1;
          require('./lib/database').save();
          return;
        }
      }
    }

    const userName = getUserName(msg);

    // Comando "menu": funciona con o sin prefijo (está marcado `noPrefix`)
    if (['menu', '.menu', '!menu', '#menu', '/menu'].includes(lower)) {
      await sendMainMenu(sock, jid, userName);
      return;
    }

    // Buscar y ejecutar comando
    const found = findCommand(trimmed, config.prefix);
    if (found && typeof found.command.handler === 'function') {
      await found.command.handler(sock, jid, found.args, msg, found.match);
      return;
    }
  } catch (err) {
    // Sin este log visible, un fallo aquí se ve como "el bot no responde".
    console.error('Error manejando mensaje:', err?.stack || err?.message || err);
    try {
      await sock.sendMessage(msg.key.remoteJid, {
        text: `⚠️ No pude ejecutar ese comando.\n\`${(err?.message || err || 'error').toString().slice(0, 120)}\``
      });
    } catch {}
  }
}

module.exports = { handleMessage, sendMainMenu, buildFullMenuText, buildFastCommandText };
