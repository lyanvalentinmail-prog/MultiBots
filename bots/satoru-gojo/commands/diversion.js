// Diversión
const { pick, rand } = require('../lib/helpers');

module.exports = {
  title: '✺ •• ┈┈ ⋯ Diversión ⋯ ┈┈ •• ✺',
  commands: [
    {
      pattern: 'ship',
      desc: 'Ship de dos usuarios',
      handler: async (sock,jid,a,msg)=>{
        const m = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid||[];
        if(m.length<2)return sock.sendMessage(jid,{text:'❌ Menciona a dos usuarios: .ship @usuario1 @usuario2'});
        const pct = rand(0,100);
        let hearts='❤️'.repeat(Math.floor(pct/20))+'🤍'.repeat(5-Math.floor(pct/20));
        await sock.sendMessage(jid,{text:`💘 *SHIP*\n@${m[0].split('@')[0]} × @${m[1].split('@')[0]}\n${hearts} ${pct}%${pct>80?' — ¡Pareja perfecta!':pct<20?' — Mejor como amigos...':''}`, mentions:m});
      }
    },
    {
      pattern: 'topgays',
      desc: 'Top gays del grupo',
      handler: async (sock,jid)=>{
        if(!jid.endsWith('@g.us'))return sock.sendMessage(jid,{text:'❌ Solo en grupos.'});
        try{
          const meta = await sock.groupMetadata(jid);
          const shuffled = meta.participants.sort(()=>Math.random()-0.5).slice(0,5);
          let t='🏳️‍🌈 *Top 5 gays del grupo*\n';
          shuffled.forEach((p,i)=>{t+=`${i+1}. @${p.id.split('@')[0]} — ${rand(50,100)}%\n`;});
          await sock.sendMessage(jid,{text:t, mentions:shuffled.map(p=>p.id)});
        }catch(e){sock.sendMessage(jid,{text:'❌ Error'});}
      }
    },
    {
      pattern: 'topotakus',
      desc: 'Top otakus',
      handler: async (sock,jid)=>{
        if(!jid.endsWith('@g.us'))return sock.sendMessage(jid,{text:'❌ Solo en grupos.'});
        try{
          const meta = await sock.groupMetadata(jid);
          const shuffled = meta.participants.sort(()=>Math.random()-0.5).slice(0,5);
          let t='🎌 *Top 5 otakus*\n';
          shuffled.forEach((p,i)=>{t+=`${i+1}. @${p.id.split('@')[0]} — Nivel otaku ${rand(1,9999)}\n`;});
          await sock.sendMessage(jid,{text:t, mentions:shuffled.map(p=>p.id)});
        }catch(e){sock.sendMessage(jid,{text:'❌ Error'});}
      }
    },
    {
      pattern: 'topfemboys',
      desc: 'Top femboys',
      handler: async (sock,jid)=>{
        if(!jid.endsWith('@g.us'))return sock.sendMessage(jid,{text:'❌ Solo en grupos.'});
        try{
          const meta = await sock.groupMetadata(jid);
          const shuffled = meta.participants.sort(()=>Math.random()-0.5).slice(0,5);
          let t='🌸 *Top 5 femboys*\n';
          shuffled.forEach((p,i)=>{t+=`${i+1}. @${p.id.split('@')[0]} — ${rand(50,100)}% femboy\n`;});
          await sock.sendMessage(jid,{text:t, mentions:shuffled.map(p=>p.id)});
        }catch(e){sock.sendMessage(jid,{text:'❌ Error'});}
      }
    },
    {
      pattern: 'meme',
      desc: 'Meme aleatorio',
      fast: true,
      handler: async (sock,jid)=>{
        try{
          const velirius = require('../lib/velirius');
          const buf = await velirius.getImage('/canvas/meme' , {});
          // Si no existe endpoint meme, intentar reacciones
          if(!buf) {
            const axios = require('axios');
            const r = await axios.get('https://meme-api.com/gimme',{timeout:10000});
            if(r.data?.url){
              const img = await axios.get(r.data.url,{responseType:'arraybuffer',timeout:15000});
              return await sock.sendMessage(jid,{image:Buffer.from(img.data), caption:r.data.title});
            }
          } else {
            return await sock.sendMessage(jid,{image:buf, caption:'😂 Meme'});
          }
          await sock.sendMessage(jid,{text:'😂 Meme no disponible en este momento.'});
        }catch(e){await sock.sendMessage(jid,{text:'❌ Error: '+e.message});}
      }
    }
  ]
};
