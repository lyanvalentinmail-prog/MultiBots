// Comandos adicionales
module.exports = {
  title: '✺ •• ┈┈ ⋯ Adicionales ⋯ ┈┈ •• ✺',
  commands: [
    { pattern: 'nota <contenido>', desc: 'Guardar una nota' },
    { pattern: 'delnota <numero>', desc: 'Eliminar una nota' },
    { pattern: 'infogrupo', desc: 'Información del grupo' },
    { pattern: 'reveal <responder>', desc: 'Revelar sticker' },
    { pattern: 'translate es/in/pt <texto>', desc: 'Traducir texto' },
    { pattern: 'calculator <operación>', desc: 'Calculadora' },
    { pattern: 'resize <imagen/sticker> 800x600', desc: 'Redimensionar imagen' },
    { pattern: 'tts <texto>', desc: 'Texto a voz' },
    { pattern: 'stt <nota de voz/audio>', desc: 'Voz a texto' }
  ]
};
