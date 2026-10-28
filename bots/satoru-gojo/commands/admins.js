// Comandos para administradores de grupo
module.exports = {
  title: '✺ •• ┈┈ ⋯ Admins ⋯ ┈┈ •• ✺',
  commands: [
    { pattern: 'ban @usuario / responder', desc: 'Banear usuario' },
    { pattern: 'sban', desc: 'Sticker ban (responder sticker)' },
    { pattern: 'warn @usuario / responder', desc: 'Advertir usuario' },
    { pattern: 'delwarn', desc: 'Eliminar advertencia' },
    { pattern: 'warnings @usuario / responder', desc: 'Ver advertencias' },
    { pattern: 'mute @usuario / responder', desc: 'Silenciar usuario' },
    { pattern: 'delmute @usuario / responder', desc: 'Desilenciar usuario' },
    { pattern: 'open', desc: 'Abrir grupo' },
    { pattern: 'close', desc: 'Cerrar grupo' },
    { pattern: 'fijar', desc: 'Fijar mensaje' },
    { pattern: 'desfijar', desc: 'Desfijar mensaje' },
    { pattern: 'namegp <nombre>', desc: 'Cambiar nombre del grupo' },
    { pattern: 'desgp <descripción>', desc: 'Cambiar descripción' },
    { pattern: 'photogp', desc: 'Cambiar foto del grupo' },
    { pattern: 'grupo on/off', desc: 'Activar/desactivar grupo' },
    { pattern: 'soloadmin on/off', desc: 'Solo admins pueden hablar' },
    { pattern: 'welcome on/off', desc: 'Bienvenida al entrar' }
  ]
};
