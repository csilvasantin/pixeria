// node --test test/stock-subida-partes.test.mjs — subida por partes del Adaptador al Stock (8-oct-2026).
// Un MP4 de ~70 MB en base64 dentro del JSON de /stock-publish tumbaba el isolate (503 «Worker exceeded
// resource limits»). Ahora: cliente que trocea, sube 2 trozos a la vez con reintentos y aborta si falla
// (adaptaciones/stock-publish.mjs), y funciones que reenvían el trozo como STREAM sin leerlo
// (functions/stock-upload/[accion].js) y publican con r2Staged (functions/stock-publish.js).
// Ninguna llamada sale a la red: fetch siempre simulado.
import test from 'node:test';
import assert from 'node:assert/strict';
import {planParts, uploadInParts, publishAdaptation, stockPayload, PARTS_THRESHOLD, MAX_STOCK_BYTES, STOCK_UPLOAD_URL} from '../adaptaciones/stock-publish.mjs';
import {onRequestPost as uploadPost, onRequestPut as uploadPut, MAX_SIZE, PART_MAX} from '../functions/stock-upload/[accion].js';
import {onRequestPost as publishPost} from '../functions/stock-publish.js';
import {stockBase, STOCK_API} from '../functions/_stock-proxy.js';

const MB = 1024 * 1024;
const KEY = 'uploads/mgx1abc-k3j2h1g0.mp4';
const UPLOAD_ID = 'AJr5bYfQ-upload.id_opaco+de/R2=';
const bytes = (n, semilla = 1) => { const b = new Uint8Array(n); for (let i = 0; i < n; i++) b[i] = (i * 31 + semilla) & 255; return b; };
const json = (body, status = 200) => new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}});

// ── Cliente ─────────────────────────────────────────────────────────────────

test('planParts: trozos iguales salvo el último, n desde 1, cubren el fichero entero', () => {
  assert.deepEqual(planParts(70 * MB, 25 * MB), [
    {n: 1, start: 0, end: 25 * MB}, {n: 2, start: 25 * MB, end: 50 * MB}, {n: 3, start: 50 * MB, end: 70 * MB},
  ]);
  assert.deepEqual(planParts(50 * MB, 25 * MB).map(p => p.end - p.start), [25 * MB, 25 * MB]);
  assert.deepEqual(planParts(10, 25), [{n: 1, start: 0, end: 10}]);
  assert.deepEqual(planParts(0, 25), []);
  assert.equal(PARTS_THRESHOLD, 8 * MB);
  assert.equal(MAX_STOCK_BYTES, MAX_SIZE, 'el tope del cliente es el de /stock-upload/start');
});

// Stock simulado detrás de /stock-upload/*: anota cada llamada y deja inyectar fallos por trozo.
function stockFalso({partSize = 1000, fallos = {}, complete = null} = {}) {
  const calls = [], trozos = new Map();
  let enVuelo = 0, maxEnVuelo = 0;
  const fetch = async (url, init = {}) => {
    const u = new URL(url, 'https://www.pixeria.com'), method = init.method || 'GET';
    if (u.pathname === `${STOCK_UPLOAD_URL}/part`) {
      const n = Number(u.searchParams.get('n'));
      calls.push({accion: 'part', n, key: u.searchParams.get('key'), uploadId: u.searchParams.get('uploadId'), method});
      enVuelo++; maxEnVuelo = Math.max(maxEnVuelo, enVuelo);
      try {
        await new Promise(r => setTimeout(r, 2));
        const plan = fallos[n] || [];
        const f = plan.shift();
        if (f === 'red') throw new TypeError('Failed to fetch');
        if (typeof f === 'number') return json({ok: false, error: 'part-failed'}, f);
        const b = new Uint8Array(await init.body.arrayBuffer());
        trozos.set(n, b);
        return json({ok: true, partNumber: n, etag: `e${n}-${b.length}`});
      } finally { enVuelo--; }
    }
    const body = init.body ? JSON.parse(init.body) : null;
    if (u.pathname === '/stock-publish') { calls.push({accion: 'publish', body, method}); return json({ok: true, id: 'stk-1', num: 4242}); }
    const accion = u.pathname.slice(STOCK_UPLOAD_URL.length + 1);
    calls.push({accion, body, method});
    if (accion === 'start') return json({ok: true, key: KEY, uploadId: UPLOAD_ID, partSize, maxParts: 400});
    if (accion === 'complete') return complete ? complete(body) : json({ok: true, key: KEY, size: [...trozos.values()].reduce((a, t) => a + t.length, 0)});
    if (accion === 'abort') return json({ok: true, aborted: true});
    return json({error: 'not-found'}, 404);
  };
  return {fetch, calls, trozos, get maxEnVuelo() { return maxEnVuelo; }};
}

