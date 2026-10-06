// Anonimizador fiable (6-oct-2026) · e2e contra un servidor LOCAL con las fuentes simuladas
// (las respuestas imitan la forma exacta de pixer-worker: /xai/image y /image/edit).
// Uso:
//   python3 -m http.server 8471 --bind 127.0.0.1 &
//   PLAYWRIGHT_MODULE=/ruta/a/playwright ANON_TEST_ORIGIN=http://127.0.0.1:8471 node test/anonimizador-fiable.browser.cjs
// Comprueba: la 1.ª foto aleatoria falla (timeout, red/CORS o imagen ilegible) y la 2.ª funciona;
// si fallan todas sale el error final con «Probar otra vez»; una foto PROPIA que falla se
// explica sin sustituirla; la sesión caducada corta sin gastar fotos. En ES y EN, 1440 y 390.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const BASE = process.env.ANON_TEST_ORIGIN || 'http://127.0.0.1:8471';
assert(['localhost', '127.0.0.1'].includes(new URL(BASE).hostname), 'Solo orígenes locales');
const root = path.join(__dirname, '..');
const JPG = fs.readFileSync(path.join(root, 'assets/anonymizer-demo/original.jpg'));
const PNG = fs.readFileSync(path.join(root, 'assets/anonymizer-demo/8-bit.png'));
const OK_X = { status: 200, json: { data: [{ b64_json: JPG.toString('base64'), mime: 'image/jpeg' }] } };
const OK_E = { status: 200, json: { ok: true, image: 'data:image/png;base64,' + PNG.toString('base64'), mime: 'image/png' } };
const MODERATION = { status: 400, json: { code: 'Client specified an invalid argument', error: 'Generated image rejected by content moderation.' } };
const GARBAGE = { status: 200, json: { data: [{ b64_json: Buffer.from('no soy una imagen').toString('base64'), mime: 'image/jpeg' }] } };
const DECLINED = { status: 422, json: { ok: false, error: 'no-image-out', reason: 'image-declined', finishReason: 'IMAGE_OTHER' } };
const exe = process.env.CHROME_PATH || (fs.existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined);

const L = {
  es: { page: '/anonimizador.html', ok: /Listo/, timeout: /tardó demasiado/, net: /red o CORS/, bad: /no se puede leer/, done2: /Hecho con la foto 2\/5/,
        all: /ninguna de las 5 fotos/, retry: /Probar otra vez/, session: /sesión de Pixeria ha caducado/, ownDeclined: /rechazó tu foto.*cuerpo entero/, ownBad: /JPG o PNG/ },
  en: { page: '/en/anonimizador.html', ok: /Done/, timeout: /took too long/, net: /network or CORS/, bad: /unreadable format/, done2: /Done with photo 2\/5/,
        all: /None of the 5 random photos/, retry: /Try again/, session: /session has expired/, ownDeclined: /refused your photo.*full-body/, ownBad: /JPG or PNG/ }
};

async function open(browser, lang, width, script) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await p.addInitScript(() => { window.__anonFiableConfig = { xaiTimeoutMs: 1500, editTimeoutMs: 1500 }; });
  await p.route('**/auth/session', (r) => r.fulfill({ json: { ok: true } }));
  const calls = { xai: 0, edit: 0, token: 0 };
  await p.route('**/auth/api-token', (r) => { calls.token++; const s = script.token || { json: { ok: true, token: 'test', exp: Date.now() / 1000 + 900 } }; r.fulfill(s); });
  const serve = (list, k) => async (r) => {
    const s = list[Math.min(calls[k]++, list.length - 1)];
    if (s === 'hang') return;                         // la fuente no contesta nunca
    if (s === 'abort') return r.abort('failed');      // red caída / CORS
    return r.fulfill(s);
  };
  await p.route('https://api.admira.store/xai/image', serve(script.x || [OK_X], 'xai'));
  await p.route('https://api.admira.store/image/edit', serve(script.e || [OK_E], 'edit'));
  await p.goto(BASE + L[lang].page, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => window.AnonFiable && document.querySelector('#anonFinal'));
  await p.click('#btnOwn');
  return { p, ctx, calls, errors };
}
const terminal = (p, ok) => p.waitForFunction((src) => {
  const s = document.querySelector('#status');
  return s.classList.contains('err') || new RegExp(src).test(s.textContent);
}, ok.source, { timeout: 60000 });
const text = (p, sel) => p.$eval(sel, (e) => e.textContent).catch(() => '');
const visible = (p, sel) => p.isVisible(sel);
const noHScroll = (p) => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth);

async function firstFailsSecondWorks(b, lang, width, x, why) {
  const t = L[lang];
  const { p, ctx, calls, errors } = await open(b, lang, width, { x });
  await p.click('#btnInvent');
  await terminal(p, t.ok);
  assert.match(await text(p, '#status'), t.ok, lang + ' termina bien con la 2.ª foto');
  assert.equal(calls.xai, 2, 'exactamente 2 fotos aleatorias');
  assert.equal(await p.$$eval('#anonDiscards li', (l) => l.length), 1, 'un descarte registrado');
  assert.match(await text(p, '#anonDiscards li'), why, 'el descarte explica el motivo');
  assert.equal(await p.$eval('#anonDiscards', (d) => d.open), false, 'el registro entra plegado');
  assert.match(await text(p, '#anonNotice'), t.done2);
  assert.equal(await visible(p, '#anonFinal'), false);
  await p.waitForSelector('#frame4 img', { timeout: 5000 });   // el relleno cierra al 100% y pinta
  assert.equal(await noHScroll(p), true, 'sin scroll horizontal');
  assert.deepEqual(errors, []);
  await ctx.close();
}

