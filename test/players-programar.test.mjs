// node --test test/players-programar.test.mjs — /players-programar (Carlos, 6-oct-2026).
// Sesión de la verja, validación estricta, modo prueba sin escrituras, modo real con fetch simulado
// y el secreto solo en la cabecera X-Notify-Key, y 503 si falta el secreto. Ninguna llamada sale a la red.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {onRequestPost, onRequestGet, validate, stockURL, PLAYLIST_URL, SCREENS_URL, STOCK_INDEX_URL, MAX_PIEZAS} from '../functions/players-programar.js';
import {handleAuth} from '../functions/_auth.js';

const DOC = JSON.parse(await readFile(new URL('../adaptaciones/proyectos/estancos/altadis-estancos-bcn.json', import.meta.url), 'utf8'));
const SIGNING = 'test-signing-key-with-enough-entropy';
const AGENT = 'token-de-agente-de-prueba-con-32-caracteres-o-mas';
const SECRET = 'clave-del-stock-de-prueba';
const baseEnv = (extra = {}) => ({PIXERIA_SIGNING_KEY: SIGNING, ADMIRA_AGENT_LOGIN_TOKEN: AGENT, ...extra});

// Cookie de sesión real: la abre /auth/agente con el token (mismo mecanismo que la verja).
async function agentCookie(env) {
  const r = await handleAuth(new Request('https://www.pixeria.com/auth/agente', {method: 'POST', headers: {Authorization: `Bearer ${AGENT}`, 'X-Agente': 'SubMorfeoMacMini'}}), env);
  assert.equal(r.status, 200);
  return r.headers.get('set-cookie').split(';')[0];
}
const est = id => DOC.estancos.find(e => e.id === id);
const pieza = (id, pan, extra = {}) => {
  const p = est(id).pantallas.find(x => x.id === pan);
  return {estanco: id, pantalla: pan, screenId: p.screen, formato: p.formato, duracion: 10, url: `https://stock.admira.store/stock/s-${p.formato}/asset.mp4?v=1`, ...extra};
};
const LOTE = [pieza('altadis-bcn-003', 'p1-vertical'), pieza('altadis-bcn-003', 'p2-horizontal'), pieza('altadis-bcn-007', 'p1-vertical')];
const post = (body, cookie, headers = {}) => new Request('https://www.pixeria.com/players-programar', {
  method: 'POST', headers: {'Content-Type': 'application/json', ...(cookie ? {Cookie: cookie} : {}), ...headers}, body: typeof body === 'string' ? body : JSON.stringify(body)
});

// fetch simulado: parrilla, listas actuales, índice del Stock y POST de admira.tv. Registra todo.
function fakeNet(t, {screens = null, live = {}, index = null, postStatus = 200, broken = []} = {}) {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (input, init = {}) => {
    const url = String(input instanceof Request ? input.url : input), method = (init.method || 'GET').toUpperCase();
    const headers = new Headers(init.headers || {});
    calls.push({url, method, headers, body: init.body ? JSON.parse(init.body) : null});
    if (method === 'GET' && url === SCREENS_URL) return Response.json({ok: true, screens: (screens || []).map(screen => ({screen, circuit: 'altadis_bcn'}))});
    if (method === 'GET' && url.startsWith(PLAYLIST_URL + '?screen=')) {
      const screen = new URL(url).searchParams.get('screen');
      return Response.json({ok: true, draft: {screen, playlist: 'default', items: live[screen] || [], rev: live[screen] ? 42 : 0, updatedAt: 0}});
    }
    if (method === 'HEAD' && url.startsWith('https://stock.admira.store/stock/')) return new Response(null, {status: broken.includes(url) ? 404 : 200});
    if (method === 'GET' && url === STOCK_INDEX_URL) return index ? Response.json(index) : new Response('no', {status: 500});
    if (method === 'POST' && url === PLAYLIST_URL) {
      const body = JSON.parse(init.body);
      if (postStatus !== 200) return Response.json({ok: false, error: 'unauthorized'}, {status: postStatus});
      return Response.json({ok: true, draft: {...body, rev: 1001, updatedBy: 'pixeria-stock · ' + body.source}, rev: 1001, updatedAt: 1});
    }
    throw new Error('red no simulada: ' + method + ' ' + url);
  });
  return calls;
}
const writes = calls => calls.filter(c => c.method !== 'GET' && c.method !== 'HEAD');
const ALL_SCREENS = LOTE.map(p => p.screenId);

