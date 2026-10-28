// Comandos de stickers
module.exports = {
  title: '✺ •• ┈┈ ⋯ Stickers ⋯ ┈┈ •• ✺',
  commands: [
    {
      pattern: 'sticker',
      desc: 'Convertir imagen/video respondido a sticker',
      fast: true
      // handler placeholder: la implementación real requiere procesamiento de medios
    },
    { pattern: 'brat/bratv <texto>', desc: 'Sticker estilo brat' },
    { pattern: 'bratestirado <texto>', desc: 'Brat estirado' },
    { pattern: 'sgay <foto> <texto>', desc: 'Sticker gay' },
    { pattern: 'attp <texto>', desc: 'Sticker animado de texto' },
    { pattern: 'ttp <texto>', desc: 'Sticker de texto' },
    { pattern: 'bobesponja <1/2/3> <texto>', desc: 'Sticker Bob Esponja' },
    { pattern: 'bratcoyote <texto>', desc: 'Brat coyote' },
    { pattern: 'bratanime <texto>', desc: 'Brat anime' },
    { pattern: 'bratpinguino <texto>', desc: 'Brat pingüino' },
    { pattern: 'bratboy <texto>', desc: 'Brat boy' },
    { pattern: 'pack <nombre.autor>', desc: 'Crear pack de stickers' },
    { pattern: 'toimg/tovid <responder>', desc: 'Convertir sticker a imagen/video' }
  ]
};
