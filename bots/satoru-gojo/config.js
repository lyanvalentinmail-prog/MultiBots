// Configuración del bot Satoru Gojo
module.exports = {
  name: 'Satoru Gojo',
  version: '1.0.0',
  ownerNumber: '59896719709', // Número de soporte
  prefix: '.',
  sessionPath: __dirname + '/auth',
  // API para generar imágenes desde HTML (según el documento "Api" del Drive)
  apiBase: 'https://velirius-api-sd8u.vercel.app',
  // Idiomas / mensajes
  messages: {
    greeting: '¡Buenos días! ☀️',
    selectMenu: 'Selecciona el menu que necesites',
    copyright: 'Ⓒ Satoru gojo',
    supportText: '📞 Soporte: wa.me/59896719709',
    pairingCodePrompt: 'Introduce tu número de WhatsApp (formato internacional sin +, ej: 59896719709): ',
    qrPrompt: 'Escanea el código QR con tu WhatsApp (Dispositivos vinculados → Vincular un dispositivo):',
    connected: '✅ Bot conectado exitosamente como',
    disconnected: '⚠️ Bot desconectado. Motivo:',
    welcomeFile: 'assets/banner.jpg'
  }
};