test('uploadInParts: start con el tamaño real, trozos con los bytes exactos (2 en vuelo como máximo), complete en orden y progreso hasta el total', async () => {
  const stock = stockFalso({partSize: 1000});
  const datos = bytes(2500);
  const progreso = [];
  const r = await uploadInParts(new Blob([datos], {type: 'video/mp4'}), {fetch: stock.fetch, onProgress: (h, t) => progreso.push([h, t])});
  assert.deepEqual(r, {ok: true, key: KEY, size: 2500});
  const start = stock.calls.find(c => c.accion === 'start');
  assert.deepEqual(start.body, {type: 'video', motor: 'adaptador', mime: 'video/mp4', size: 2500});
  const partes = stock.calls.filter(c => c.accion === 'part');
  assert.deepEqual(partes.map(p => p.n).sort(), [1, 2, 3]);
  assert.ok(partes.every(p => p.method === 'PUT' && p.key === KEY && p.uploadId === UPLOAD_ID));
  assert.deepEqual([...stock.trozos.keys()].sort().map(n => stock.trozos.get(n).length), [1000, 1000, 500]);
  assert.deepEqual(Buffer.concat([1, 2, 3].map(n => stock.trozos.get(n))), Buffer.from(datos));
  assert.ok(stock.maxEnVuelo <= 2, `en vuelo: ${stock.maxEnVuelo}`);
  assert.equal(stock.maxEnVuelo, 2, 'aprovecha los dos carriles');
  const complete = stock.calls.find(c => c.accion === 'complete');
  assert.deepEqual(complete.body, {key: KEY, uploadId: UPLOAD_ID, parts: [{partNumber: 1, etag: 'e1-1000'}, {partNumber: 2, etag: 'e2-1000'}, {partNumber: 3, etag: 'e3-500'}]});
  assert.deepEqual(progreso.at(-1), [2500, 2500]);
  assert.equal(stock.calls.some(c => c.accion === 'abort'), false);
});

test('uploadInParts: un trozo que falla por red o 5xx se reintenta con espera creciente y la subida termina', async () => {
  const stock = stockFalso({partSize: 1000, fallos: {2: ['red', 502]}});
  const esperas = [];
  const r = await uploadInParts(new Blob([bytes(3000)]), {fetch: stock.fetch, wait: async ms => { esperas.push(ms); }});
  assert.equal(r.ok, true);
  assert.equal(stock.calls.filter(c => c.accion === 'part' && c.n === 2).length, 3, 'tres intentos del trozo 2');
  assert.deepEqual(esperas, [800, 1600]);
  assert.equal(stock.calls.filter(c => c.accion === 'complete').length, 1);
  assert.equal(stock.calls.some(c => c.accion === 'abort'), false);
});

test('uploadInParts: si un trozo agota los intentos se aborta la subida y no se cierra', async () => {
  const stock = stockFalso({partSize: 1000, fallos: {2: [503, 503, 503]}});
  const r = await uploadInParts(new Blob([bytes(3000)]), {fetch: stock.fetch, wait: async () => {}});
  assert.deepEqual(r, {ok: false, error: 'part-failed'});
  assert.equal(stock.calls.filter(c => c.accion === 'part' && c.n === 2).length, 3);
  assert.equal(stock.calls.some(c => c.accion === 'complete'), false);
  const abort = stock.calls.filter(c => c.accion === 'abort');
  assert.equal(abort.length, 1);
  assert.deepEqual(abort[0].body, {key: KEY, uploadId: UPLOAD_ID});
});

