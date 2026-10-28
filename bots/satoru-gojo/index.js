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
const path = require('path');
const config = require('./config');
const { handleMessage } = require('./message-handler');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(question) {
  return new Promise(resolve => rl.question(question, answer => resolve(answer.trim())));
}

async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState(config.sessionPath);
  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`Usando Baileys v${version.join('.')} (latest: ${isLatest})`);

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false, // manejamos QR manualmente para preguntar antes
    logger: pino({ level: 'silent' }),
    browser: Browsers.baileys('Chrome'),
    syncFullHistory: false,
    markOnlineOnConnect: true
  });

  // Decidir método de autenticación si no hay credenciales guardadas
  const isFirstRun = !state.creds.me;
  let authMethod = null;
  let phoneNumber = null;

  if (isFirstRun) {
    console.log('\n=== ' + config.name + ' ' + config.version + ' ===');
    console.log('No hay sesión previa guardada. Elige el método de autenticación:');
    console.log('1) Pairing code (recomendado para Termux: introduce tu número y teclea el código en WhatsApp)');
    console.log('2) Código QR (escanéalo con la cámara de WhatsApp)');
    const choice = await ask('Opción [1/2]: ');

    if (choice === '2') {
      authMethod = 'qr';
      console.log(config.messages.qrPrompt);
    } else {
      authMethod = 'pairing';
      phoneNumber = await ask(config.messages.pairingCodePrompt);
      if (!phoneNumber.startsWith('+')) phoneNumber = '+' + phoneNumber.replace(/\D/g, '');
      console.log(`Usando número: ${phoneNumber}`);
    }
  }

  let pairingRequested = false;

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    // Cuando Baileys está esperando a que se vincule el dispositivo (momento del QR),
    // solicitamos el pairing code si ese fue el método elegido.
    if (qr && authMethod === 'pairing' && phoneNumber && !pairingRequested) {
      pairingRequested = true;
      try {
        const code = await sock.requestPairingCode(phoneNumber);
        const pretty = (code || '').match(/.{1,4}/g)?.join('-') || code;
        console.log('\n═══════════════════════════════════');
        console.log(` Tu código de pairing es:  ${pretty}`);
        console.log(' Introdúcelo en WhatsApp →');
        console.log(' Dispositivos vinculados →');
        console.log(' Vincular con código');
        console.log('═══════════════════════════════════\n');
      } catch (err) {
        console.error('Error pidiendo pairing code:', err.message);
        console.log('Reinicia el bot e intenta nuevamente.');
      }
    }

    if (qr && authMethod === 'qr') {
      qrcode.generate(qr, { small: true });
      console.log('(Si el QR expira, reinicia el bot para obtener uno nuevo)');
    }

    if (connection === 'open') {
      const me = sock.user;
      const tag = me.id.split(':')[0];
      console.log(`\n${config.messages.connected} ${me.name || config.name} (${tag})\n`);
    }

    if (connection === 'close') {
      const reason = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = reason !== DisconnectReason.loggedOut;
      console.log(`${config.messages.disconnected} ${reason || 'desconocido'}`);
      if (shouldReconnect) {
        console.log('Reconectando...');
        connectToWhatsApp();
      } else {
        console.log('Sesión cerrada (logged out). Elimina la carpeta "auth" y vuelve a iniciar para volver a escanear/parear.');
        process.exit(1);
      }
    }
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async (m) => {
    const msg = m.messages[0];
    if (!msg.key) return;
    await handleMessage(sock, msg);
  });
}

connectToWhatsApp().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
