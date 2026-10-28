// Comandos exclusivos del owner
const { isOwner } = require('../lib/helpers');
const { db, save, getGroup } = require('../lib/database');
const config = require('../config');
const fs = require('fs');
const path = require('path');

function requireOwner(msg) {
  const sender = msg.key.participant || msg.key.remoteJid;
  return isOwner(sender);
}

module.exports = {
  title: '✺ •• ┈┈ ⋯ Owners ⋯ ┈┈ •• ✺',
  commands: [
    {
      pattern: 'mod',
      desc: 'Añadir/eliminar/listar mods',
      handler: async (sock, jid, args, msg) => {
        if (!requireOwner(msg)) return sock.sendMessage(jid, { text: '❌ Solo el owner puede usar este comando.' });
        const [action, targetRaw] = args.split(/\s+/);
        if (!action || action === 'lista') {
          return sock.sendMessage(jid, { text: '👥 *Mods actuales:*\n' + (db.global.mods.length ? db.global.mods.map(m => '• ' + m).join('\n') : '(ninguno)') });
        }
        if (action === 'del') {
          const num = (targetRaw || '').replace(/\D/g, '');
          db.global.mods = db.global.mods.filter(m => !m.includes(num));
          save();
          return sock.sendMessage(jid, { text: '✅ Mod eliminado.' });
        }
        // add
        const addNum = action.replace(/\D/g, '');
        const newMod = addNum + '@s.whatsapp.net';
        if (!db.global.mods.includes(newMod)) db.global.mods.push(newMod);
        save();
        await sock.sendMessage(jid, { text: '✅ Mod añadido: ' + addNum });
      }
    },
    {
      pattern: 'delsession',
      desc: 'Eliminar sesión actual (reinicio requerido)',
      handler: async (sock, jid, args, msg) => {
        if (!requireOwner(msg)) return sock.sendMessage(jid, { text: '❌ Solo owner.' });
        await sock.sendMessage(jid, { text: '⚠️ Eliminando sesión en 3 segundos...' });
        setTimeout(() => {
          try {
            fs.rmSync(config.sessionPath, { recursive: true, force: true });
            process.exit(0);
          } catch (e) {
            console.error(e);
          }
        }, 3000);
      }
    },
    {
      pattern: 'join',
      desc: 'Unirse a grupo por invitación',
      handler: async (sock, jid, args, msg) => {
        if (!requireOwner(msg)) return sock.sendMessage(jid, { text: '❌ Solo owner.' });
        const code = args.match(/([A-Za-z0-9]{20,})/)?.[1] || args;
        try {
          const res = await sock.groupAcceptInvite(code);
          await sock.sendMessage(jid, { text: '✅ Unido al grupo: ' + res });
        } catch (e) {
          await sock.sendMessage(jid, { text: '❌ No se pudo unir: ' + e.message });
        }
      }
    },
    {
      pattern: 'bot on',
      desc: 'Activar el bot',
      handler: async (sock, jid, args, msg) => {
        if (!requireOwner(msg)) return sock.sendMessage(jid, { text: '❌ Solo owner.' });
        db.global.botOn = true; save();
        await sock.sendMessage(jid, { text: '✅ Bot activado.' });
      }
    },
    {
      pattern: 'bot off',
      desc: 'Desactivar el bot',
      handler: async (sock, jid, args, msg) => {
        if (!requireOwner(msg)) return sock.sendMessage(jid, { text: '❌ Solo owner.' });
        db.global.botOn = false; save();
        await sock.sendMessage(jid, { text: '⏸️ Bot desactivado.' });
      }
    },
    {
      pattern: 'setlen',
      desc: 'Cambiar idioma (es/in/pt)',
      handler: async (sock, jid, args, msg) => {
        if (!requireOwner(msg)) return sock.sendMessage(jid, { text: '❌ Solo owner.' });
        const lang = args.trim();
        if (!['es','in','pt'].includes(lang)) return sock.sendMessage(jid, { text: '❌ Idioma inválido. Usa: es / in / pt' });
        db.global.lang = lang; save();
        await sock.sendMessage(jid, { text: '✅ Idioma: ' + lang });
      }
    },
    {
      pattern: 'setmenu',
      desc: 'Cambiar estilo del menú (lista/texto)',
      handler: async (sock, jid, args, msg) => {
        if (!requireOwner(msg)) return sock.sendMessage(jid, { text: '❌ Solo owner.' });
        const style = args.trim();
        if (!['lista','texto'].includes(style)) return sock.sendMessage(jid, { text: '❌ Usa: lista / texto' });
        db.global.menuStyle = style; save();
        await sock.sendMessage(jid, { text: '✅ Estilo menú: ' + style });
      }
    }
  ]
};