test('uploadInParts: un 4xx no se reintenta (aborta al momento); un complete fallido (size-mismatch) también aborta', async () => {
  const s1 = stockFalso({partSize: 1000, fallos: {1: [400]}});
  const r1 = await uploadInParts(new Blob([bytes(1500)]), {fetch: s1.fetch, wait: async () => { throw new Error('no debe esperar'); }});
  assert.equal(r1.ok, false);
  assert.equal(s1.calls.filter(c => c.accion === 'part' && c.n === 1).length, 1);
  assert.equal(s1.calls.filter(c => c.accion === 'abort').length, 1);

  const s2 = stockFalso({partSize: 1000, complete: () => json({error: 'size-mismatch', declared: 1501, size: 1500}, 400)});
  const r2 = await uploadInParts(new Blob([bytes(1500)]), {fetch: s2.fetch});
  assert.deepEqual(r2, {ok: false, error: 'size-mismatch'});
  assert.equal(s2.calls.filter(c => c.accion === 'abort').length, 1);

  const s3 = {calls: [], fetch: async (url, init) => { s3.calls.push(url); return json({ok: false, error: 'too-big', max: MAX_SIZE}, 413); }};
  assert.deepEqual(await uploadInParts(new Blob([bytes(10)]), {fetch: s3.fetch}), {ok: false, error: 'too-big'});
  assert.deepEqual(s3.calls, [`${STOCK_UPLOAD_URL}/start`], 'sin start no hay nada que abortar');
});

// FileReader (lo usa el carril base64) no existe en node: uno mínimo para el test.
globalThis.FileReader ??= class {
  readAsDataURL(blob) { blob.arrayBuffer().then(b => { this.result = `data:${blob.type};base64,${Buffer.from(b).toString('base64')}`; this.onload(); }, e => { this.error = e; this.onerror(); }); }
};
const META = {title: 'Spot · Altadis · 9:16', originId: '1790883135453-96r1uk', client: null, format: '9:16', width: 1080, height: 1920, duration: 30};
const EXTRA = {tags: ['adaptación', '9:16', 'altadis', 'estanco-bcn-001'], externalRef: 'altadis:bcn-001:9:16', comment: 'Estanco 001'};

test('publishAdaptation: por encima de 8 MB sube por partes y publica con r2Staged, sin base64 y con los mismos metadatos', async () => {
  const stock = stockFalso({partSize: 4 * MB});
  const blob = new Blob([new Uint8Array(PARTS_THRESHOLD + 1)], {type: 'video/mp4'});
  const r = await publishAdaptation(blob, META, EXTRA, {fetch: stock.fetch});
  assert.deepEqual(r, {ok: true, id: 'stk-1', num: 4242, reused: false});
  assert.equal(stock.calls.filter(c => c.accion === 'part').length, 3);
  const pub = stock.calls.find(c => c.accion === 'publish');
  assert.equal(stock.calls.at(-1), pub, 'se publica después de cerrar la subida');
  assert.equal(pub.body.r2Staged, KEY);
  assert.equal('base64' in pub.body, false);
  const {base64, ...esperado} = stockPayload({...META, size: blob.size});
  assert.deepEqual({...pub.body}, {...esperado, ...EXTRA, r2Staged: KEY});
});

test('publishAdaptation: hasta 8 MB sigue el base64 de siempre (un solo POST a /stock-publish); por encima del tope → too-big sin llamar a nadie', async () => {
  const calls = [];
  const fetch = async (url, init) => { calls.push({url, body: JSON.parse(init.body)}); return json({ok: true, id: 'stk-2', num: 7}); };
  const datos = bytes(5000);
  const r = await publishAdaptation(new Blob([datos], {type: 'video/mp4'}), META, null, {fetch});
  assert.deepEqual(r, {ok: true, id: 'stk-2', num: 7, reused: false});
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, '/stock-publish');
  assert.equal(calls[0].body.base64, Buffer.from(datos).toString('base64'));
  assert.equal('r2Staged' in calls[0].body, false);

  const enorme = {size: MAX_STOCK_BYTES + 1};
  assert.deepEqual(await publishAdaptation(enorme, META, null, {fetch: () => { throw new Error('no debe llamar'); }}), {ok: false, error: 'too-big'});
});

// ── Funciones (Pages) ───────────────────────────────────────────────────────

