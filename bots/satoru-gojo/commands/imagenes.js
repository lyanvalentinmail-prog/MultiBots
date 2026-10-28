// Comandos de edición/filtros de imágenes
module.exports = {
  title: '✺ •• ┈┈ ⋯ Imágenes ⋯ ┈┈ •• ✺',
  commands: [
    { pattern: 'blur <responder> <intensidad>', desc: 'Aplicar desenfoque' },
    { pattern: 'deepfry <responder> <intensidad>', desc: 'Efecto deepfry' },
    { pattern: 'gay <responder> <intensidad>', desc: 'Efecto arcoíris gay' },
    { pattern: 'glitch <responder> <intensidad>', desc: 'Efecto glitch' },
    { pattern: 'grayscale <responder> <intensidad>', desc: 'Escala de grises' },
    { pattern: 'invert <responder>', desc: 'Invertir colores' },
    { pattern: 'liquify <responder>', desc: 'Distorsión líquida' },
    { pattern: 'pixel <responder>', desc: 'Pixelar imagen' },
    { pattern: 'sketch <responder>', desc: 'Efecto boceto' },
    { pattern: 'swirl <responder> <intensidad>', desc: 'Efecto remolino' }
  ]
};
