/* /stock-publish — el Adaptador guarda sus exportaciones en el Stock.
 *
 * Es el MISMO mecanismo con el que hoy se suben vídeos locales al Stock desde
 * pixeria.com (app.js → publishToStock → POST api.admira.store/stock/publish, con el
 * fichero en base64 dentro del JSON). Solo cambia por dónde sale: desde el propio
 * dominio. El Worker del Stock solo abre CORS a www.pixeria.com, así que desde un
 * preview (*.pixeria.pages.dev) la llamada directa no se podía ni probar; por aquí
 * es igual en preview y en producción.
 *
 * Dos formas de llevar el MP4, exactamente una por petición:
 * · `base64` dentro del JSON, para ficheros pequeños (lo de siempre).
 * · `r2Staged`: el MP4 ya subió crudo y por partes a uploads/ del Stock con /stock-upload/*
 *   (functions/stock-upload/[accion].js) y aquí solo viajan los metadatos. Así sube el
 *   Adaptador todo lo que pasa de 8 MB: un MP4 de ~70 MB en base64 eran ~97 MB de JSON que
 *   esta función parseaba y volvía a serializar, y el isolate pasaba de 128 MB (503 «Worker
 *   exceeded resource limits», 8-oct-2026).
 *
 * No abre nada nuevo: el endpoint de arriba ya es público. Aun así solo reenvía lo que
 * producen el Adaptador, su caja 2 y el Stock de pixeria.com (ficheros locales e importaciones,
 * desde el 9-oct-2026): vídeo, audio o imagen con su mime, de los motores de _stock-proxy.js, y
 * ningún campo que el Worker trate como privilegiado (externalId, catalogo…).
 */
import {MOTORES, STAGED_KEY, tipoMimeOk, stockBase, cabeceras, error, respuesta} from './_stock-proxy.js';

const MAX_BODY = 95 * 1024 * 1024; // el borde corta en 100 MB
const CAMPOS = ['type', 'motor', 'prompt', 'title', 'comment', 'tags', 'costEst', 'mime', 'externalRef', 'validacion', 'quality', 'dimensions'];

export async function onRequestPost({ request, env }) {
  if (+request.headers.get('content-length') > MAX_BODY) return error(413, 'too-big');
  let body;
  try { body = await request.json(); } catch { return error(400, 'bad-json'); }
  // Tipo, mime y motor admitidos (_stock-proxy.js) y exactamente una fuente.
  const conBase64 = typeof body?.base64 === 'string' && body.base64 !== '';
  const conStaged = typeof body?.r2Staged === 'string' && STAGED_KEY.test(body.r2Staged);
  if (!body || !MOTORES.includes(body.motor) || !tipoMimeOk(body.type, body.mime) || conBase64 === conStaged) {
    return error(400, 'solo-adaptaciones');
  }
  const limpio = {};
  for (const k of CAMPOS) if (body[k] != null) limpio[k] = body[k];
  if (conBase64) limpio.base64 = body.base64; else limpio.r2Staged = body.r2Staged;
  // Miniatura generada en el navegador (assets/poster-frame.mjs): el vídeo llega al Stock con imagen.
  if (typeof body.poster === 'string' && /^data:image\/(jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(body.poster) && body.poster.length < 400 * 1024) limpio.poster = body.poster;
  // Miniatura por URL (p. ej. la de YouTube en las importaciones del Stock): solo https y corta.
  if (typeof body.thumbnail === 'string' && /^https:\/\/[^\s"'<>]+$/.test(body.thumbnail) && body.thumbnail.length <= 500) limpio.thumbnail = body.thumbnail;
  let r;
  try {
    r = await fetch(`${stockBase(env)}/stock/publish`, {
      method: 'POST',
      headers: cabeceras({'Content-Type': 'application/json'}),
      body: JSON.stringify(limpio),
    });
  } catch (e) {
    return error(502, 'stock-unreachable');
  }
  return respuesta(r);
}
