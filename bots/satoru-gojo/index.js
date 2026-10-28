const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  Browsers,
  fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const readline = require('readline');
const pino = require('pino');
const config = require('./config');
const { handleMessage } = require('./message-handler');
const { getGroup, save } = require('./lib/database');
const { isGroup } = require('./lib/helpers');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(question) {
  return new Promise(resolve => rl.question(question, answer => resolve(answer.trim())));
}

/**
 * Solicita el pairing code y lo muestra formateado.
 * Importante: Baileys requiere el número SÓLO con dígitos, código de país incluido, SIN '+' ni espacios.
 * Ejemplos válidos: "59896719709", "5491112345678", "34612345678"
 */
async function requestAndShowCode(sock, phoneDigits) {
  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`\n🔑 Solicitando código de pairing (intento ${attempt}/${maxRetries})...`);
      const code = await sock.requestPairingCode(phoneDigits);
      if (code) {
        const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
        const pretty = clean.match(/.{1,4}/g)?.join('-') || clean;
        console.log('\n═══════════════════════════════════════════════');
        console.log('  ✅  Tu código de pairing es:');
        console.log(`           ${pretty}`);
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
      console.error(`❌ Error solicitando pairing code (intento ${attempt}):`, err?.message || err);
      if (attempt < maxRetries) {
        console.log('⏳ Reintentando en 3 segundos...');
        await new Promise(r => setTimeout(r, 3000));
      }
    }
  }
  console.log('\n❌ No se pudo obtener el pairing code tras varios intentos.');
  console.log('   Reinicia el bot con "npm run satoru" y vuelve a intentarlo.');
  console.log('   Si sigue fallando, prueba el método QR (opción 2).\n');
  return false;
}

async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState(config.sessionPath);
  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`🔌 Usando Baileys v${version.join('.')} (latest: ${isLatest})`);

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    logger: pino({ level: 'silent' }),
    // Usa un browser UA real para que el pairing funcione (WhatsApp valida UA)
    browser: ['Satoru Gojo', 'Chrome', '120.0.0.0'],
    syncFullHistory: false,
    markOnlineOnConnect: true,
    // No generar QR automáticamente (lo controlamos nosotros)
    generateHighQualityLinkPreview: false
  });

  // Decidir método de autenticación
  const isFirstRun = !state.creds.me;
  let authMethod = null;
  let phoneNumberDigits = null; // SOLO dígitos, sin '+'

  if (isFirstRun) {
    console.log('\n╔══════════════════════════════════════════╗');
    console.log(`║   ${config.name} v${config.version}`.padEnd(42) + '║');
    console.log('╚══════════════════════════════════════════╝\n');
    console.log('No hay sesión previa. Elige el método de inicio:');
    console.log('');
    console.log('  1) 🔢 Pairing code  (RECOMENDADO para Termux)');
    console.log('       Introduces tu número y tecleas un código de 8 caracteres en WhatsApp');
    console.log('');
    console.log('  2) 📷 Código QR');
    console.log('       Muestra un QR para escanear con la cámara de WhatsApp');
    console.log('');
    const choice = await ask('Opción [1/2]: ');

    if (choice === '2') {
      authMethod = 'qr';
      console.log('\n📷 Modo QR activado. Escanea el QR cuando aparezca:\n');
    } else {
      authMethod = 'pairing';
      console.log('');
      const raw = await ask('📱 Tu número (con código de país, sin +, ej: 59896719709): ');
      phoneNumberDigits = raw.replace(/\D/g, '');
      if (phoneNumberDigits.length < 8) {
        console.error('❌ Número inválido. Debe incluir código de país. Ej: 59896719709');
        process.exit(1);
      }
      console.log(`✅ Número registrado: +${phoneNumberDigits}`);
      console.log('⏳ Esperando a que WhatsApp esté listo para solicitar el código...');
    }
  } else {
    console.log('🔓 Sesión guardada detectada, conectando...');
  }

  let pairingRequested = false;
  let qrShown = false;

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr, isNewLogin } = update;

    // === PAIRING CODE ===
    // El momento correcto para solicitar el pairing code es cuando WhatsApp emite
    // un QR (significa que está esperando un dispositivo vinculado). Pedimos el
    // código INSTEAD de mostrar el QR. También cubrimos el caso de "isNewLogin"
    // que dispara en algunas versiones.
    if (authMethod === 'pairing' && phoneNumberDigits && !pairingRequested && (qr || isNewLogin || connection === 'connecting')) {
      // Solo pedimos cuando realmente hay QR disponible (momento exacto del handshake)
      if (qr) {
        pairingRequested = true;
        await requestAndShowCode(sock, phoneNumberDigits);
      }
    }

    // Fallback de seguridad: si pasaron 10 segundos desde que conectamos y no
    // se pidió el código, intentamos pedirlo
    if (authMethod === 'pairing' && phoneNumberDigits && !pairingRequested && connection !== 'open') {
      setTimeout(async () => {
        if (!pairingRequested && sock.user === undefined) {
          pairingRequested = true;
          await requestAndShowCode(sock, phoneNumberDigits);
        }
      }, 10000);
    }

    // === QR ===
    if (qr && authMethod === 'qr') {
      qrcode.generate(qr, { small: true });
      console.log('(Si el QR expira o no aparece, reinicia con Ctrl+C y vuelve a correr `npm run satoru`)');
      qrShown = true;
    }

    // === CONEXIÓN EXITOSA ===
    if (connection === 'open') {
      const me = sock.user;
      const tag = me.id.split(':')[0];
      console.log('\n═══════════════════════════════════════════════');
      console.log(` ✅ ${config.messages.connected}`);
      console.log(`    ${me.name || config.name}  (${tag})`);
      console.log('═══════════════════════════════════════════════\n');
    }

    // === RECONEXIÓN / DESCONEXIÓN ===
    if (connection === 'close') {
      const reason = lastDisconnect?.error?.output?.statusCode;
      const reasonName = lastDisconnect?.error?.output?.payload?.error || reason;
      const loggedOut = reason === DisconnectReason.loggedOut || reason === 401;
      const restartRequired = reason === DisconnectReason.restartRequired;
      console.log(`\n⚠️  Desconectado. Razón: ${reasonName || reason || 'desconocida'}`);
      if (loggedOut) {
        console.log('❌ Sesión cerrada (logged out).');
        console.log('   Borra la carpeta `bots/satoru-gojo/auth` y reinicia el bot.');
        process.exit(1);
      }
      if (restartRequired) {
        console.log('🔄 Reinicio requerido por WhatsApp. Reconectando en 3s...');
        setTimeout(connectToWhatsApp, 3000);
        return;
      }
      console.log('🔄 Reconectando...');
      pairingRequested = false; // permitir volver a pedir código si hace falta
      setTimeout(connectToWhatsApp, 2000);
    }
  });

  sock.ev.on('creds.update', saveCreds);

  // Evento: bienvenida al entrar a grupo
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
    } catch (e) { console.error('welcome error:', e.message); }
  });

  // Evento: anti-delete
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
    try { await handleMessage(sock, msg); } catch (e) { console.error('msg error:', e.message); }
  });
}

connectToWhatsApp().catch(err => {
  console.error('❌ Error fatal:', err);
  process.exit(1);
});
