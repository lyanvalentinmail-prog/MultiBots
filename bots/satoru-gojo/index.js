'use strict';

/**
 * Satoru Gojo — conexión a WhatsApp (Baileys).
 *
 * Métodos de login:
 *   1) 🔢 Pairing code (8 dígitos, recomendado en Termux: no hay que escanear nada)
 *   2) 📷 Código QR
 *
 * Uso no interactivo (útil en Termux, tmux o cuando stdin no es una TTY):
 *   node bots/satoru-gojo/index.js --pairing 59896719709
 *   node bots/satoru-gojo/index.js --qr
 *   node bots/satoru-gojo/index.js --reset      # borra la sesión guardada
 *   MB_PAIRING_NUMBER=59896719709 node bots/satoru-gojo/index.js
 */

/* ------------------------------------------------------------------ *
 * 0) PARCHES DE ENTORNO — DEBEN IR ANTES DE REQUERIR BAILEYS
 *
 * En Node 18 (el que instala `pkg install nodejs-lts` en Termux) no existe
 * `globalThis.crypto`, y Baileys lo usa para derivar la clave del pairing
 * code. Sin este parche `requestPairingCode()` lanza
 * "ReferenceError: crypto is not defined" y el código nunca aparece,
 * aunque el QR sí funcione.
 * ------------------------------------------------------------------ */
const runtime = require('./lib/runtime');
const cryptoFix = runtime.patchWebCrypto();

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  DEFAULT_CONNECTION_CONFIG,
  Browsers
} = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const readline = require('readline');
const pino = require('pino');
const fs = require('fs');
const config = require('./config');
const { handleMessage } = require('./message-handler');
const { getGroup, save } = require('./lib/database');
const { isGroup } = require('./lib/helpers');

const NODE = runtime.nodeInfo();
const AUTH_DIR = config.sessionPath;

/* ------------------------------------------------------------------ *
 * 1) Entrada por consola
 * ------------------------------------------------------------------ */

let rl = null;
function getRl() {
  if (!rl) {
    rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: !!process.stdin.isTTY });
  }
  return rl;
}
function closeRl() {
  if (rl) { try { rl.close(); } catch {} rl = null; }
}
function ask(question, timeoutMs = 0) {
  return new Promise(resolve => {
    const iface = getRl();
    let done = false;
    let timer = null;
    const finish = value => {
      if (done) return;
      done = true;
      if (timer) clearTimeout(timer);
      resolve((value || '').trim());
    };
    if (timeoutMs > 0) timer = setTimeout(() => finish(''), timeoutMs);
    iface.question(question, finish);
  });
}

const IS_TTY = !!process.stdin.isTTY;

/* ------------------------------------------------------------------ *
 * 2) Argumentos / variables de entorno
 * ------------------------------------------------------------------ */

function parseArgs(argv) {
  const args = { method: null, phone: null, reset: false };
  const list = argv.slice(2);
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (a === '--qr' || a === '--qrcode') args.method = 'qr';
    else if (a === '--pairing' || a === '--pair' || a === '--code' || a === '-p') {
      args.method = 'pairing';
      const next = list[i + 1];
      if (next && !next.startsWith('--')) { args.phone = next; i++; }
    } else if (a === '--reset' || a === '--clean' || a === '--logout') args.reset = true;
    else if (a.startsWith('--number=')) args.phone = a.split('=')[1];
    else if (a.startsWith('--pairing=')) { args.method = 'pairing'; args.phone = a.split('=')[1]; }
  }
  const envMethod = String(process.env.MB_AUTH_METHOD || '').toLowerCase();
  if (!args.method && (envMethod === 'qr' || envMethod === 'pairing')) args.method = envMethod;
  if (!args.phone && process.env.MB_PAIRING_NUMBER) args.phone = process.env.MB_PAIRING_NUMBER;
  return args;
}

const CLI = parseArgs(process.argv);

/* ------------------------------------------------------------------ *
 * 3) Selección del método de login
 * ------------------------------------------------------------------ */

