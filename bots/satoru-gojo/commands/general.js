// Comandos generales
module.exports = {
  title: '✺ •• ┈┈ ⋯ General ⋯ ┈┈ •• ✺',
  commands: [
    {
      pattern: 'ping',
      desc: 'Latencia del bot',
      fast: true,
      handler: async (sock, jid) => {
        const start = Date.now();
        const sent = await sock.sendMessage(jid, { text: '🏓 Calculando...' });
        const latency = Date.now() - start;
        await sock.sendMessage(jid, { text: `🏓 Pong!\n⏱️ ${latency}ms` });
      }
    },
    {
      pattern: 'id',
      desc: 'Obtener ID del chat/usuario',
      fast: true,
      handler: async (sock, jid, args, msg) => {
        await sock.sendMessage(jid, {
          text: `🆔 *ID del chat:* ${jid}\n👤 *Tu JID:* ${msg.key.participant || msg.key.remoteJid}`
        });
      }
    },
    {
      pattern: 'infobot',
      desc: 'Información del bot',
      fast: true,
      handler: async (sock, jid) => {
        await sock.sendMessage(jid, {
          text: `🤖 *Satoru Gojo v1.0.0*\n📚 Librería: Baileys\n⚙️ Node.js ${process.version}\n📅 Fecha: ${new Date().toLocaleString()}\n\n_El hechicero más fuerte._`
        });
      }
    },
    {
      pattern: 'menu',
      desc: 'Muestra el menú principal',
      fast: false,
      handler: null // el menú se maneja en el message-handler para soportar también sin prefijo
    },
    {
      pattern: 'owner',
      desc: 'Contactar al creador',
      fast: true,
      handler: async (sock, jid) => {
        await sock.sendMessage(jid, {
          text: '👑 *Creador / Owner:*\nhttps://wa.me/59896719709'
        });
      }
    },
    {
      pattern: 'estadoapi',
      desc: 'Estado de la API (velirius)',
      fast: false,
      handler: async (sock, jid) => {
        try {
          const res = await fetch('https://velirius-api-sd8u.vercel.app/');
          await sock.sendMessage(jid, {
            text: `🌐 API: ${res.ok ? '✅ Online' : '❌ Error'} (${res.status})`
          });
        } catch (e) {
          await sock.sendMessage(jid, { text: '🌐 API: ❌ No reachable' });
        }
      }
    }
  ]
};