test('sin sesión → 401 y no toca la red', async t => {
  const calls = fakeNet(t);
  for (const cookie of [null, '__Host-pixeria_session=falsa.firma']) {
    const r = await onRequestPost({request: post({modo: 'prueba', proyecto: 'altadis-estancos-bcn', piezas: LOTE}, cookie), env: baseEnv({STOCK_NOTIFY_KEY: SECRET})});
    assert.equal(r.status, 401);
    assert.equal((await r.json()).error, 'sin-sesion');
  }
  assert.equal(calls.length, 0);
  const g = await onRequestGet();
  assert.equal(g.status, 405);
});

test('sesión de un usuario de Google en la lista (cookie firmada) también vale', async t => {
  const user = {email: 'csilvasantin@gmail.com', google_sub: 'g-1', status: 'active', session_version: 1};
  const db = {prepare: sql => ({bind() { return this; }, run: async () => ({}), first: async () => sql.startsWith('SELECT * FROM pixeria_users') ? user : null})};
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({v: 1, aud: 'pixeria.com', email: user.email, sub: user.google_sub, sv: 1, iat: now, exp: now + 3600, sid: 's'})).toString('base64url');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(SIGNING), {name: 'HMAC', hash: 'SHA-256'}, false, ['sign']);
  const sig = Buffer.from(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode('px:' + payload))).toString('base64url');
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (input, init = {}) => {
    const url = String(input); calls.push({url, method: init.method || 'GET'});
    if (url.startsWith('https://whitelist.admira.store/')) return Response.json({emails: [user.email]});
    if (url === SCREENS_URL) return Response.json({ok: true, screens: []});
    if (url.startsWith(PLAYLIST_URL)) return Response.json({ok: true, draft: {items: [], rev: 0}});
    if (url.startsWith('https://stock.admira.store/')) return new Response(null, {status: 200});
    throw new Error('red no simulada ' + url);
  });
  const r = await onRequestPost({request: post({modo: 'prueba', proyecto: 'altadis-estancos-bcn', piezas: LOTE}, `__Host-pixeria_session=${payload}.${sig}`), env: {PIXERIA_SIGNING_KEY: SIGNING, AUTH_DB: db}});
  assert.equal(r.status, 200);
  assert.equal((await r.json()).quien, 'csilvasantin@gmail.com');
  assert.ok(calls.every(c => c.method === 'GET' || c.method === 'HEAD'));
});

