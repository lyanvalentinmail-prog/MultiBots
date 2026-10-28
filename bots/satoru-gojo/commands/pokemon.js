// Comandos de Pokémon (usa la API Velirius /anime/pokemon)
const velirius = require('../lib/velirius');
const { getUser, db, save } = require('../lib/database');
const { rand, pick } = require('../lib/helpers');

const POKEMON_LIST = ['pikachu','charmander','bulbasaur','squirtle','eevee','mewtwo','gengar','dragonite','snorlax','lucario','greninja','charizard','blastoise','venusaur','gyarados','raichu','mew','arceus','rayquaza','giratina'];

module.exports = {
  title: '✺ •• ┈┈ ⋯ Pokémon ⋯ ┈┈ •• ✺',
  commands: [
    {
      pattern: 'catch',
      desc: 'Capturar Pokémon salvaje',
      handler: async (sock, jid, args, msg) => {
        const sender = msg.key.participant || jid;
        const u = getUser(sender);
        const name = pick(POKEMON_LIST);
        const success = Math.random() < 0.45;
        db.pokemon[sender] = db.pokemon[sender] || { owned: [], team: [] };
        if (success) {
          db.pokemon[sender].owned.push(name);
          save();
          await sock.sendMessage(jid, { text: `🎉 ¡Capturaste un *${name}*! Añadido a tu Pokédex.` });
        } else {
          await sock.sendMessage(jid, { text: `❌ El *${name}* escapó. Intenta de nuevo!` });
        }
      }
    },
    {
      pattern: 'pokedex',
      desc: 'Ver datos de un Pokémon (por nombre/ID/random)',
      handler: async (sock, jid, args) => {
        const q = args.trim() || 'random';
        await sock.sendMessage(jid, { text: '🔍 Buscando...' });
        const data = await velirius.request('/anime/pokemon', { query: q });
        if (!data || !data.name) {
          return sock.sendMessage(jid, { text: '❌ Pokémon no encontrado.' });
        }
        let txt = `📕 *Pokédex: ${data.name.toUpperCase()}*\n`;
        txt += `ID: #${data.id || '?'}\n`;
        if (data.types?.length) txt += `Tipos: ${data.types.join(', ')}\n`;
        if (data.stats) {
          txt += 'Stats:\n';
          for (const k of Object.keys(data.stats)) txt += `  ${k}: ${data.stats[k]}\n`;
        }
        if (data.description) txt += `\n_${data.description}_\n`;
        if (data.sprite || data.image) {
          const axios = require('axios');
          try {
            const r = await axios.get(data.sprite || data.image, { responseType: 'arraybuffer', timeout: 15000 });
            await sock.sendMessage(jid, { image: Buffer.from(r.data), caption: txt });
            return;
          } catch {}
        }
        await sock.sendMessage(jid, { text: txt });
      }
    },
    {
      pattern: 'pokemonbattle',
      desc: 'Batalla Pokémon',
      handler: async (sock, jid, args, msg) => {
        const sender = msg.key.participant || jid;
        const target = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
        const my = pick(POKEMON_LIST);
        const other = pick(POKEMON_LIST);
        const iWin = Math.random() < 0.5;
        await sock.sendMessage(jid, {
          text: `⚔️ *Batalla Pokémon*\nTu ${my} VS ${target?'el Pokémon de @'+target.split('@')[0]:other}\n🏆 ${iWin?'¡GANASTE!':'Perdiste...'}`,
          mentions: target ? [target] : []
        });
      }
    }
  ]
};
