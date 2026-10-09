// node --test test/stock-subida-partes-callers.test.mjs — los otros caminos al Stock pasan a la subida
// por partes (Carlos, 9-oct-2026): la caja 2 del Adaptador (adaptaciones/importar.js) y el Stock de
// pixeria.com (app.js · publishToStock: ficheros locales e importaciones por URL). Los dos usan el
// cliente común de adaptaciones/stock-publish.mjs. Hasta 8 MB, base64 como siempre; por encima, crudo
// y en trozos por /stock-upload/* y después /stock-publish con r2Staged. Ninguna llamada sale a la red.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {registerHooks} from 'node:module';
import {stockSource, uploadInParts, PARTS_THRESHOLD, MAX_STOCK_BYTES} from '../adaptaciones/stock-publish.mjs';
import {tipoMimeOk, STAGED_KEY} from '../functions/_stock-proxy.js';
import {onRequestPost as publishPost} from '../functions/stock-publish.js';

const MB = 1024 * 1024;
const KEY = 'uploads/mgx1abc-k3j2h1g0.mp4';
const UPLOAD_ID = 'AJr5bYfQ-upload.id';
const WORKER_PUBLISH = 'https://api.admira.store/stock/publish';
const json = (body, status = 200) => new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}});
const grande = (mb = 20, type = 'video/mp4') => new Blob([new Uint8Array(mb * MB)], {type});

// FileReader (carril base64 del cliente común) no existe en node.
globalThis.FileReader ??= class {
  readAsDataURL(blob) { blob.arrayBuffer().then(b => { this.result = `data:${blob.type};base64,${Buffer.from(b).toString('base64')}`; this.onload(); }, e => { this.error = e; this.onerror(); }); }
};

// Red simulada: /stock-upload/* (proxy del dominio), /stock-publish, el Worker directo y blob: URLs.
function red(t, {fallaTrozo = null, blobs = {}} = {}) {
  const calls = [];
  const fetch = async (url, init = {}) => {
    url = String(url);
    if (url.startsWith('blob:')) { calls.push({accion: 'blob', url}); return new Response(blobs[url]); }
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : null;
    if (url.startsWith('/stock-upload/part')) {
      const n = Number(new URL(url, 'https://x').searchParams.get('n'));
      calls.push({accion: 'part', n, bytes: init.body.size});
      if (fallaTrozo === n) return json({ok: false, error: 'part-failed'}, 400);
      return json({ok: true, partNumber: n, etag: 'e' + n});
    }
    if (url.startsWith('/stock-upload/')) {
      const accion = url.slice('/stock-upload/'.length);
      calls.push({accion, body});
      if (accion === 'start') return json({ok: true, key: KEY, uploadId: UPLOAD_ID, partSize: 8 * MB, maxParts: 400});
      if (accion === 'complete') return json({ok: true, key: KEY, size: 1});
      return json({ok: true, aborted: true});
    }
    calls.push({accion: url === '/stock-publish' ? 'publish-proxy' : url === WORKER_PUBLISH ? 'publish-worker' : 'otra', url, body});
    return json({ok: true, id: 'stk-1', url: 'https://api.admira.store/stock/asset/stk-1', tags: []});
  };
  t.mock.method(globalThis, 'fetch', fetch);
  return {calls, fetch};
}
// import() de los scripts clásicos (cargador del contexto principal): el cliente común es el
// módulo real; el resto de /assets (orientación, póster) falla como sin navegador, y el código lo tolera.
const cliente = new URL('../adaptaciones/stock-publish.mjs', import.meta.url).href;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '/adaptaciones/stock-publish.mjs') return {url: cliente, shortCircuit: true};
    if (specifier.startsWith('/assets/')) throw new Error('sin navegador: ' + specifier);
    return nextResolve(specifier, context);
  },
});
const importar = vm.constants.USE_MAIN_CONTEXT_DEFAULT_LOADER;

// ── Cliente común ───────────────────────────────────────────────────────────