const ORIGEN = 'https://www.pixeria.com';
function fetchFalso(t, respuesta = () => json({ok: true})) {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, init = {}) => { calls.push({url: String(url), init, headers: new Headers(init.headers || {})}); return respuesta(url, init); });
  return calls;
}
const postJSON = (path, body) => new Request(ORIGEN + path, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});
// Trozo con cuerpo en STREAM y espías: si la función lo leyera (arrayBuffer/text/json…), el test lo ve.
function peticionTrozo(qs, datos, {contentLength = datos.length} = {}) {
  const headers = {'Content-Type': 'application/octet-stream'};
  if (contentLength != null) headers['Content-Length'] = String(contentLength);
  const request = new Request(`${ORIGEN}/stock-upload/part?${new URLSearchParams(qs)}`, {method: 'PUT', headers, body: new Blob([datos]).stream(), duplex: 'half'});
  const lecturas = [];
  for (const m of ['arrayBuffer', 'text', 'json', 'blob', 'formData', 'bytes', 'clone']) {
    Object.defineProperty(request, m, {configurable: true, value: () => { lecturas.push(m); throw new Error(`el trozo no se lee con ${m}()`); }});
  }
  return {request, lecturas, stream: request.body};
}
const cabecerasStock = h => {
  assert.equal(h.get('user-agent'), 'Mozilla/5.0 (compatible; PixeriaAdaptador/1.0)');
  assert.equal(h.get('origin'), 'https://www.pixeria.com');
  assert.equal(h.get('referer'), 'https://www.pixeria.com/adaptaciones/');
};

test('PUT /stock-upload/part: reenvía el MISMO stream a api.admira.store sin leerlo, con Content-Length y las cabeceras de /stock-publish', async t => {
  const calls = fetchFalso(t, () => json({ok: true, partNumber: 2, etag: 'abc'}));
  const datos = bytes(4096);
  const {request, lecturas, stream} = peticionTrozo({key: KEY, uploadId: UPLOAD_ID, n: 2}, datos);
  const r = await uploadPut({request, env: {}, params: {accion: 'part'}});
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), {ok: true, partNumber: 2, etag: 'abc'});
  assert.deepEqual(lecturas, [], 'la función no lee el trozo');
  assert.equal(calls.length, 1);
  const {url, init, headers} = calls[0];
  const u = new URL(url);
  assert.equal(u.origin + u.pathname, 'https://api.admira.store/stock/upload/part');
  assert.deepEqual(Object.fromEntries(u.searchParams), {key: KEY, uploadId: UPLOAD_ID, n: '2'});
  assert.equal(init.method, 'PUT');
  assert.equal(init.duplex, 'half');
  assert.equal(init.body, stream, 'el cuerpo es el stream de la petición, no una copia');
  assert.equal(init.body.locked, false, 'y nadie lo ha empezado a leer');
  assert.equal(headers.get('content-length'), '4096');
  assert.equal(headers.get('content-type'), 'application/octet-stream');
  cabecerasStock(headers);
});

test('PUT /stock-upload/part en el runtime de Workers: pasa por FixedLengthStream (longitud garantizada) y sigue sin leerse en la función', async t => {
  let creado = null;
  globalThis.FixedLengthStream = class extends TransformStream { constructor(n) { super(); this.expectedLength = n; creado = this; } };
  t.after(() => { delete globalThis.FixedLengthStream; });
  const calls = fetchFalso(t, () => json({ok: true, partNumber: 1, etag: 'x'}));
  const datos = bytes(3000, 9);
  const {request, lecturas} = peticionTrozo({key: KEY, uploadId: UPLOAD_ID, n: 1}, datos);
  const r = await uploadPut({request, env: {}, params: {accion: 'part'}});
  assert.equal(r.status, 200);
  assert.deepEqual(lecturas, []);
  assert.equal(creado.expectedLength, 3000);
  assert.equal(calls[0].init.body, creado.readable);
  // Lo que sale aguas arriba son exactamente los bytes del trozo.
  assert.deepEqual(new Uint8Array(await new Response(calls[0].init.body).arrayBuffer()), datos);
});

test('PUT /stock-upload/part: clave ajena, n fuera de rango, sin Content-Length o trozo > 25 MB → error sin llamar al Stock', async t => {
  const calls = fetchFalso(t);
  const casos = [
    [{key: 'stock/123/asset.mp4', uploadId: UPLOAD_ID, n: 1}, {}, 400, 'bad-key'],
    [{key: 'uploads/mgx1abc-k3j2h1g0.webm', uploadId: UPLOAD_ID, n: 1}, {}, 400, 'bad-key'],
    [{key: KEY, uploadId: 'con espacio', n: 1}, {}, 400, 'bad-key'],
    [{key: KEY, uploadId: UPLOAD_ID, n: 0}, {}, 400, 'bad-part'],
    [{key: KEY, uploadId: UPLOAD_ID, n: 401}, {}, 400, 'bad-part'],
    [{key: KEY, uploadId: UPLOAD_ID, n: 1}, {contentLength: null}, 411, 'length-required'],
    [{key: KEY, uploadId: UPLOAD_ID, n: 1}, {contentLength: PART_MAX + 1}, 413, 'part-too-big'],
  ];
  for (const [qs, op, status, error] of casos) {
    const {request, lecturas} = peticionTrozo(qs, bytes(10), op);
    const r = await uploadPut({request, env: {}, params: {accion: 'part'}});
    assert.equal(r.status, status, JSON.stringify(qs));
    assert.equal((await r.json()).error, error);
    assert.deepEqual(lecturas, []);
  }
  assert.equal(calls.length, 0);
  const otra = await uploadPut({request: new Request(ORIGEN + '/stock-upload/start', {method: 'PUT', body: 'x'}), env: {}, params: {accion: 'start'}});
  assert.equal(otra.status, 404);
});

