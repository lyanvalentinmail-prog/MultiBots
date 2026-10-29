#!/usr/bin/env node
'use strict';

/**
 * Selector interactivo de bots para Termux.
 *
 * Detalle importante: el proceso hijo hereda stdin (`stdio: 'inherit'`). Si el
 * padre deja su propio `readline` abierto, los DOS procesos leen de la misma
 * TTY y se roban las teclas — en Termux eso se ve como que el bot "no responde"
 * cuando te pregunta el método de login o el número del pairing code. Por eso
 * cerramos el readline ANTES de lanzar el hijo.
 *
 * Uso:
 *   npm start                          # menú interactivo
 *   npm start -- --pairing 59896719709 # directo a pairing code
 *   npm start -- --qr                  # directo a QR
 *   npm start -- --reset               # borra la sesión y vuelve a vincular
 */

const { spawn } = require('child_process');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

const botsDir = path.join(__dirname, 'bots');
const bots = fs.existsSync(botsDir)
  ? fs.readdirSync(botsDir).filter(f => fs.existsSync(path.join(botsDir, f, 'index.js')))
  : [];

const argv = process.argv.slice(2);
const passthrough = argv.filter(a => a.startsWith('-') || /^\d{6,15}$/.test(a));
const IS_TTY = !!process.stdin.isTTY;

let rl = null;
function ask(q) {
  if (!rl) rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: IS_TTY });
  return new Promise(res => rl.question(q, a => res((a || '').trim())));
}
function releaseStdin() {
  if (rl) { try { rl.close(); } catch {} rl = null; }
  // Dejar stdin en modo no-crudo y sin listeners: el hijo necesita la TTY limpia.
  try {
    if (process.stdin.isTTY && process.stdin.setRawMode) process.stdin.setRawMode(false);
    process.stdin.pause();
    process.stdin.removeAllListeners('data');
    process.stdin.removeAllListeners('keypress');
  } catch {}
}

function launch(botName) {
  const script = path.join(botsDir, botName, 'index.js');
  console.log(`\n▶ Iniciando ${botName}...`);
  if (passthrough.length) console.log(`  args: ${passthrough.join(' ')}`);
  console.log('');

  releaseStdin();

  const child = spawn(process.execPath, [script, ...passthrough], {
    stdio: 'inherit',
    cwd: __dirname
  });

  const forward = sig => { try { child.kill(sig); } catch {} };
  process.on('SIGINT', () => forward('SIGINT'));
  process.on('SIGTERM', () => forward('SIGTERM'));

  child.on('error', err => {
    console.error('❌ No se pudo iniciar el bot:', err.message);
    process.exit(1);
  });
  child.on('exit', (code, signal) => {
    if (signal) console.log(`\n(${signal})`);
    process.exit(code == null ? 0 : code);
  });
}

(async () => {
  console.log('╔═══════════════════════════════╗');
  console.log('║       MultiBots Manager      ║');
  console.log('║   (WhatsApp bots / Baileys)  ║');
  console.log('╚═══════════════════════════════╝\n');

  if (!bots.length) {
    console.error('❌ No se encontró ningún bot en bots/');
    process.exit(1);
  }

  // Si ya nos dicen qué método usar y sólo hay un bot, no preguntamos nada.
  if (bots.length === 1 && passthrough.some(a => a.startsWith('-'))) {
    return launch(bots[0]);
  }

  console.log('Bots disponibles:');
  bots.forEach((b, i) => console.log(`  [${i + 1}] ${b}`));
  console.log('  [0] Salir\n');

  if (!IS_TTY) {
    releaseStdin();
    return launch(bots[0]);
  }

  let chosen = null;
  for (let i = 0; i < 5 && !chosen; i++) {
    const sel = await ask('Selecciona el número del bot que quieres ejecutar: ');
    const n = parseInt(sel, 10);
    if (n === 0) {
      console.log('Saliendo...');
      releaseStdin();
      process.exit(0);
    }
    chosen = bots[n - 1] || null;
    if (!chosen) console.log('Opción inválida.');
  }
  if (!chosen) {
    console.error('❌ Demasiados intentos.');
    releaseStdin();
    process.exit(1);
  }

  launch(chosen);
})();
