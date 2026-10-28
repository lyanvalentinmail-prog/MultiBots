// Comandos de perfil
const { getUser, db, save } = require('../lib/database');

module.exports = {
  title: '✺ •• ┈┈ ⋯ Perfil ⋯ ┈┈ •• ✺',
  commands: [
    {
      pattern: 'perfil',
      desc: 'Ver tu perfil',
      handler: async (sock, jid, args, msg) => {
        const sender = msg.key.participant || jid;
        const u = getUser(sender);
        const pkmn = (db.pokemon[sender]?.owned?.length) || 0;
        const txt =
`👤 *Perfil*
━━━━━━━━━━━━
📛 Nombre: ${msg.pushName || 'Usuario'}
🆔 ${sender.split('@')[0]}
🎂 Cumpleaños: ${u.birth || 'No establecido'}
🔞 Edad: ${u.age || '?'}
⚥ Género: ${u.genre || '?'}
💍 Casado con: ${u.married ? '@'+u.married.split('@')[0] : 'Soltero/a'}
⭐ Personaje fav: ${u.fav || 'No establecido'}
📝 Descripción: ${u.desc}
━━━━━━━━━━━━
💵 Monedas: ${u.coins} | 🏦 Banco: ${u.banco}
🎒 Pokémon capturados: ${pkmn}`;
        await sock.sendMessage(jid, { text: txt, mentions: u.married ? [u.married] : [] });
      }
    },
    {
      pattern: 'setbirth',
      desc: 'Establecer fecha de nacimiento',
      handler: async (sock, jid, args, msg) => {
        if (!args) return sock.sendMessage(jid,{text:'Uso: .setbirth YYYY-MM-DD'});
        const u = getUser(msg.key.participant||jid);
        u.birth = args.trim(); save();
        await sock.sendMessage(jid,{text:`🎂 Cumpleaños: ${u.birth}`});
      }
    },
    {
      pattern: 'setage',
      desc: 'Establecer edad',
      handler: async (sock, jid, args, msg) => {
        const n = parseInt(args); if (!n||n<0||n>120) return sock.sendMessage(jid,{text:'❌ Edad inválida.'});
        const u = getUser(msg.key.participant||jid); u.age = n; save();
        await sock.sendMessage(jid,{text:`🔞 Edad: ${n}`});
      }
    },
    {
      pattern: 'setdesc',
      desc: 'Establecer descripción',
      handler: async (sock, jid, args, msg) => {
        if (!args) return sock.sendMessage(jid,{text:'Uso: .setdesc <descripción>'});
        const u = getUser(msg.key.participant||jid); u.desc = args; save();
        await sock.sendMessage(jid,{text:`📝 Descripción actualizada.`});
      }
    },
    {
      pattern: 'setfav',
      desc: 'Personaje favorito',
      handler: async (sock, jid, args, msg) => {
        if (!args) return sock.sendMessage(jid,{text:'Uso: .setfav <personaje>'});
        const u = getUser(msg.key.participant||jid); u.fav = args; save();
        await sock.sendMessage(jid,{text:`⭐ Favorito: ${args}`});
      }
    },
    {
      pattern: 'setgenre',
      desc: 'Establecer género',
      handler: async (sock, jid, args, msg) => {
        if (!['hombre','mujer','otro'].includes(args.trim())) return sock.sendMessage(jid,{text:'❌ Usa: hombre / mujer / otro'});
        const u = getUser(msg.key.participant||jid); u.genre = args.trim(); save();
        await sock.sendMessage(jid,{text:`⚥ Género: ${u.genre}`});
      }
    },
    {
      pattern: 'birthdays',
      desc: 'Ver próximos cumpleaños',
      handler: async (sock, jid) => {
        const today = new Date().toISOString().slice(5,10);
        const list = Object.entries(db.users)
          .filter(([,u])=>u.birth && u.birth.slice(5)===today)
          .map(([id])=>'• @'+id.split('@')[0]);
        await sock.sendMessage(jid,{text:`🎂 *Cumpleaños de hoy*:\n${list.length?list.join('\n'):'Nadie cumple años hoy.'}`, mentions: list.map(l=>l.replace('• @','')+'@s.whatsapp.net')});
      }
    },
    {
      pattern: 'marry',
      desc: 'Casarse con un usuario',
      handler: async (sock, jid, args, msg) => {
        const s = msg.key.participant||jid;
        const t = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
        if (!t||s===t) return sock.sendMessage(jid,{text:'❌ Menciona al usuario con quien te quieres casar.'});
        const us=getUser(s), ut=getUser(t);
        if (us.married||ut.married) return sock.sendMessage(jid,{text:'❌ Uno de los dos ya está casado.'});
        us.married = t; ut.married = s; save();
        await sock.sendMessage(jid,{text:`💍 ¡@${s.split('@')[0]} se ha casado con @${t.split('@')[0]}! 🎉`, mentions:[s,t]});
      }
    },
    {
      pattern: 'divorce',
      desc: 'Divorciarse',
      handler: async (sock, jid, args, msg) => {
        const s = msg.key.participant||jid;
        const u=getUser(s); if(!u.married) return sock.sendMessage(jid,{text:'❌ No estás casado.'});
        const p=getUser(u.married); u.married=null; p.married=null; save();
        await sock.sendMessage(jid,{text:`💔 Divorciado.`});
      }
    }
  ]
};