test('POST /stock-upload/start: solo MP4 de los motores del Adaptador, con tamaño entero ≤ 500 MB; al Stock solo van mime y size', async t => {
  const calls = fetchFalso(t, () => json({ok: true, key: KEY, uploadId: UPLOAD_ID, partSize: 25 * MB, maxParts: 400}));
  const bien = {type: 'video', motor: 'adaptador', mime: 'video/mp4', size: 70 * MB, externalId: 'admiranext:intruso:12345678', catalogo: {id: 'x'}};
  const r = await uploadPost({request: postJSON('/stock-upload/start', bien), env: {}, params: {accion: 'start'}});
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), {ok: true, key: KEY, uploadId: UPLOAD_ID, partSize: 25 * MB, maxParts: 400});
  assert.equal(calls[0].url, 'https://api.admira.store/stock/upload/init');
  assert.deepEqual(JSON.parse(calls[0].init.body), {mime: 'video/mp4', size: 70 * MB});
  cabecerasStock(calls[0].headers);
  const malos = [
    [{...bien, motor: 'local'}, 400, 'solo-adaptaciones'],
    [{...bien, type: 'image'}, 400, 'solo-adaptaciones'],
    [{...bien, mime: 'video/webm'}, 400, 'solo-adaptaciones'],
    [{...bien, size: undefined}, 400, 'bad-size'],
    [{...bien, size: 0}, 400, 'bad-size'],
    [{...bien, size: 1.5}, 400, 'bad-size'],
    [{...bien, size: '1000'}, 400, 'bad-size'],
    [{...bien, size: MAX_SIZE + 1}, 413, 'too-big'],
  ];
  for (const [body, status, error] of malos) {
    const m = await uploadPost({request: postJSON('/stock-upload/start', body), env: {}, params: {accion: 'start'}});
    assert.equal(m.status, status, JSON.stringify(body));
    assert.equal((await m.json()).error, error);
  }
  const roto = await uploadPost({request: new Request(ORIGEN + '/stock-upload/start', {method: 'POST', body: '{no'}), env: {}, params: {accion: 'start'}});
  assert.equal(roto.status, 400);
  const gordo = await uploadPost({request: new Request(ORIGEN + '/stock-upload/start', {method: 'POST', headers: {'Content-Length': String(65 * 1024)}, body: 'x'.repeat(10)}), env: {}, params: {accion: 'start'}});
  assert.equal(gordo.status, 413);
  assert.equal(calls.length, 1);
  assert.equal((await uploadPost({request: postJSON('/stock-upload/otra', {}), env: {}, params: {accion: 'otra'}})).status, 404);
});