test('entrada inválida → 400 con la lista de errores', async t => {
  const env = baseEnv({STOCK_NOTIFY_KEY: SECRET}), cookie = await agentCookie(env);
  const calls = fakeNet(t);
  const cases = [
    [{modo: 'prueba', proyecto: 'otro-proyecto', piezas: LOTE}, /proyecto desconocido/],
    [{modo: 'borrar', proyecto: 'altadis-estancos-bcn', piezas: LOTE}, /modo debe ser/],
    [{modo: 'prueba', proyecto: 'altadis-estancos-bcn', piezas: []}, /al menos una pieza/],
    [{modo: 'prueba', proyecto: 'altadis-estancos-bcn', piezas: Array.from({length: MAX_PIEZAS + 1}, () => LOTE[0])}, /como máximo 50/],
    [{modo: 'prueba', proyecto: 'altadis-estancos-bcn', piezas: [{...LOTE[0], estanco: 'altadis-bcn-099'}]}, /no es del proyecto/],
    [{modo: 'prueba', proyecto: 'altadis-estancos-bcn', piezas: [{...LOTE[0], pantalla: 'p3-led'}]}, /no existe en altadis-bcn-003/],
    [{modo: 'prueba', proyecto: 'altadis-estancos-bcn', piezas: [{...LOTE[0], screenId: 'altadis-bcn-004-p1-vertical'}]}, /screenId debe ser/],
    [{modo: 'prueba', proyecto: 'altadis-estancos-bcn', piezas: [{...LOTE[0], formato: 'cliente-02'}]}, /el formato de/],
    [{modo: 'prueba', proyecto: 'altadis-estancos-bcn', piezas: [{...LOTE[0], url: 'https://evil.example/stock/x/asset.mp4'}]}, /stock\.admira\.store/],
    [{modo: 'prueba', proyecto: 'altadis-estancos-bcn', piezas: [{...LOTE[0], url: 'http://stock.admira.store/stock/x/asset.mp4'}]}, /stock\.admira\.store/],
    [{modo: 'prueba', proyecto: 'altadis-estancos-bcn', piezas: [{...LOTE[0], url: 'https://stock.admira.store.evil.example/x.mp4'}]}, /stock\.admira\.store/],
    [{modo: 'prueba', proyecto: 'altadis-estancos-bcn', piezas: [{...LOTE[0], url: null}]}, /falta stockId o url/],
    [{modo: 'prueba', proyecto: 'altadis-estancos-bcn', piezas: [{...LOTE[0], duracion: 0}]}, /duracion/],
    [{modo: 'prueba', proyecto: 'altadis-estancos-bcn', piezas: [LOTE[0], LOTE[0]]}, /repetida/],
    [{modo: 'prueba', proyecto: '__proto__', piezas: LOTE}, /proyecto desconocido/],
  ];
  for (const [body, re] of cases) {
    const r = await onRequestPost({request: post(body, cookie), env});
    assert.equal(r.status, 400, JSON.stringify(body).slice(0, 120));
    const out = await r.json();
    assert.equal(out.error, 'entrada-no-valida');
    assert.ok(out.errores.some(e => re.test(e)), `${re} ∉ ${out.errores.join(' | ')}`);
  }
  const bad = await onRequestPost({request: post('{no-json', cookie), env});
  assert.equal(bad.status, 400);
  const form = await onRequestPost({request: post(JSON.stringify({modo: 'prueba'}), cookie, {'Content-Type': 'text/plain'}), env});
  assert.equal(form.status, 415);
  const cross = await onRequestPost({request: post({modo: 'prueba', proyecto: 'altadis-estancos-bcn', piezas: LOTE}, cookie, {Origin: 'https://evil.example'}), env});
  assert.equal(cross.status, 403);
  assert.equal(calls.length, 0, 'una entrada inválida no consulta nada fuera');
  assert.equal(stockURL('https://stock.admira.store:8443/x'), null);
  assert.equal(stockURL('https://u:p@stock.admira.store/x'), null);
  assert.equal(validate({modo: 'prueba', proyecto: 'altadis-estancos-bcn', piezas: LOTE}).piezas.length, 3);
});

