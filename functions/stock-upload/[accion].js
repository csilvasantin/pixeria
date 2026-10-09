/* /stock-upload/<accion> — subida por partes del Adaptador al Stock (8-oct-2026).
 *
 * Un MP4 de 30 s a ~18 Mbps (las especificaciones de Altadis mandan el bitrate) pesa ~70 MB.
 * En base64 dentro del JSON de /stock-publish eran ~97 MB que había que parsear y volver a
 * serializar: el isolate pasaba de 128 MB y Cloudflare respondía 503 «Worker exceeded resource
 * limits». Por aquí el MP4 viaja CRUDO y en trozos, y ningún Worker lo tiene entero en memoria:
 *
 *   POST /stock-upload/start     {type:'video', motor, mime:'video/mp4', size}
 *                                → {ok, key, uploadId, partSize, maxParts}
 *   PUT  /stock-upload/part?key=&uploadId=&n=   cuerpo crudo (≤ partSize, con Content-Length)
 *                                → {ok, partNumber, etag}
 *   POST /stock-upload/complete  {key, uploadId, parts:[{partNumber, etag}]} → {ok, key, size}
 *   POST /stock-upload/abort     {key, uploadId} → {ok, aborted}
 *
 * y después POST /stock-publish con los metadatos de siempre y `r2Staged: key` en vez de base64.
 * Cada acción se reenvía a la subida por partes que el Worker del Stock ya tiene
 * (api.admira.store/stock/upload/{init,part,complete,abort}) con las mismas cabeceras que
 * /stock-publish. El trozo se reenvía como STREAM: aquí nunca se llama a arrayBuffer(),
 * text() ni json() sobre él.
 *
 * Mismo perímetro que /stock-publish: vídeo, audio o imagen con su mime de los motores admitidos
 * (_stock-proxy.js: Adaptador, importaciones y ficheros locales del Stock de pixeria.com), solo
 * claves de uploads/ y ningún campo privilegiado (externalId, catalogo…), que aquí ni existen.
 * Desde el 9-oct-2026 también suben por aquí la caja 2 del Adaptador (importar.js) y el Stock de
 * pixeria.com (app.js), así que funciona igual en pixeria.com, en admira.studio y en los previews.
 */
import {MOTORES, STAGED_KEY, tipoMimeOk, stockBase, cabeceras, error, respuesta} from '../_stock-proxy.js';

// Tope de la ruta = el del Worker (STOCK_STAGED_MAX, 2 GB): el Stock de pixeria.com ya subía episodios
// de ese tamaño. Cada cliente pone el suyo (el Adaptador y su caja 2, 500 MB: MAX_STOCK_BYTES).
export const MAX_SIZE = 2 * 1024 * 1024 * 1024;
export const PART_MAX = 25 * 1024 * 1024;     // = STOCK_PART_MAX del Worker
export const PARTS_MAX = 400;                 // = STOCK_PARTS_MAX del Worker
const JSON_MAX = 64 * 1024;                   // start/complete/abort son JSON pequeños (400 partes ≈ 30 KB)
const UPLOAD_ID = /^[\x21-\x7e]{1,1024}$/;    // id opaco de R2: ASCII imprimible, sin espacios
const ETAG = /^[\x21-\x7e]{1,256}$/;

export async function onRequestPost({request, env, params}) {
  switch (params && params.accion) {
    case 'start': return start(request, env);
    case 'complete': return complete(request, env);
    case 'abort': return abort(request, env);
    default: return error(404, 'no-existe');
  }
}

export async function onRequestPut({request, env, params}) {
  if (!params || params.accion !== 'part') return error(404, 'no-existe');
  return parte(request, env);
}

async function start(request, env) {
  const body = await leerJSON(request);
  if (body instanceof Response) return body;
  // «solo-adaptaciones» es el nombre histórico del error de perímetro; se conserva por compatibilidad.
  if (!MOTORES.includes(body.motor) || !tipoMimeOk(body.type, body.mime)) return error(400, 'solo-adaptaciones');
  const size = body.size;
  if (!Number.isSafeInteger(size) || size <= 0) return error(400, 'bad-size');
  if (size > MAX_SIZE) return error(413, 'too-big', {max: MAX_SIZE});
  return reenviarJSON(env, '/stock/upload/init', {mime: body.mime, size});
}