test('stockSource: hasta 8 MB devuelve base64; por encima sube por partes y devuelve r2Staged; por encima del tope, too-big sin red', async t => {
  const {calls, fetch} = red(t);
  const peq = await stockSource(new Blob([new Uint8Array([1, 2, 3])], {type: 'video/mp4'}), {fetch});
  assert.deepEqual(peq, {ok: true, fields: {base64: 'AQID'}});
  assert.equal(calls.length, 0);
  const gr = await stockSource(grande(20), {fetch, motor: 'yt-dlp'});
  assert.deepEqual(gr, {ok: true, fields: {r2Staged: KEY}});
  assert.deepEqual(calls.find(c => c.accion === 'start').body, {type: 'video', motor: 'yt-dlp', mime: 'video/mp4', size: 20 * MB});
  assert.deepEqual(calls.filter(c => c.accion === 'part').map(c => c.bytes).sort(), [4 * MB, 8 * MB, 8 * MB]);
  assert.deepEqual(await stockSource({size: MAX_STOCK_BYTES + 1}, {fetch: () => { throw new Error('sin red'); }}), {ok: false, error: 'too-big'});
  assert.deepEqual(await stockSource({size: 3 * MB}, {maxBytes: 2 * MB}), {ok: false, error: 'too-big'});
});

test('uploadInParts lleva a /stock-upload/start el tipo, el mime y el motor de quien sube (no solo MP4 del Adaptador)', async t => {
  const {calls, fetch} = red(t);
  const r = await uploadInParts(grande(9, 'audio/mpeg'), {fetch, motor: 'local', type: 'audio', mime: 'audio/mpeg'});
  assert.equal(r.ok, true);
  assert.deepEqual(calls[0].body, {type: 'audio', motor: 'local', mime: 'audio/mpeg', size: 9 * MB});
});

// ── app.js · publishToStock ────────────────────────────────────────────────

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const trozo = (a, b) => app.slice(app.indexOf(a), app.indexOf(b));
const codigoApp = "const ELEVEN_WORKER_URL = 'https://api.admira.store'; const STOCK_PUBLISH_URL = ELEVEN_WORKER_URL + '/stock/publish';\n"
  + trozo('// [STOCK-PARTES-INICIO]', '// [STOCK-PARTES-FIN]') + '\n' + trozo('// [PUBLICAR-INICIO]', '// [PUBLICAR-FIN]')
  + '\nthis.publishToStock = publishToStock;';
function cargarApp(fetch) {
  const base64 = [];
  const ctx = vm.createContext({
    fetch, Blob, URL, console, setTimeout, Math, String, JSON, Error, Array, Object, Promise,
    showToast() {}, updateMusicStage() {}, motorQuality: () => 'good', SUNO_LOCAL_URL: 'http://suno.invalid',
    urlToBase64: async url => { base64.push(url); return {mime: 'video/mp4', base64: 'QUJD'}; },
  });
  new vm.Script(codigoApp, {filename: 'app.js', importModuleDynamically: importar}).runInContext(ctx);
  return {publishToStock: ctx.publishToStock, base64};
}

test('app.js · fichero local de 20 MB: sube por partes con el cliente común y publica por el proxy del dominio con r2Staged', async t => {
  const {calls, fetch} = red(t);
  const {publishToStock, base64} = cargarApp(fetch);
  const file = new File([new Uint8Array(20 * MB)], 'episodio.mov', {type: 'video/quicktime'});
  const progreso = [];
  const r = await publishToStock({type: 'video', motor: 'local', prompt: 'episodio.mov', title: 'episodio', comment: null, tags: ['starbucks'], costEst: 'local · 20.00MB', url: 'blob:https://www.pixeria.com/x', blob: file, mime: 'video/quicktime', dimensions: {width: 1920, height: 1080}}, null, {onProgress: (h, tot) => progreso.push([h, tot])});
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(base64, [], 'nada en base64');
  assert.deepEqual(calls.find(c => c.accion === 'start').body, {type: 'video', motor: 'local', mime: 'video/quicktime', size: 20 * MB});
  assert.equal(calls.filter(c => c.accion === 'part').length, 3);
  const pub = calls.find(c => c.accion === 'publish-proxy');
  assert.ok(pub, 'publica por /stock-publish del mismo dominio, no directo al Worker');
  assert.equal(calls.some(c => c.accion === 'publish-worker'), false);
  assert.equal(pub.body.r2Staged, KEY);
  assert.equal(pub.body.mime, 'video/quicktime');
  assert.equal('base64' in pub.body, false);
  assert.deepEqual(pub.body.tags, ['starbucks']);
  // (dimensions las pone /assets/content-orientation.mjs en el navegador; aquí no se carga)
  assert.deepEqual(progreso.at(-1), [20 * MB, 20 * MB]);
});

