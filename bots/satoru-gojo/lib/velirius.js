// Cliente para la API Velirius (https://velirius-api-sd8u.vercel.app)
const axios = require('axios');
const config = require('../config');

const BASE = config.apiBase;

async function request(endpoint, params = {}, responseType = 'json') {
  try {
    const url = BASE + endpoint;
    const res = await axios.get(url, {
      params,
      responseType,
      timeout: 30000,
      validateStatus: () => true
    });
    return res.data;
  } catch (e) {
    return null;
  }
}

// Helper: obtener el primer campo con URL/Buffer de la respuesta
async function getImage(endpoint, params = {}) {
  // Intentar direct=true para imagen directa
  const buf = await request(endpoint, { ...params, direct: true }, 'arraybuffer');
  if (buf && Buffer.isBuffer(buf) && buf.length > 500) return buf;
  // Si devuelve JSON con url, descargarla
  const json = await request(endpoint, { ...params, direct: false }, 'json');
  if (json?.url) {
    try {
      const r = await axios.get(json.url, { responseType: 'arraybuffer', timeout: 30000 });
      return r.data;
    } catch { return null; }
  }
  if (json?.result && typeof json.result === 'string' && json.result.startsWith('http')) {
    try {
      const r = await axios.get(json.result, { responseType: 'arraybuffer', timeout: 30000 });
      return r.data;
    } catch { return null; }
  }
  return null;
}

async function getSticker(endpoint, params = {}) {
  const data = await request(endpoint, params);
  // Muchos canvas devuelven { url: '...webp' } o directamente JSON con url
  let url = data?.url || data?.result;
  if (Array.isArray(url)) url = url[0];
  if (url && typeof url === 'string') {
    try {
      const r = await axios.get(url, { responseType: 'arraybuffer', timeout: 30000 });
      return r.data;
    } catch { return null; }
  }
  return null;
}

module.exports = { request, getImage, getSticker, BASE };
