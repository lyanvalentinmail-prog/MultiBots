// Sub-bots (multi-session). Funcionalidad básica.
const config = require('../config');
const fs = require('fs');
const path = require('path');

function listSessions() {
  try {
    const authDir = path.join(__dirname,'..','subbots');
    if (!fs.existsSync(authDir)) fs.mkdirSync(authDir,{recursive:true});
    return fs.readdirSync(authDir).filter(f => fs.statSync(path.join(authDir,f)).isDirectory());
  } catch { return []; }
}

module.exports = {
  title: '✺ •• ┈┈ ⋯ Sub bot ⋯ ┈┈ •• ✺',
  commands: [
    { pattern: 'qr', desc: 'Muestra QR del bot principal', handler: async (sock,jid)=>{
      await sock.sendMessage(jid,{text:'📱 El QR solo se muestra al iniciar el bot por consola (Termux). Elimina la carpeta `bots/satoru-gojo/auth` y reinicia para obtener un QR nuevo.'});
    }},
    { pattern: 'code', desc: 'Pairing code (re-inicio requerido)', handler: async (sock,jid)=>{
      await sock.sendMessage(jid,{text:'🔢 Para obtener un pairing code nuevo, elimina la carpeta `bots/satoru-gojo/auth` y reinicia el bot en Termux seleccionando la opción 1.'});
    }},
    { pattern: 'bots', desc: 'Listar sub-bots', handler: async (sock,jid)=>{
      const sessions = listSessions();
      await sock.sendMessage(jid,{text:`🤖 *Sub-bots activos*\nPrincipal: ${config.name}\n${sessions.length?sessions.map(s=>'• '+s).join('\n'):'(sin sub-bots)'}`});
    }},
    { pattern: 'bot info', desc: 'Info del sub-bot', handler: async (sock,jid)=>{
      await sock.sendMessage(jid,{text:`ℹ️ ${config.name} v${config.version}\nSesión principal.`});
    }},
    {
      pattern: 'setbotname',
      desc: 'Cambiar nombre del bot (solo visual)',
      handler: async (sock,jid,args)=>{
        if (!args) return sock.sendMessage(jid,{text:'❌ Uso: .setbotname <nombre>'});
        config.name = args;
        await sock.sendMessage(jid,{text:'✅ Nombre: '+args});
      }
    },
    {
      pattern: 'setbotimg',
      desc: 'Cambiar avatar del bot',
      handler: async (sock,jid,a,msg)=>{
        const { downloadMsg } = require('../lib/media');
        const buf = await downloadMsg(msg);
        if (!buf) return sock.sendMessage(jid,{text:'❌ Responde a una imagen.'});
        try { await sock.updateProfilePicture(sock.user.id, buf); await sock.sendMessage(jid,{text:'✅ Avatar actualizado.'}); }
        catch (e) { await sock.sendMessage(jid,{text:'❌ '+e.message}); }
      }
    },
    { pattern: 'autoread', desc: 'Auto-lectura de mensajes', handler: async (sock,jid,a)=>{
      await sock.sendMessage(jid,{text:`👁️ Auto-read: ${a.includes('on')?'activado':'desactivado'} (configuración no persistente en esta versión).`});
    }}
  ]
};
