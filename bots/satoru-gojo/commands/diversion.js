// Comandos de diversión
module.exports = {
  title: '✺ •• ┈┈ ⋯ Diversión ⋯ ┈┈ •• ✺',
  commands: [
    { pattern: 'ship <@usuario> <@usuario>', desc: 'Ship de dos usuarios' },
    { pattern: 'topgays', desc: 'Top gays del grupo' },
    { pattern: 'topotakus', desc: 'Top otakus' },
    { pattern: 'topfemboys', desc: 'Top femboys' },
    {
      pattern: 'meme',
      desc: 'Meme aleatorio',
      fast: true,
      handler: async (sock, jid) => {
        await sock.sendMessage(jid, { text: '😂 Comando meme (en desarrollo)' });
      }
    }
  ]
};
