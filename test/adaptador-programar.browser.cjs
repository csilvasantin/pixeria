// Programación de players en el navegador (Carlos, 6-oct-2026): con el paquete por estanco publicado en
// el Stock, «Probar programación (sin cambios)» llama a /players-programar en modo prueba y pinta el plan
// y las pantallas que no existen; «Programar N players de M estancos» queda deshabilitado mientras falte
// la prueba de ESE lote o haya pantallas inexistentes, pide confirmación y llama al modo real con la firma.
// /auth/session, /stock-publish y /players-programar se simulan en el navegador: nada sale a producción.
// Uso: BASE=http://127.0.0.1:9193 [SHOTS=/dir] [PW=/ruta/playwright-core] [CHROME=/ruta/chrome]
//      node test/adaptador-programar.browser.cjs
const { chromium } = require(process.env.PW || '/usr/local/lib/node_modules/playwright-core');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const BASE = process.env.BASE || 'http://127.0.0.1:9193', SHOTS = process.env.SHOTS || '';

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'programar-e2e-'));
  const VIDEO = path.join(tmp, 'clip.mp4');
  const mk = spawnSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'testsrc=size=640x360:rate=25:duration=2', '-pix_fmt', 'yuv420p', '-c:v', 'libx264', VIDEO]);
  assert.equal(mk.status, 0, String(mk.stderr));
  const browser = await chromium.launch({ executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--no-sandbox'] });

  // Servidor simulado de /players-programar: `world.existen` decide qué pantallas hay en la parrilla.
  const open = async (width, lang, world) => {
    const ctx = await browser.newContext({ viewport: { width, height: width < 500 ? 844 : 900 }, deviceScaleFactor: width < 500 ? 2 : 1 });
    const calls = [], forbidden = [];
    let n = 0;
    await ctx.route('**/auth/session', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"email":"csilvasantin@gmail.com"}' }));
    await ctx.route('**/stock-publish', r => { n++; r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, id: 'test-' + n, num: 9000 + n }) }); });
    await ctx.route(/admira\.tv\/api\/playlist|api\.admira\.store\/(grid|signage)\//, r => { if (r.request().method() !== 'GET') forbidden.push(r.request().url()); r.abort(); });
    await ctx.route('**/players-programar', r => {
      const body = JSON.parse(r.request().postData()); calls.push(body);
      if (world.status) return r.fulfill({ status: world.status, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'sin-sesion' }) });
      const screens = [...new Set(body.piezas.map(p => p.screenId))];
      const plan = screens.map(s => ({ screenId: s, existe: world.existen, assetsOk: true, actual: { items: 0, rev: 0, updatedBy: null }, sustituye: 0,
        payload: { screen: s, name: 'altadis-estancos-bcn', source: 'adaptador altadis-estancos-bcn', items: body.piezas.filter(p => p.screenId === s).map(p => ({ id: p.stockId, stockId: p.stockId, title: 't', sub: '', lane: 'publicidad', seconds: p.duracion, asset: p.url, assetType: 'video', tags: [] })) } }));
      const inexistentes = world.existen ? [] : screens;
      const estancos = new Set(body.piezas.map(p => p.estanco)).size;
      const base = { modo: body.modo, proyecto: body.proyecto, circuito: 'altadis_bcn', quien: 'csilvasantin@gmail.com', cuando: '2026-10-06T19:00:00.000Z', firma: 'f'.repeat(64),
        resumen: { piezas: body.piezas.length, pantallas: screens.length, estancos, inexistentes: inexistentes.length, assetsNoDisponibles: 0, parrilla: true } };
      if (body.modo === 'prueba') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, ...base, secretoConfigurado: true, inexistentes, assetsNoDisponibles: [], plan, pantallas: [] }) });
      const resultados = screens.map(s => ({ screenId: s, ok: true, status: 200, items: 1, rev: 1001, error: null }));
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, ...base, resultados, piezas: body.piezas.map((p, i) => ({ pieza: i, screenId: p.screenId, ok: true, rev: 1001, error: null })) }) });
    });
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', e => errors.push(String(e)));
    await page.goto(`${BASE}${lang}/adaptaciones/?proyecto=altadis-estancos-bcn`, { waitUntil: 'load' });
    await page.waitForFunction(() => !document.querySelector('#estancos').hidden && document.querySelectorAll('#estancos-lista > li').length, null, { timeout: 20000 });
    return { ctx, page, errors, forbidden, calls };
  };
  // Paquete publicado en el Stock para los estancos dados (exporta de verdad con FFmpeg WASM).
  const preparePublished = async (page, ids) => {
    await page.setInputFiles('#src-file', VIDEO);
    await page.waitForFunction(() => !document.querySelector('#btn-adaptar').disabled, null, { timeout: 15000 });
    await page.click('#btn-adaptar');
    await page.evaluate(ids => { localStorage.clear(); ids.forEach(id => { const b = document.querySelector(`#estancos-lista input[value="${id}"]`); if (!b.checked) b.click(); }); const s = document.querySelector('#estancos-stock'); if (!s.checked) s.click(); }, ids);
    await page.evaluate(() => document.querySelector('#estancos-preparar').click());
    await page.waitForTimeout(400);
    await page.evaluate(() => document.body.classList.add('pf-left-off'));
    await page.waitForFunction(() => document.querySelectorAll('#paquete-stock-log li').length === 2 && !document.querySelector('#programar-probar').disabled, null, { timeout: 300000 });
  };
  const shot = async (page, name) => {
    if (!SHOTS) return;
    fs.mkdirSync(SHOTS, { recursive: true });
    await page.evaluate(() => { const el = document.querySelector('#programar'), bar = document.querySelector('.pf-topbar, header'); const top = bar ? bar.getBoundingClientRect().bottom : 0; window.scrollTo(0, el.getBoundingClientRect().top + scrollY - top - 12); });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(SHOTS, name) });
  };
  const ui = page => page.evaluate(() => ({
    probar: document.querySelector('#programar-probar').disabled, probarTxt: document.querySelector('#programar-probar').textContent,
    real: document.querySelector('#programar-real').disabled, realTxt: document.querySelector('#programar-real').textContent,
    status: document.querySelector('#programar-status').textContent,
    plan: [...document.querySelectorAll('#programar-plan li')].map(li => ({ screen: li.dataset.screen, bad: li.classList.contains('bad'), txt: li.textContent })),
    log: [...document.querySelectorAll('#programar-log li')].map(li => li.textContent)
  }));

  // ── 1440 · español: hoy no existen las pantallas → no se puede programar; con alta → confirmación y real ──
  {
    const world = { existen: false };
    const { ctx, page, errors, forbidden, calls } = await open(1440, '', world);
    await preparePublished(page, ['altadis-bcn-003', 'altadis-bcn-007']);
    let s = await ui(page);
    assert.equal(s.probarTxt, 'Probar programación (sin cambios)');
    assert.equal(s.realTxt, 'Programar 4 players de 2 estancos');
    assert.equal(s.real, true, 'sin prueba no se programa');
    assert.match(s.status, /Prueba la programación antes de programar/);
    await page.click('#programar-probar');
    await page.waitForFunction(() => document.querySelectorAll('#programar-plan li').length === 4, null, { timeout: 15000 });
    s = await ui(page);
    assert.equal(calls.length, 1); assert.equal(calls[0].modo, 'prueba'); assert.equal(calls[0].proyecto, 'altadis-estancos-bcn');
    assert.equal(calls[0].piezas.length, 4);
    for (const p of calls[0].piezas) {
      assert.match(p.stockId, /^test-\d$/);
      assert.equal(p.url, `https://stock.admira.store/stock/${p.stockId}/asset.mp4`);
      assert.equal(p.screenId, `${p.estanco}-${p.pantalla}`);
      assert.equal(p.duracion, 2);
      assert.equal(p.secret, undefined);
    }
    assert.ok(s.plan.every(r => r.bad && /no existe en la parrilla/.test(r.txt)));
    assert.match(s.status, /4 pantallas no existen en la parrilla/);
    assert.equal(s.real, true, 'con pantallas inexistentes no se programa');
    assert.match(s.log[0], /Prueba · 4 pantallas de 2 estancos · 4 no existen · sin cambios/);
    await shot(page, 'programar-prueba-1440.png');
    // Alta de las pantallas: nueva prueba → se habilita.
    world.existen = true;
    await page.click('#programar-probar');
    await page.waitForFunction(() => !document.querySelector('#programar-real').disabled, null, { timeout: 15000 });
    s = await ui(page);
    assert.ok(s.plan.every(r => !r.bad)); assert.match(s.status, /Prueba correcta/);
    // Cancelar la confirmación no llama al modo real.
    page.once('dialog', d => { assert.match(d.message(), /SUSTITUIR la lista por defecto de 4 players de 2 estancos/); d.dismiss(); });
    await page.click('#programar-real');
    await page.waitForTimeout(300);
    assert.equal(calls.filter(c => c.modo === 'real').length, 0);
    assert.match((await ui(page)).log[0], /cancelada/);
    page.once('dialog', d => d.accept());
    await page.click('#programar-real');
    await page.waitForFunction(() => /Programados 4 players/.test(document.querySelector('#programar-status').textContent), null, { timeout: 15000 });
    const real = calls.filter(c => c.modo === 'real');
    assert.equal(real.length, 1); assert.equal(real[0].firma, 'f'.repeat(64));
    s = await ui(page);
    assert.match(s.log[0], /Programación · 4\/4 players · csilvasantin@gmail\.com/);
    assert.equal(s.log.filter(l => /^\S+ · ✓ altadis-bcn-00[37]-p[12]-/.test(l)).length, 4);
    assert.equal(s.real, true, 'después de programar, otra programación exige otra prueba');
    assert.deepEqual(errors, []); assert.deepEqual(forbidden, []);
    await ctx.close();
  }

  // ── 390 · inglés: prueba con pantallas inexistentes, sin desbordar; sesión caducada ──
  {
    const world = { existen: false };
    const { ctx, page, errors, forbidden, calls } = await open(390, '/en', world);
    await preparePublished(page, ['altadis-bcn-001']);
    let s = await ui(page);
    assert.equal(s.probarTxt, 'Test scheduling (no changes)');
    assert.equal(s.realTxt, 'Schedule 2 players in 1 shop');
    await page.click('#programar-probar');
    await page.waitForFunction(() => document.querySelectorAll('#programar-plan li').length === 2, null, { timeout: 15000 });
    s = await ui(page);
    assert.match(s.status, /2 screens do not exist in the player grid/);
    assert.ok(s.plan.every(r => /not in the grid · would get 1 piece/.test(r.txt)));
    assert.equal(s.real, true);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    assert.equal(overflow, false, 'no horizontal scroll at 390');
    await shot(page, 'programar-prueba-390.png');
    world.status = 401;
    await page.click('#programar-probar');
    await page.waitForFunction(() => /session has expired/.test(document.querySelector('#programar-status').textContent), null, { timeout: 15000 });
    assert.equal((await ui(page)).real, true);
    assert.equal(calls.every(c => c.modo === 'prueba'), true);
    assert.deepEqual(errors, []); assert.deepEqual(forbidden, []);
    await ctx.close();
  }
  await browser.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('✓ adaptador-programar: prueba sin cambios, bloqueo por pantallas inexistentes, confirmación y modo real');
})().catch(e => { console.error(e); process.exit(1); });