async function parte(request, env) {
  const url = new URL(request.url);
  const key = url.searchParams.get('key') || '', uploadId = url.searchParams.get('uploadId') || '';
  const n = Number(url.searchParams.get('n'));
  if (!STAGED_KEY.test(key) || !UPLOAD_ID.test(uploadId)) return error(400, 'bad-key');
  if (!Number.isInteger(n) || n < 1 || n > PARTS_MAX) return error(400, 'bad-part', {max: PARTS_MAX});
  // R2 solo acepta un trozo de longitud conocida: sin Content-Length no hay nada que reenviar.
  const len = Number(request.headers.get('content-length'));
  if (!request.body || !Number.isSafeInteger(len) || len <= 0) return error(411, 'length-required');
  if (len > PART_MAX) return error(413, 'part-too-big', {max: PART_MAX});
  let r;
  try {
    r = await fetch(`${stockBase(env)}/stock/upload/part?${new URLSearchParams({key, uploadId, n: String(n)})}`, {
      method: 'PUT',
      headers: cabeceras({'Content-Type': 'application/octet-stream', 'Content-Length': String(len)}),
      body: conLongitud(request.body, len),
      duplex: 'half',
    });
  } catch (e) {
    return error(502, 'stock-unreachable');
  }
  return respuesta(r);
}

async function complete(request, env) {
  const body = await leerJSON(request);
  if (body instanceof Response) return body;
  if (!STAGED_KEY.test(body.key) || !UPLOAD_ID.test(body.uploadId)) return error(400, 'bad-key');
  const parts = Array.isArray(body.parts) ? body.parts : [];
  if (!parts.length || parts.length > PARTS_MAX) return error(400, 'bad-parts');
  const limpias = parts.map(p => ({partNumber: p && p.partNumber, etag: p && p.etag}));
  if (!limpias.every(p => Number.isInteger(p.partNumber) && p.partNumber >= 1 && p.partNumber <= PARTS_MAX && typeof p.etag === 'string' && ETAG.test(p.etag))) {
    return error(400, 'bad-parts');
  }
  return reenviarJSON(env, '/stock/upload/complete', {key: body.key, uploadId: body.uploadId, parts: limpias});
}

async function abort(request, env) {
  const body = await leerJSON(request);
  if (body instanceof Response) return body;
  if (!STAGED_KEY.test(body.key) || !UPLOAD_ID.test(body.uploadId)) return error(400, 'bad-key');
  return reenviarJSON(env, '/stock/upload/abort', {key: body.key, uploadId: body.uploadId});
}

// JSON pequeño con tope: si anuncia un cuerpo grande, ni se lee.
async function leerJSON(request) {
  if (+request.headers.get('content-length') > JSON_MAX) return error(413, 'too-big', {max: JSON_MAX});
  let text;
  try { text = await request.text(); } catch (e) { return error(400, 'bad-json'); }
  if (text.length > JSON_MAX) return error(413, 'too-big', {max: JSON_MAX});
  try {
    const body = JSON.parse(text);
    return body && typeof body === 'object' && !Array.isArray(body) ? body : error(400, 'bad-json');
  } catch (e) {
    return error(400, 'bad-json');
  }
}

async function reenviarJSON(env, path, body) {
  let r;
  try {
    r = await fetch(stockBase(env) + path, {method: 'POST', headers: cabeceras({'Content-Type': 'application/json'}), body: JSON.stringify(body)});
  } catch (e) {
    return error(502, 'stock-unreachable');
  }
  return respuesta(r);
}

// El trozo sigue siendo un stream, con su longitud garantizada aguas arriba. FixedLengthStream
// (runtime de Workers) asegura el Content-Length —R2 rechaza un trozo de longitud desconocida— y
// corta si llegan más o menos bytes de los anunciados. Fuera de Workers (tests) va tal cual.
export function conLongitud(body, length) {
  if (typeof FixedLengthStream !== 'function') return body;
  const fijo = new FixedLengthStream(length);
  body.pipeTo(fijo.writable).catch(() => {});
  return fijo.readable;
}