function printBanner() {
  const title = `${config.name} v${config.version}`;
  const width = Math.max(44, title.length + 6);
  const line = '═'.repeat(width);
  const pad = ' '.repeat(Math.max(0, width - title.length - 3));
  console.log(`\n╔${line}╗`);
  console.log(`║   ${title}${pad}║`);
  console.log(`╚${line}╝`);
  let baileysVersion = '?';
  try { baileysVersion = require('@whiskeysockets/baileys/package.json').version; } catch {}
  console.log(`   Node ${NODE.version}${NODE.isTermux ? ' · Termux' : ''} · Baileys ${baileysVersion}`);
}

async function promptAuthMethod() {
  console.log('\nElige el método de inicio de sesión:\n');
  console.log('  1) 🔢 Pairing code  (RECOMENDADO en Termux)');
  console.log('       Escribes tu número y tecleas un código de 8 dígitos en WhatsApp');
  console.log('');
  console.log('  2) 📷 Código QR');
  console.log('       Muestra un QR para escanear con la cámara');
  console.log('');

  let choice = await ask('Opción [1/2]: ');
  let guard = 0;
  while (!['1', '2'].includes(choice) && guard++ < 5) {
    choice = await ask('Por favor escribe 1 o 2: ');
  }
  if (!['1', '2'].includes(choice)) return { method: 'qr', phone: null };

  if (choice === '2') return { method: 'qr', phone: null };

  console.log('\nIntroduce tu número de WhatsApp con código de país,');
  console.log('SIN el signo +, SIN espacios ni guiones.');
  console.log('Ejemplos:');
  console.log('  Uruguay:   59896719709');
  console.log('  Argentina: 5491112345678');
  console.log('  México:    5215512345678');
  console.log('  España:    34612345678\n');

  for (let i = 0; i < 5; i++) {
    const raw = await ask('Número: ');
    if (!raw) break;
    const { digits, valid, warnings } = runtime.normalizePhone(raw);
    if (valid) {
      warnings.forEach(w => console.log(`⚠️  ${w}`));
      console.log(`\n✅ Número: +${digits}`);
      return { method: 'pairing', phone: digits };
    }
    console.log(`\n❌ Leí "${digits}" (${digits.length} dígitos): no parece un número internacional válido.`);
    console.log('   Debe llevar código de país, sin el 0 de la troncal local (ej. 0598... → 598...).');
  }
  console.log('\n↩️  Sin número válido: se usará el QR.\n');
  return { method: 'qr', phone: null };
}

/* ------------------------------------------------------------------ *
 * 4) Pairing code
 * ------------------------------------------------------------------ */

function prettyCode(code) {
  const clean = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return clean.match(/.{1,4}/g)?.join('-') || clean;
}

