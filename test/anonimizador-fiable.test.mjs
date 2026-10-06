// Anonimizador fiable (6-oct-2026): clasificación de fallos, política de reintento
// con otra foto aleatoria (máximo duro, sin bucles infinitos) y mensajes ES/EN.
// node --test test/anonimizador-fiable.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const AF = require('../assets/anonimizador-fiable.js');
const err = (props) => Object.assign(new Error(props.message || ''), props);

test('clasifica los fallos reales del worker y del navegador', () => {
  const cases = [
    [err({ status: 401, message: 'unauthorized' }), 'session'],
    [AF.fail('session', 'sesión caducada'), 'session'],
    [err({ status: 422, reason: 'image-declined', message: '' }), 'declined'],
    [err({ status: 422, reason: 'safety' }), 'declined'],
    [err({ status: 422, reason: 'copyright' }), 'declined'],
    [err({ status: 400, message: 'Generated image rejected by content moderation.' }), 'declined'],
    [err({ status: 422, reason: 'empty' }), 'empty'],
    [err({ status: 400, message: 'Unable to process input image. Please retry or report in https://…' }), 'bad-image'],
    [err({ status: 413, message: 'too-big' }), 'too-big'],
    [err({ status: 429, message: 'Too many requests' }), 'overload'],
    [err({ status: 503, message: 'The model is overloaded. Please try again later.' }), 'overload'],
    [err({ status: 500, message: 'Internal error encountered.' }), 'overload'],
    [err({ name: 'AbortError', message: 'The operation was aborted.' }), 'timeout'],
    [err({ status: 408, reason: 'timeout' }), 'timeout'],
    [err({ name: 'SecurityError', message: "Failed to execute 'toDataURL': Tainted canvases may not be exported." }), 'cors'],
    [err({ name: 'TypeError', message: 'Failed to fetch' }), 'network'],
    [AF.fail('no-data', 'la fuente no entregó la imagen', { status: 200 }), 'no-data'],
    [err({ message: 'algo raro' }), 'unknown'],
    [null, 'unknown'],
  ];
  for (const [e, code] of cases) assert.equal(AF.classify(e).code, code, String(e && e.message));
});

test('solo sesión caducada y sin red son fatales (no se gastan más fotos)', () => {
  assert.equal(AF.classify(err({ status: 401 })).fatal, true);
  assert.equal(AF.classify(AF.fail('offline')).fatal, true);
  for (const c of ['declined', 'empty', 'timeout', 'overload', 'bad-image', 'no-data', 'cors', 'network', 'unknown']) {
    assert.equal(AF.classify(AF.fail(c)).fatal, false, c);
  }
});

test('reintento con otra foto: la primera falla y la segunda funciona', async () => {
  const seen = [];
  const res = await AF.tryRandomPhotos({
    max: 5, sleep: async () => {},
    attempt: async (n) => { if (n === 1) throw err({ status: 422, reason: 'image-declined', step: '8-bit' }); return 'foto-' + n; },
    onDiscard: (d, n, max) => seen.push([d.code, n, max, d.step]),
  });
  assert.equal(res.ok, true);
  assert.equal(res.value, 'foto-2');
  assert.equal(res.attempts, 2);
  assert.deepEqual(seen, [['declined', 1, 5, '8-bit']]);
});

test('máximo duro: si todas fallan se para en N y nunca entra en bucle', async () => {
  let calls = 0;
  const res = await AF.tryRandomPhotos({ max: 5, sleep: async () => {}, attempt: async () => { calls++; throw err({ status: 422, reason: 'empty' }); } });
  assert.equal(calls, 5);
  assert.equal(res.ok, false);
  assert.equal(res.exhausted, true);
  assert.equal(res.discards.length, 5);
  // Valores absurdos de max se acotan a [1, 10].
  for (const [max, expected] of [[0, 5], [-3, 5], [Infinity, 5], ['x', 5], [1, 1], [99, 10], [3.9, 3]]) {
    let n = 0;
    await AF.tryRandomPhotos({ max, sleep: async () => {}, attempt: async () => { n++; throw new Error('x'); } });
    assert.equal(n, expected, 'max=' + max);
  }
});

test('un motivo fatal corta en el primer intento', async () => {
  let calls = 0;
  const res = await AF.tryRandomPhotos({ max: 5, sleep: async () => {}, attempt: async () => { calls++; throw err({ status: 401, message: 'unauthorized' }); } });
  assert.equal(calls, 1);
  assert.equal(res.ok, false);
  assert.equal(res.fatal.code, 'session');
});

test('pausa entre intentos: breve, y más larga con saturación', async () => {
  const pauses = [];
  await AF.tryRandomPhotos({ max: 3, sleep: async (ms) => pauses.push(ms), attempt: async () => { throw err({ status: 429 }); } });
  assert.deepEqual(pauses, [1500, 3000]);   // nunca después del último intento
  pauses.length = 0;
  await AF.tryRandomPhotos({ max: 2, sleep: async (ms) => pauses.push(ms), attempt: async () => { throw err({ status: 422, reason: 'empty' }); } });
  assert.deepEqual(pauses, [250]);
});