test('modo prueba: plan exacto, pantallas inexistentes y ninguna escritura (aunque falte el secreto)', async t => {
  const env = baseEnv(), cookie = await agentCookie(env);
  const calls = fakeNet(t, {screens: ['altadis-bcn-003-p1-vertical'], live: {'altadis-bcn-003-p1-vertical': [{id: 'viejo'}]}});
  const r = await onRequestPost({request: post({modo: 'prueba', proyecto: 'altadis-estancos-bcn', piezas: LOTE}, cookie), env});
  assert.equal(r.status, 200);
  const out = await r.json();
  assert.equal(out.ok, true); assert.equal(out.modo, 'prueba');
  assert.equal(out.quien, 'agentes@silicio.admiranext.com');
  assert.equal(out.secretoConfigurado, false);
  assert.match(out.firma, /^[0-9a-f]{64}$/);
  assert.deepEqual(out.resumen, {piezas: 3, pantallas: 3, estancos: 2, inexistentes: 2, assetsNoDisponibles: 0, parrilla: true});
  assert.ok(calls.some(c => c.method === 'HEAD' && c.url === LOTE[0].url), 'comprueba que el Stock sirve el asset');
  assert.deepEqual(out.inexistentes, ['altadis-bcn-003-p2-horizontal', 'altadis-bcn-007-p1-vertical']);
  assert.equal(out.destino, `POST ${PLAYLIST_URL}`);
  const first = out.plan[0];
  assert.equal(first.existe, true); assert.equal(first.assetsOk, true); assert.equal(first.sustituye, 1); assert.deepEqual(first.actual, {items: 1, rev: 42, updatedBy: null});
  // El payload es el de admira.tv/api/playlist (cleanItem): screen, name, source e items con asset https.
  assert.deepEqual(Object.keys(first.payload).sort(), ['items', 'name', 'screen', 'source']);
  assert.equal(first.payload.screen, 'altadis-bcn-003-p1-vertical');
  assert.equal(first.payload.source, 'adaptador altadis-estancos-bcn');
  const item = first.payload.items[0];
  assert.deepEqual(Object.keys(item).sort(), ['asset', 'assetType', 'id', 'lane', 'seconds', 'stockId', 'sub', 'tags', 'title']);
  assert.equal(item.asset, LOTE[0].url); assert.equal(item.assetType, 'video'); assert.equal(item.seconds, 10); assert.equal(item.lane, 'publicidad');
  assert.ok(item.tags.includes('altadis-bcn-003') && item.tags.includes('altadis_bcn'));
  assert.equal(JSON.stringify(out).includes(SECRET), false);
  assert.deepEqual(writes(calls), [], 'la prueba no escribe nada fuera');
  assert.ok(calls.every(c => !c.headers.has('X-Notify-Key')));
  // Misma entrada → misma firma.
  const again = await (await onRequestPost({request: post({modo: 'prueba', proyecto: 'altadis-estancos-bcn', piezas: LOTE}, cookie), env})).json();
  assert.equal(again.firma, out.firma);
});

test('modo prueba resuelve stockId con el índice público del Stock y comprueba medidas', async t => {
  const env = baseEnv({STOCK_NOTIFY_KEY: SECRET}), cookie = await agentCookie(env);
  const index = {items: [{id: 'v-vert', type: 'video', title: 'Spot vertical', url: 'https://stock.admira.store/stock/v-vert/asset.mp4?v=9', ancho: 1080, alto: 1920}, {id: 'v-hor', type: 'video', title: 'Spot', url: 'https://stock.admira.store/stock/v-hor/asset.mp4', ancho: 1920, alto: 1080}]};
  const calls = fakeNet(t, {screens: ALL_SCREENS, index});
  const piezas = [{...LOTE[0], url: undefined, stockId: 'v-vert'}];
  const out = await (await onRequestPost({request: post({modo: 'prueba', proyecto: 'altadis-estancos-bcn', piezas}, cookie), env})).json();
  assert.equal(out.plan[0].payload.items[0].asset, 'https://stock.admira.store/stock/v-vert/asset.mp4?v=9');
  assert.equal(out.plan[0].payload.items[0].title, 'Spot vertical');
  assert.equal(out.plan[0].payload.items[0].stockId, 'v-vert');
  const wrong = await onRequestPost({request: post({modo: 'prueba', proyecto: 'altadis-estancos-bcn', piezas: [{...LOTE[0], url: undefined, stockId: 'v-hor'}]}, cookie), env});
  assert.equal(wrong.status, 400);
  assert.match((await wrong.json()).errores[0], /mide 1920×1080/);
  const missing = await onRequestPost({request: post({modo: 'prueba', proyecto: 'altadis-estancos-bcn', piezas: [{...LOTE[0], url: undefined, stockId: 'no-existe'}]}, cookie), env});
  assert.equal(missing.status, 400);
  assert.deepEqual(writes(calls), []);
});

