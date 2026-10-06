/* /players-programar — programa los players del «Paquete por estanco» (Carlos, 6-oct-2026).
 *
 * Los players abren admira.tv/canal.html?screen=<id> y reproducen la lista por defecto de esa
 * pantalla (admira.tv/api/playlist, KV ACCESS). La única escritura posible desde aquí es
 * POST admira.tv/api/playlist con el secreto STOCK_NOTIFY_KEY (cabecera X-Notify-Key). Ese
 * secreto vive solo en el proyecto Pages (pixeria y admira-studio): nunca viaja al navegador.
 * Antes, stock.html lo pedía con prompt(); esta function lo sustituye para el Adaptador.
 *
 * POST /players-programar  {modo:'prueba'|'real', proyecto, piezas:[{estanco, pantalla, screenId,
 *   stockId|url, formato, duracion}], firma?}
 *  - Sesión de Pixeria obligatoria (la misma cookie firmada de la verja) → si no, 401.
 *  - Validación estricta contra adaptaciones/proyectos/estancos/<proyecto>.json (importado en el
 *    build, no copiado): estanco, pantalla, screenId y formato tienen que cuadrar; URLs solo de
 *    stock.admira.store; como mucho 50 piezas.
 *  - prueba: no escribe nada. Devuelve el plan exacto (qué lista de qué pantalla recibe qué y el
 *    payload que se enviaría), si cada pantalla existe hoy en la parrilla (GET público
 *    api.admira.store/grid/screens), qué tiene ahora su lista (GET público admira.tv/api/playlist) y si
 *    el Stock sirve cada asset (HEAD).
 *    Devuelve también `firma`: el SHA-256 de esos payloads.
 *  - real: exige la `firma` de la prueba (si el lote cambió, 409), que todas las pantallas existan,
 *    que los assets respondan y el secreto instalado (si falta, 503). Hace un POST por pantalla y devuelve el resultado por
 *    pieza, con quién (email de la sesión) y cuándo. Lo mismo va a los logs, sin secretos.
 * Ver docs/adaptador.md · «Programación de players».
 */
import {sessionInfo} from './_auth.js';
import ALTADIS_BCN from '../adaptaciones/proyectos/estancos/altadis-estancos-bcn.json' with {type: 'json'};

export const PLAYLIST_URL = 'https://admira.tv/api/playlist';
export const SCREENS_URL = 'https://api.admira.store/grid/screens';
export const STOCK_INDEX_URL = 'https://stock.admira.store/stock/index.json';
export const STOCK_HOST = 'stock.admira.store';
export const MAX_PIEZAS = 50;
const MAX_BODY = 64 * 1024;
const PROYECTOS = {'altadis-estancos-bcn': ALTADIS_BCN};
// Sin UA de navegador, Cloudflare responde 403 1010 (ver stock-publish.js y scripts/stock-subir.py).
const UA = 'Mozilla/5.0 (compatible; PixeriaAdaptador/1.0)';
const SECRETO_FALTA = 'falta configurar el secreto en el proyecto Pages (STOCK_NOTIFY_KEY)';

