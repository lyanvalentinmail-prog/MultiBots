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

/**
 * Busca un comando por texto. Maneja comandos de varias palabras (ej "bot on", "bot off", "bot info",
 * "antipalabra add", "grupo on", etc.) priorizando coincidencia más larga.
 */
function findCommand(text, prefix = '.') {
  let normalized = text.trim();
  if (normalized.startsWith(prefix)) normalized = normalized.slice(prefix.length);
  const lower = normalized.toLowerCase();

  let best = null;
  let bestLen = 0;
  let bestArgs = '';

  for (const c of commands) {
    if (typeof c.pattern !== 'string') continue;
    // Extraer la parte de "palabras base" (antes de '<' que indica argumento)
    const baseRaw = c.pattern.split('<')[0].trim().toLowerCase();
    // Coincidencia exacta de tokens: el texto debe comenzar con baseRaw
    if (lower === baseRaw || lower.startsWith(baseRaw + ' ') || lower.startsWith(baseRaw)) {
      if (baseRaw.length > bestLen) {
        best = c;
        bestLen = baseRaw.length;
        bestArgs = normalized.slice(baseRaw.length).trim();
      }
    }
  }

  if (best) return { command: best, args: bestArgs };

  // Fallback regex
  for (const c of commands) {
    if (c.pattern instanceof RegExp) {
      const m = lower.match(c.pattern);
      if (m) return { command: c, args: normalized, match: m };
    }
  }
  return null;
}

module.exports = {
  commands,
  categories,
  fastCommands,
  findCommand
};
