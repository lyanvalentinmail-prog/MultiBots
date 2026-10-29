/**
 * Clima para la tarjeta del menú (el diseño del HTML de Drive trae su_tile
 * "CLIMA"). Usa open-meteo, que no pide clave: si no hay red, si el destino
 * no responde o si el código viene raro, se devuelve `null` y la tarjeta
 * muestra "Sin datos" en vez de romperse.
 */

const CACHE_TTL_MS = 10 * 60 * 1000
const NEGATIVE_TTL_MS = 60 * 1000
const REQUEST_TIMEOUT_MS = 3500

const cache = new Map()

/** Código WMO -> descripción corta en español. */
export function weatherLabel(code) {
  const value = Number(code)
  if (value === 0) return 'Despejado'
  if (value === 1) return 'Mayormente despejado'
  if (value === 2) return 'Parcialmente nublado'
  if (value === 3) return 'Nublado'
  if (value === 45 || value === 48) return 'Niebla'
  if (value >= 51 && value <= 57) return 'Llovizna'
  if (value >= 61 && value <= 67) return 'Lluvia'
  if (value >= 71 && value <= 77) return 'Nieve'
  if (value >= 80 && value <= 82) return 'Chubascos'
  if (value === 85 || value === 86) return 'Nevadas'
  if (value >= 95 && value <= 99) return 'Tormenta'
  return 'Variable'
}

/**
 * `{ temperature, label }` para unas coordenadas, cacheado 10 minutos.
 * Devuelve `null` ante cualquier fallo (sin red, timeout, respuesta rara).
 */
export async function fetchWeather({ lat, lon, timeoutMs = REQUEST_TIMEOUT_MS } = {}) {
  if (lat === undefined || lat === null || lon === undefined || lon === null) return null
  const key = `${Number(lat).toFixed(2)},${Number(lon).toFixed(2)}`
  const cached = cache.get(key)
  if (cached && cached.expiresAt > Date.now()) return cached.value

  let value = null
  let ttl = NEGATIVE_TTL_MS
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${Number(lat).toFixed(4)}&longitude=${Number(lon).toFixed(4)}&current_weather=true`
    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(timer)
    if (response.ok) {
      const data = await response.json()
      const current = data?.current_weather
      if (current && typeof current.temperature === 'number') {
        value = { temperature: current.temperature, label: weatherLabel(current.weathercode) }
        ttl = CACHE_TTL_MS
      }
    }
  } catch {
    value = null
  }

  cache.set(key, { value, expiresAt: Date.now() + ttl })
  return value
}

export function clearWeatherCache() {
  cache.clear()
}