const HEADERS = {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow'};
const reply = (status, body) => new Response(JSON.stringify(body), {status, headers: HEADERS});
const fail = (status, error, extra = {}) => reply(status, {ok: false, error, ...extra});

const ID_RE = /^[a-z0-9][a-z0-9-]{0,79}$/;
const STOCK_ID_RE = /^[A-Za-z0-9_-]{1,80}$/;
const text = (v, n) => String(v ?? '').trim().slice(0, n);

// URL de un asset del Stock: https, host exacto stock.admira.store, sin usuario ni puerto.
export function stockURL(value) {
  let u;
  try { u = new URL(String(value || '')); } catch (_) { return null; }
  if (u.protocol !== 'https:' || u.hostname !== STOCK_HOST || u.username || u.password || u.port) return null;
  return u.href.length <= 1000 ? u.href : null;
}

// Valida la entrada. Devuelve {errors} o {doc, modo, piezas} con cada pieza ya resuelta contra el JSON.
export function validate(body) {
  const errors = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) return {errors: ['el cuerpo debe ser un objeto JSON']};
  const modo = body.modo;
  if (modo !== 'prueba' && modo !== 'real') errors.push("modo debe ser 'prueba' o 'real'");
  const doc = Object.hasOwn(PROYECTOS, String(body.proyecto)) ? PROYECTOS[body.proyecto] : null;
  if (!doc) errors.push(`proyecto desconocido: «${text(body.proyecto, 80)}»`);
  const raw = body.piezas;
  if (!Array.isArray(raw) || !raw.length) errors.push('piezas debe ser una lista con al menos una pieza');
  else if (raw.length > MAX_PIEZAS) errors.push(`como máximo ${MAX_PIEZAS} piezas (llegan ${raw.length})`);
  if (errors.length) return {errors};
  const piezas = [], seen = new Set();
  raw.forEach((p, i) => {
    const w = `piezas[${i}]`;
    if (!p || typeof p !== 'object') { errors.push(`${w}: no es un objeto`); return; }
    const est = ID_RE.test(p.estanco || '') ? doc.estancos.find(e => e.id === p.estanco) : null;
    if (!est) { errors.push(`${w}: el estanco «${text(p.estanco, 80)}» no es del proyecto`); return; }
    const pan = ID_RE.test(p.pantalla || '') ? est.pantallas.find(x => x.id === p.pantalla) : null;
    if (!pan) { errors.push(`${w}: la pantalla «${text(p.pantalla, 80)}» no existe en ${est.id}`); return; }
    if (p.screenId !== pan.screen) errors.push(`${w}: screenId debe ser «${pan.screen}»`);
    if (p.formato !== pan.formato) errors.push(`${w}: el formato de ${pan.screen} es «${pan.formato}», no «${text(p.formato, 40)}»`);
    const duracion = Number(p.duracion);
    if (!Number.isFinite(duracion) || duracion < 2 || duracion > 600) errors.push(`${w}: duracion en segundos, de 2 a 600`);
    const stockId = p.stockId == null || p.stockId === '' ? null : String(p.stockId);
    if (stockId !== null && !STOCK_ID_RE.test(stockId)) errors.push(`${w}: stockId no válido`);
    const url = p.url == null || p.url === '' ? null : stockURL(p.url);
    if (p.url != null && p.url !== '' && !url) errors.push(`${w}: la URL tiene que ser https://${STOCK_HOST}/…`);
    if (!stockId && !url) errors.push(`${w}: falta stockId o url`);
    if (url && stockId && !new URL(url).pathname.startsWith(`/stock/${stockId}/`)) errors.push(`${w}: la URL no es la del asset ${stockId}`);
    const key = `${pan.screen}|${stockId || url}`;
    if (seen.has(key)) errors.push(`${w}: pieza repetida en ${pan.screen}`);
    seen.add(key);
    piezas.push({i, estanco: est, pantalla: pan, stockId, url, formato: pan.formato, duracion: Math.round(duracion * 100) / 100});
  });
  return errors.length ? {errors} : {doc, modo, piezas};
}

async function getJSON(fetchImpl, url) {
  try {
    const r = await fetchImpl(url, {headers: {Accept: 'application/json', 'User-Agent': UA}, cache: 'no-store'});
    return r.ok ? await r.json() : null;
  } catch (_) { return null; }
}

// Las piezas con solo stockId toman la URL (y las medidas) del índice público del Stock.
async function resolveAssets(piezas, fetchImpl) {
  const errors = [];
  if (!piezas.some(p => p.stockId)) return errors;
  const index = await getJSON(fetchImpl, STOCK_INDEX_URL);
  const items = Array.isArray(index?.items) ? index.items : null;
  for (const p of piezas) {
    if (!p.stockId) continue;
    const it = items && items.find(x => x && x.id === p.stockId);
    if (!it) { if (!p.url) errors.push(`piezas[${p.i}]: ${items ? `el asset ${p.stockId} no está en el índice del Stock` : 'no se pudo leer el índice del Stock'}`); continue; }
    const url = stockURL(it.url);
    if (!url) { errors.push(`piezas[${p.i}]: el asset ${p.stockId} no está en ${STOCK_HOST}`); continue; }
    if (!p.url) p.url = url;
    p.titulo = text(it.title, 240);
    p.tipo = it.type;
    if (Number.isInteger(it.ancho) && Number.isInteger(it.alto) && (it.ancho !== p.pantalla.ancho || it.alto !== p.pantalla.alto)) {
      errors.push(`piezas[${p.i}]: ${p.stockId} mide ${it.ancho}×${it.alto} y ${p.pantalla.screen} ${p.pantalla.ancho}×${p.pantalla.alto}`);
    }
  }
  return errors;
}

