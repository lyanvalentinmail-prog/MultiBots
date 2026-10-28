// Comandos anti-xxxx. Los toggles se guardan en db.groups[jid].
// Para que funcionen, el message-handler también debe consultar estos flags.
// Se añade check en message-handler después.
const { isAdmin, isGroup, getSender } = require('../lib/helpers');
const { save, getGroup } = require('../lib/database');

async function requireAdmin(sock, jid, msg) {
  if (!isGroup(jid)) { await sock.sendMessage(jid, { text: '❌ Solo en grupos.' }); return false; }
  const sender = getSender(msg);
  const ok = await isAdmin(sock, jid, sender);
  if (!ok) await sock.sendMessage(jid, { text: '❌ Necesitas ser admin.' });
  return ok;
}

function setFlag(sock, jid, msg, args, flag, label) {
  return (async () => {
    if (!(await requireAdmin(sock, jid, msg))) return;
    const g = getGroup(jid);
    const on = args.includes('on');
    const off = args.includes('off');
    if (!on && !off) return sock.sendMessage(jid, { text: `Uso: .${flag} on / .${flag} off` });
    g[flag] = on;
    save();
    await sock.sendMessage(jid, { text: `${label}: ${on ? '✅ activado' : '❌ desactivado'}` });
  })();
}

module.exports = {
  title: '✺ •• ┈┈ ⋯ Antis (Admins) ⋯ ┈┈ •• ✺',
  commands: [
    { pattern: 'antilink', desc: 'Anti enlaces', handler: (s,j,a,m) => setFlag(s,j,m,a,'antilink','Anti-enlaces') },
    { pattern: 'antiimg', desc: 'Anti imágenes', handler: (s,j,a,m) => setFlag(s,j,m,a,'antiimg','Anti-imágenes') },
    { pattern: 'antiaudio', desc: 'Anti audios', handler: (s,j,a,m) => setFlag(s,j,m,a,'antiaudio','Anti-audios') },
    { pattern: 'antivideo', desc: 'Anti videos', handler: (s,j,a,m) => setFlag(s,j,m,a,'antivideo','Anti-videos') },
    { pattern: 'antisticker', desc: 'Anti stickers', handler: (s,j,a,m) => setFlag(s,j,m,a,'antisticker','Anti-stickers') },
    { pattern: 'antispam', desc: 'Anti spam', handler: (s,j,a,m) => setFlag(s,j,m,a,'antispam','Anti-spam') },
    { pattern: 'antibot', desc: 'Anti bots', handler: (s,j,a,m) => setFlag(s,j,m,a,'antibot','Anti-bots') },
    {
      pattern: 'antidelete',
      desc: 'Anti borrado de mensajes',
      handler: (s,j,a,m) => setFlag(s,j,m,a,'antidelete','Anti-delete')
    },
    { pattern: 'antidocs', desc: 'Anti documentos', handler: (s,j,a,m) => setFlag(s,j,m,a,'antidocs','Anti-documentos') },
    { pattern: 'antipalabras', desc: 'Anti palabras prohibidas', handler: (s,j,a,m) => setFlag(s,j,m,a,'antipalabras','Anti-palabras') },
    {
      pattern: 'antipalabra',
      desc: 'Añadir/eliminar palabra prohibida',
      handler: async (sock, jid, args, msg) => {
        if (!(await requireAdmin(sock, jid, msg))) return;
        const parts = args.trim().split(/\s+/);
        const action = parts[0];
        const word = parts.slice(1).join(' ').toLowerCase();
        const g = getGroup(jid);
        g.antipalabrasList = g.antipalabrasList || [];
        if (action === 'add' && word) {
          if (!g.antipalabrasList.includes(word)) g.antipalabrasList.push(word);
          save();
          return sock.sendMessage(jid, { text: '✅ Palabra añadida: ' + word });
        }
        if (action === 'del' && word) {
          g.antipalabrasList = g.antipalabrasList.filter(w => w !== word);
          save();
          return sock.sendMessage(jid, { text: '🗑️ Palabra eliminada: ' + word });
        }
        await sock.sendMessage(jid, { text: 'Uso: .antipalabra add <palabra> | .antipalabra del <palabra>\n\nLista actual:\n' + (g.antipalabrasList.join(', ') || '(ninguna)') });
      }
    }
  ]
};
