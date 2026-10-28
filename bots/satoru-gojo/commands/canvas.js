// Canvas - todos usan Velirius API /canvas/*
const velirius = require('../lib/velirius');
const { downloadMsg } = require('../lib/media');
const axios = require('axios');

async function canvasImageCmd(sock,jid,args,msg,endpoint,errMsg) {
  const buf = await downloadMsg(msg);
  // Si no hay imagen respondida, usa texto
  await sock.sendMessage(jid,{text:'🎨 Generando...'});
  try {
    let params = {};
    if (args) params.text = args;
    if (buf) {
      // Subir a un host temporal? Muchos canvas de Velirius aceptan URL en ?image=...
      // Usamos data URI o un host - por simplicidad, sólo enviamos texto si no hay URL.
    }
    const img = await velirius.getImage(endpoint, params);
    if (img) return await sock.sendMessage(jid,{image:img});
    // fallback: devolver texto con la URL
    const d = await velirius.request(endpoint, params);
    const url = d?.url || d?.result;
    if (url) await sock.sendMessage(jid,{text:`🎨 ${url}`});
    else await sock.sendMessage(jid,{text:'❌ '+errMsg});
  } catch (e) {
    await sock.sendMessage(jid,{text:'❌ '+e.message});
  }
}

module.exports = {
  title: '✺ •• ┈┈ ⋯ Canvas ⋯ ┈┈ •• ✺',
  commands: [
    { pattern: 'canvaimagen', desc: 'Canvas sobre imagen (placeholder)', handler: (s,j,a,m)=>canvasImageCmd(s,j,a,m,'/canvas/pixel','No disponible') },
    { pattern: 'cuentatiktok', desc: 'Cuenta de TikTok falsa', handler: (s,j,a)=>canvasImageCmd(s,j,a,null,'/canvas/tiktok','Usa texto') },
    { pattern: 'friendship', desc: 'Tarjeta amistad', handler: (s,j,a)=>canvasImageCmd(s,j,a,null,'/canvas/friendship','No disponible') },
    { pattern: 'gaycard', desc: 'Tarjeta gay', handler: (s,j,a)=>canvasImageCmd(s,j,a,null,'/canvas/gaycard','No disponible') },
    { pattern: 'googleimg', desc: 'Imagen estilo Google', handler: (s,j,a)=>canvasImageCmd(s,j,a,null,'/canvas/google','No disponible') },
    { pattern: 'iqc', desc: 'Quote IQ', handler: async (s,j,a)=>{if(!a)return s.sendMessage(j,{text:'Uso: .iqc <texto>'}); const img=await velirius.getImage('/canvas/iqc',{text:a}); if(img)await s.sendMessage(j,{image:img}); else s.sendMessage(j,{text:'❌ Error'});} },
    { pattern: 'iqcblue', desc: 'Quote IQ azul', handler: async (s,j,a)=>{if(!a)return s.sendMessage(j,{text:'Uso: .iqcblue <texto>'}); const img=await velirius.getImage('/canvas/iqc',{text:a,bg:'blue'}); if(img)await s.sendMessage(j,{image:img}); else s.sendMessage(j,{text:'❌ Error'});} },
    { pattern: 'iqcpink', desc: 'Quote IQ rosa', handler: async (s,j,a)=>{if(!a)return s.sendMessage(j,{text:'Uso: .iqcpink <texto>'}); const img=await velirius.getImage('/canvas/iqc',{text:a,bg:'pink'}); if(img)await s.sendMessage(j,{image:img}); else s.sendMessage(j,{text:'❌ Error'});} },
    { pattern: 'laptop', desc: 'Foto en laptop', handler: (s,j,a,m)=>canvasImageCmd(s,j,a,m,'/canvas/laptop','Responde a una imagen') },
    { pattern: 'messengerquote', desc: 'Quote Messenger', handler: async (s,j,a)=>{if(!a)return s.sendMessage(j,{text:'Uso: .messengerquote <texto>'}); const img=await velirius.getImage('/canvas/messenger',{text:a}); if(img)await s.sendMessage(j,{image:img}); else s.sendMessage(j,{text:'❌ Error'});} },
    { pattern: 'pc', desc: 'Foto en PC', handler: (s,j,a,m)=>canvasImageCmd(s,j,a,m,'/canvas/pc','Responde a una imagen') },
    { pattern: 'pov', desc: 'POV', handler: async (s,j,a)=>{if(!a)return s.sendMessage(j,{text:'Uso: .pov <texto>'}); const img=await velirius.getImage('/canvas/pov',{text:a}); if(img)await s.sendMessage(j,{image:img}); else s.sendMessage(j,{text:'❌ Error'});} },
    { pattern: 'profilenote', desc: 'Nota de perfil', handler: async (s,j,a)=>{if(!a)return s.sendMessage(j,{text:'Uso: .profilenote <texto>'}); const img=await velirius.getImage('/canvas/note',{text:a}); if(img)await s.sendMessage(j,{image:img}); else s.sendMessage(j,{text:'❌ Error'});} },
    { pattern: 'quotly', desc: 'Quote estilo Telegram (sticker)', handler: async (s,j,a,m)=>{
      const sender = m.pushName||'Usuario';
      if(!a)return s.sendMessage(j,{text:'Uso: .quotly <texto>'});
      try{const img=await velirius.getImage('/canvas/quotly',{text:a,username:sender}); if(img)await s.sendMessage(j,{sticker:img}); else s.sendMessage(j,{text:'❌ Error'});}catch(e){s.sendMessage(j,{text:'❌ '+e.message});}
    }},
    { pattern: 'searched', desc: 'Buscado por policía', handler: (s,j,a,m)=>canvasImageCmd(s,j,a,m,'/canvas/searched','Responde a una imagen') },
    { pattern: 'storyreply', desc: 'Responder historia', handler: async (s,j,a)=>{if(!a)return s.sendMessage(j,{text:'Uso: .storyreply <texto>'}); const img=await velirius.getImage('/canvas/instagramreply',{text:a}); if(img)await s.sendMessage(j,{image:img}); else s.sendMessage(j,{text:'❌ Error'});} },
    { pattern: 'x', desc: 'Estilo Twitter/X', handler: async (s,j,a,m)=>{if(!a)return s.sendMessage(j,{text:'Uso: .x <texto>'}); const sender=m.pushName||'Usuario'; const img=await velirius.getImage('/canvas/tweet',{text:a,username:sender}); if(img)await s.sendMessage(j,{image:img,caption:`🐦 Tweet de ${sender}`}); else s.sendMessage(j,{text:'❌ Error'});} }
  ]
};