test('POST /stock-upload/complete y /abort: JSON pequeño, partes saneadas, campos de más fuera; la respuesta del Stock pasa tal cual', async t => {
  const calls = fetchFalso(t, url => String(url).endsWith('/complete') ? json({error: 'size-mismatch', declared: 10, size: 9}, 400) : json({ok: true, aborted: true}));
  const parts = [{partNumber: 1, etag: '"e1"', sobra: true}, {partNumber: 2, etag: 'e2'}];
  const r = await uploadPost({request: postJSON('/stock-upload/complete', {key: KEY, uploadId: UPLOAD_ID, parts, r2Staged: 'x'}), env: {}, params: {accion: 'complete'}});
  assert.equal(r.status, 400);
  assert.deepEqual(await r.json(), {error: 'size-mismatch', declared: 10, size: 9});
  assert.equal(r.headers.get('cache-control'), 'no-store');
  assert.equal(calls[0].url, 'https://api.admira.store/stock/upload/complete');
  assert.deepEqual(JSON.parse(calls[0].init.body), {key: KEY, uploadId: UPLOAD_ID, parts: [{partNumber: 1, etag: '"e1"'}, {partNumber: 2, etag: 'e2'}]});
  for (const body of [
    {key: KEY, uploadId: UPLOAD_ID, parts: []},
    {key: KEY, uploadId: UPLOAD_ID, parts: [{partNumber: '1', etag: 'e'}]},
    {key: KEY, uploadId: UPLOAD_ID, parts: [{partNumber: 1}]},
    {key: 'stock/1/meta.json', uploadId: UPLOAD_ID, parts: [{partNumber: 1, etag: 'e'}]},
  ]) {
    const m = await uploadPost({request: postJSON('/stock-upload/complete', body), env: {}, params: {accion: 'complete'}});
    assert.equal(m.status, 400, JSON.stringify(body));
  }
  const a = await uploadPost({request: postJSON('/stock-upload/abort', {key: KEY, uploadId: UPLOAD_ID, extra: 1}), env: {}, params: {accion: 'abort'}});
  assert.deepEqual(await a.json(), {ok: true, aborted: true});
  assert.equal(calls.at(-1).url, 'https://api.admira.store/stock/upload/abort');
  assert.deepEqual(JSON.parse(calls.at(-1).init.body), {key: KEY, uploadId: UPLOAD_ID});
  const ajena = await uploadPost({request: postJSON('/stock-upload/abort', {key: 'stock/1/asset.mp4', uploadId: UPLOAD_ID}), env: {}, params: {accion: 'abort'}});
  assert.equal(ajena.status, 400);
  assert.equal(calls.length, 2);
});

test('POST /stock-publish con r2Staged: reenvía la clave sin base64 y con los mismos campos; una sola fuente; externalId y catalogo nunca pasan', async t => {
  const calls = fetchFalso(t, () => json({ok: true, id: 'stk-9', num: 9}));
  const meta = {type: 'video', motor: 'adaptador', mime: 'video/mp4', title: 't', tags: ['adaptación'], externalRef: 'ref', validacion: {ok: true, ancho: 1080, alto: 1920}, quality: 'good', costEst: 'c', prompt: 'p'};
  const r = await publishPost({request: postJSON('/stock-publish', {...meta, r2Staged: KEY, externalId: 'admiranext:intruso:12345678', catalogo: {id: 'x'}, sourceUrl: 'https://evil.example/x.mp4'}), env: {}});
  assert.equal(r.status, 200);
  assert.equal(calls[0].url, 'https://api.admira.store/stock/publish');
  assert.deepEqual(JSON.parse(calls[0].init.body), {...meta, r2Staged: KEY});
  cabecerasStock(calls[0].headers);
  for (const body of [
    {...meta},                                        // sin fuente
    {...meta, r2Staged: KEY, base64: 'AAAA'},         // dos fuentes
    {...meta, r2Staged: 'stock/1/asset.mp4'},         // clave ajena
    {...meta, r2Staged: 'uploads/mgx1abc-k3j2h1g0.webm'},
    {...meta, motor: 'local', r2Staged: KEY},
  ]) {
    const m = await publishPost({request: postJSON('/stock-publish', body), env: {}});
    assert.equal(m.status, 400, JSON.stringify(body));
    assert.equal((await m.json()).error, 'solo-adaptaciones');
  }
  // El carril base64 de siempre sigue igual (sin r2Staged).
  const b = await publishPost({request: postJSON('/stock-publish', {...meta, base64: 'AAAA'})});
  assert.equal(b.status, 200);
  assert.deepEqual(JSON.parse(calls.at(-1).init.body), {...meta, base64: 'AAAA'});
  assert.equal(calls.length, 2);
});

test('STOCK_API_BASE solo cambia el destino si es un origen http(s) limpio (pruebas locales); si no, api.admira.store', () => {
  assert.equal(stockBase({}), STOCK_API);
  assert.equal(stockBase(undefined), STOCK_API);
  assert.equal(stockBase({STOCK_API_BASE: 'http://127.0.0.1:8787'}), 'http://127.0.0.1:8787');
  for (const v of ['http://127.0.0.1:8787/stock', 'javascript:alert(1)', 'ftp://x', 'https://a.b?x=1', ' ']) assert.equal(stockBase({STOCK_API_BASE: v}), STOCK_API, v);
});