(async () => {
  const b = await chromium.launch({ executablePath: exe, headless: true, args: ['--no-sandbox'] });
  let n = 0;
  for (const lang of ['es', 'en']) {
    const t = L[lang];
    // 1) Primera foto: la fuente no contesta (timeout) → otra → bien.
    await firstFailsSecondWorks(b, lang, 1440, ['hang', OK_X], t.timeout); n++;
    // 2) Primera foto: la red/CORS corta la petición → otra → bien.
    await firstFailsSecondWorks(b, lang, 1440, ['abort', OK_X], t.net); n++;
    // 3) Primera foto: llega una imagen ilegible (bad-image) → otra → bien.
    await firstFailsSecondWorks(b, lang, 390, [GARBAGE, OK_X], t.bad); n++;

    // 4) Todas fallan → error final explicado + «Probar otra vez» (que vuelve a intentarlo).
    {
      const { p, ctx, calls, errors } = await open(b, lang, lang === 'es' ? 390 : 1440, { x: [MODERATION] });
      await p.click('#btnInvent');
      await terminal(p, t.ok);
      assert.equal(calls.xai, 5, 'máximo 5 fotos, ni una más');
      assert.equal(await visible(p, '#anonFinal'), true);
      assert.match(await text(p, '#anonFinal p'), t.all);
      assert.match(await text(p, '#btnRetryAll'), t.retry);
      assert.equal(await p.$$eval('#anonDiscards li', (l) => l.length), 5);
      await p.click('#anonDiscards summary');
      assert.equal(await p.$eval('#anonDiscards', (d) => d.open), true, 'el registro se despliega');
      assert.equal(await noHScroll(p), true);
      await p.click('#btnRetryAll');
      await p.waitForFunction(() => document.querySelectorAll('#anonDiscards li').length === 5 && !document.querySelector('#anonFinal').hidden && !document.querySelector('#btnInvent').disabled, null, { timeout: 60000 });
      assert.equal(calls.xai, 10, '«Probar otra vez» hace otra pasada acotada');
      assert.deepEqual(errors, []);
      await ctx.close(); n++;
    }

    // 5) Foto PROPIA que el motor rechaza → se explica qué pasó y qué hacer; NO se sustituye.
    {
      const { p, ctx, calls, errors } = await open(b, lang, 1440, { e: [DECLINED] });
      await p.setInputFiles('#fileInput', { name: 'mia.jpg', mimeType: 'image/jpeg', buffer: JPG });
      await terminal(p, t.ok);
      assert.match(await text(p, '#status'), t.ownDeclined);
      assert.equal(calls.xai, 0, 'nunca se pide una foto aleatoria en su lugar');
      assert.equal(calls.edit, 1, 'un rechazo de contenido no se reintenta a ciegas');
      assert.match(await p.$eval('#frame1 img', (i) => i.getAttribute('src')), /^data:image\/jpeg/, 'su foto sigue en la tarjeta Original');
      assert.equal(await visible(p, '#anonDiscards'), false);
      assert.equal(await visible(p, '#anonFinal'), true);
      assert.equal(await visible(p, '#btnRetryAll'), false, 'sin «Probar otra vez»: hace falta otra foto suya');
      assert.deepEqual(errors, []);
      await ctx.close(); n++;
    }

    // 6) Foto PROPIA ilegible → se explica sin mandarla al motor.
    {
      const { p, ctx, calls } = await open(b, lang, 390, {});
      await p.setInputFiles('#fileInput', { name: 'foto.heic', mimeType: 'image/heic', buffer: Buffer.from('ftypheic no decodificable') });
      await p.waitForFunction(() => document.querySelector('#status').classList.contains('err'), null, { timeout: 15000 });
      assert.match(await text(p, '#status'), t.ownBad);
      assert.equal(calls.edit + calls.xai, 0, 'no se envía nada al motor');
      assert.equal(await noHScroll(p), true);
      await ctx.close(); n++;
    }

    // 7) Sesión caducada → se dice al momento, sin gastar las 5 fotos.
    {
      const { p, ctx, calls } = await open(b, lang, 1440, { token: { status: 401, json: { ok: false } } });
      await p.click('#btnInvent');
      await terminal(p, t.ok);
      assert.match(await text(p, '#status'), t.session);
      assert.equal(calls.xai, 0, 'no se llama al motor sin sesión');
      assert.equal(await visible(p, '#btnRetryAll'), false);
      await ctx.close(); n++;
    }
  }
  await b.close();
  console.log('ok anonimizador-fiable.browser · ' + n + ' escenarios');
})().catch((e) => { console.error(e); process.exit(1); });
