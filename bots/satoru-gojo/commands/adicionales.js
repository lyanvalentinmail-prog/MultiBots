// Adicionales
const { db, save, getUser } = require('../lib/database');
const { isGroup } = require('../lib/helpers');
const axios = require('axios');

module.exports = {
  title: '✺ •• ┈┈ ⋯ Adicionales ⋯ ┈┈ •• ✺',
  commands: [
    {
      pattern: 'nota',
      desc: 'Guardar una nota',
      handler: async (sock,jid,args,msg)=>{
        if(!args)return sock.sendMessage(jid,{text:'❌ Uso: .nota <contenido>'});
        const s = msg.key.participant||jid;
        db.notes[s] = db.notes[s]||[];
        const n = db.notes[s].length+1;
        db.notes[s].push({n,text:args});
        save();
        await sock.sendMessage(jid,{text:`📝 Nota #${n} guardada.`});
      }
    },
    {
      pattern: 'delnota',
      desc: 'Eliminar una nota',
      handler: async (sock,jid,args,msg)=>{
        const s=msg.key.participant||jid; const n=parseInt(args);
        db.notes[s]=(db.notes[s]||[]).filter(x=>x.n!==n); save();
        await sock.sendMessage(jid,{text:`🗑️ Nota #${n} eliminada.`});
      }
    },
    {
      pattern: 'infogrupo',
      desc: 'Información del grupo',
      handler: async (sock,jid,a,msg)=>{
        if(!isGroup(jid))return sock.sendMessage(jid,{text:'❌ Solo en grupos.'});
        const meta = await sock.groupMetadata(jid);
        const admins = meta.participants.filter(p=>p.admin).map(p=>'• @'+p.id.split('@')[0]);
        await sock.sendMessage(jid,{text:`👥 *${meta.subject}*\n👑 Creado por: ${meta.owner?.split('@')[0]||'?'}\n👤 Miembros: ${meta.size}\n📅 Creado: ${new Date(meta.creation*1000).toLocaleDateString()}\n🔒 Admins (${admins.length}):\n${admins.join('\n')}`, mentions: meta.participants.filter(p=>p.admin).map(p=>p.id)});
      }
    },
    {
      pattern: 'reveal',
      desc: 'Revelar sticker (convertir a imagen)',
      handler: async (sock,jid,a,msg)=>{
        const { downloadMsg } = require('../lib/media');
        const buf = await downloadMsg(msg);
        if(!buf)return sock.sendMessage(jid,{text:'❌ Responde a un sticker.'});
        await sock.sendMessage(jid,{image:buf, caption:'🔍 Sticker revelado.'});
      }
    },
    {
      pattern: 'translate',
      desc: 'Traducir texto',
      handler: async (sock,jid,args)=>{
        // Formato: .translate es Hola mundo / .translate es/en Hola
        const m = args.match(/^([a-z]{2})(?:\/([a-z]{2}))?\s+(.+)$/i);
        if(!m)return sock.sendMessage(jid,{text:'❌ Uso: .translate es <texto> o .translate es/en <texto>'});
        const [,from,to,text]=m; const target=to||'en';
        try {
          const r = await axios.get(`https://api.mymemory.translated.net/get`,{params:{q:text,langpair:`${from}|${target}`},timeout:10000});
          await sock.sendMessage(jid,{text:`🌐 *Traducción (${from} → ${target}):*\n${r.data?.responseData?.translatedText || 'Error'}`});
        } catch(e){await sock.sendMessage(jid,{text:'❌ Error: '+e.message});}
      }
    },
    {
      pattern: 'calculator',
      desc: 'Calculadora (eval de forma segura)',
      handler: async (sock,jid,args)=>{
        if(!args)return sock.sendMessage(jid,{text:'❌ Uso: .calculator 2+2'});
        try {
          // Validar que solo contenga números y operadores básicos
          if(!/^[\d+\-*/().\s]+$/.test(args)) throw new Error('Caracteres no permitidos');
          const result = Function('"use strict";return ('+args+')')();
          await sock.sendMessage(jid,{text:`🧮 ${args} = *${result}*`});
        } catch(e){await sock.sendMessage(jid,{text:'❌ Expresión inválida.'});}
      }
    },
    {
      pattern: 'resize',
      desc: 'Redimensionar imagen',
      handler: async (sock,jid,args,msg)=>{
        await sock.sendMessage(jid,{text:'📐 Redimensionamiento requiere editor de imágenes en el cliente. Usa canvas API o edita antes de enviar.'});
      }
    },
    {
      pattern: 'tts',
      desc: 'Texto a voz (audio)',
      handler: async (sock,jid,args)=>{
        if(!args)return sock.sendMessage(jid,{text:'❌ Uso: .tts <texto>'});
        await sock.sendMessage(jid,{text:'🔊 Generando audio...'});
        try {
          // Usar API TTS pública
          const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(args)}&tl=es&client=tw-ob`;
          const r = await axios.get(url,{responseType:'arraybuffer',timeout:15000, headers:{'User-Agent':'Mozilla/5.0'}});
          await sock.sendMessage(jid,{audio:Buffer.from(r.data), mimetype:'audio/mpeg', ptt:true});
        } catch(e){await sock.sendMessage(jid,{text:'❌ Error TTS: '+e.message});}
      }
    },
    {
      pattern: 'stt',
      desc: 'Voz a texto (placeholder - requiere Whisper)',
      handler: async (sock,jid)=>{
        await sock.sendMessage(jid,{text:'🎙️ STT requiere API de reconocimiento. Configuración disponible próximamente.'});
      }
    }
  ]
};
