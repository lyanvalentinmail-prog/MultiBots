// Búsquedas (usa Velirius API /searcher)
const velirius = require('../lib/velirius');
const axios = require('axios');

module.exports = {
  title: '✺ •• ┈┈ ⋯ Búsquedas ⋯ ┈┈ •• ✺',
  commands: [
    {
      pattern: 'google',
      desc: 'Buscar en Google',
      handler: async (sock,jid,args) => {
        if (!args) return sock.sendMessage(jid,{text:'❌ Uso: .google <búsqueda>'});
        await sock.sendMessage(jid,{text:'🔎 Buscando...'});
        try {
          // Usa Velirius searcher/google si está disponible
          const data = await velirius.request('/searcher/google', { q: args, limit: 5 });
          let text = `🔎 *Resultados para* "${args}":\n\n`;
          if (data?.results?.length) {
            data.results.slice(0,5).forEach((r,i)=>{ text += `${i+1}. *${r.title}*\n${r.url || r.link || ''}\n${r.description || r.snippet || ''}\n\n`; });
          } else {
            // fallback: url directa
            text += `https://www.google.com/search?q=${encodeURIComponent(args)}`;
          }
          await sock.sendMessage(jid,{text});
        } catch (e) {
          await sock.sendMessage(jid,{text:`https://www.google.com/search?q=${encodeURIComponent(args)}`});
        }
      }
    },
    {
      pattern: 'pinterestbuscar',
      desc: 'Buscar imágenes en Pinterest',
      handler: async (sock,jid,args) => {
        if (!args) return sock.sendMessage(jid,{text:'❌ Uso: .pinterestbuscar <búsqueda>'});
        await sock.sendMessage(jid,{text:'📌 Buscando en Pinterest...'});
        const data = await velirius.request('/searcher/pinterest', { q: args });
        const url = data?.url || data?.result || (Array.isArray(data) ? data[0] : null);
        if (url && typeof url === 'string' && url.startsWith('http')) {
          const { sendImageFromUrl } = require('../lib/media');
          const ok = await sendImageFromUrl(sock,jid,url);
          if (!ok) await sock.sendMessage(jid,{text:url});
        } else {
          await sock.sendMessage(jid,{text:`📌 https://www.pinterest.com/search/pins/?q=${encodeURIComponent(args)}`});
        }
      }
    },
    {
      pattern: 'tiktokbuscar',
      desc: 'Buscar videos en TikTok (sin descargar)',
      handler: async (sock,jid,args) => {
        if (!args) return sock.sendMessage(jid,{text:'❌ Uso: .tiktokbuscar <búsqueda>'});
        await sock.sendMessage(jid,{text:'🎵 Buscando TikTok...'});
        await sock.sendMessage(jid,{text:`🎵 Resultados: https://www.tiktok.com/search?q=${encodeURIComponent(args)}`});
      }
    },
    {
      pattern: 'wiki',
      desc: 'Buscar en Wikipedia',
      handler: async (sock,jid,args) => {
        if (!args) return sock.sendMessage(jid,{text:'❌ Uso: .wiki <tema>'});
        try {
          const r = await axios.get(`https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(args)}`,{timeout:10000});
          const d = r.data;
          await sock.sendMessage(jid,{text:`📖 *${d.title}*\n\n${d.extract}\n\n${d.content_urls?.desktop?.page||''}`});
        } catch (e) {
          await sock.sendMessage(jid,{text:`❌ No encontrado: https://es.wikipedia.org/wiki/${encodeURIComponent(args)}`});
        }
      }
    },
    {
      pattern: 'youtube',
      desc: 'Buscar en YouTube',
      handler: async (sock,jid,args) => {
        if (!args) return sock.sendMessage(jid,{text:'❌ Uso: .youtube <búsqueda>'});
        await sock.sendMessage(jid,{text:'▶️ Buscando YouTube...'});
        try {
          const r = await axios.get('https://www.youtube.com/results',{params:{search_query:args},headers:{'User-Agent':'Mozilla/5.0'},timeout:10000});
          const cheerio = require('cheerio'); const $ = cheerio.load(r.data);
          const links = [];
          $('a[href^="/watch"]').each((i,el)=>{const h=$(el).attr('href'); if(h && !links.find(x=>x.url===h)) links.push({url:'https://www.youtube.com'+h.split('&')[0], title:$(el).attr('title')||$(el).text().trim()});});
          const top = links.slice(0,5).filter(l=>l.title);
          if (!top.length) return sock.sendMessage(jid,{text:`▶️ https://www.youtube.com/results?search_query=${encodeURIComponent(args)}`});
          await sock.sendMessage(jid,{text:top.map((l,i)=>`${i+1}. ${l.title}\n${l.url}`).join('\n\n')});
        } catch (e) {
          await sock.sendMessage(jid,{text:`▶️ https://www.youtube.com/results?search_query=${encodeURIComponent(args)}`});
        }
      }
    }
  ]
};
