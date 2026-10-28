#!/usr/bin/env node
// Selector interactivo de bots para Termux
const { spawn } = require('child_process');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

const botsDir = path.join(__dirname, 'bots');
const bots = fs.readdirSync(botsDir).filter(f => {
  const p = path.join(botsDir, f, 'index.js');
  return fs.existsSync(p);
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(q) {
  return new Promise(res => rl.question(q, a => res(a.trim())));
}

(async () => {
  console.log('╔═══════════════════════════════╗');
  console.log('║       MultiBots Manager      ║');
  console.log('║   (WhatsApp bots / Baileys)  ║');
  console.log('╚═══════════════════════════════╝\n');
  console.log('Bots disponibles:');
  bots.forEach((b, i) => {
    console.log(`  [${i + 1}] ${b}`);
  });
  console.log('  [0] Salir\n');

  const sel = await ask('Selecciona el número del bot que quieres ejecutar: ');
  const n = parseInt(sel, 10);
  if (n === 0 || !n) {
    console.log('Saliendo...');
    rl.close();
    process.exit(0);
  }
  const chosen = bots[n - 1];
  if (!chosen) {
    console.log('Opción inválida.');
    rl.close();
    process.exit(1);
  }

  const script = path.join(botsDir, chosen, 'index.js');
  console.log(`\n▶ Iniciando ${chosen}...\n`);

  const child = spawn('node', [script], { stdio: 'inherit', cwd: __dirname });
  child.on('exit', code => process.exit(code || 0));
})();
