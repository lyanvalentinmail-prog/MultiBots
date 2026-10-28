// Listas de comandos (basados en el documento "Menus" del Drive)
module.exports = {
  fastCommands: [
    { cmd: '.ping', desc: 'Latencia del bot' },
    { cmd: '.id', desc: 'ID del chat/usuario' },
    { cmd: '.infobot', desc: 'Info del bot' },
    { cmd: '.owner', desc: 'Contactar al owner' },
    { cmd: '.estadoapi', desc: 'Estado de la API' },
    { cmd: '.sticker', desc: 'Responder a imagen/video para sticker' },
    { cmd: '.tts <texto>', desc: 'Texto a voz' },
    { cmd: '.meme', desc: 'Meme aleatorio' }
  ],
  categories: [
    {
      title: '✺ •• ┈┈ ⋯ General ⋯ ┈┈ •• ✺',
      cmds: ['.estadoapi', '.id', '.infobot', '.menu <categoría>', '.owner', '.ping']
    },
    {
      title: '✺ •• ┈┈ ⋯ Owners ⋯ ┈┈ •• ✺',
      cmds: [
        '.mod @usuario / número',
        '.mod del @usuario',
        '.mod lista',
        '.delsession',
        '.join <link>',
        '.bot on',
        '.bot off',
        '.setlen es/in/pt',
        '.setmenu lista/texto'
      ]
    },
    {
      title: '✺ •• ┈┈ ⋯ Admins ⋯ ┈┈ •• ✺',
      cmds: [
        '.ban @usuario / responder',
        '.sban → sticker ban',
        '.warn @usuario / responder',
        '.delwarn',
        '.warnings @usuario / responder',
        '.mute @usuario / responder',
        '.delmute @usuario / responder',
        '.open',
        '.close',
        '.fijar',
        '.desfijar',
        '.namegp <nombre>',
        '.desgp <descripción>',
        '.photogp',
        '.grupo on/off',
        '.soloadmin on/off',
        '.welcome on/off'
      ]
    },
    {
      title: '✺ •• ┈┈ ⋯ Antis (Admins) ⋯ ┈┈ •• ✺',
      cmds: [
        '.antilink on/off',
        '.antiimg on/off',
        '.antiaudio on/off',
        '.antivideo on/off',
        '.antisticker on/off',
        '.antispam on/off',
        '.antibot on/off',
        '.antidelete on/off',
        '.antidocs on/off',
        '.antipalabras on/off',
        '.antipalabra del <palabra>',
        '.antipalabra add <palabra>'
      ]
    },
    {
      title: '✺ •• ┈┈ ⋯ Sub bot ⋯ ┈┈ •• ✺',
      cmds: [
        '.qr', '.code', '.bots', '.bot info',
        '.setbotname', '.setbotimg',
        '.autoread on/off',
        '.setlen es/in/pt',
        '.setmenu lista/texto'
      ]
    },
    {
      title: '✺ •• ┈┈ ⋯ Juegos RPG ⋯ ┈┈ •• ✺',
      cmds: [
        '.balance', '.coins', '.transf @usuario <cantidad>', '.dado',
        '.daily', '.adivinanza', '.pescar', '.miner', '.work', '.suerte',
        '.crimen', '.cazar', '.cofre', '.ppt piedra|papel|tijera',
        '.ahorcado', '.banco', '.deposit <cantidad/all>', '.change <banco>',
        '.unirsebank <banco>', '.prestamo <cantidad> <días>', '.pagar',
        '.robar', '.sorpresa', '.w / rw', '.claim / c', '.tiendag',
        '.comprarg <orden>'
      ]
    },
    {
      title: '✺ •• ┈┈ ⋯ Pokémon ⋯ ┈┈ •• ✺',
      cmds: ['.catch', '.pokedex <nombre/ID/random>', '.pokemonbattle <@usuario>']
    },
    {
      title: '✺ •• ┈┈ ⋯ Perfil ⋯ ┈┈ •• ✺',
      cmds: [
        '.perfil', '.setbirth <fecha>', '.setage <edad>',
        '.setdesc <descripción>', '.setfav <personaje>',
        '.setgenre <hombre/mujer>', '.birthdays',
        '.marry @user', '.divorce'
      ]
    },
    {
      title: '✺ •• ┈┈ ⋯ Tops ⋯ ┈┈ •• ✺',
      cmds: ['.topcoins', '.topinactivos', '.topactivos']
    },
    {
      title: '✺ •• ┈┈ ⋯ Búsquedas ⋯ ┈┈ •• ✺',
      cmds: [
        '.google <búsqueda>', '.pinterest <búsqueda>',
        '.tiktok <búsqueda>', '.wiki <búsqueda>', '.youtube <búsqueda>'
      ]
    },
    {
      title: '✺ •• ┈┈ ⋯ Descargas ⋯ ┈┈ •• ✺',
      cmds: [
        '.facebook <URL>', '.instagram <URL>', '.letra <artista y canción>',
        '.mp3 <URL o búsqueda>', '.mp4 <URL o búsqueda>',
        '.pinterest <URL>', '.play <canción o artista>',
        '.tiktok <URL>', '.tiktokaudio <URL>'
      ]
    },
    {
      title: '✺ •• ┈┈ ⋯ Adicionales ⋯ ┈┈ •• ✺',
      cmds: [
        '.nota <contenido>', '.delnota <numero>', '.infogrupo',
        '.reveal <responder>', '.translate es/in/pt <texto>',
        '.calculator <operación>', '.resize <imagen/sticker> 800x600',
        '.tts <texto>', '.stt <nota de voz/audio>'
      ]
    },
    {
      title: '✺ •• ┈┈ ⋯ Stickers ⋯ ┈┈ •• ✺',
      cmds: [
        '.brat/bratv <texto>', '.bratestirado <texto>', '.sgay <foto> <texto>',
        '.attp <texto>', '.ttp <texto>', '.bobesponja <1/2/3> <texto>',
        '.bratcoyote <texto>', '.bratanime <texto>', '.bratpinguino <texto>',
        '.bratboy <texto>', '.sticker <responder>', '.pack <nombre.autor>',
        '.toimg/tovid <responder>'
      ]
    },
    {
      title: '✺ •• ┈┈ ⋯ Diversión ⋯ ┈┈ •• ✺',
      cmds: ['.ship <@usuario> <@usuario>', '.topgays', '.topotakus', '.topfemboys', '.meme']
    },
    {
      title: '✺ •• ┈┈ ⋯ Canvas ⋯ ┈┈ •• ✺',
      cmds: [
        '.canvaimagen <responder>', '.cuentatiktok <texto> <responder>',
        '.friendship <@usuario> <@usuario>', '.gaycard <@usuario>',
        '.googleimg <responder>', '.iqc <texto>', '.iqcblue <texto>',
        '.iqcpink <texto>', '.laptop <responder>', '.messengerquote <texto>',
        '.pc <responder>', '.pov <texto> <responder>', '.profilenote <texto>',
        '.quotly <texto>', '.searched <imagen>', '.storyreply <texto>',
        '.x <texto>'
      ]
    },
    {
      title: '✺ •• ┈┈ ⋯ Imágenes ⋯ ┈┈ •• ✺',
      cmds: [
        '.blur <responder> <intensidad>', '.deepfry <responder> <intensidad>',
        '.gay <responder> <intensidad>', '.glitch <responder> <intensidad>',
        '.grayscale <responder> <intensidad>', '.invert <responder>',
        '.liquify <responder>', '.pixel <responder>', '.sketch <responder>',
        '.swirl <responder> <intensidad>'
      ]
    }
  ]
};
