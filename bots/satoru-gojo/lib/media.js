// Helpers para descargar medios y crear stickers (usa API Velirius para stickers sin sharp/ffmpeg)
const { downloadContentFromMessage, generateWAMessageFromContent, proto } = require('@whiskeysockets/baileys');
const axios = require('axios');
const velirius = require('./velirius');

async function downloadMsg(msg) {
  const m = msg.message;
  let type = null, content = null;

  if (m?.imageMessage) { type = 'image'; content = m.imageMessage; }
  else if (m?.videoMessage) { type = 'video'; content = m.videoMessage; }
  else if (m?.stickerMessage) { type = 'sticker'; content = m.stickerMessage; }
  else if (m?.audioMessage) { type = 'audio'; content = m.audioMessage; }

  const ctx = m?.extendedTextMessage?.contextInfo?.quotedMessage;
  if (ctx) {
    if (ctx.imageMessage) { type = 'image'; content = ctx.imageMessage; }
    else if (ctx.videoMessage) { type = 'video'; content = ctx.videoMessage; }
    else if (ctx.stickerMessage) { type = 'sticker'; content = ctx.stickerMessage; }
    else if (ctx.audioMessage) { type = 'audio'; content = ctx.audioMessage; }
  }

  if (!type || !content) return null;
  const stream = await downloadContentFromMessage(content, type);
  const chunks = [];
  for await (const c of stream) chunks.push(c);
  return Buffer.concat(chunks);
}

/**
 * Crea un sticker a partir de texto (usa el endpoint /canvas/brat o /canvas/quotly de Velirius).
 * Si no hay API disponible, envía la imagen con la bandera sticker via sendMessage.
 */
async function sendTextSticker(sock, jid, text, type = 'brat', author = 'Satoru Gojo') {
  try {
    const buf = await velirius.getImage('/canvas/' + type, { text, username: author });
    if (buf) {
      // Enviar como sticker (Baileys acepta image + stickerMetadata)
      await sock.sendMessage(jid, {
        sticker: buf,
        mimetype: 'image/webp'
      });
      return true;
    }
  } catch (e) {}
  return false;
}

async function sendImageAsSticker(sock, jid, buffer) {
  try {
    await sock.sendMessage(jid, { sticker: buffer });
    return true;
  } catch (e) { return false; }
}

/**
 * Enviar una imagen desde URL
 */
async function sendImageFromUrl(sock, jid, url, caption = '') {
  try {
    const r = await axios.get(url, { responseType: 'arraybuffer', timeout: 30000 });
    await sock.sendMessage(jid, { image: Buffer.from(r.data), caption });
    return true;
  } catch { return false; }
}

module.exports = { downloadMsg, sendTextSticker, sendImageAsSticker, sendImageFromUrl };