test('modo real sin secreto → 503 con mensaje claro y sin llamadas', async t => {
  const env = baseEnv(), cookie = await agentCookie(env);
  const calls = fakeNet(t, {screens: ALL_SCREENS});
  const r = await onRequestPost({request: post({modo: 'real', proyecto: 'altadis-estancos-bcn', piezas: LOTE, firma: 'x'}, cookie), env});
  assert.equal(r.status, 503);
  const out = await r.json();
  assert.equal(out.error, 'falta-secreto');
  assert.match(out.mensaje, /falta configurar el secreto en el proyecto Pages/);
  assert.equal(calls.length, 0);
});

test('modo real: exige la firma de la prueba y que existan todas las pantallas', async t => {
  const env = baseEnv({STOCK_NOTIFY_KEY: SECRET}), cookie = await agentCookie(env);
  const calls = fakeNet(t, {screens: ['altadis-bcn-003-p1-vertical']});
  const {firma} = await (await onRequestPost({request: post({modo: 'prueba', proyecto: 'altadis-estancos-bcn', piezas: LOTE}, cookie), env})).json();
  const sinFirma = await onRequestPost({request: post({modo: 'real', proyecto: 'altadis-estancos-bcn', piezas: LOTE}, cookie), env});
  assert.equal(sinFirma.status, 409); assert.equal((await sinFirma.json()).error, 'prueba-pendiente');
  const otroLote = await onRequestPost({request: post({modo: 'real', proyecto: 'altadis-estancos-bcn', piezas: LOTE.slice(0, 2), firma}, cookie), env});
  assert.equal(otroLote.status, 409);
  const faltan = await onRequestPost({request: post({modo: 'real', proyecto: 'altadis-estancos-bcn', piezas: LOTE, firma}, cookie), env});
  assert.equal(faltan.status, 409);
  const out = await faltan.json();
  assert.equal(out.error, 'pantallas-inexistentes'); assert.equal(out.inexistentes.length, 2);
  assert.deepEqual(writes(calls), [], 'sin pantallas no se escribe nada');
});

test('modo real: si el Stock no sirve un asset, no se programa nada', async t => {
  const env = baseEnv({STOCK_NOTIFY_KEY: SECRET}), cookie = await agentCookie(env);
  const calls = fakeNet(t, {screens: ALL_SCREENS, broken: [LOTE[1].url]});
  t.mock.method(console, 'log', () => {});
  const prueba = await (await onRequestPost({request: post({modo: 'prueba', proyecto: 'altadis-estancos-bcn', piezas: LOTE}, cookie), env})).json();
  assert.deepEqual(prueba.assetsNoDisponibles, [LOTE[1].url]);
  assert.equal(prueba.plan[1].assetsOk, false);
  const r = await onRequestPost({request: post({modo: 'real', proyecto: 'altadis-estancos-bcn', piezas: LOTE, firma: prueba.firma}, cookie), env});
  assert.equal(r.status, 409); assert.equal((await r.json()).error, 'assets-no-disponibles');
  assert.deepEqual(writes(calls), []);
});

