/* POST /api/youtube/upload {id, title?, description?, privacyStatus?} → {ok, url, id}
 * GET  /api/youtube/upload → {ok, conectado} (para que el botón avise antes de abrir el modal).
 * Solo superusuarios (publica en el canal de Admira). Sin secretos: 503 «YouTube no conectado».
 */
import {sessionInfo, esSuperusuario} from '../../_auth.js';
import {youtubeConectado, esVideoCompartible, metadatosYoutube, subirAYoutube, STOCK_ORIGIN} from '../../_youtube.js';

const json = (status, obj) => new Response(JSON.stringify(obj), {status, headers: {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store'}});

export async function onRequestGet({env}) {
  return json(200, {ok: true, conectado: youtubeConectado(env)});
}

export async function onRequestPost({request, env, data}) {
  const fetchImpl = data?.fetchImpl || fetch;
  const auth = data?.sessionInfo || sessionInfo;
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) return json(403, {ok: false, error: 'invalid-origin'});
  const session = await auth(request, env);
  if (!session) return json(401, {ok: false, error: 'session-required'});
  if (!esSuperusuario(session)) return json(403, {ok: false, error: 'solo-superusuario'});
  if (!youtubeConectado(env)) return json(503, {ok: false, error: 'youtube-no-conectado', mensaje: 'YouTube no conectado'});
  let body; try { body = await request.json(); } catch { return json(400, {ok: false, error: 'bad-json'}); }
  const id = String(body?.id || '');
  if (!/^[A-Za-z0-9-]{1,80}$/.test(id)) return json(400, {ok: false, error: 'bad-id'});
  let indice;
  try { indice = await (await fetchImpl(`${STOCK_ORIGIN}/stock/index.json`, {cf: {cacheTtl: 30}})).json(); }
  catch { return json(502, {ok: false, error: 'stock-no-disponible'}); }
  const items = Array.isArray(indice) ? indice : (indice?.items || []);
  const it = items.find(x => x && String(x.id) === id);
  if (!it) return json(404, {ok: false, error: 'no-existe'});
  if (!esVideoCompartible(it)) return json(422, {ok: false, error: 'no-es-video'});
  try {
    const r = await subirAYoutube(env, it, metadatosYoutube(it, body), fetchImpl);
    return json(200, {ok: true, ...r});
  } catch (e) {
    return json(e.status || 502, {ok: false, error: e.codigo || 'youtube-error'});
  }
}
