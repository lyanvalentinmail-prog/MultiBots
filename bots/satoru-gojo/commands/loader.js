// Loader de comandos: carga automáticamente todos los archivos .js de esta carpeta
const fs = require('fs');
const path = require('path');

const commands = [];
const categories = [];
const fastCommands = [];

const files = fs.readdirSync(__dirname).filter(
  f => f.endsWith('.js') && !['index.js', 'loader.js'].includes(f)
);

for (const file of files) {
  const mod = require(path.join(__dirname, file));
  const cat = {
    key: file.replace(/\.js$/, ''),
    title: mod.title,
    commands: []
  };

  if (Array.isArray(mod.commands)) {
    for (const cmd of mod.commands) {
      const entry = {
        pattern: cmd.pattern,
        desc: cmd.desc || '',
        fast: !!cmd.fast,
        // `noPrefix: true` => el comando funciona sin '.' (ej. "menu")
        noPrefix: !!cmd.noPrefix,
        handler: cmd.handler || null,
        category: cat.title
      };
      commands.push(entry);
      cat.commands.push(entry);
      if (entry.fast) fastCommands.push(entry);
    }
  }

  categories.push(cat);
}

/** Prefijos aceptados además del configurado. */
const EXTRA_PREFIXES = ['.', '!', '#', '/'];

/**
 * Busca un comando por texto.
 *
 * Reglas (antes esto estaba roto, ver más abajo):
 *  1. La coincidencia es por PALABRA COMPLETA: `lower === base` o
 *     `lower.startsWith(base + ' ')`. Así "sol" ya no dispara `.s` ni
 *     "identidad" dispara `.id`.
 *  2. Hace falta prefijo ('.', '!', '#', '/'), salvo los comandos marcados con
 *     `noPrefix: true` (ej. "menu"). Sin esto, cualquier mensaje de una
 *     conversación normal ejecutaba un comando al azar.
 *  3. Entre varios candidatos gana el más largo, para que "bot on" no se lo
 *     coma "bot".
 *
 * @param {string} text texto del mensaje
 * @param {string|string[]} prefix prefijo principal (o lista de prefijos)
 * @param {{prefixes?: string[]}} [opts]
 */
function findCommand(text, prefix = '.', opts = {}) {
  const raw = String(text || '').trim();
  if (!raw) return null;

  const prefixes = Array.isArray(opts.prefixes) && opts.prefixes.length
    ? opts.prefixes
    : (Array.isArray(prefix) ? prefix : [prefix, ...EXTRA_PREFIXES.filter(p => p !== prefix)]);

  const lowerAll = raw.toLowerCase();
  const usedPrefix = prefixes.find(p => typeof p === 'string' && p && lowerAll.startsWith(p)) || '';
  const body = usedPrefix ? raw.slice(usedPrefix.length).trim() : raw;
  if (!body) return null;
  const lower = body.toLowerCase();

  let best = null;
  let bestLen = 0;
  let bestArgs = '';

  for (const c of commands) {
    if (typeof c.pattern !== 'string') continue;
    // Parte de "palabras base" (antes del '<' que indica argumento)
    const baseRaw = c.pattern.split('<')[0].trim().toLowerCase();
    if (!baseRaw) continue;
    // Sin prefijo sólo aceptamos los comandos marcados explícitamente
    if (!usedPrefix && !c.noPrefix) continue;
    // Coincidencia por palabra completa, nunca por prefijo suelto
    if (lower === baseRaw || lower.startsWith(baseRaw + ' ')) {
      if (baseRaw.length > bestLen) {
        best = c;
        bestLen = baseRaw.length;
        bestArgs = body.slice(baseRaw.length).trim();
      }
    }
  }

  if (best) return { command: best, args: bestArgs, prefix: usedPrefix };

  // Fallback regex (sólo si el mensaje venía con prefijo)
  if (usedPrefix) {
    for (const c of commands) {
      if (c.pattern instanceof RegExp) {
        const m = body.match(c.pattern);
        if (m) return { command: c, args: body, match: m, prefix: usedPrefix };
      }
    }
  }
  return null;
}

module.exports = {
  commands,
  categories,
  fastCommands,
  findCommand,
  EXTRA_PREFIXES
};