test('app.js · importación por URL (yt-dlp) de 20 MB: el blob: se lee y sube por partes; la miniatura de YouTube viaja', async t => {
  const blobUrl = 'blob:https://www.pixeria.com/yt';
  const {calls, fetch} = red(t, {blobs: {[blobUrl]: grande(20)}});
  const {publishToStock} = cargarApp(fetch);
  const btn = {textContent: '', disabled: false, dataset: {}, classList: {add() {}}, previousElementSibling: null, closest: () => null};
  const r = await publishToStock({type: 'video', motor: 'yt-dlp', prompt: 'https://youtu.be/abc', title: 'x', tags: [], costEst: 'gratis', url: blobUrl, mime: 'video/mp4', thumbnail: 'https://img.youtube.com/vi/abcdefghijk/hqdefault.jpg'}, btn);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(calls.find(c => c.accion === 'start').body, {type: 'video', motor: 'yt-dlp', mime: 'video/mp4', size: 20 * MB});
  const pub = calls.find(c => c.accion === 'publish-proxy');
  assert.equal(pub.body.r2Staged, KEY);
  assert.equal(pub.body.thumbnail, 'https://img.youtube.com/vi/abcdefghijk/hqdefault.jpg');
  assert.equal(btn.textContent, '✅ EN STOCK');
});

test('app.js · lo pequeño y lo de otros motores sigue en base64 directo al Worker, como siempre', async t => {
  const {calls, fetch} = red(t, {blobs: {'blob:a': grande(20)}});
  const {publishToStock, base64} = cargarApp(fetch);
  const chico = new File([new Uint8Array(2 * MB)], 'foto.png', {type: 'image/png'});
  assert.equal((await publishToStock({type: 'image', motor: 'local', url: 'blob:chico', blob: chico, mime: 'image/png'}, null)).ok, true);
  assert.equal((await publishToStock({type: 'video', motor: 'pollinations-wan-fast', url: 'blob:a', mime: 'video/mp4'}, null)).ok, true);
  assert.deepEqual(base64, ['blob:chico', 'blob:a']);
  assert.deepEqual(calls.filter(c => c.accion.startsWith('publish')).map(c => c.accion), ['publish-worker', 'publish-worker']);
  assert.equal(calls.some(c => c.accion === 'start'), false);
});

test('app.js · si un trozo falla se aborta y se informa; por encima de 2 GB ni se intenta', async t => {
  const {calls, fetch} = red(t, {fallaTrozo: 2});
  const {publishToStock} = cargarApp(fetch);
  const r = await publishToStock({type: 'video', motor: 'local', url: 'blob:x', blob: grande(20), mime: 'video/mp4'}, null);
  assert.equal(r.ok, false);
  assert.match(r.error, /subida por partes: part-failed/);
  assert.equal(calls.filter(c => c.accion === 'abort').length, 1);
  assert.equal(calls.some(c => c.accion.startsWith('publish')), false);
  const enorme = await publishToStock({type: 'video', motor: 'local', url: 'blob:y', blob: {size: 3 * 1024 * MB, type: 'video/mp4'}, mime: 'video/mp4'}, null);
  assert.equal(enorme.ok, false);
  assert.match(enorme.error, /tope del Stock es 2048 MB/);
});

test('app.js · ya no queda la subida por partes directa al Worker ni el tope de 70 MB', () => {
  assert.doesNotMatch(app, /ELEVEN_WORKER_URL \+ '\/stock\/upload'/);
  assert.doesNotMatch(app, /MAX_LOCAL/);
  assert.match(app, /import\('\/adaptaciones\/stock-publish\.mjs'\)/);
  assert.doesNotMatch(trozo('// [STOCK-PARTES-INICIO]', '// [STOCK-PARTES-FIN]'), /Pixeria[A-Z]/, 'sin identificadores que el espejo de admira.studio renombraría');
});

// ── importar.js · caja 2 del Adaptador ──────────────────────────────────────

function cargarImportar(fetch) {
  const window = {};
  const ctx = vm.createContext({
    window, fetch, Blob, URL, console, setTimeout, Math, String, JSON, Error, Object, Promise,
    document: {documentElement: {lang: 'es'}, readyState: 'complete', querySelector: () => null, addEventListener() {}},
  });
  const code = fs.readFileSync(new URL('../adaptaciones/importar.js', import.meta.url), 'utf8');
  new vm.Script(code, {filename: 'importar.js', importModuleDynamically: importar}).runInContext(ctx);
  return window.PixeriaImportar;
}

