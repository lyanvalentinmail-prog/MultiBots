// Comandos para administradores de grupo
const { isAdmin, isGroup, getSender, getMentioned, getQuoted } = require('../lib/helpers');
const { save, getGroup } = require('../lib/database');

async function requireAdmin(sock, jid, msg) {
  if (!isGroup(jid)) { await sock.sendMessage(jid, { text: '❌ Este comando solo funciona en grupos.' }); return false; }
  const sender = getSender(msg);
  const ok = await isAdmin(sock, jid, sender);
  if (!ok) await sock.sendMessage(jid, { text: '❌ Necesitas ser admin para usar este comando.' });
  return ok;
}

function getTarget(msg) {
  const mentioned = getMentioned(msg);
  if (mentioned.length) return mentioned[0];
  const quoted = getQuoted(msg);
  return quoted;
}

module.exports = {
  title: '✺ •• ┈┈ ⋯ Admins ⋯ ┈┈ •• ✺',
  commands: [
    {
      pattern: 'ban',
      desc: 'Banear usuario',
      handler: async (sock, jid, args, msg) => {
        if (!(await requireAdmin(sock, jid, msg))) return;
        const target = getTarget(msg);
        if (!target) return sock.sendMessage(jid, { text: '❌ Menciona o responde a un usuario.' });
        try {
          await sock.groupParticipantsUpdate(jid, [target], 'remove');
          await sock.sendMessage(jid, { text: '✅ Usuario baneado.' });
        } catch (e) { await sock.sendMessage(jid, { text: '❌ Error: ' + e.message }); }
      }
    },
    {
      pattern: 'sban',
      desc: 'Sticker ban (responder sticker)',
      handler: async (sock, jid, args, msg) => {
        if (!(await requireAdmin(sock, jid, msg))) return;
        const target = getTarget(msg);
        if (!target) return sock.sendMessage(jid, { text: '❌ Responde a un sticker enviado por el usuario a banear.' });
        try {
          await sock.groupParticipantsUpdate(jid, [target], 'remove');
          await sock.sendMessage(jid, { text: '🚫 Sticker ban aplicado.' });
        } catch (e) { await sock.sendMessage(jid, { text: '❌ ' + e.message }); }
      }
    },
    {
      pattern: 'warn',
      desc: 'Advertir usuario',
      handler: async (sock, jid, args, msg) => {
        if (!(await requireAdmin(sock, jid, msg))) return;
        const target = getTarget(msg);
        if (!target) return sock.sendMessage(jid, { text: '❌ Menciona o responde a un usuario.' });
        const g = getGroup(jid);
        g.mutes = g.mutes || {};
        const wKey = 'w_' + target;
        g.mutes[wKey] = (g.mutes[wKey] || 0) + 1;
        save();
        const warns = g.mutes[wKey];
        let extra = '';
        if (warns >= 3) {
          try { await sock.groupParticipantsUpdate(jid, [target], 'remove'); extra = '\n🚫 3 advertencias → baneado automáticamente.'; g.mutes[wKey] = 0; save(); } catch {}
        }
        await sock.sendMessage(jid, { text: `⚠️ Advertencia para @${target.split('@')[0]} (${warns}/3)${extra}`, mentions: [target] });
      }
    },
    {
      pattern: 'delwarn',
      desc: 'Eliminar advertencia',
      handler: async (sock, jid, args, msg) => {
        if (!(await requireAdmin(sock, jid, msg))) return;
        const target = getTarget(msg);
        if (!target) return sock.sendMessage(jid, { text: '❌ Menciona o responde a un usuario.' });
        const g = getGroup(jid);
        g.mutes['w_' + target] = 0; save();
        await sock.sendMessage(jid, { text: '✅ Advertencias eliminadas.' });
      }
    },
    {
      pattern: 'warnings',
      desc: 'Ver advertencias',
      handler: async (sock, jid, args, msg) => {
        if (!(await requireAdmin(sock, jid, msg))) return;
        const target = getTarget(msg) || getSender(msg);
        const g = getGroup(jid);
        const w = g.mutes?.['w_' + target] || 0;
        await sock.sendMessage(jid, { text: `⚠️ @${target.split('@')[0]} tiene ${w}/3 advertencias.`, mentions: [target] });
      }
    },
    {
      pattern: 'mute',
      desc: 'Silenciar usuario',
      handler: async (sock, jid, args, msg) => {
        if (!(await requireAdmin(sock, jid, msg))) return;
        const target = getTarget(msg);
        if (!target) return sock.sendMessage(jid, { text: '❌ Menciona o responde a un usuario.' });
        try {
          await sock.groupParticipantsUpdate(jid, [target], 'demote'); // quitar admin temporal - mejor: usar restrict
          const g = getGroup(jid);
          g.mutes = g.mutes || {};
          g.mutes[target] = true; save();
          await sock.sendMessage(jid, { text: '🔇 Usuario silenciado.' });
        } catch (e) { await sock.sendMessage(jid, { text: '❌ ' + e.message }); }
      }
    },
    {
      pattern: 'delmute',
      desc: 'Desilenciar usuario',
      handler: async (sock, jid, args, msg) => {
        if (!(await requireAdmin(sock, jid, msg))) return;
        const target = getTarget(msg);
        if (!target) return sock.sendMessage(jid, { text: '❌ Menciona o responde a un usuario.' });
        const g = getGroup(jid);
        if (g.mutes) delete g.mutes[target];
        save();
        await sock.sendMessage(jid, { text: '🔊 Usuario desilenciado.' });
      }
    },
    {
      pattern: 'open',
      desc: 'Abrir grupo',
      handler: async (sock, jid, args, msg) => {
        if (!(await requireAdmin(sock, jid, msg))) return;
        try { await sock.groupSettingUpdate(jid, 'not_announcement'); await sock.sendMessage(jid, { text: '🔓 Grupo abierto. Todos pueden hablar.' }); }
        catch (e) { await sock.sendMessage(jid, { text: '❌ ' + e.message }); }
      }
    },
    {
      pattern: 'close',
      desc: 'Cerrar grupo',
      handler: async (sock, jid, args, msg) => {
        if (!(await requireAdmin(sock, jid, msg))) return;
        try { await sock.groupSettingUpdate(jid, 'announcement'); await sock.sendMessage(jid, { text: '🔒 Grupo cerrado. Solo admins hablan.' }); }
        catch (e) { await sock.sendMessage(jid, { text: '❌ ' + e.message }); }
      }
    },
    {
      pattern: 'fijar',
      desc: 'Fijar mensaje',
      handler: async (sock, jid, args, msg) => {
        if (!(await requireAdmin(sock, jid, msg))) return;
        try {
          const quoted = msg.message.extendedTextMessage?.contextInfo?.stanzaId;
          if (!quoted) return sock.sendMessage(jid, { text: '❌ Responde al mensaje a fijar.' });
          await sock.sendMessage(jid, { pin: msg.message.extendedTextMessage.contextInfo.stanzaId, type: 1 });
          await sock.sendMessage(jid, { text: '📌 Mensaje fijado.' });
        } catch (e) { await sock.sendMessage(jid, { text: '❌ ' + e.message }); }
      }
    },
    {
      pattern: 'desfijar',
      desc: 'Desfijar mensaje',
      handler: async (sock, jid, args, msg) => {
        if (!(await requireAdmin(sock, jid, msg))) return;
        try {
          const quoted = msg.message.extendedTextMessage?.contextInfo?.stanzaId;
          if (quoted) await sock.sendMessage(jid, { pin: quoted, type: 2 });
          await sock.sendMessage(jid, { text: '📌 Mensaje desfijado.' });
        } catch (e) { await sock.sendMessage(jid, { text: '❌ ' + e.message }); }
      }
    },
    {
      pattern: 'namegp',
      desc: 'Cambiar nombre del grupo',
      handler: async (sock, jid, args, msg) => {
        if (!(await requireAdmin(sock, jid, msg))) return;
        if (!args) return sock.sendMessage(jid, { text: '❌ Uso: .namegp <nombre>' });
        try { await sock.groupUpdateSubject(jid, args); await sock.sendMessage(jid, { text: '✅ Nombre cambiado.' }); }
        catch (e) { await sock.sendMessage(jid, { text: '❌ ' + e.message }); }
      }
    },
    {
      pattern: 'desgp',
      desc: 'Cambiar descripción',
      handler: async (sock, jid, args, msg) => {
        if (!(await requireAdmin(sock, jid, msg))) return;
        try { await sock.groupUpdateDescription(jid, args || ''); await sock.sendMessage(jid, { text: '✅ Descripción actualizada.' }); }
        catch (e) { await sock.sendMessage(jid, { text: '❌ ' + e.message }); }
      }
    },
    {
      pattern: 'photogp',
      desc: 'Cambiar foto del grupo',
      handler: async (sock, jid, args, msg) => {
        if (!(await requireAdmin(sock, jid, msg))) return;
        const { downloadMsg } = require('../lib/media');
        const buf = await downloadMsg(msg);
        if (!buf) return sock.sendMessage(jid, { text: '❌ Responde a una imagen.' });
        try { await sock.updateProfilePicture(jid, buf); await sock.sendMessage(jid, { text: '✅ Foto actualizada.' }); }
        catch (e) { await sock.sendMessage(jid, { text: '❌ ' + e.message }); }
      }
    },
    {
      pattern: 'grupo',
      desc: 'Activar/desactivar grupo (abierto/cerrado)',
      handler: async (sock, jid, args, msg) => {
        if (!(await requireAdmin(sock, jid, msg))) return;
        if (args.includes('on')) {
          await sock.groupSettingUpdate(jid, 'not_announcement');
          await sock.sendMessage(jid, { text: '🔓 Grupo abierto.' });
        } else if (args.includes('off')) {
          await sock.groupSettingUpdate(jid, 'announcement');
          await sock.sendMessage(jid, { text: '🔒 Grupo cerrado.' });
        } else {
          await sock.sendMessage(jid, { text: '❌ Uso: .grupo on / .grupo off' });
        }
      }
    },
    {
      pattern: 'soloadmin',
      desc: 'Solo admins pueden cambiar info',
      handler: async (sock, jid, args, msg) => {
        if (!(await requireAdmin(sock, jid, msg))) return;
        try {
          if (args.includes('on')) { await sock.groupSettingUpdate(jid, 'locked'); await sock.sendMessage(jid, { text: '🔒 Info del grupo solo para admins.' }); }
          else { await sock.groupSettingUpdate(jid, 'unlocked'); await sock.sendMessage(jid, { text: '🔓 Info del grupo para todos.' }); }
        } catch (e) { await sock.sendMessage(jid, { text: '❌ ' + e.message }); }
      }
    },
    {
      pattern: 'welcome',
      desc: 'Bienvenida al entrar',
      handler: async (sock, jid, args, msg) => {
        if (!(await requireAdmin(sock, jid, msg))) return;
        const g = getGroup(jid);
        g.welcome = args.includes('on');
        save();
        await sock.sendMessage(jid, { text: g.welcome ? '✅ Bienvenida activada.' : '❌ Bienvenida desactivada.' });
      }
    }
  ]
};
