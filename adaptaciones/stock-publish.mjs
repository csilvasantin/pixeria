// Adaptaciones → Stock. Cada MP4 terminado se publica como vídeo nuevo con el mismo
// mecanismo de las subidas locales de pixeria.com (POST /stock/publish con base64),
// a través de /stock-publish (functions/stock-publish.js) para que funcione igual en preview.
// Metadatos que el Stock ya guarda: externalRef = id del vídeo original, validacion.ancho/alto
// = resolución, y etiquetas «adaptación», formato y cliente (id).
// Imagen fija (5-oct-2026): el MP4 hecho desde una imagen se publica igual, como vídeo, con la
// etiqueta «imagen-fija», «imagen fija · N s» en el prompt y la duración elegida en validacion.
export const STOCK_PUBLISH_URL = '/stock-publish';
export const MAX_STOCK_BYTES = 70 * 1024 * 1024; // base64 +33 % y el borde corta en 100 MB
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
export function stockPayload({base64, size, title, originId, client, format, width, height, duration, still}) {
  const resolution = `${width}×${height}`;
  const tags = [ADAPTATION_TAG, RATIO.test(format) ? format : null, still ? STILL_TAG : null, client?.id].filter(Boolean);
  return {
    type: 'video', motor: 'adaptador', mime: 'video/mp4', base64, quality: 'good',
    title,
    prompt: [`Adaptación · origen ${originId || 'archivo local'}`, still ? `imagen fija · ${Math.round(duration)} s` : null, `formato ${format}`, resolution, client ? `cliente ${client.id}` : null].filter(Boolean).join(' · '),
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
// `extra` (paquete por estanco) sustituye tags, externalRef y comment del payload.
export async function publishAdaptation(blob, meta, extra = null) {
  if (blob.size > MAX_STOCK_BYTES) return {ok: false, error: 'too-big'};
  const body = {...stockPayload({...meta, size: blob.size, base64: await toBase64(blob)}), ...(extra || {})};
  // Miniatura real del vídeo exportado (fotograma ~10 %): nada llega al Stock sin imagen.
  try {
    const {posterFromVideo} = await import('/assets/poster-frame.mjs');
    const url = URL.createObjectURL(blob);
    try { const poster = await posterFromVideo(url); if (poster) body.poster = poster; } finally { URL.revokeObjectURL(url); }
  } catch (_) {}
  const response = await fetch(STOCK_PUBLISH_URL, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});
  let data = {};
  try { data = await response.json(); } catch (_) {}
  if (!response.ok || data.ok === false || data.error) return {ok: false, error: data.error || `HTTP ${response.status}`};
  return {ok: true, id: data.id, num: data.num, reused: !!data.reused};
}
