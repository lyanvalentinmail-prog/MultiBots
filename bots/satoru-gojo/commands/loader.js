// Loader de comandos: carga automáticamente todos los archivos .js de esta carpeta
// (excepto index.js) y los organiza por categoría.
// Cada archivo debe exportar: { name, emoji, commands: [ { pattern, desc, fast, handler } ] }
//   - pattern: string con el nombre del comando (sin prefijo) o RegExp
//   - desc: descripción para el menú
//   - fast: true/false para mostrar en "Fast command"
//   - handler: async (sock, msg, args) => { ... }
const fs = require('fs');
const path = require('path');

const commands = [];
const categories = [];
const fastCommands = [];

const files = fs.readdirSync(__dirname).filter(
  f => f.endsWith('.js') && f !== 'index.js' && f !== 'loader.js'
);

for (const file of files) {
  const mod = require(path.join(__dirname, file));
  const cat = {
    key: file.replace(/\.js$/, ''),
    title: mod.title,
    emoji: mod.emoji || '✺',
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
 * Busca un comando por texto (sin prefijo).
 */
function findCommand(text, prefix = '.') {
  const trimmed = text.trim();
  // Soporte para con/sin prefijo
  const normalized = trimmed.startsWith(prefix) ? trimmed.slice(prefix.length) : trimmed;
  const lower = normalized.toLowerCase();

  for (const c of commands) {
    if (typeof c.pattern === 'string') {
      // Extraer el nombre base (antes del primer espacio o '<')
      const base = c.pattern.split(/\s|</)[0].toLowerCase();
      if (lower === base || lower.startsWith(base + ' ')) {
        // args son lo que viene después del comando
        const args = normalized.slice(base.length).trim();
        return { command: c, args };
      }
    } else if (c.pattern instanceof RegExp) {
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
