const path = require('path');
const fs = require('fs');
const config = require('./config');
const menuData = require('./menu-data');

const SUPPORT_NUMBER = config.ownerNumber;

function getUserName(msg, userId) {
  const pushName = msg.pushName || '';
  const fromMe = msg.key.fromMe;
  if (pushName) return pushName;
  // fallback
  return fromMe ? 'Dueño' : 'Usuario';
}

function getJid(msg) {
  return msg.key.remoteJid;
}

function buildFastCommandText() {
  let text = '⚡ *Fast Commands* ⚡\n\n';
  menuData.fastCommands.forEach((c, i) => {
    text += `${i + 1}. *${c.cmd}* — ${c.desc}\n`;
  });
  text += `\n${config.messages.copyright}`;
  return text;
}

function buildFullMenuText() {
  let text = '📜 *Menú completo de comandos* 📜\n\n';
  menuData.categories.forEach(cat => {
    text += `${cat.title}\n\n`;
    cat.cmds.forEach(cmd => { text += `> ${cmd}\n`; });
    text += '\n';
  });
  text += `\n${config.messages.copyright}`;
  return text;
}

/**
 * Envia el menú principal con imagen y botones.
 * Diseño según pedido:
 * - Imagen banner con título "Satoru gojo" (caption de la imagen)
 * - Saludo "¡Buenos días! ☀️ {usuario}"
 * - Texto "Selecciona el menu que necesites"
 * - Copyright chiquito gris (usamos caracteres grises con bloque de formato de WhatsApp:  ```...``` o simplemente texto)
 * - Tres botones separados: Menu, Fast command, Support
 */
async function sendMainMenu(sock, jid, userName) {
  const bannerPath = path.join(__dirname, config.messages.welcomeFile);
  const bannerBuf = fs.readFileSync(bannerPath);

  const greeting = `${config.messages.greeting} ${userName}`;
  const copyright = config.messages.copyright; // lo ponemos en gris usando ```
  const captionText =
    `*Satoru gojo*\n\n` +
    `${greeting}\n\n` +
    `${config.messages.selectMenu}\n\n` +
    `\`\`\`${copyright}\`\`\``;

  // Botones (usamos interactive message con botones, compatible con Baileys)
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
      footer: copyright,
      headerType: 4 // IMAGE
    });
  } catch (e) {
    // Si el cliente no acepta botones con image, enviamos imagen primero y luego botones
    await sock.sendMessage(jid, { image: bannerBuf, caption: captionText });
    await sock.sendMessage(jid, {
      text: 'Selecciona una opción:',
      buttons: buttons,
      footer: copyright
    });
  }
}

async function handleButtonReply(sock, jid, selectedButtonId, msg) {
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

async function handleMessage(sock, msg) {
  try {
    // Ignorar mensajes sin contenido
    if (!msg.message) return;
    // Ignorar mensajes propios
    if (msg.key.fromMe) return;

    const jid = getJid(msg);

    // Obtener texto del mensaje (conversation o extendedTextMessage o buttonsResponse)
    let text = '';
    let buttonId = null;

    if (msg.message.conversation) {
      text = msg.message.conversation;
    } else if (msg.message.extendedTextMessage) {
      text = msg.message.extendedTextMessage.text || '';
    } else if (msg.message.buttonsResponseMessage) {
      buttonId = msg.message.buttonsResponseMessage.selectedButtonId;
      text = msg.message.buttonsResponseMessage.selectedDisplayText || '';
    } else if (msg.message.interactiveResponseMessage) {
      // Respuesta interactiva (listas/botones nuevos)
      const resp = msg.message.interactiveResponseMessage;
      try {
        const parsed = JSON.parse(resp.nativeFlowResponseMessage?.paramsJson || '{}');
        buttonId = parsed.id || resp.selectedButtonId || null;
      } catch {
        buttonId = resp.selectedButtonId || null;
      }
    }

    const userId = jid;
    const userName = getUserName(msg, userId);

    // Respuesta a botones
    if (buttonId) {
      await handleButtonReply(sock, jid, buttonId, msg);
      return;
    }

    const trimmed = (text || '').trim().toLowerCase();

    // Comando "menu" (sin importar mayúsculas)
    if (trimmed === 'menu' || trimmed === '.menu' || trimmed === '!menu' || trimmed === '#menu') {
      await sendMainMenu(sock, jid, userName);
      return;
    }

    if (trimmed === 'ping' || trimmed === '.ping') {
      await sock.sendMessage(jid, { text: '🏓 Pong!' });
      return;
    }
  } catch (err) {
    console.error('Error manejando mensaje:', err);
  }
}

module.exports = { handleMessage, sendMainMenu, buildFullMenuText, buildFastCommandText };
