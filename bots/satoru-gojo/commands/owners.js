// Comandos exclusivos del owner (estructura: lógica básica placeholder)
function isOwner(msg, ownerNumber) {
  const sender = (msg.key.participant || msg.key.remoteJid || '').split('@')[0].replace(/\D/g, '');
  return sender === ownerNumber.replace(/\D/g, '');
}

module.exports = {
  title: '✺ •• ┈┈ ⋯ Owners ⋯ ┈┈ •• ✺',
  commands: [
    { pattern: 'mod @usuario / número', desc: 'Añadir moderador' },
    { pattern: 'mod del @usuario', desc: 'Eliminar moderador' },
    { pattern: 'mod lista', desc: 'Listar moderadores' },
    { pattern: 'delsession', desc: 'Eliminar sesión actual' },
    { pattern: 'join <link>', desc: 'Unirse a grupo por invitación' },
    { pattern: 'bot on', desc: 'Activar el bot' },
    { pattern: 'bot off', desc: 'Desactivar el bot' },
    { pattern: 'setlen es/in/pt', desc: 'Cambiar idioma' },
    { pattern: 'setmenu lista/texto', desc: 'Cambiar estilo del menú' }
  ]
};
