#!/usr/bin/env node
/**
 * MultiBots — selector de bots.
 *
 * Cada bot vive en `bots/<nombre>/` y es autónomo (su propio index.js,
 * config.json, plugins/, src/, assets/, sessions/, data/). Por eso el hijo se
 * lanza con `cwd` = la carpeta del bot.
 *
 * Detalle importante (regresión ya corregida una vez): el hijo hereda stdin
 * (`stdio: 'inherit'`). Si el padre deja su `readline` abierto, los DOS procesos
 * leen de la misma TTY y se roban las teclas — en Termux eso se ve como que el
 * bot "no responde" cuando pregunta la vinculación o el número del pairing code.
 * Aquí se libera stdin ANTES de lanzar el hijo.
 *
 * Uso:
 *   npm start                                  # menú interactivo
 *   npm start -- --pairing --phone=59896719709 # directo a pairing code
 *   npm start -- --qr                          # directo a QR
 */

import { spawn, spawnSync } from 'node:child_process'
import { createInterface } from 'node:readline/promises'
import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(fileURLToPath(import.meta.url))
const BOTS_DIR = path.join(ROOT, 'bots')

const bots = existsSync(BOTS_DIR)
  ? readdirSync(BOTS_DIR, { withFileTypes: true })
      .filter(entry => entry.isDirectory() && existsSync(path.join(BOTS_DIR, entry.name, 'index.js')))
      .map(entry => entry.name)
      .sort()
  : []

const argv = process.argv.slice(2)
const passthrough = argv.filter(arg => arg.startsWith('-') || /^\d{6,15}$/.test(arg))
const IS_TTY = Boolean(process.stdin.isTTY)

let rl = null
function ask(question) {
  rl ||= createInterface({ input: process.stdin, output: process.stdout, terminal: IS_TTY })
  return rl.question(question).then(answer => String(answer || '').trim())
}

/** Devuelve la TTY limpia al proceso hijo. */
function releaseStdin() {
  try { rl?.close() } catch {}
  rl = null
  try {
    if (process.stdin.isTTY && process.stdin.setRawMode) process.stdin.setRawMode(false)
    process.stdin.removeAllListeners('data')
    process.stdin.removeAllListeners('keypress')
    process.stdin.pause()
  } catch {}
}

/** Prepara sharp (nativo o WebAssembly en Termux) antes de arrancar el bot. */
function ensureSharp(botDir) {
  const script = path.join(botDir, 'scripts', 'ensure-sharp.js')
  if (!existsSync(script)) return
  spawnSync(process.execPath, [script], { cwd: botDir, stdio: 'inherit', timeout: 240000 })
}

function launch(botName) {
  const botDir = path.join(BOTS_DIR, botName)
  const script = path.join(botDir, 'index.js')
  console.log(`\n▶ Iniciando ${botName}…`)
  if (passthrough.length) console.log(`  args: ${passthrough.join(' ')}`)
  console.log('')

  releaseStdin()
  ensureSharp(botDir)

  const child = spawn(process.execPath, [script, ...passthrough], {
    stdio: 'inherit',
    cwd: botDir,
    env: process.env,
  })

  const forward = signal => { try { child.kill(signal) } catch {} }
  process.on('SIGINT', () => forward('SIGINT'))
  process.on('SIGTERM', () => forward('SIGTERM'))

  child.on('error', error => {
    console.error('❌ No se pudo iniciar el bot:', error.message)
    process.exit(1)
  })
  child.on('exit', (code, signal) => {
    if (signal) console.log(`\n(${signal})`)
    process.exit(code == null ? 0 : code)
  })
}

async function main() {
  console.log('╔═══════════════════════════════╗')
  console.log('║       MultiBots Manager       ║')
  console.log('║   (WhatsApp bots / Baileys)   ║')
  console.log('╚═══════════════════════════════╝\n')

  if (!bots.length) {
    console.error('❌ No se encontró ningún bot en bots/')
    process.exit(1)
  }

  // Con un solo bot y argumentos explícitos, directo (sin preguntar nada).
  if (bots.length === 1 && passthrough.some(arg => arg.startsWith('-'))) return launch(bots[0])

  console.log('Bots disponibles:')
  bots.forEach((bot, index) => console.log(`  [${index + 1}] ${bot}`))
  console.log('  [0] Salir\n')

  if (!IS_TTY) {
    console.log('ℹ️  stdin no es una terminal: se lanza el primer bot.')
    return launch(bots[0])
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const answer = await ask('Selecciona el número del bot que quieres ejecutar: ')
    const index = Number.parseInt(answer, 10)
    if (index === 0) {
      console.log('Saliendo…')
      releaseStdin()
      process.exit(0)
    }
    const chosen = bots[index - 1]
    if (chosen) return launch(chosen)
    console.log('Opción inválida.')
  }

  console.error('❌ Demasiados intentos.')
  releaseStdin()
  process.exit(1)
}

main().catch(error => {
  console.error('❌ Error fatal:', error?.stack || error?.message || error)
  releaseStdin()
  process.exit(1)
})
