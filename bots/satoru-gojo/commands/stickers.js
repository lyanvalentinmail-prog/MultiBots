// Comandos de stickers
const { downloadMsg, sendImageAsSticker, sendTextSticker } = require('../lib/media');
const velirius = require('../lib/velirius');

async function replyErr(sock, jid, text) {
  await sock.sendMessage(jid, { text: '❌ ' + text });
}

module.exports = {
  title: '✺ •• ┈┈ ⋯ Stickers ⋯ ┈┈ •• ✺',
  commands: [
    {
      pattern: 'sticker',
      desc: 'Convertir imagen/video respondido a sticker',
      fast: true,
      handler: async (sock, jid, args, msg) => {
        const buf = await downloadMsg(msg);
        if (!buf) return replyErr(sock, jid, 'Responde a una imagen o video para convertirlo a sticker.');
        try { await sendImageAsSticker(sock, jid, buf); }
        catch { await replyErr(sock, jid, 'No se pudo crear el sticker.'); }
      }
    },
    {
      pattern: 's',
      desc: 'Atajo de .sticker',
      handler: async (sock, jid, args, msg) => {
        // Mismo comportamiento que .sticker
        const buf = await downloadMsg(msg);
        if (!buf) return replyErr(sock, jid, 'Responde a una imagen o video para convertirlo a sticker.');
        try { await sendImageAsSticker(sock, jid, buf); }
        catch { await replyErr(sock, jid, 'No se pudo crear el sticker.'); }
      }
    },
    {
      pattern: 'brat',
      desc: 'Sticker estilo brat (texto)',
      handler: async (sock, jid, args) => {
        if (!args) return replyErr(sock, jid, 'Uso: .brat <texto>');
        const ok = await sendTextSticker(sock, jid, args, 'brat');
        if (!ok) await replyErr(sock, jid, 'No se pudo generar el sticker brat.');
      }
    },
    {
      pattern: 'bratv',
      desc: 'Video brat',
      handler: async (sock, jid, args) => {
        if (!args) return replyErr(sock, jid, 'Uso: .bratv <texto>');
        try {
          const data = await velirius.request('/canvas/bratvideo', { text: args });
          const url = data?.url || data?.result;
          if (url) {
            const axios = require('axios');
            const r = await axios.get(url, { responseType: 'arraybuffer', timeout: 60000 });
            await sock.sendMessage(jid, { video: Buffer.from(r.data), gifPlayback: true, mimetype: 'video/mp4' });
          } else await replyErr(sock, jid, 'No se pudo generar el video.');
        } catch (e) { await replyErr(sock, jid, 'Error: ' + e.message); }
      }
    },
    { pattern: 'bratestirado', desc: 'Brat estirado', handler: async (sock,jid,a)=>{ if(!a)return replyErr(s,jid,'Uso: .bratestirado <texto>'); sendTextSticker(s,jid,a,'brat'); } },
    { pattern: 'attp', desc: 'Sticker animado de texto', handler: async (s,jid,a)=>{ if(!a)return replyErr(s,jid,'Uso: .attp <texto>'); sendTextSticker(s,jid,a,'quotly'); } },
    { pattern: 'ttp', desc: 'Sticker de texto', handler: async (s,jid,a)=>{ if(!a)return replyErr(s,jid,'Uso: .ttp <texto>'); sendTextSticker(s,jid,a,'quotly'); } },
    { pattern: 'bobesponja', desc: 'Sticker Bob Esponja', handler: async (s,jid,a)=> sendTextSticker(s,jid,a||'Bob','brat') },
    { pattern: 'bratcoyote', desc: 'Brat coyote', handler: async (s,jid,a)=> sendTextSticker(s,jid,a||'Coyote','brat') },
    { pattern: 'bratanime', desc: 'Brat anime', handler: async (s,jid,a)=> sendTextSticker(s,jid,a||'Anime','brat') },
    { pattern: 'bratpinguino', desc: 'Brat pingüino', handler: async (s,jid,a)=> sendTextSticker(s,jid,a||'Pingüino','brat') },
    { pattern: 'bratboy', desc: 'Brat boy', handler: async (s,jid,a)=> sendTextSticker(s,jid,a||'Boy','brat') },
    { pattern: 'pack', desc: 'Crear pack de stickers', handler: async (sock,jid)=> sock.sendMessage(jid,{text:'📦 Usa .sticker individualmente. El sistema de packs estará disponible próximamente.'}) },
    {
      pattern: 'toimg',
      desc: 'Convertir sticker a imagen',
      handler: async (sock, jid, args, msg) => {
        const buf = await downloadMsg(msg);
        if (!buf) return replyErr(sock, jid, 'Responde a un sticker.');
        await sock.sendMessage(jid, { image: buf });
      }
    },
    {
      pattern: 'tovid',
      desc: 'Convertir sticker animado a video',
      handler: async (sock, jid, args, msg) => {
        const buf = await downloadMsg(msg);
        if (!buf) return replyErr(sock, jid, 'Responde a un sticker animado.');
        await sock.sendMessage(jid, { video: buf, caption: '🎬 Video extraído.' });
      }
    }
  ]
};
