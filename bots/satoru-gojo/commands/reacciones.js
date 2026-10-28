// Reacciones de anime (Velirius /reactions/*). No incluyen waifu/neko/maid (eliminados).
const velirius = require('../lib/velirius');
const { pick } = require('../lib/helpers');

// Reacciones disponibles (Velirius tiene 26 en /reactions)
const REACTIONS = [
  'abrazar','besar','palmada','golpear','dormir','comer','beber','baile',
  'llorar','reir','sonrojar','enojar','pat','wave','hi5','kill',
  'cuddle','slap','smile','sad','happy','dance','sleep','wink','poke','shrug'
];

async function sendReaction(sock,jid,name) {
  await sock.sendMessage(jid,{text:'✨ Cargando...'});
  const img = await velirius.getImage('/reactions/' + name, {});
  if (img) return await sock.sendMessage(jid,{image:img, caption:`✨ ${name}`});
  await sock.sendMessage(jid,{text:'❌ Reacción no disponible: '+name});
}

module.exports = {
  title: '✺ •• ┈┈ ⋯ Reacciones ⋯ ┈┈ •• ✺',
  commands: REACTIONS.map(name => ({
    pattern: name,
    desc: `Reacción: ${name}`,
    handler: async (sock,jid) => sendReaction(sock,jid,name)
  })).concat([
    {
      pattern: 'reaccion',
      desc: 'Reacción aleatoria',
      handler: async (sock,jid) => sendReaction(sock,jid,pick(REACTIONS))
    }
  ])
};
