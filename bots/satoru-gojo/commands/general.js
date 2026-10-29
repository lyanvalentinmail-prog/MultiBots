const { formatTime } = require('../lib/helpers');
const config = require('../config');
const os = require('os');

let startTime = Date.now();

module.exports = {
  title: '✺ •• ┈┈ ⋯ General ⋯ ┈┈ •• ✺',
  commands: [
    {
      pattern: 'ping',
      desc: 'Latencia del bot',
      fast: true,
      handler: async (sock, jid) => {
        const start = Date.now();
        await sock.sendMessage(jid, { text: '🏓 Calculando...' });
        const latency = Date.now() - start;
        await sock.sendMessage(jid, { text: `🏓 *Pong!*\n⏱️ Latencia: *${latency}ms*\n⚡ Velirius API: https://velirius-api-sd8u.vercel.app` });
      }
    },
    {
      pattern: 'id',
      desc: 'Obtener ID del chat/usuario',
      fast: true,
      handler: async (sock, jid, args, msg) => {
        const sender = msg.key.participant || msg.key.remoteJid;
        await sock.sendMessage(jid, {
          text: `🆔 *ID del chat:* \`${jid}\`\n👤 *Tu JID:* \`${sender}\`\n${msg.key.fromMe ? '(mensaje propio)' : ''}`
        });
      }
    },
    {
      pattern: 'infobot',
      desc: 'Información del bot',
      fast: true,
      handler: async (sock, jid) => {
        const { categories } = require('./loader');
        const uptime = formatTime(Date.now() - startTime);
        const ram = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
        const totalCmds = categories.reduce((a, c) => a + c.commands.length, 0);
        await sock.sendMessage(jid, {
          text:
`🤖 *${config.name} v${config.version}*
━━━━━━━━━━━━━━━━
👑 Owner: wa.me/${config.ownerNumber}
📚 Librería: @whiskeysockets/baileys
⚙️ Node.js: ${process.version}
💾 RAM usada: ${ram} MB
⏱️ Uptime: ${uptime}
📊 Comandos totales: ${totalCmds}
🌐 API: ${config.apiBase}
━━━━━━━━━━━━━━━━
_"En el mundo y el jujutsu, él es el más fuerte."_`
        });
      }
    },
    {
      pattern: 'menu',
      desc: 'Muestra el menú principal',
      fast: false,
      noPrefix: true, // funciona escribiendo "menu" a secas
      // El handler real se asigna por message-handler porque necesita sendMainMenu con el userName
      // Este placeholder asegura que el comando aparezca listado; la lógica real se intercepta en message-handler.
      handler: async (sock, jid, args, msg) => {
        const { sendMainMenu } = require('../message-handler');
        const userName = msg.pushName || 'Usuario';
        await sendMainMenu(sock, jid, userName);
      }
    },
    {
      // Los tres "botones" del menú también como comando: si WhatsApp no
      // muestra botones interactivos, el menú de texto usa estos.
      pattern: 'menufull',
      desc: 'Lista completa de comandos',
      fast: true,
      handler: async (sock, jid) => {
        const { buildFullMenuText } = require('../message-handler');
        await sock.sendMessage(jid, { text: buildFullMenuText() });
      }
    },
    {
      pattern: 'fastcommand',
      desc: 'Comandos rápidos',
      fast: true,
      handler: async (sock, jid) => {
        const { buildFastCommandText } = require('../message-handler');
        await sock.sendMessage(jid, { text: buildFastCommandText() });
      }
    },
    {
      pattern: 'support',
      desc: 'Número de soporte',
      fast: false,
      handler: async (sock, jid) => {
        await sock.sendMessage(jid, {
          text: `${config.messages.supportText}\n\nhttps://wa.me/${config.ownerNumber}`
        });
      }
    },
    {
      pattern: 'owner',
      desc: 'Contactar al creador',
      fast: true,
      handler: async (sock, jid) => {
        await sock.sendMessage(jid, {
          text: '👑 *Creador / Owner:*\nhttps://wa.me/' + config.ownerNumber,
          footer: config.messages.copyright
        });
      }
    },
    {
      pattern: 'estadoapi',
      desc: 'Estado de la API (velirius)',
      fast: false,
      handler: async (sock, jid) => {
        try {
          const axios = require('axios');
          const res = await axios.get(config.apiBase + '/information', { timeout: 10000 });
          await sock.sendMessage(jid, {
            text: `🌐 *Velirius API*\nEstado: ✅ *Online*\nRutas: ${res.data?.routers || '?'}\nEndpoints: ${res.data?.endpoints || '?'}\n${config.apiBase}`
          });
        } catch (e) {
          await sock.sendMessage(jid, { text: '🌐 *Velirius API*\nEstado: ❌ *Fuera de línea*\n' + e.message });
        }
      }
    }
  ]
};