test('mensajes ES/EN: completos, breves y sin texto crudo del motor', () => {
  for (const l of ['es', 'en']) {
    const t = AF.texts[l];
    for (const c of AF.CODES) {
      assert.ok(t.why[c] && t.why[c].length <= 110, l + ' why ' + c);
      assert.ok(t.own[c] && t.own[c].length <= 220, l + ' own ' + c);
    }
    const msg = AF.discardMessage({ code: 'empty', step: '8-bit' }, 2, 5, l);
    assert.match(msg, l === 'es' ? /^Foto 2\/5: .*NPC 8-bit; probamos con otra foto…$/ : /^Photo 2\/5: .*8-bit NPC; trying another photo…$/);
    assert.doesNotMatch(msg, /HTTP|unauthorized|undefined/);
  }
  assert.match(AF.discardMessage({ code: 'timeout' }, 1, 5, 'es'), /tardó demasiado/);
  assert.match(AF.discardMessage({ code: 'cors' }, 1, 5, 'es'), /CORS/);
  assert.match(AF.discardMessage({ code: 'declined' }, 1, 5, 'en'), /refused/);
  assert.match(AF.finalMessage({ exhausted: true, attempts: 5, discards: [{ code: 'timeout' }] }, 'es'), /ninguna de las 5 fotos.*tardó demasiado/);
  assert.match(AF.finalMessage({ fatal: { code: 'session' } }, 'en'), /session has expired/);
  assert.match(AF.ownMessage({ code: 'bad-image' }, 'es'), /JPG o PNG/);
  assert.match(AF.ownMessage({ code: 'declined' }, 'en'), /full-body/);
  assert.equal(AF.ownMessage({ code: 'nada' }, 'es'), AF.texts.es.own.unknown);
  assert.equal(AF.doneAfterMessage({ attempts: 1, discards: [] }, 'es'), '');
  assert.match(AF.doneAfterMessage({ attempts: 3, discards: [{}, {}] }, 'es'), /^Hecho con la foto 3\/5 \(2 descartadas/);
  assert.match(AF.doneAfterMessage({ attempts: 2, discards: [{}] }, 'en'), /^Done with photo 2\/5 \(1 discarded/);
  assert.match(AF.failedLine('es'), /No se pudo anonimizar/);
  assert.match(AF.failedLine('en'), /Could not anonymize/);
});

test('validación de la foto propia: tipo y tamaño', () => {
  assert.throws(() => AF.checkFile({ type: 'application/pdf', name: 'doc.pdf', size: 10 }), (e) => e.code === 'bad-image');
  assert.throws(() => AF.checkFile({ type: 'image/jpeg', name: 'a.jpg', size: 30 * 1024 * 1024 }), (e) => e.code === 'too-big');
  assert.doesNotThrow(() => AF.checkFile({ type: 'image/png', name: 'a.png', size: 1000 }));
  assert.doesNotThrow(() => AF.checkFile({ type: '', name: 'IMG_1.HEIC', size: 1000 }));   // se intenta decodificar
});

test('token de pago: 401 de /auth/api-token es sesión caducada ANTES de llamar al motor', async () => {
  AF.forgetToken();
  const calls = [];
  const fake = async (url) => { calls.push(url); return { status: 401, ok: false, json: async () => ({ ok: false }) }; };
  await assert.rejects(AF.paidFetch('https://api.admira.store/xai/image', { prompt: 'x' }, 1000, fake), (e) => e.code === 'session');
  assert.deepEqual(calls, ['/auth/api-token']);
});

test('token de pago: se cachea y se renueva una vez si el worker rechaza el cacheado', async () => {
  AF.forgetToken();
  const calls = [];
  let worker401 = 1;
  const fake = async (url, init) => {
    calls.push(url + ' ' + ((init && init.headers && init.headers.Authorization) || ''));
    if (url === '/auth/api-token') return { status: 200, ok: true, json: async () => ({ ok: true, token: 't' + calls.length, exp: Date.now() / 1000 + 900 }) };
    if (calls.length > 2 && worker401-- > 0) return { status: 401, ok: false, json: async () => ({ error: 'unauthorized' }) };
    return { status: 200, ok: true, json: async () => ({ ok: true }) };
  };
  await AF.paidFetch('https://w/a', {}, 1000, fake);            // pide token y llama
  const { r } = await AF.paidFetch('https://w/b', {}, 1000, fake); // usa el cacheado → 401 → token nuevo → OK
  assert.equal(r.status, 200);
  assert.deepEqual(calls.map((c) => c.split(' ')[0]), ['/auth/api-token', 'https://w/a', 'https://w/b', '/auth/api-token', 'https://w/b']);
  AF.forgetToken();
});

test('timeout real: una fuente que no contesta se corta y se clasifica', async () => {
  AF.forgetToken();
  const hang = (url, init) => url === '/auth/api-token'
    ? Promise.resolve({ status: 404, ok: false, json: async () => ({}) })
    : new Promise((_, rej) => init.signal.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' }))));
  await assert.rejects(AF.paidFetch('https://w/x', {}, 50, hang), (e) => e.code === 'timeout' && AF.classify(e).code === 'timeout');
});

test('ambas páginas cargan el módulo y ya no muestran errores crudos', () => {
  for (const f of ['anonimizador.html', 'en/anonimizador.html']) {
    const html = fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
    assert.match(html, /<script src="\/assets\/anonimizador-fiable\.js\?v=[^"]+"><\/script>/, f);
    assert.match(html, /AF\.tryRandomPhotos\(/, f);
    assert.match(html, /AF\.ownMessage\(/, f);
    assert.doesNotMatch(html, /errMsg\(|'Error: ' \+/, f);
    assert.doesNotMatch(html, /No se pudo crear la audiencia \(' \+ e\.message|Could not create the audience \(' \+ e\.message/, f);
  }
});