test('modo real: un POST por pantalla con X-Notify-Key, quién y cuándo, resultado por pieza', async t => {
  const env = baseEnv({STOCK_NOTIFY_KEY: SECRET}), cookie = await agentCookie(env);
  const calls = fakeNet(t, {screens: ALL_SCREENS, live: {'altadis-bcn-007-p1-vertical': [{id: 'viejo'}]}});
  const logs = []; t.mock.method(console, 'log', (...a) => logs.push(a.join(' ')));
  const lote = [...LOTE, pieza('altadis-bcn-003', 'p1-vertical', {url: 'https://stock.admira.store/stock/otra/asset.mp4', duracion: 15})];
  const {firma} = await (await onRequestPost({request: post({modo: 'prueba', proyecto: 'altadis-estancos-bcn', piezas: lote}, cookie), env})).json();
  const r = await onRequestPost({request: post({modo: 'real', proyecto: 'altadis-estancos-bcn', piezas: lote, firma}, cookie), env});
  assert.equal(r.status, 200);
  const out = await r.json();
  assert.equal(out.ok, true); assert.equal(out.modo, 'real');
  assert.equal(out.quien, 'agentes@silicio.admiranext.com');
  assert.ok(Date.parse(out.cuando) > 0);
  const sent = writes(calls);
  assert.equal(sent.length, 3, 'una escritura por pantalla, no por pieza');
  for (const c of sent) {
    assert.equal(c.url, PLAYLIST_URL);
    assert.equal(c.headers.get('X-Notify-Key'), SECRET, 'el secreto va en la cabecera');
    assert.equal(c.body.secret, undefined, 'y nunca en el cuerpo');
    assert.equal(c.headers.get('Content-Type'), 'application/json');
  }
  const p1 = sent.find(c => c.body.screen === 'altadis-bcn-003-p1-vertical');
  assert.equal(p1.body.items.length, 2); assert.equal(p1.body.items[1].seconds, 15);
  assert.equal(p1.body.rev, undefined);
  assert.equal(sent.find(c => c.body.screen === 'altadis-bcn-007-p1-vertical').body.rev, 42, 'rev leído: si alguien la cambió entre medias, admira.tv responde 409');
  assert.equal(out.piezas.length, 4);
  assert.ok(out.piezas.every(p => p.ok && p.rev === 1001));
  assert.equal(out.resultados.length, 3);
  assert.equal(JSON.stringify(out).includes(SECRET), false);
  const line = logs.find(l => l.includes('"modo":"real"'));
  assert.ok(line && line.includes('agentes@silicio.admiranext.com'));
  assert.equal(logs.join('\n').includes(SECRET), false, 'los logs no llevan el secreto');
});

test('modo real: si admira.tv rechaza la clave, 502 con el error por pieza', async t => {
  const env = baseEnv({STOCK_NOTIFY_KEY: 'otra-clave'}), cookie = await agentCookie(env);
  fakeNet(t, {screens: ALL_SCREENS, postStatus: 401});
  t.mock.method(console, 'log', () => {});
  const {firma} = await (await onRequestPost({request: post({modo: 'prueba', proyecto: 'altadis-estancos-bcn', piezas: LOTE}, cookie), env})).json();
  const r = await onRequestPost({request: post({modo: 'real', proyecto: 'altadis-estancos-bcn', piezas: LOTE, firma}, cookie), env});
  assert.equal(r.status, 502);
  const out = await r.json();
  assert.equal(out.ok, false);
  assert.ok(out.piezas.every(p => !p.ok && p.error === 'unauthorized'));
});

test('espejo admira.studio: la sustitución de marca no rompe identificadores de la function', async () => {
  const src = await readFile(new URL('../functions/players-programar.js', import.meta.url), 'utf8');
  const marca = [['www.pixeria.com', 'www.admira.studio'], ['pixeria.com', 'admira.studio'], ['PIXERIA', 'ADMIRA STUDIO'], ['PixerIA', 'Admira Studio'], ['Pixeria', 'Admira Studio'], ['Admira StudioAdaptador', 'PixeriaAdaptador']];
  let mirrored = src; for (const [a, b] of marca) mirrored = mirrored.split(a).join(b);
  const code = mirrored.split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  assert.equal(/Admira Studio[A-Za-z_]/.test(code), false, 'ningún identificador queda partido por «Admira Studio»');
  assert.match(code, /PixeriaAdaptador\/1\.0/);
  assert.match(code, /STOCK_NOTIFY_KEY/);
});
