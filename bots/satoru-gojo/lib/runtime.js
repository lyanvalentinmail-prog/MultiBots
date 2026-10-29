/**
 * runtime.js — parches y utilidades de entorno para Termux (Android) y Node.
 *
 * IMPORTANTE: este módulo debe cargarse ANTES de `@whiskeysockets/baileys`.
 *
 * ¿Por qué existe?
 * ----------------
 * Baileys genera el *pairing code* usando la **Web Crypto API del global**
 * (`crypto.subtle`) en `Utils/crypto.js -> derivePairingCodeKey()`.
 * Ese global sólo existe por defecto a partir de **Node 19**; en Node 18
 * (el que instala `pkg install nodejs-lts` en Termux) hay que pasar
 * `--experimental-global-webcrypto`, y sin él la llamada revienta con:
 *
 *     ReferenceError: crypto is not defined
 *
 * Como el QR NO usa Web Crypto, el síntoma clásico en Termux es:
 * "el QR funciona pero el pairing code nunca aparece / falla 5 veces".
 * Aquí parcheamos el global con `require('crypto').webcrypto`, que SÍ existe
 * desde Node 15, y así el pairing code funciona en Node 18, 20, 22 y 24.
 */

'use strict';

const fs = require('fs');
const path = require('path');

/* ------------------------------------------------------------------ *
 * 1) Web Crypto global (fix del pairing code en Node 18 / Termux)
 * ------------------------------------------------------------------ */

let cryptoPatched = false;

/**
 * Garantiza que `globalThis.crypto.subtle` exista.
 * @returns {{ok: boolean, patched: boolean, reason?: string}}
 */
function patchWebCrypto() {
  if (globalThis.crypto && typeof globalThis.crypto.subtle?.importKey === 'function') {
    return { ok: true, patched: cryptoPatched };
  }
  try {
    const { webcrypto } = require('crypto'); // node:crypto
    if (!webcrypto || typeof webcrypto.subtle?.importKey !== 'function') {
      return { ok: false, patched: false, reason: 'node:crypto no expone webcrypto' };
    }
    // No pisar un objeto existente incompleto: reemplazarlo entero.
    Object.defineProperty(globalThis, 'crypto', {
      value: webcrypto,
      writable: true,
      configurable: true,
      enumerable: true
    });
    cryptoPatched = true;
    return { ok: true, patched: true };
  } catch (err) {
    return { ok: false, patched: false, reason: err?.message || String(err) };
  }
}

/**
 * Prueba real de que la ruta criptográfica del pairing code funciona
 * (mismos primitivos que usa Baileys: PBKDF2 + SHA-256 sobre `crypto.subtle`).
 * Sirve para avisar ANTES de gastar intentos contra WhatsApp.
 */
async function verifyPairingCrypto() {
  if (!patchWebCrypto().ok) {
    return { ok: false, error: 'crypto.subtle no disponible en este Node' };
  }
  try {
    const enc = new TextEncoder();
    const salt = require('crypto').randomBytes(16);
    const key = await globalThis.crypto.subtle.importKey(
      'raw', enc.encode('TERMUX00'), { name: 'PBKDF2' }, false, ['deriveBits']
    );
    const bits = await globalThis.crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: new Uint8Array(salt), iterations: 1000, hash: 'SHA-256' },
      key, 256
    );
    return { ok: !!(bits && bits.byteLength === 32) };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/* ------------------------------------------------------------------ *
 * 2) Info de Node
 * ------------------------------------------------------------------ */

function nodeInfo() {
  const parts = String(process.versions.node || '').split('.').map(Number);
  return {
    version: process.versions.node || '?',
    major: parts[0] || 0,
    minor: parts[1] || 0,
    isTermux: /android/i.test(process.platform) ||
      (process.env.PREFIX || '').includes('com.termux') ||
      fs.existsSync('/data/data/com.termux/files/usr/bin/bash'),
    // Node >= 19 trae Web Crypto global; por debajo hace falta el parche.
    nativeWebCrypto: parts[0] >= 19
  };
}

/* ------------------------------------------------------------------ *
 * 3) Normalización / validación del número de teléfono
 * ------------------------------------------------------------------ */

/**
 * Baileys pide el número SÓLO con dígitos, código de país incluido,
 * SIN '+' ni espacios ni guiones: "59896719709".
 */
function normalizePhone(raw) {
  let digits = String(raw || '').replace(/\D/g, '');

  // Prefijo de salida internacional escrito a mano: 00 -> quitar.
  digits = digits.replace(/^00+/, '');
  // Ceros de troncal local (ej. 0598..., 011...): quitar los iniciales.
  digits = digits.replace(/^0+/, '');

  const warnings = [];
  if (digits.startsWith('54') && digits.length >= 10 && !/^549/.test(digits)) {
    warnings.push('Argentina móvil suele necesitar el 9 después del 54: 54 9 11 1234-5678.');
  }
  if (digits.startsWith('52') && digits.length >= 11 && !/^521/.test(digits)) {
    warnings.push('México móvil suele llevar 1 después del 52: 52 1 55 1234 5678.');
  }
  return {
    digits,
    valid: digits.length >= 8 && digits.length <= 15,
    warnings
  };
}

