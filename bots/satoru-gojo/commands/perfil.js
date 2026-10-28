// Comandos de perfil
module.exports = {
  title: '✺ •• ┈┈ ⋯ Perfil ⋯ ┈┈ •• ✺',
  commands: [
    { pattern: 'perfil', desc: 'Ver tu perfil' },
    { pattern: 'setbirth <fecha>', desc: 'Establecer fecha de nacimiento' },
    { pattern: 'setage <edad>', desc: 'Establecer edad' },
    { pattern: 'setdesc <descripción>', desc: 'Establecer descripción' },
    { pattern: 'setfav <personaje>', desc: 'Personaje favorito' },
    { pattern: 'setgenre <hombre/mujer>', desc: 'Establecer género' },
    { pattern: 'birthdays', desc: 'Ver próximos cumpleaños' },
    { pattern: 'marry @user', desc: 'Casarse con un usuario' },
    { pattern: 'divorce', desc: 'Divorciarse' }
  ]
};
