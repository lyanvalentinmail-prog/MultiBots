const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const readline = require('readline');
const pino = require('pino');
const fs = require('fs');
const config = require('./config');
const { handleMessage } = require('./message-handler');
const { getGroup, save } = require('./lib/database');
const { isGroup } = require('./lib/helpers');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(question) {
  return new Promise(resolve => {
    rl.question(question, answer => resolve((answer || '').trim()));
  });
}

/**
 * Solicita el pairing code y lo muestra formateado.
 * Baileys requiere el número SÓLO con dígitos, código de país incluido, SIN '+' ni espacios.
 * Ejemplos válidos: "59896719709", "5491112345678", "34612345678", "5215512345678"
 */
async function requestAndShowCode(sock, phoneDigits) {
  const maxRetries = 5;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`\n🔑 Solicitando código (intento ${attempt}/${maxRetries})...`);
      // Baileys pide el número sin '+'
      const code = await sock.requestPairingCode(phoneDigits);
      if (code) {
        const clean = String(code).toUpperCase().replace(/[^A-Z0-9]/g, '');
        const pretty = clean.match(/.{1,4}/g)?.join('-') || clean;
        console.log('\n═══════════════════════════════════════════════');
        console.log('  ✅  Tu código de pairing es:');
        console.log(`               ${pretty}`);
        console.log('');
        console.log('  1) Abre WhatsApp en tu teléfono');
        console.log('  2) Toca ⋮ → Dispositivos vinculados');
        console.log('  3) Toca "Vincular un dispositivo"');
        console.log('  4) Pulsa "Vincular con código de teléfono"');
        console.log(`  5) Introduce:  ${pretty}`);
        console.log('═══════════════════════════════════════════════\n');
        return true;
      }
    } catch (err) {
      console.error(`❌ Error (intento ${attempt}):`, err?.message || err);
      if (attempt < maxRetries) {
        console.log('⏳ Reintentando en 3 segundos...');
        await new Promise(r => setTimeout(r, 3000));
      }
    }
  }
  console.log('\n❌ No se pudo obtener el código. Reinicia con `npm run satoru`.');
  console.log('   Prueba el método QR (opción 2) si el problema persiste.\n');
  return false;
}

async function promptAuthMethod() {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log(`║   ${config.name} v${config.version}`.padEnd(42) + '║');
  console.log('╚══════════════════════════════════════════╝\n');
  console.log('Elige el método de inicio de sesión:');
  console.log('');
  console.log('  1) 🔢 Pairing code  (RECOMENDADO para Termux)');
  console.log('       Introduces tu número y tecleas el código en WhatsApp');
  console.log('');
  console.log('  2) 📷 Código QR');
  console.log('       Muestra un QR para escanear con la cámara');
  console.log('');

  let choice = await ask('Opción [1/2]: ');
  while (!['1', '2'].includes(choice)) {
    choice = await ask('Por favor escribe 1 o 2: ');
  }

  if (choice === '2') {
    return { method: 'qr', phone: null };
  }

  console.log('');
  console.log('Introduce tu número de WhatsApp con código de país,');
  console.log('SIN el signo +, SIN espacios ni guiones.');
  console.log('Ejemplos:');
  console.log('  Uruguay:   59896719709');
  console.log('  Argentina: 5491112345678');
  console.log('  México:    5215512345678');
  console.log('  España:    34612345678');
  console.log('');

  let raw = await ask('Número: ');
  let digits = raw.replace(/\D/g, '');

  // Si el usuario escribió con '+' al principio, lo quitamos (ya lo hace replace)
  // Si el número empieza con 0 (formato local) pedimos que lo quite
  while (digits.length < 6 || digits.length > 15) {
    console.log(`\n❌ Leí "${digits}" (${digits.length} dígitos). No parece válido.`);
    console.log('Debe ser sólo dígitos con código de país, sin + ni espacios.');
    raw = await ask('Número: ');
    digits = raw.replace(/\D/g, '');
  }

  console.log(`\n✅ Número: +${digits}`);
  return { method: 'pairing', phone: digits };
}