/* ------------------------------------------------------------------ *
 * 4) Estado de la sesión guardada (auth/)
 * ------------------------------------------------------------------ */

/**
 * ¿Hay una sesión *realmente vinculada*?
 *
 * Ojo: `requestPairingCode()` escribe `creds.json` ANTES de vincular, con
 * `registered: false`. Si sólo miramos "la carpeta auth existe y no está
 * vacía", un intento fallido deja la carpeta sucia y el bot deja de pedir el
 * método de login para siempre, reintentando una sesión a medias en bucle.
 */
function sessionState(authDir) {
  const credsPath = path.join(authDir, 'creds.json');
  const out = { dir: authDir, exists: false, files: 0, registered: false, valid: false, reason: 'sin sesión' };
  try {
    if (!fs.existsSync(authDir)) return out;
    out.exists = true;
    out.files = fs.readdirSync(authDir).filter(f => !f.startsWith('.')).length;
    if (!fs.existsSync(credsPath)) {
      out.reason = 'carpeta de sesión sin creds.json';
      return out;
    }
    const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
    out.registered = creds?.registered === true;
    const complete = !!(creds?.noiseKey?.private && creds?.signedIdentityKey?.private &&
                        creds?.signedPreKey?.keyPair?.private && creds?.registrationId &&
                        creds?.advSecretKey && creds?.me?.id);
    if (out.registered && complete) {
      out.valid = true;
      out.reason = 'sesión vinculada';
      out.number = String(creds.me.id).split(':')[0].split('@')[0];
      out.name = creds.me.name;
    } else {
      out.reason = out.registered
        ? 'creds.json incompleto (faltan claves)'
        : 'sesión a medias (registered=false) — resto de un pairing fallido';
    }
  } catch (err) {
    out.reason = 'creds.json ilegible: ' + (err?.message || err);
  }
  return out;
}

/** Borra la carpeta de sesión para poder volver a vincular. */
function clearSession(authDir) {
  try {
    if (fs.existsSync(authDir)) fs.rmSync(authDir, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  patchWebCrypto,
  verifyPairingCrypto,
  nodeInfo,
  normalizePhone,
  sessionState,
  clearSession
};

/* ------------------------------------------------------------------ *
 * 5) Diagnóstico por consola:  npm run doctor
 * ------------------------------------------------------------------ */

if (require.main === module) {
  (async () => {
    const info = nodeInfo();
    console.log('🩺 MultiBots — diagnóstico de pairing code\n');
    console.log(`  Node:            v${info.version}`);
    console.log(`  Plataforma:      ${process.platform}${info.isTermux ? ' (Termux detectado)' : ''}`);
    console.log(`  Web Crypto nativa (Node>=19): ${info.nativeWebCrypto ? 'sí' : 'no → se aplica el parche'}`);

    const fix = patchWebCrypto();
    console.log(`  Parche aplicado: ${fix.patched ? 'sí' : (fix.ok ? 'no hacía falta' : 'FALLÓ')}`);
    if (!fix.ok) console.log(`    Motivo: ${fix.reason}`);

    const check = await verifyPairingCrypto();
    console.log(`  PBKDF2/subtle (lo que usa Baileys): ${check.ok ? '✅ OK' : '❌ ' + check.error}`);

    let baileysVersion = '?';
    try { baileysVersion = require('@whiskeysockets/baileys/package.json').version; } catch {}
    console.log(`  Baileys:         v${baileysVersion}`);
    try {
      const b = require('@whiskeysockets/baileys');
      console.log(`  requestPairingCode disponible: ${b?.default ? 'sí (makeWASocket)' : '?'}`);
    } catch (err) {
      console.log(`  ❌ No se pudo cargar Baileys: ${err.message}`);
      console.log('     Ejecuta:  npm install');
    }

    const authDir = path.join(__dirname, '..', 'auth');
    const sess = sessionState(authDir);
    console.log(`\n  Sesión (${authDir}):`);
    console.log(`    existe: ${sess.exists} · archivos: ${sess.files} · registered: ${sess.registered}`);
    console.log(`    estado: ${sess.valid ? '✅ válida (' + (sess.number || '') + ')' : '⚠️  ' + sess.reason}`);
    if (sess.exists && !sess.valid) {
      console.log('    → El bot la limpiará solo al arrancar. O hazlo ya:  npm run reset');
    }

    const ok = fix.ok && check.ok;
    console.log(`\n${ok ? '✅ Todo listo para usar el pairing code.' : '❌ Hay problemas: actualiza Node con `pkg install nodejs`.'}\n`);
    process.exit(ok ? 0 : 1);
  })();
}