function withTimeout(promise, ms, label) {
  let timer;
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${label}: tiempo de espera agotado (${ms} ms)`)), ms); })
  ]);
}

async function requestAndShowCode(sock, phoneDigits) {
  // Comprobación previa: si la Web Crypto no funciona, ni lo intentamos
  // (evita 5 reintentos inútiles y un mensaje confuso).
  const cryptoOk = await runtime.verifyPairingCrypto();
  if (!cryptoOk.ok) {
    console.error('\n❌ Este Node no puede generar el pairing code (falta Web Crypto).');
    console.error(`   Motivo: ${cryptoOk.error}`);
    console.error(`   Node detectado: ${NODE.version}. Actualiza con:  pkg install nodejs`);
    return false;
  }
  if (typeof sock?.requestPairingCode !== 'function') {
    console.error('❌ La versión de Baileys instalada no soporta requestPairingCode().');
    console.error('   Ejecuta:  npm install @whiskeysockets/baileys@^6.7.16');
    return false;
  }

  const maxRetries = 2;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`\n🔑 Solicitando código para +${phoneDigits} (intento ${attempt}/${maxRetries})...`);
      // Baileys quiere el número SIN '+' y sólo con dígitos.
      const code = await withTimeout(sock.requestPairingCode(phoneDigits), 20000, 'requestPairingCode');
      if (!code) throw new Error('WhatsApp no devolvió ningún código');

      const pretty = prettyCode(code);
      console.log('\n═══════════════════════════════════════════════');
      console.log('  ✅  Tu código de pairing es:');
      console.log(`               ${pretty}`);
      console.log('');
      console.log('  1) Abre WhatsApp en tu teléfono');
      console.log('  2) Toca ⋮ → Dispositivos vinculados');
      console.log('  3) Toca "Vincular un dispositivo"');
      console.log('  4) Pulsa "Vincular con código de teléfono"');
      console.log(`  5) Introduce:  ${pretty}`);
      console.log('');
      console.log('  ⏱️  El código caduca en ~60 segundos. No cierres Termux.');
      console.log('═══════════════════════════════════════════════\n');
      return true;
    } catch (err) {
      console.error(`❌ Error (intento ${attempt}/${maxRetries}):`, err?.message || err);
      if (attempt < maxRetries) {
        console.log('⏳ Reintentando en 3 s...');
        await new Promise(r => setTimeout(r, 3000));
      }
    }
  }
  return false;
}

/* ------------------------------------------------------------------ *
 * 5) Conexión
 * ------------------------------------------------------------------ */

const MAX_PAIRING_ATTEMPTS = 3;

let currentSock = null;
let reconnectTimer = null;
let reconnectDelay = 2000;
let closing = false;

/* Estado de autenticación a nivel de módulo: debe sobrevivir a las
 * reconexiones internas (si fuera local a connect(), cada reintento volvería
 * a preguntar el número con el readline ya cerrado y se quedaría colgado). */
const authState = {
  resolved: false,        // ¿ya elegimos método?
  announced: false,       // ¿ya anunciamos el método por consola?
  method: CLI.method,     // 'pairing' | 'qr' | null (sesión ya vinculada)
  phone: null,
  pairingRequested: false,
  pairingAttempts: 0,
  fellBackToQr: false,
  qrShown: false
};

function endCurrentSocket() {
  const s = currentSock;
  currentSock = null;
  if (!s) return;
  try { s.ev.removeAllListeners(); } catch {}
  try { s.removeAllListeners?.(); } catch {}
  try { s.end?.(); } catch {}
  try { s.ws?.close?.(); } catch {}
}

function scheduleReconnect(reason) {
  if (closing || reconnectTimer) return;
  console.log(`🔄 Reconectando en ${Math.round(reconnectDelay / 1000)} s... (${reason})`);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    reconnectDelay = Math.min(reconnectDelay * 2, 30000);
    connect().catch(err => {
      console.error('❌ Error al reconectar:', err?.message || err);
      scheduleReconnect('error en connect()');
    });
  }, reconnectDelay);
}

async function resolveBaileysVersion() {
  try {
    // Con timeout: en Termux `raw.githubusercontent.com` suele estar lento o
    // bloqueado y sin esto el arranque se queda colgado minutos.
    const { version, isLatest } = await fetchLatestBaileysVersion({ timeout: 5000 });
    if (Array.isArray(version)) {
      console.log(`🔌 Baileys: WA v${version.join('.')} ${isLatest ? '(actualizada)' : '(por defecto, sin red)'}`);
      return version;
    }
  } catch (err) {
    console.log('⚠️  No se pudo consultar la última versión de WA, usando la integrada.');
  }
  return DEFAULT_CONNECTION_CONFIG?.version || [2, 3000, 1019707846];
}

async function connect() {
  if (closing) return;

  /* --- Estado de la sesión guardada --- */
  const sess = runtime.sessionState(AUTH_DIR);

  if (sess.valid) {
    if (!authState.resolved) {
      console.log(`🔓 Sesión guardada detectada (${sess.number || 'desconocida'}), conectando...`);
      authState.resolved = true;
      authState.method = null; // ya estamos vinculados
      closeRl();
    }
  } else if (!authState.resolved) {
    if (sess.exists) {
      console.log(`🧹 ${sess.reason}`);
      console.log(`   Limpiando ${AUTH_DIR} para poder vincular de nuevo...`);
      runtime.clearSession(AUTH_DIR);
    }

    let method = CLI.method;
    let phone = CLI.phone ? runtime.normalizePhone(CLI.phone).digits : null;

    if (!method || (method === 'pairing' && !phone)) {
      if (IS_TTY) {
        const chosen = await promptAuthMethod();
        method = chosen.method;
        phone = chosen.phone;
      } else {
        console.log('ℹ️  stdin no es una terminal interactiva: no puedo pedirte el número.');
        console.log('   Lanza:  node bots/satoru-gojo/index.js --pairing <número>');
        console.log('   ...o se mostrará un QR para escanear.');
        method = 'qr';
        phone = null;
      }
    }

    authState.method = method === 'pairing' && phone ? 'pairing' : 'qr';
    authState.phone = authState.method === 'pairing' ? phone : null;
    authState.resolved = true;

    // Ya no hace falta leer más del teclado: soltamos stdin para no pelear
    // con el proceso padre (npm start) ni bloquear la TTY de Termux.
    closeRl();
  }

  // Anunciar el método una sola vez: si se repite en cada reconexión la
  // consola de Termux se llena de ruido durante un corte de red.
  if (!authState.announced) {
    authState.announced = true;
    if (authState.method === 'pairing') {
      console.log(`🔢 Método: pairing code para +${authState.phone}`);
    } else if (authState.method === 'qr') {
      console.log('📷 Método: código QR');
    }
    console.log('⏳ Conectando con WhatsApp...\n');
  }

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const version = await resolveBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    logger: pino({ level: 'silent' }),
    // UA de escritorio coherente: "Chrome (Ubuntu)". Con la anterior
    // ('Chrome (Linux)','Chrome',...) WhatsApp recibía "Chrome (Chrome (Linux))".
    browser: Browsers?.ubuntu ? Browsers.ubuntu('Chrome') : ['Ubuntu', 'Chrome', '22.04'],
    syncFullHistory: false,
    markOnlineOnConnect: true,
    emitOwnEvents: false,
    connectTimeoutMs: 30000
  });

  currentSock = sock;
  authState.qrShown = false;

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    /* === PAIRING CODE ===
     * Se pide en el PRIMER evento `qr`: es el momento en que WhatsApp está
     * esperando la vinculación. Antes el socket aún no está listo y después
     * la referencia caduca. */
    if (qr && authState.method === 'pairing' && !authState.pairingRequested && !authState.fellBackToQr) {
      authState.pairingRequested = true;
      authState.pairingAttempts++;
      const ok = await requestAndShowCode(sock, authState.phone);
      if (!ok) {
        // Permitimos reintentar en el próximo ciclo de QR; si se agotan los
        // intentos, caemos al QR para que el usuario no se quede tirado.
        authState.pairingRequested = false;
        if (authState.pairingAttempts >= MAX_PAIRING_ATTEMPTS) {
          authState.fellBackToQr = true;
          console.log('\n⚠️  No se pudo obtener el pairing code. Cambiando al método QR...\n');
        }
      }
      return;
    }

    /* === QR === */
    if (qr && (authState.method === 'qr' || authState.fellBackToQr)) {
      if (!authState.qrShown) console.log('\n📷 Escanea este código QR con tu WhatsApp:\n');
      qrcode.generate(qr, { small: true });
      authState.qrShown = true;
      console.log('(Si el QR expira, espera al nuevo)');
    }

    /* === CONECTADO === */
    if (connection === 'open') {
      reconnectDelay = 2000;
      const me = sock.user;
      const tag = me ? String(me.id).split(':')[0] : '?';
      const okMsg = String(config.messages.connected || 'Conectado').replace(/^✅\s*/, '');
      console.log('\n═══════════════════════════════════════════════');
      console.log(` ✅ ${okMsg} ${me?.name || config.name} (${tag})`);
      console.log('═══════════════════════════════════════════════\n');
      try { save(); } catch {}
    }

    /* === DESCONEXIÓN === */
    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const errMsg =
        lastDisconnect?.error?.output?.payload?.error ||
        lastDisconnect?.error?.message ||
        statusCode || 'desconocido';

      const loggedOut = statusCode === DisconnectReason.loggedOut || statusCode === 401;
      const badSession = statusCode === DisconnectReason.badSession;
      const restartRequired = statusCode === DisconnectReason.restartRequired;
      const replaced = statusCode === DisconnectReason.connectionReplaced;

      console.log(`\n⚠️  Desconectado (${errMsg}${statusCode ? ` [${statusCode}]` : ''})`);

      // Estábamos sin vincular: normalmente el código caducó o se introdujo mal.
      const stillUnlinked = !runtime.sessionState(AUTH_DIR).valid;
      if (stillUnlinked && authState.method === 'pairing' && !authState.fellBackToQr &&
          authState.pairingAttempts < MAX_PAIRING_ATTEMPTS) {
        endCurrentSocket();
        authState.pairingRequested = false;
        console.log('🔢 El código caducó o no se introdujo. Pediremos uno nuevo al reconectar...');
        scheduleReconnect('pairing no completado');
        return;
      }
      if (stillUnlinked && authState.method === 'pairing' && !authState.fellBackToQr) {
        authState.fellBackToQr = true;
        console.log('⚠️  Agotados los intentos de pairing: se mostrará un QR en la próxima conexión.');
      }

      if (loggedOut || badSession) {
        runtime.clearSession(AUTH_DIR);
        console.log('❌ Sesión cerrada por WhatsApp. Borré la carpeta `auth/`.');
        console.log('   Reinicia con:  npm run pairing   (o  npm start → opción 1)');
        closing = true;
        closeRl();
        process.exit(1);
      }
      if (replaced) {
        console.log('🔁 La sesión fue reemplazada por otra conexión. Reinicia el bot para volver a vincular.');
        closing = true;
        process.exit(0);
      }
      if (restartRequired) {
        endCurrentSocket();
        scheduleReconnect('reinicio requerido');
        return;
      }

      endCurrentSocket();
      scheduleReconnect(String(errMsg));
    }
  });

  /* === Bienvenida === */
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

  /* === Anti-delete === */
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

  /* === Mensajes === */
  sock.ev.on('messages.upsert', async (m) => {
    const msg = m.messages[0];
    if (!msg?.key) return;
    try { await handleMessage(sock, msg); } catch (e) { console.error('msg:', e.message); }
  });
}

/* ------------------------------------------------------------------ *
 * 6) Arranque
 * ------------------------------------------------------------------ */

async function main() {
  printBanner();

  if (!cryptoFix.ok) {
    console.error(`\n❌ Web Crypto no disponible (${cryptoFix.reason}).`);
    console.error(`   Node ${NODE.version}. El pairing code necesita Node 19+ o el parche aplicado.`);
    console.error('   Actualiza Termux:  pkg update && pkg install nodejs\n');
    process.exit(1);
  }
  if (cryptoFix.patched) {
    console.log(`🩹 Web Crypto parcheada para Node ${NODE.version} — el pairing code funcionará.`);
  }
  if (!NODE.nativeWebCrypto && NODE.major < 19) {
    console.log('💡 Recomendado en Termux:  pkg install nodejs   (Node 19+ trae Web Crypto nativa)');
  }

  if (CLI.reset) {
    console.log(`\n🧹 --reset: borrando sesión en ${AUTH_DIR}`);
    runtime.clearSession(AUTH_DIR);
  }

  await connect();
}

/* Salida limpia con Ctrl+C (en Termux el proceso suele quedar colgado si no) */
function shutdown(signal) {
  if (closing) return;
  closing = true;
  console.log(`\n👋 ${signal || 'SIGINT'} recibido, cerrando el bot...`);
  if (reconnectTimer) clearTimeout(reconnectTimer);
  endCurrentSocket();
  closeRl();
  try { save(); } catch {}
  setTimeout(() => process.exit(0), 400).unref?.();
  process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', err => {
  console.error('⚠️  unhandledRejection:', err?.message || err);
});
process.on('uncaughtException', err => {
  console.error('❌ uncaughtException:', err?.message || err);
});

main().catch(err => {
  console.error('❌ Error fatal:', err?.message || err);
  if (err?.stack && process.env.MB_DEBUG) console.error(err.stack);
  process.exit(1);
});