async function connectToWhatsApp() {
  const AUTH_DIR = config.sessionPath;

  // Detectar si ya hay sesión guardada ANTES de crear el socket
  const hasSession = fs.existsSync(AUTH_DIR) && fs.readdirSync(AUTH_DIR).length > 0;

  let authMethod = 'qr';
  let phoneNumberDigits = null;

  if (!hasSession) {
    const auth = await promptAuthMethod();
    authMethod = auth.method;
    phoneNumberDigits = auth.phone;
    console.log('⏳ Iniciando conexión con WhatsApp...\n');
  } else {
    console.log('🔓 Sesión guardada detectada, conectando...');
  }

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();
  console.log(`🔌 Baileys v${version.join('.')}`);

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    logger: pino({ level: 'silent' }),
    // UA real para que no bloqueen
    browser: ['Chrome (Linux)', 'Chrome', '120.0.0.0'],
    syncFullHistory: false,
    markOnlineOnConnect: true
  });

  let pairingRequested = false;
  let qrShown = false;

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    // === PAIRING CODE ===
    // Pedimos el código en el PRIMER evento QR (momento en que WhatsApp
    // está esperando la vinculación). Si lo pedimos antes o después, falla.
    if (authMethod === 'pairing' && phoneNumberDigits && qr && !pairingRequested) {
      pairingRequested = true;
      await requestAndShowCode(sock, phoneNumberDigits);
    }

    // === QR ===
    if (qr && authMethod === 'qr') {
      if (!qrShown) {
        console.log('\n📷 Escanea este código QR con tu WhatsApp:\n');
      }
      qrcode.generate(qr, { small: true });
      qrShown = true;
      console.log('(Si el QR expira, espera al nuevo)');
    }

    // === CONECTADO ===
    if (connection === 'open') {
      const me = sock.user;
      const tag = me.id.split(':')[0];
      console.log('\n═══════════════════════════════════════════════');
      console.log(` ✅ ${config.messages.connected}`);
      console.log(`    ${me.name || config.name}  (${tag})`);
      console.log('═══════════════════════════════════════════════\n');
    }

    // === DESCONEXIÓN ===
    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const errMsg = lastDisconnect?.error?.output?.payload?.error || lastDisconnect?.error?.message || statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut || statusCode === 401;
      const restart = statusCode === DisconnectReason.restartRequired;

      console.log(`\n⚠️  Desconectado (${errMsg})`);

      if (loggedOut) {
        console.log('❌ Sesión cerrada. Borra la carpeta `bots/satoru-gojo/auth` y reinicia.');
        process.exit(1);
      }
      if (restart) {
        console.log('🔄 Reinicio requerido, reconectando en 3s...');
        setTimeout(connectToWhatsApp, 3000);
        return;
      }
      console.log('🔄 Reconectando...');
      pairingRequested = false;
      setTimeout(connectToWhatsApp, 2000);
    }
  });

  sock.ev.on('creds.update', saveCreds);

  // Bienvenida
  sock.ev.on('group-participants.update', async (update) => {
    const { id, participants, action } = update;
    try {
      const g = getGroup(id);
      if (g.welcome && action === 'add') {
        for (const p of participants) {
          await sock.sendMessage(id, {
            text: `👋 ¡Bienvenido/a @${p.split('@')[0]} al grupo!\nSoy *${config.name}*, escribe "menu" para ver lo que puedo hacer.`,
            mentions: [p]
          });
        }
      }
    } catch (e) { console.error('welcome:', e.message); }
  });

  // Anti-delete
  sock.ev.on('messages.update', async (updates) => {
    for (const u of updates) {
      try {
        const jid = u.key.remoteJid;
        if (!isGroup(jid)) continue;
        const g = getGroup(jid);
        if (!g.antidelete) continue;
        if (u.update?.message === null || u.update?.status === 3) {
          await sock.sendMessage(jid, {
            text: `🚫 @${u.key.participant?.split('@')[0] || u.key.remoteJid?.split('@')[0]} borró un mensaje.`,
            mentions: u.key.participant ? [u.key.participant] : []
          });
        }
      } catch {}
    }
  });

  sock.ev.on('messages.upsert', async (m) => {
    const msg = m.messages[0];
    if (!msg?.key) return;
    try { await handleMessage(sock, msg); } catch (e) { console.error('msg:', e.message); }
  });
}

connectToWhatsApp().catch(err => {
  console.error('❌ Error fatal:', err);
  process.exit(1);
});
