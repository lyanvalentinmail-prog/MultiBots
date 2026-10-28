// Descargas (usa Velirius /downloader)
const velirius = require('../lib/velirius');
const axios = require('axios');

async function downloadEndpoint(sock,jid,endpoint,url,typeLabel) {
  await sock.sendMessage(jid,{text:`⬇️ Descargando ${typeLabel}...`});
  try {
    const data = await velirius.request(endpoint, { url });
    const mediaUrl = data?.url || data?.video || data?.audio || data?.result || (Array.isArray(data?.result)?data.result[0]:null);
    if (!mediaUrl || typeof mediaUrl !== 'string') {
      return sock.sendMessage(jid,{text:'❌ No se pudo descargar (error API).'});
    }
    const isVideo = /\.mp4|video|tiktok|facebook/.test(endpoint + mediaUrl) || typeLabel.includes('video') || typeLabel === 'MP4';
    const r = await axios.get(mediaUrl,{responseType:'arraybuffer',timeout:120000});
    if (isVideo) await sock.sendMessage(jid,{video: Buffer.from(r.data), caption:'✅ Descargado'});
    else await sock.sendMessage(jid,{audio: Buffer.from(r.data), mimetype:'audio/mpeg', caption:'✅ Descargado'});
  } catch (e) {
    await sock.sendMessage(jid,{text:'❌ Error descargando: ' + e.message});
  }
}

module.exports = {
  title: '✺ •• ┈┈ ⋯ Descargas ⋯ ┈┈ •• ✺',
  commands: [
    { pattern: 'facebook', desc: 'Descargar video de Facebook', handler: (s,j,a)=>a?downloadEndpoint(s,j,'/downloader/facebook',a,'Facebook'):s.sendMessage(j,{text:'❌ Uso: .facebook <URL>'}) },
    { pattern: 'instagram', desc: 'Descargar de Instagram', handler: (s,j,a)=>a?downloadEndpoint(s,j,'/downloader/instagram',a,'Instagram'):s.sendMessage(j,{text:'❌ Uso: .instagram <URL>'}) },
    {
      pattern: 'letra',
      desc: 'Letra de canción',
      handler: async (sock,jid,args) => {
        if (!args) return sock.sendMessage(jid,{text:'❌ Uso: .letra <artista - canción>'});
        try {
          const r = await axios.get(`https://api.lyrics.ovh/v1/${encodeURIComponent(args.split('-')[0].trim())}/${encodeURIComponent(args.split('-')[1]?.trim() || args)}`,{timeout:10000});
          const letra = r.data?.lyrics;
          if (!letra) return sock.sendMessage(jid,{text:'❌ Letra no encontrada.'});
          await sock.sendMessage(jid,{text:`🎵 *${args}*\n\n${letra.slice(0,3000)}`});
        } catch (e) { await sock.sendMessage(jid,{text:'❌ Letra no encontrada.'}); }
      }
    },
    { pattern: 'mp3', desc: 'Descargar audio MP3', handler: async (s,j,a)=>{
      if (!a) return s.sendMessage(j,{text:'❌ Uso: .mp3 <URL o búsqueda>'});
      await s.sendMessage(j,{text:'🎵 Buscando/descargando MP3...'});
      // buscar por youtube
      try {
        const yt = await velirius.request('/downloader/ytmp3', { q: a, url: a });
        const url = yt?.url || yt?.audio || yt?.result;
        if (url && url.startsWith('http')) {
          const r = await axios.get(url,{responseType:'arraybuffer',timeout:120000});
          await s.sendMessage(j,{audio:Buffer.from(r.data), mimetype:'audio/mpeg', caption:'🎵 '+a});
        } else {
          s.sendMessage(j,{text:'❌ No encontrado.'});
        }
      } catch(e){ s.sendMessage(j,{text:'❌ '+e.message}); }
    }},
    { pattern: 'mp4', desc: 'Descargar video MP4', handler: async (s,j,a)=>{
      if (!a) return s.sendMessage(j,{text:'❌ Uso: .mp4 <URL o búsqueda>'});
      await s.sendMessage(j,{text:'🎬 Descargando MP4...'});
      try {
        const yt = await velirius.request('/downloader/ytmp4',{q:a,url:a});
        const url = yt?.url || yt?.video || yt?.result;
        if (url && url.startsWith('http')) {
          const r = await axios.get(url,{responseType:'arraybuffer',timeout:120000});
          await s.sendMessage(j,{video:Buffer.from(r.data), caption:'🎬 '+a});
        } else s.sendMessage(j,{text:'❌ No encontrado.'});
      } catch(e){ s.sendMessage(j,{text:'❌ '+e.message}); }
    }},
    {
      pattern: 'play',
      desc: 'Reproducir música (atajo de mp3)',
      handler: async (s,j,a)=>{
        if (!a) return s.sendMessage(j,{text:'❌ Uso: .play <canción o artista>'});
        await s.sendMessage(j,{text:'🎵 Buscando/descargando...'});
        try {
          const yt = await velirius.request('/downloader/ytmp3', { q: a, url: a });
          const url = yt?.url || yt?.audio || yt?.result;
          if (url && url.startsWith('http')) {
            const r = await axios.get(url,{responseType:'arraybuffer',timeout:120000});
            await s.sendMessage(j,{audio:Buffer.from(r.data), mimetype:'audio/mpeg', caption:'🎵 '+a});
          } else s.sendMessage(j,{text:'❌ No encontrado.'});
        } catch(e){ s.sendMessage(j,{text:'❌ '+e.message}); }
      }
    },
    { pattern: 'tiktok', desc: 'Descargar video de TikTok', handler: (s,j,a)=>a?downloadEndpoint(s,j,'/downloader/tiktok',a,'TikTok'):s.sendMessage(j,{text:'❌ Uso: .tiktok <URL>'}) },
    { pattern: 'tiktokaudio', desc: 'Descargar audio de TikTok', handler: async (s,j,a)=>{
      if(!a)return s.sendMessage(j,{text:'❌ Uso: .tiktokaudio <URL>'});
      await s.sendMessage(j,{text:'🎵 Descargando audio de TikTok...'});
      try {
        const d = await velirius.request('/downloader/tiktok',{url:a});
        const aud = d?.audio || d?.url;
        if(aud){const r = await axios.get(aud,{responseType:'arraybuffer',timeout:60000}); await s.sendMessage(j,{audio:Buffer.from(r.data), mimetype:'audio/mpeg'});}
        else s.sendMessage(j,{text:'❌ No encontrado.'});
      }catch(e){s.sendMessage(j,{text:'❌ '+e.message});}
    }},
    { pattern: 'pinterest', desc: 'Descargar de Pinterest (video/imagen)', handler: async (s,j,a)=>{
      if(!a)return s.sendMessage(j,{text:'❌ Uso: .pinterest <URL>'});
      const d = await velirius.request('/downloader/pinterest',{url:a});
      const u = d?.url || d?.result;
      if(u){
        try{const r=await axios.get(u,{responseType:'arraybuffer',timeout:60000}); await s.sendMessage(j,{video:/mp4/.test(u)?Buffer.from(r.data):undefined, image:/mp4/.test(u)?undefined:Buffer.from(r.data), caption:'✅ Descargado'}); return;}catch(e){}
      }
      s.sendMessage(j,{text:'❌ No descargable.'});
    }}
  ]
};
