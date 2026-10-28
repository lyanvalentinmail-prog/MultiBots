// Tops/Rankings
const { db } = require('../lib/database');

function topBy(key, label, n=10) {
  return Object.entries(db.users)
    .filter(([,u])=>u[key] !== undefined)
    .sort((a,b)=>b[1][key]-a[1][key])
    .slice(0,n);
}

function fmt(list, key) {
  if (!list.length) return '(sin datos)';
  return list.map(([id,u],i)=>`${i+1}. @${id.split('@')[0]} — ${u[key]}`).join('\n');
}

function mentionsFrom(list) {
  return list.map(([id])=>id);
}

module.exports = {
  title: '✺ •• ┈┈ ⋯ Tops ⋯ ┈┈ •• ✺',
  commands: [
    {
      pattern: 'topcoins',
      desc: 'Top usuarios con más monedas',
      handler: async (sock,jid) => {
        const list = topBy('coins','coins');
        await sock.sendMessage(jid,{text:`💰 *Top monedas*\n${fmt(list,'coins')}`, mentions: mentionsFrom(list)});
      }
    },
    {
      pattern: 'topinactivos',
      desc: 'Top usuarios inactivos (placeholder - lista aleatoria)',
      handler: async (sock,jid) => {
        await sock.sendMessage(jid,{text:'😴 Top inactivos: función basada en último mensaje (requiere tracking de actividad por ahora).'});
      }
    },
    {
      pattern: 'topactivos',
      desc: 'Top usuarios más activos (placeholder)',
      handler: async (sock,jid) => {
        await sock.sendMessage(jid,{text:'🔥 Top activos próximamente (contador de mensajes activado en próxima actualización).'});
      }
    }
  ]
};
