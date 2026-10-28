const path = require('path');
const fs = require('fs');
const config = require('./config');
const { categories, fastCommands, findCommand } = require('./commands');
const { isAdmin, isGroup, getSender } = require('./lib/helpers');
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

async function sendMainMenu(sock, jid, userName) {
  const bannerPath = path.join(__dirname, config.messages.welcomeFile);
  const bannerBuf = fs.readFileSync(bannerPath);

  const greeting = `${config.messages.greeting} ${userName}`;
  const captionText =
    `*Satoru gojo*\n\n` +
    `${greeting}\n\n` +
    `${config.messages.selectMenu}\n\n` +
    `\`\`\`${config.messages.copyright}\`\`\``;

  const buttons = [
    { buttonId: 'menu_full', buttonText: { displayText: 'Menu' }, type: 1 },
    { buttonId: 'menu_fast', buttonText: { displayText: 'Fast command' }, type: 1 },
    { buttonId: 'menu_support', buttonText: { displayText: 'Support' }, type: 1 }
  ];

  try {
    await sock.sendMessage(jid, {
      image: bannerBuf,
      caption: captionText,
      buttons: buttons,
      footer: config.messages.copyright,
      headerType: 4
    });
  } catch (e) {
    await sock.sendMessage(jid, { image: bannerBuf, caption: captionText });
    await sock.sendMessage(jid, {
      text: 'Selecciona una opción:',
      buttons: buttons,
      footer: config.messages.copyright
    });
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
  if (msg.message?.conversation) return msg.message.conversation;
  if (msg.message?.extendedTextMessage) return msg.message.extendedTextMessage.text || '';
  if (msg.message?.buttonsResponseMessage) {
    return {
      buttonId: msg.message.buttonsResponseMessage.selectedButtonId,
      text: msg.message.buttonsResponseMessage.selectedDisplayText || ''
    };
  }
  if (msg.message?.interactiveResponseMessage) {
    const resp = msg.message.interactiveResponseMessage;
    let buttonId = null;
    try {
      const parsed = JSON.parse(resp.nativeFlowResponseMessage?.paramsJson || '{}');
      buttonId = parsed.id;
    } catch {
      buttonId = resp.selectedButtonId || null;
    }
    return { buttonId, text: '' };
  }
  return '';
}

async function handleMessage(sock, msg) {
  try {
    if (!msg.message) return;
    if (msg.key.fromMe) return;

    // Respetar "bot off" del owner (excepto "bot on")
    const { db } = require('./lib/database');
    const sender = msg.key.participant || msg.key.remoteJid;
    const { isOwner } = require('./lib/helpers');
    const testText = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '').trim().toLowerCase();
    if (!db.global.botOn && testText !== '.bot on' && !isOwner(sender)) return;
    if (!db.global.botOn && testText === '.bot on' && !isOwner(sender)) return;

    // === Antis (solo en grupos) ===
    if (isGroup(jid) && !isOwner(sender)) {
      const g = getGroup(jid);
      const senderIsAdmin = await isAdmin(sock, jid, sender);
      if (!senderIsAdmin && g) {
        const m = msg.message;
        const hasLink = /https?:\/\/|chat\.whatsapp\.com|wa\.me/i.test(testText);
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
        else if (g.antipalabras && g.antipalabrasList && g.antipalabrasList.some(w => testText.includes(w))) reason = 'palabra prohibida';
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

    const jid = getJid(msg);
    const extracted = extractText(msg);
    let text = '';
    let buttonId = null;

    if (typeof extracted === 'string') {
      text = extracted;
    } else {
      text = extracted.text || '';
      buttonId = extracted.buttonId;
    }

    if (buttonId) {
      await handleButtonReply(sock, jid, buttonId);
      return;
    }

    const userName = getUserName(msg);
    const trimmed = (text || '').trim();
    const lower = trimmed.toLowerCase();

    // Comando "menu" funciona con o sin prefijo
    if (['menu', '.menu', '!menu', '#menu'].includes(lower)) {
      await sendMainMenu(sock, jid, userName);
      return;
    }

    // Buscar y ejecutar comando (soporta texto con o sin prefijo)
    const found = findCommand(trimmed, config.prefix);
    if (found && found.command.handler) {
      await found.command.handler(sock, jid, found.args, msg, found.match);
      return;
    }
  } catch (err) {
    console.error('Error manejando mensaje:', err);
  }
}

module.exports = { handleMessage, sendMainMenu, buildFullMenuText, buildFastCommandText };