test('importar.js · más de 8 MB sube por partes con el cliente común y publica con r2Staged; hasta 8 MB, base64', async t => {
  const {calls, fetch} = red(t);
  const imp = cargarImportar(fetch);
  const progreso = [];
  const r = await imp.alStock({motor: 'yt-dlp', titulo: 'Spot'}, 'https://youtu.be/abc', new File([new Uint8Array(20 * MB)], 'spot.mp4', {type: 'video/mp4'}), (h, tot) => progreso.push(h / tot));
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(calls.find(c => c.accion === 'start').body, {type: 'video', motor: 'yt-dlp', mime: 'video/mp4', size: 20 * MB});
  const pub = calls.find(c => c.accion === 'publish-proxy');
  assert.equal(pub.body.r2Staged, KEY);
  assert.equal('base64' in pub.body, false);
  assert.equal(pub.body.title, 'Spot');
  assert.equal(pub.body.prompt, 'https://youtu.be/abc');
  assert.equal(progreso.at(-1), 1);

  calls.length = 0;
  const chico = await imp.alStock({motor: 'import', titulo: 'Clip'}, 'https://e.com/clip.mp4', new File([new Uint8Array([1, 2, 3])], 'clip.mp4', {type: 'video/mp4'}));
  assert.equal(chico.ok, true);
  assert.equal(calls.some(c => c.accion === 'start'), false);
  assert.equal(calls.find(c => c.accion === 'publish-proxy').body.base64, 'AQID');
});

test('importar.js · por encima de 500 MB no sube y lo explica; el tope de 70 MB ya no existe', async t => {
  const {calls, fetch} = red(t);
  const imp = cargarImportar(fetch);
  const r = await imp.alStock({motor: 'yt-dlp'}, 'https://youtu.be/abc', {size: MAX_STOCK_BYTES + 1, type: 'video/mp4'});
  assert.deepEqual(JSON.parse(JSON.stringify(r)), {ok: false, error: 'pesa más de 500 MB (tope de subida al Stock)'});
  assert.equal(calls.length, 0);
  assert.doesNotMatch(fs.readFileSync(new URL('../adaptaciones/importar.js', import.meta.url), 'utf8'), /70 \* 1024 \* 1024/);
});

// ── Perímetro del proxy ─────────────────────────────────────────────────────

test('proxy: vídeo, audio e imagen con su mime (u octet-stream) de los motores admitidos; claves de uploads/ con cualquier extensión', async t => {
  for (const [type, mime] of [['video', 'video/mp4'], ['video', 'video/quicktime'], ['audio', 'audio/mpeg'], ['image', 'image/png'], ['audio', 'application/octet-stream']]) assert.equal(tipoMimeOk(type, mime), true, `${type} ${mime}`);
  for (const [type, mime] of [['video', 'audio/mpeg'], ['image', 'video/mp4'], ['capsula', 'text/plain'], ['video', 'text/html'], ['video', 'Video/MP4'], ['video', null]]) assert.equal(tipoMimeOk(type, mime), false, `${type} ${mime}`);
  for (const k of ['uploads/mgx1abc-k3j2h1g0.mp4', 'uploads/mgx1abc-k3j2h1g0.mov', 'uploads/mgx1abc-k3j2h1g0.bin']) assert.ok(STAGED_KEY.test(k), k);
  for (const k of ['stock/1/asset.mp4', 'uploads/x.mp4', 'uploads/mgx1abc-k3j2h1g0', 'uploads/mgx1abc/../a.mp4']) assert.equal(STAGED_KEY.test(k), false, k);

  const llamadas = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => { llamadas.push(JSON.parse(init.body)); return json({ok: true}); });
  const req = body => new Request('https://www.admira.studio/stock-publish', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});
  const local = {type: 'audio', motor: 'local', mime: 'audio/mpeg', title: 'Episodio', r2Staged: 'uploads/mgx1abc-k3j2h1g0.mp3'};
  assert.equal((await publishPost({request: req({...local, thumbnail: 'https://img.youtube.com/vi/x/hqdefault.jpg'}), env: {}})).status, 200);
  assert.deepEqual(llamadas[0], {...local, thumbnail: 'https://img.youtube.com/vi/x/hqdefault.jpg'});
  assert.equal((await publishPost({request: req({...local, thumbnail: 'javascript:alert(1)'}), env: {}})).status, 200);
  assert.equal('thumbnail' in llamadas[1], false, 'una miniatura que no es https no pasa');
  assert.equal((await publishPost({request: req({...local, motor: 'veo'}), env: {}})).status, 400);
  assert.equal(llamadas.length, 2);
});
