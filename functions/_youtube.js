/* Publicar un vídeo del Stock en YouTube (Data API v3, videos.insert, subida reanudable).
 * Secretos del proyecto Pages (nunca en el repo): YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET,
 * YOUTUBE_REFRESH_TOKEN (scope https://www.googleapis.com/auth/youtube.upload). Ver docs/youtube-compartir.md.
 * El guion bajo inicial hace que Pages no lo publique como ruta.
 */
export const STOCK_ORIGIN = 'https://stock.admira.store';
export const PRIVACIDADES = ['private', 'unlisted', 'public'];
export const SECRETOS = ['YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET', 'YOUTUBE_REFRESH_TOKEN'];
const MAX_BYTES = 4 * 1024 * 1024 * 1024;

export function youtubeConectado(env) {
  return SECRETOS.every(k => typeof env?.[k] === 'string' && env[k].trim() !== '');
}

export function esVideoCompartible(it) {
  if (!it || typeof it.url !== 'string') return false;
  let u; try { u = new URL(it.url); } catch { return false; }
  if (u.origin !== STOCK_ORIGIN) return false;
  const mime = String(it.mime || '');
  return it.type === 'video' || mime.startsWith('video/') || /\.(mp4|webm|mov)$/i.test(u.pathname);
}

const limpiar = (s, n) => String(s ?? '').replace(/[<>]/g, '').trim().slice(0, n);

// Metadatos de YouTube a partir del asset (el usuario puede sobrescribir título, descripción y privacidad).
export function metadatosYoutube(it, over = {}) {
  const titulo = limpiar(over.title || it.title || it.prompt || `Admira Stock ${it.id}`, 100) || `Admira Stock ${it.id}`;
  const base = limpiar(over.description ?? (it.comment || it.prompt || ''), 4500);
  const fuente = `Fuente: ${it.url}`;
  const description = base.includes(it.url) ? base : (base ? `${base}\n\n${fuente}` : fuente);
  const tags = [...new Set((Array.isArray(it.tags) ? it.tags : []).map(t => limpiar(t, 30)).filter(Boolean))];
  let total = 0; const tagsOk = [];
  for (const t of tags) { if (total + t.length + 1 > 450) break; tagsOk.push(t); total += t.length + 1; }
  const privacyStatus = PRIVACIDADES.includes(over.privacyStatus) ? over.privacyStatus : 'unlisted';
  return {
    snippet: {title: titulo, description: description.slice(0, 5000), tags: tagsOk, categoryId: '22'},
    status: {privacyStatus, selfDeclaredMadeForKids: false},
  };
}

export async function accessToken(env, fetchImpl = fetch) {
  const r = await fetchImpl('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: new URLSearchParams({
      client_id: env.YOUTUBE_CLIENT_ID, client_secret: env.YOUTUBE_CLIENT_SECRET,
      refresh_token: env.YOUTUBE_REFRESH_TOKEN, grant_type: 'refresh_token',
    }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw Object.assign(new Error('oauth'), {codigo: 'youtube-oauth', status: 502, detalle: j.error || r.status});
  return j.access_token;
}

// Sube el vídeo: abre la sesión reanudable y le pasa el MP4 del Stock en streaming (sin cargarlo en memoria).
export async function subirAYoutube(env, it, meta, fetchImpl = fetch) {
  const token = await accessToken(env, fetchImpl);
  const src = await fetchImpl(it.url);
  if (!src.ok || !src.body) throw Object.assign(new Error('src'), {codigo: 'stock-no-disponible', status: 502});
  const len = Number(src.headers.get('content-length')) || 0;
  if (!len || len > MAX_BYTES) throw Object.assign(new Error('len'), {codigo: 'tamano-desconocido', status: 422});
  const mime = (src.headers.get('content-type') || it.mime || 'video/mp4').split(';')[0];
  const init = await fetchImpl('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
    method: 'POST',
    headers: {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': mime, 'X-Upload-Content-Length': String(len)},
    body: JSON.stringify(meta),
  });
  const loc = init.headers.get('location');
  if (!init.ok || !loc) {
    const j = await init.json().catch(() => ({}));
    const razon = j?.error?.errors?.[0]?.reason || '';
    throw Object.assign(new Error('init'), {codigo: razon === 'quotaExceeded' ? 'youtube-cuota' : 'youtube-init', status: init.status === 403 ? 429 : 502});
  }
  const up = await fetchImpl(loc, {method: 'PUT', headers: {'Content-Type': mime, 'Content-Length': String(len)}, body: src.body, duplex: 'half'});
  const v = await up.json().catch(() => ({}));
  if (!up.ok || !v.id) throw Object.assign(new Error('put'), {codigo: 'youtube-subida', status: 502});
  return {id: v.id, url: `https://youtu.be/${v.id}`, privacyStatus: v.status?.privacyStatus || meta.status.privacyStatus};
}