// Un payload por pantalla, en el formato exacto de admira.tv/api/playlist (functions/api/playlist.js
// · cleanItem): {screen, name, source, items:[{id, stockId, title, sub, lane, seconds, asset, assetType, tags}]}.
// La lista por defecto se SUSTITUYE entera con las piezas del lote para esa pantalla.
export function buildPlan(doc, piezas) {
  const byScreen = new Map();
  for (const p of piezas) {
    const s = p.pantalla.screen;
    if (!byScreen.has(s)) byScreen.set(s, {screenId: s, estanco: p.estanco.id, estancoNombre: p.estanco.nombre, pantalla: p.pantalla.id, pantallaNombre: p.pantalla.nombre, pantallaNameEn: p.pantalla.nameEn, piezas: [], items: []});
    const row = byScreen.get(s), n = row.items.length + 1;
    row.piezas.push(p.i);
    const image = p.tipo === 'image' || /\.(png|jpe?g|webp|gif)(\?|$)/i.test(p.url);
    row.items.push({
      id: p.stockId || `${s}-${n}`, stockId: p.stockId || '',
      title: p.titulo || `${doc.proyecto} · ${p.formato}`,
      sub: `${p.estanco.nombre} · ${p.pantalla.nombre}`.slice(0, 300),
      lane: 'publicidad', seconds: p.duracion, asset: p.url, assetType: image ? 'image' : 'video',
      tags: [doc.proyecto, doc.circuito, p.estanco.id, `pantalla-${p.pantalla.id}`, p.formato, 'adaptador'].slice(0, 32)
    });
  }
  return [...byScreen.values()].map(row => ({
    ...row,
    payload: {screen: row.screenId, name: `${doc.proyecto} · ${row.estancoNombre}`.slice(0, 80), source: `adaptador ${doc.proyecto}`, items: row.items}
  }));
}

const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
export async function planSignature(plan) {
  const canon = JSON.stringify(plan.map(r => r.payload));
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canon)));
}

// ¿Responde el asset? HEAD al Stock público (sin descargar el vídeo).
async function reachable(fetchImpl, url) {
  try { const r = await fetchImpl(url, {method: 'HEAD', headers: {'User-Agent': UA}}); return r.ok; } catch (_) { return false; }
}

// Qué pantallas existen hoy (parrilla pública), qué tiene ahora su lista y si los assets responden.
// Solo lecturas (GET y HEAD).
async function inspect(plan, fetchImpl) {
  const grid = await getJSON(fetchImpl, SCREENS_URL);
  const known = Array.isArray(grid?.screens) ? new Set(grid.screens.map(s => s && s.screen)) : null;
  const urls = [...new Set(plan.flatMap(r => r.items.map(it => it.asset)))];
  const ok = new Map(await Promise.all(urls.map(async u => [u, await reachable(fetchImpl, u)])));
  const missing = urls.filter(u => !ok.get(u));
  await Promise.all(plan.map(async row => {
    row.assetsOk = row.items.every(it => ok.get(it.asset));
    row.existe = known ? known.has(row.screenId) : null;
    const live = await getJSON(fetchImpl, `${PLAYLIST_URL}?screen=${encodeURIComponent(row.screenId)}`);
    row.actual = live && live.ok && live.draft ? {items: Array.isArray(live.draft.items) ? live.draft.items.length : 0, rev: Number(live.draft.rev) || 0, updatedBy: text(live.draft.updatedBy, 80) || null} : null;
  }));
  return {gridOk: known !== null, missing};
}

function log(entry) { try { console.log(JSON.stringify({evento: 'players_programar', ...entry})); } catch (_) {} }

