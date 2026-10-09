// Adaptaciones → Stock. Cada MP4 terminado se publica como vídeo nuevo con el mismo
// mecanismo de las subidas locales de pixeria.com (POST /stock/publish con base64),
// a través de /stock-publish (functions/stock-publish.js) para que funcione igual en preview.
// Metadatos que el Stock ya guarda: externalRef = id del vídeo original, validacion.ancho/alto
// = resolución, y etiquetas «adaptación», formato y cliente (id).
// Imagen fija (5-oct-2026): el MP4 hecho desde una imagen se publica igual, como vídeo, con la
// etiqueta «imagen-fija», «imagen fija · N s» en el prompt y la duración elegida en validacion.
// Subida por partes (8-oct-2026): un MP4 de 30 s a ~18 Mbps (Altadis) pesa ~70 MB y en base64
// eran ~97 MB de JSON que /stock-publish no podía tener en memoria (503 «Worker exceeded resource
// limits»). Por encima de PARTS_THRESHOLD el MP4 viaja crudo, en trozos, por /stock-upload/*
// (functions/stock-upload/[accion].js) y se publica con `r2Staged` en vez de base64. El Stock
// guarda la misma entrada por los dos caminos. El bitrate no se toca: lo fijan las especificaciones.
// Cliente común (9-oct-2026): uploadInParts y stockSource los usan también la caja 2 del Adaptador
// (importar.js) y el Stock de pixeria.com (app.js · publishToStock), cada uno con su tipo, mime y motor.
export const STOCK_PUBLISH_URL = '/stock-publish';
export const STOCK_UPLOAD_URL = '/stock-upload';
export const PARTS_THRESHOLD = 8 * 1024 * 1024;    // hasta aquí, base64 como siempre
export const MAX_STOCK_BYTES = 500 * 1024 * 1024;  // tope del Adaptador y de su caja 2 (importar.js)
export const PART_CONCURRENCY = 2;                 // trozos en vuelo a la vez
export const PART_ATTEMPTS = 3;                    // intentos por trozo (1 + 2 reintentos)
export const ADAPTATION_TAG = 'adaptación';
export const STILL_TAG = 'imagen-fija';
const RATIO = /^\d+:\d+$/;
// «9:16» para los formatos de proporción; el nombre del tamaño para el resto.
export function shortFormat(format, output) {
  if (format && RATIO.test(format.id)) return format.id;
  return String(output?.label || format?.nombre || format?.id || '').trim();
}
export function adaptationTitle(title, client, format) {
  return [String(title || '').trim(), client?.nombre, format].filter(Boolean).join(' · ').slice(0, 300);
}
// Crear (6-oct-2026): un MP4 hecho con una receta lleva además su etiqueta (crear-tira, crear-barrido, crear-rotulo).
export const recipeTag = receta => ['tira', 'barrido', 'rotulo'].includes(receta) ? `crear-${receta}` : null;
export function stockPayload({base64, size, title, originId, client, format, width, height, duration, still, receta}) {
  const resolution = `${width}×${height}`;
  const tags = [ADAPTATION_TAG, RATIO.test(format) ? format : null, still ? STILL_TAG : null, recipeTag(receta), client?.id].filter(Boolean);
  return {
    type: 'video', motor: 'adaptador', mime: 'video/mp4', base64, quality: 'good',
    title,
    prompt: [`Adaptación · origen ${originId || 'archivo local'}`, recipeTag(receta) ? `crear · receta ${receta}` : null, still ? `imagen fija · ${Math.round(duration)} s` : null, `formato ${format}`, resolution, client ? `cliente ${client.id}` : null].filter(Boolean).join(' · '),
    tags,
    externalRef: originId || null,
    validacion: {ok: true, ancho: width, alto: height, duracion: Number.isFinite(duration) ? Math.round(duration * 100) / 100 : null, por: 'adaptador'},
    costEst: `adaptador · ${(size / 1048576).toFixed(2)}MB`
  };
}
const toBase64 = blob => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ''));
  reader.onerror = () => reject(reader.error || new Error('read'));
  reader.readAsDataURL(blob);
});
// Trozos de la subida: todos de `partSize` menos el último, como exige R2. n empieza en 1.
export function planParts(size, partSize) {
  const parts = [];
  for (let n = 1, start = 0; start < size; n++, start += partSize) parts.push({n, start, end: Math.min(start + partSize, size)});
  return parts;
}
const pausa = ms => new Promise(resolve => setTimeout(resolve, ms));
const leerJSON = async response => { try { return await response.json(); } catch (_) { return {}; } };
// Sube el fichero crudo a uploads/ del Stock: start → trozos (PART_CONCURRENCY a la vez, PART_ATTEMPTS
// intentos cada uno ante red caída, 408, 429 o 5xx) → complete. Si algo falla, abort: no deja
// trozos colgando. Devuelve {ok, key} para publicar con r2Staged, o {ok:false, error}.
// onProgress(bytesSubidos, total) tras cada trozo. Por defecto, el MP4 del Adaptador; quien suba
// otra cosa pasa su type ('video'|'audio'|'image'), su mime y su motor.
export async function uploadInParts(blob, {fetch: f = (...a) => fetch(...a), motor = 'adaptador', type = 'video', mime = 'video/mp4', onProgress = null, concurrency = PART_CONCURRENCY, attempts = PART_ATTEMPTS, wait = pausa} = {}) {
  const post = (accion, body) => f(`${STOCK_UPLOAD_URL}/${accion}`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});
  let ini;
  try {
    const r = await post('start', {type, motor, mime, size: blob.size});
    ini = await leerJSON(r);
    if (!r.ok || !ini.ok) return {ok: false, error: ini.error || `HTTP ${r.status}`};
  } catch (_) { return {ok: false, error: 'network'}; }
  const {key, uploadId, partSize} = ini;
  if (!key || !uploadId || !(partSize > 0)) return {ok: false, error: 'bad-start'};
  const cola = planParts(blob.size, partSize), parts = [];
  let subido = 0, fallo = null;
  const subirTrozo = async ({n, start, end}) => {
    for (let intento = 1; ; intento++) {
      let r = null, d = {};
      try {
        r = await f(`${STOCK_UPLOAD_URL}/part?${new URLSearchParams({key, uploadId, n: String(n)})}`, {method: 'PUT', headers: {'Content-Type': 'application/octet-stream'}, body: blob.slice(start, end)});
        d = await leerJSON(r);
      } catch (_) { r = null; }
      if (r && r.ok && d.etag) return {partNumber: d.partNumber || n, etag: d.etag};
      const reintentable = !r || r.status === 408 || r.status === 429 || r.status >= 500;
      if (!reintentable || intento >= attempts) throw new Error(d.error || (r ? `HTTP ${r.status}` : 'network'));
      await wait(800 * intento);
    }
  };
  const obrero = async () => {
    while (!fallo && cola.length) {
      const trozo = cola.shift();
      try {
        parts[trozo.n - 1] = await subirTrozo(trozo);
        subido += trozo.end - trozo.start;
        if (onProgress) onProgress(subido, blob.size);
      } catch (e) { fallo = fallo || e; }
    }
  };
  await Promise.all(Array.from({length: Math.min(concurrency, cola.length)}, obrero));
  let error = fallo ? String(fallo.message || fallo) : null;
  if (!error) {
    try {
      const r = await post('complete', {key, uploadId, parts});
      const d = await leerJSON(r);
      if (r.ok && d.ok) return {ok: true, key, size: d.size};
      error = d.error || `HTTP ${r.status}`;
    } catch (_) { error = 'network'; }
  }
  try { await post('abort', {key, uploadId}); } catch (_) {}
  return {ok: false, error};
}
// Cómo viaja el fichero a /stock-publish: {base64} hasta PARTS_THRESHOLD, o subido antes por partes y
// {r2Staged}. Devuelve {ok, fields} para mezclar con los metadatos, o {ok:false, error} ('too-big' si
// pasa de maxBytes). Las mismas opciones que uploadInParts.
export async function stockSource(blob, {maxBytes = MAX_STOCK_BYTES, ...opts} = {}) {
  if (blob.size > maxBytes) return {ok: false, error: 'too-big'};
  if (blob.size <= PARTS_THRESHOLD) return {ok: true, fields: {base64: await toBase64(blob)}};
  const subida = await uploadInParts(blob, opts);
  return subida.ok ? {ok: true, fields: {r2Staged: subida.key}} : {ok: false, error: subida.error};
}
// `extra` (paquete por estanco) sustituye tags, externalRef y comment del payload.
// `opts.onProgress(bytes, total)` informa de la subida por partes (solo por encima de PARTS_THRESHOLD).
export async function publishAdaptation(blob, meta, extra = null, {onProgress = null, fetch: f = (...a) => fetch(...a)} = {}) {
  const fuente = await stockSource(blob, {fetch: f, onProgress});
  if (!fuente.ok) return fuente;
  const {base64: _, ...payload} = stockPayload({...meta, size: blob.size});
  const body = {...payload, ...(extra || {}), ...fuente.fields};
  // Miniatura real del vídeo exportado (fotograma ~10 %): nada llega al Stock sin imagen.
  try {
    const {posterFromVideo} = await import('/assets/poster-frame.mjs');
    const url = URL.createObjectURL(blob);
    try { const poster = await posterFromVideo(url); if (poster) body.poster = poster; } finally { URL.revokeObjectURL(url); }
  } catch (_) {}
  const response = await f(STOCK_PUBLISH_URL, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});
  let data = {};
  try { data = await response.json(); } catch (_) {}
  if (!response.ok || data.ok === false || data.error) return {ok: false, error: data.error || `HTTP ${response.status}`};
  return {ok: true, id: data.id, num: data.num, reused: !!data.reused};
}
