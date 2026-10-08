/* Piezas comunes de los reenvíos de Pixeria al Stock (api.admira.store):
 * /stock-publish (stock-publish.js) y la subida por partes /stock-upload/* (stock-upload/[accion].js).
 * El guion bajo inicial hace que Pages no lo publique como ruta (igual que _auth.js).
 */
export const STOCK_API = 'https://api.admira.store';
// Exportaciones del Adaptador e importaciones por URL de su caja 2 (yt-dlp o mp4 directo).
export const MOTORES = ['adaptador', 'yt-dlp', 'import'];
// Fichero ya subido por partes y esperando en uploads/ del Stock. Misma forma que acepta el
// Worker (stagingKeyOk), pero solo .mp4: por aquí solo pasan vídeos MP4.
export const STAGED_KEY = /^uploads\/[a-z0-9-]{6,64}\.mp4$/;

// Base del Stock. STOCK_API_BASE (variable del proyecto Pages) existe solo para probar en local
// contra un `wrangler dev` del Worker; en producción no se define y se usa api.admira.store.
export function stockBase(env) {
  const v = env && typeof env.STOCK_API_BASE === 'string' ? env.STOCK_API_BASE.trim() : '';
  return /^https?:\/\/[^/?#\s]+$/.test(v) ? v : STOCK_API;
}

// Cabeceras de todas las llamadas al Stock.
export function cabeceras(extra = {}) {
  return {
    // Sin UA de navegador, Cloudflare responde 403 1010 (ver scripts/stock-subir.py).
    'User-Agent': 'Mozilla/5.0 (compatible; PixeriaAdaptador/1.0)',
    Origin: 'https://www.pixeria.com',
    Referer: 'https://www.pixeria.com/adaptaciones/',
    ...extra,
  };
}

export function error(status, message, extra = null) {
  return new Response(JSON.stringify({ok: false, error: message, ...(extra || {})}), {status, headers: {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store'}});
}

// La respuesta del Stock tal cual (estado y JSON), sin caché.
export async function respuesta(r) {
  const text = await r.text();
  return new Response(text, {status: r.status, headers: {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store'}});
}
