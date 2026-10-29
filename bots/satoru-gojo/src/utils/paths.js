import path from 'node:path'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/**
 * Raíz del bot (la carpeta que contiene index.js, plugins/, src/, assets/…).
 *
 * MultiBots puede lanzar el bot desde la raíz del repositorio (`npm start` →
 * `node index.js` → spawn) o directamente (`node bots/satoru-gojo/index.js`),
 * así que NUNCA se puede depender de process.cwd(): todas las rutas relativas
 * (config.json, assets/, plugins/, sessions/, data/) se resuelven contra aquí.
 */
export const BOT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

/** Resuelve una ruta relativa contra la raíz del bot (las absolutas y las URL pasan igual). */
export function resolveBot(...segments) {
  const target = path.join(...segments)
  return path.isAbsolute(target) ? target : path.resolve(BOT_ROOT, target)
}

let cachedPackageVersion

/** Versión del package.json de la raíz (para el "{bot name} {version}" de la tarjeta). */
export function packageVersion() {
  if (cachedPackageVersion === undefined) {
    try {
      cachedPackageVersion = JSON.parse(readFileSync(resolveBot('..', '..', 'package.json'), 'utf8')).version || ''
    } catch {
      cachedPackageVersion = ''
    }
  }
  return cachedPackageVersion
}
