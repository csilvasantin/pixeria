/* /stock-publish — el Adaptador guarda sus exportaciones en el Stock.
 *
 * Es el MISMO mecanismo con el que hoy se suben vídeos locales al Stock desde
 * pixeria.com (app.js → publishToStock → POST api.admira.store/stock/publish, con el
 * fichero en base64 dentro del JSON). Solo cambia por dónde sale: desde el propio
 * dominio. El Worker del Stock solo abre CORS a www.pixeria.com, así que desde un
 * preview (*.pixeria.pages.dev) la llamada directa no se podía ni probar; por aquí
 * es igual en preview y en producción.
 *
 * No abre nada nuevo: el endpoint de arriba ya es público. Aun así solo reenvía lo que
 * produce el Adaptador (type video, motor «adaptador», MP4 en base64) y ningún otro campo
 * que el Worker trate como privilegiado (externalId, catalogo…).
 */
const UPSTREAM = 'https://api.admira.store/stock/publish';
const MAX_BODY = 95 * 1024 * 1024; // el borde corta en 100 MB
const MOTORES = ['adaptador', 'yt-dlp', 'import'];
const CAMPOS = ['type', 'motor', 'prompt', 'title', 'comment', 'tags', 'costEst', 'mime', 'base64', 'externalRef', 'validacion', 'quality'];

export async function onRequestPost({ request }) {
  if (+request.headers.get('content-length') > MAX_BODY) return error(413, 'too-big');
  let body;
  try { body = await request.json(); } catch { return error(400, 'bad-json'); }
  // Exportaciones del Adaptador e importaciones por URL de su caja 2 (yt-dlp o mp4 directo), solo vídeo MP4.
  if (!body || body.type !== 'video' || !MOTORES.includes(body.motor) || body.mime !== 'video/mp4' || typeof body.base64 !== 'string' || !body.base64) {
    return error(400, 'solo-adaptaciones');
  }
  const limpio = {};
  for (const k of CAMPOS) if (body[k] != null) limpio[k] = body[k];
  // Miniatura generada en el navegador (assets/poster-frame.mjs): el vídeo llega al Stock con imagen.
  if (typeof body.poster === 'string' && /^data:image\/(jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(body.poster) && body.poster.length < 400 * 1024) limpio.poster = body.poster;
  let r;
  try {
    r = await fetch(UPSTREAM, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Sin UA de navegador, Cloudflare responde 403 1010 (ver scripts/stock-subir.py).
        'User-Agent': 'Mozilla/5.0 (compatible; PixeriaAdaptador/1.0)',
        Origin: 'https://www.pixeria.com',
        Referer: 'https://www.pixeria.com/adaptaciones/',
      },
      body: JSON.stringify(limpio),
    });
  } catch (e) {
    return error(502, 'stock-unreachable');
  }
  const text = await r.text();
  return new Response(text, { status: r.status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}

function error(status, message) {
  return new Response(JSON.stringify({ ok: false, error: message }), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}
