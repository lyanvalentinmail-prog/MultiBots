const path = require('path');
const fs = require('fs');
const config = require('./config');
const { categories, fastCommands, findCommand } = require('./commands');

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