export async function onRequestPost(context) {
  const {request, env} = context;
  const fetchImpl = (...args) => fetch(...args);
  const session = await sessionInfo(request, env);
  if (!session) return fail(401, 'sin-sesion', {mensaje: 'Entra en Pixeria para programar players.'});
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) return fail(403, 'origen-no-valido');
  if (!/^application\/json\b/i.test(request.headers.get('Content-Type') || '')) return fail(415, 'solo-json');
  if (+request.headers.get('Content-Length') > MAX_BODY) return fail(413, 'demasiado-grande');
  let body;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY) return fail(413, 'demasiado-grande');
    body = JSON.parse(raw);
  } catch (_) { return fail(400, 'json-no-valido'); }
  const v = validate(body);
  if (v.errors) return fail(400, 'entrada-no-valida', {errores: v.errors.slice(0, 60)});
  const {doc, modo, piezas} = v;
  const secreto = String(env.STOCK_NOTIFY_KEY || '');
  if (modo === 'real' && !secreto) return fail(503, 'falta-secreto', {mensaje: SECRETO_FALTA});

  const assetErrors = await resolveAssets(piezas, fetchImpl);
  if (assetErrors.length) return fail(400, 'entrada-no-valida', {errores: assetErrors.slice(0, 60)});
  const plan = buildPlan(doc, piezas);
  const firma = await planSignature(plan);
  const {gridOk, missing: assetsNoDisponibles} = await inspect(plan, fetchImpl);
  const inexistentes = plan.filter(r => r.existe !== true).map(r => r.screenId);
  const quien = session.email, cuando = new Date().toISOString();
  const estancos = new Set(plan.map(r => r.estanco)).size;
  const resumen = {piezas: piezas.length, pantallas: plan.length, estancos, inexistentes: inexistentes.length, assetsNoDisponibles: assetsNoDisponibles.length, parrilla: gridOk};
  const pantallas = plan.map(r => ({screenId: r.screenId, estanco: r.estanco, estancoNombre: r.estancoNombre, pantalla: r.pantalla, pantallaNombre: r.pantallaNombre, pantallaNameEn: r.pantallaNameEn, existe: r.existe, assetsOk: r.assetsOk, actual: r.actual, piezas: r.piezas}));

  if (modo === 'prueba') {
    log({modo, quien, cuando, proyecto: doc.proyecto, piezas: piezas.length, pantallas: plan.length, inexistentes});
    return reply(200, {
      ok: true, modo, proyecto: doc.proyecto, circuito: doc.circuito, quien, cuando, firma, resumen,
      secretoConfigurado: Boolean(secreto), inexistentes, assetsNoDisponibles,
      destino: `POST ${PLAYLIST_URL}`, autenticacion: 'X-Notify-Key: STOCK_NOTIFY_KEY (secreto del proyecto Pages, solo en el servidor)',
      plan: plan.map(r => ({screenId: r.screenId, existe: r.existe, assetsOk: r.assetsOk, actual: r.actual, sustituye: r.actual ? r.actual.items : null, payload: r.payload})),
      pantallas
    });
  }

  // modo real: lo mismo que se probó, con todas las pantallas dadas de alta.
  if (String(body.firma || '') !== firma) {
    log({modo, quien, cuando, proyecto: doc.proyecto, bloqueado: 'firma'});
    return fail(409, 'prueba-pendiente', {mensaje: 'Prueba la programación de este lote antes de programarlo.', firma});
  }
  if (!gridOk) return fail(503, 'parrilla-no-disponible', {mensaje: `No se pudo leer ${SCREENS_URL}.`});
  if (inexistentes.length) {
    log({modo, quien, cuando, proyecto: doc.proyecto, bloqueado: 'inexistentes', inexistentes});
    return fail(409, 'pantallas-inexistentes', {inexistentes, mensaje: 'Hay pantallas que no existen en la parrilla: no se programa nada.'});
  }
  if (assetsNoDisponibles.length) {
    log({modo, quien, cuando, proyecto: doc.proyecto, bloqueado: 'assets', assetsNoDisponibles});
    return fail(409, 'assets-no-disponibles', {assetsNoDisponibles, mensaje: 'Hay piezas que el Stock no sirve: no se programa nada.'});
  }
  const resultados = [];
  for (const row of plan) {
    const payload = row.actual && row.actual.rev ? {...row.payload, rev: row.actual.rev} : row.payload;
    let status = 0, data = {};
    try {
      const r = await fetchImpl(PLAYLIST_URL, {method: 'POST', headers: {'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': UA, 'X-Notify-Key': secreto}, body: JSON.stringify(payload)});
      status = r.status; data = await r.json().catch(() => ({}));
    } catch (_) { data = {error: 'red'}; }
    const ok = status === 200 && data.ok === true;
    resultados.push({screenId: row.screenId, estanco: row.estanco, pantalla: row.pantalla, ok, status, items: row.items.length, rev: ok ? (data.rev ?? data.draft?.rev ?? null) : null, error: ok ? null : text(data.error || `HTTP ${status}`, 80)});
  }
  const porPieza = piezas.map(p => { const r = resultados.find(x => x.screenId === p.pantalla.screen); return {pieza: p.i, estanco: p.estanco.id, pantalla: p.pantalla.id, screenId: p.pantalla.screen, ok: r.ok, rev: r.rev, error: r.error}; });
  const ok = resultados.every(r => r.ok);
  log({modo, quien, cuando, proyecto: doc.proyecto, firma, ok, resultados: resultados.map(r => ({screenId: r.screenId, ok: r.ok, status: r.status, items: r.items, rev: r.rev, error: r.error}))});
  return reply(ok ? 200 : 502, {ok, modo, proyecto: doc.proyecto, circuito: doc.circuito, quien, cuando, firma, resumen, resultados, piezas: porPieza});
}

export function onRequestGet() {
  return new Response(JSON.stringify({ok: false, error: 'solo-post'}), {status: 405, headers: {...HEADERS, Allow: 'POST'}});
}
