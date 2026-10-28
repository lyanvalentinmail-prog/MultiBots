// Filtros de imágenes (canvas/filtros)
const velirius = require('../lib/velirius');
const { downloadMsg } = require('../lib/media');

async function applyFilter(sock,jid,msg,endpoint,intensity,errMsg) {
  const buf = await downloadMsg(msg);
  if (!buf) return sock.sendMessage(jid,{text:'❌ Responde a una imagen.'});
  await sock.sendMessage(jid,{text:'🎨 Aplicando filtro...'});
  try {
    // La API canvas/filtros usualmente acepta parámetros de intensidad
    const img = await velirius.getImage(endpoint, { intensity: intensity ? parseInt(intensity) : 5 });
    if (img) await sock.sendMessage(jid,{image:img});
    else await sock.sendMessage(jid,{text:'❌ '+errMsg});
  } catch(e) { await sock.sendMessage(jid,{text:'❌ '+e.message}); }
}

module.exports = {
  title: '✺ •• ┈┈ ⋯ Imágenes ⋯ ┈┈ •• ✺',
  commands: [
    { pattern: 'blur', desc: 'Aplicar desenfoque', handler: (s,j,a,m)=>applyFilter(s,j,m,'/canvas/blur',a?a.split(/\s+/).pop():'5','Error con blur') },
    { pattern: 'deepfry', desc: 'Efecto deepfry', handler: (s,j,a,m)=>applyFilter(s,j,m,'/canvas/deepfry',a?a.split(/\s+/).pop():'5','Error con deepfry') },
    { pattern: 'gay', desc: 'Efecto arcoíris gay', handler: (s,j,a,m)=>applyFilter(s,j,m,'/canvas/gay',null,'Error con gay') },
    { pattern: 'glitch', desc: 'Efecto glitch', handler: (s,j,a,m)=>applyFilter(s,j,m,'/canvas/glitch',a?a.split(/\s+/).pop():'5','Error con glitch') },
    { pattern: 'grayscale', desc: 'Escala de grises', handler: (s,j,a,m)=>applyFilter(s,j,m,'/canvas/grayscale',null,'Error con grayscale') },
    { pattern: 'invert', desc: 'Invertir colores', handler: (s,j,a,m)=>applyFilter(s,j,m,'/canvas/invert',null,'Error con invert') },
    { pattern: 'liquify', desc: 'Distorsión líquida', handler: (s,j,a,m)=>applyFilter(s,j,m,'/canvas/liquify',null,'Error con liquify') },
    { pattern: 'pixel', desc: 'Pixelar imagen', handler: (s,j,a,m)=>applyFilter(s,j,m,'/canvas/pixel','10','Error con pixel') },
    { pattern: 'sketch', desc: 'Efecto boceto', handler: (s,j,a,m)=>applyFilter(s,j,m,'/canvas/sketch',null,'Error con sketch') },
    { pattern: 'swirl', desc: 'Efecto remolino', handler: (s,j,a,m)=>applyFilter(s,j,m,'/canvas/swirl',a?a.split(/\s+/).pop():'5','Error con swirl') }
  ]
};
