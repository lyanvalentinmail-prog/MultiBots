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
      await sock.sendMessage(jid,{text:'📱 *Código QR*\n\nEl QR sólo se muestra en la consola de Termux al arrancar el bot.\n\nPara obtener uno nuevo:\n1. `.delsession` (solo owner) — borra la sesión actual\n2. En Termux: `npm run qr`\n\nSi ya estás vinculado no hace falta nada: la sesión se guarda en `bots/satoru-gojo/auth/`.'});
    }},
    { pattern: 'code', desc: 'Pairing code (re-inicio requerido)', handler: async (sock,jid)=>{
      await sock.sendMessage(jid,{text:'🔢 *Pairing code (8 dígitos)*\n\nSe genera en la consola de Termux al vincular por primera vez:\n\n• `npm run pairing` → te pregunta el número\n• `npm run pairing -- 59896719709` → va directo\n• `npm start` → opción 1\n\nLuego en WhatsApp: ⋮ → Dispositivos vinculados → Vincular un dispositivo → *Vincular con código de teléfono* → escribe el código (caduca en ~60 s).\n\n¿No aparece el código?\n1. `npm run doctor` — diagnóstico (Node/Web Crypto/sesión)\n2. `npm run reset` — limpia una sesión a medias y vuelve a pedirlo\n3. Node 18 o inferior: `pkg install nodejs` (el bot ya parchea la Web Crypto, pero conviene actualizar)'});
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
