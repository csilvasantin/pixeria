// Estancos y circuito en el navegador (Carlos, 6-oct-2026): con Altadis activo se eligen dos estancos,
// «Preparar paquete» marca exactamente sus formatos (cliente-01 y cliente-02), los exporta con FFmpeg
// WASM y deja el ZIP por estanco y el global (fflate fijado) con manifest.json. La publicación al Stock
// se intercepta: dos piezas con etiquetas y externalRef estable, y al repetirla no se sube nada.
// Uso: BASE=http://127.0.0.1:9193 [SHOTS=/dir] [PW=/ruta/playwright-core] [CHROME=/ruta/chrome]
//      node test/adaptador-estancos.browser.cjs
// La verja se simula respondiendo /auth/session en el propio navegador (sin credenciales).
const { chromium } = require(process.env.PW || '/usr/local/lib/node_modules/playwright-core');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const BASE = process.env.BASE || 'http://127.0.0.1:9193', SHOTS = process.env.SHOTS || '';
const PICK = ['altadis-bcn-003', 'altadis-bcn-007'];

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'estancos-e2e-'));
  const VIDEO = path.join(tmp, 'clip.mp4');
  const mk = spawnSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'testsrc=size=640x360:rate=25:duration=2', '-pix_fmt', 'yuv420p', '-c:v', 'libx264', VIDEO]);
  assert.equal(mk.status, 0, String(mk.stderr));
  const browser = await chromium.launch({ executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--no-sandbox'] });
  const published = [];
  const open = async (width, lang = '') => {
    const ctx = await browser.newContext({ viewport: { width, height: width < 500 ? 844 : 900 }, deviceScaleFactor: width < 500 ? 2 : 1, acceptDownloads: true });
    await ctx.route('**/auth/session', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }));
    await ctx.route('**/stock-publish', r => { published.push(JSON.parse(r.request().postData())); r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, id: 'test-' + published.length, num: 9000 + published.length }) }); });
    // Nada de programar players ni de tocar producción: cualquier escritura a admira.tv o a la parrilla falla el test.
    const forbidden = [];
    await ctx.route(/admira\.tv\/api\/playlist|api\.admira\.store\/(grid|signage)\//, r => { if (r.request().method() !== 'GET') forbidden.push(r.request().url()); r.abort(); });
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', e => errors.push(String(e)));
    await page.goto(`${BASE}${lang}/adaptaciones/?proyecto=altadis-estancos-bcn`, { waitUntil: 'load' });
    await page.waitForFunction(() => !document.querySelector('#estancos').hidden && document.querySelectorAll('#estancos-lista > li').length, null, { timeout: 20000 });
    return { ctx, page, errors, forbidden };
  };
  const openLibrary = async page => {
    const menu = await page.$('.pix-nav-icon-menu');
    if (menu && await page.evaluate(() => document.body.classList.contains('pf-left-off'))) await menu.click(); else await page.click('#btn-sizes').catch(() => {});
    await page.waitForTimeout(900);
  };
  const tick = (page, ids) => page.evaluate(ids => ids.forEach(id => { const b = document.querySelector(`#estancos-lista input[value="${id}"]`); if (!b.checked) b.click(); }), ids);
  const shot = async (page, name) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, name) }); } };

  // ── 1440 · español: dos estancos, paquete, ZIP y Stock ──
  {
    const { ctx, page, errors, forbidden } = await open(1440);
    const list = await page.evaluate(() => ({ n: document.querySelectorAll('#estancos-lista > li').length, btn: document.querySelector('#estancos-preparar').disabled, status: document.querySelector('#estancos-status').textContent }));
    assert.equal(list.n, 9); assert.equal(list.btn, true); assert.match(list.status, /Elige primero un contenido/);
    await page.setInputFiles('#src-file', VIDEO);
    await page.waitForFunction(() => !document.querySelector('#btn-adaptar').disabled, null, { timeout: 15000 });
    await page.click('#btn-adaptar');
    await tick(page, PICK);
    await page.evaluate(() => { const s = document.querySelector('#estancos-stock'); if (!s.checked) s.click(); });
    const label = await page.$eval('#estancos-preparar', b => b.textContent);
    assert.equal(label, 'Preparar paquete · 2 estancos · 2 formatos');
    await openLibrary(page);
    await page.evaluate(() => { const el = document.querySelector('#estancos-lista li:nth-child(3)'), box = el.closest('.rail') || document.scrollingElement; box.scrollTop += el.getBoundingClientRect().top - 420; });
    await page.waitForTimeout(300);
    await shot(page, 'estancos-1440.png');
    await page.evaluate(() => document.querySelector('#estancos-preparar').click());
    await page.waitForTimeout(500);
    // ☰ se superpone al contenido: se cierra para pulsar en el paquete.
    const menu = await page.$('.pix-nav-icon-menu'); if (menu) await menu.click(); else await page.evaluate(() => document.body.classList.add('pf-left-off'));
    await page.waitForTimeout(600);
    const cards = await page.evaluate(() => [...document.querySelectorAll('#grid .fmt[data-f]')].map(e => e.dataset.f));
    assert.deepEqual(cards, ['cliente-01', 'cliente-02'], 'exactly the formats of those screens');
    await page.waitForFunction(() => document.querySelector('#paquete-progreso').textContent.startsWith('2/2') && document.querySelectorAll('#paquete-stock-log li').length === 2, null, { timeout: 300000 });
    assert.equal(published.length, 2, 'one Stock piece per format');
    for (const body of published) {
      assert.equal(body.type, 'video'); assert.equal(body.motor, 'adaptador'); assert.equal(body.mime, 'video/mp4');
      assert.ok(body.tags.includes('altadis') && body.tags.includes('estanco-altadis-bcn-003') && body.tags.includes('estanco-altadis-bcn-007'), body.tags.join());
      assert.ok(body.tags.some(t => /^pantalla-p\d-/.test(t)) && body.tags.some(t => /^cliente-0[12]$/.test(t)));
      assert.match(body.externalRef, /^pixeria:altadis-estancos-bcn:sha256-[0-9a-f]{16}:cliente-0[12]$/);
      assert.match(body.comment, /estanco altadis-bcn-003 · pantalla altadis-bcn-003-p/);
    }
    assert.notEqual(published[0].externalRef, published[1].externalRef);
    // Repetir la publicación no sube nada (misma fuente y formato).
    await page.click('#paquete-publicar');
    await page.waitForFunction(() => [...document.querySelectorAll('#paquete-stock-log li')].filter(li => /ya estaba/.test(li.textContent)).length === 2, null, { timeout: 15000 });
    assert.equal(published.length, 2, 'no duplicates on re-publish');
    // ZIP por estanco.
    const dl = async sel => { const [d] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.click(sel)]); const p = path.join(tmp, d.suggestedFilename()); await d.saveAs(p); return p; };
    const one = await dl('.paquete-grupo[data-estanco="altadis-bcn-003"] .paquete-zip-estanco');
    assert.equal(path.basename(one), 'altadis-estancos-bcn-altadis-bcn-003-n275-torrent-de-l-olla.zip');
    const names = spawnSync('unzip', ['-Z1', one], { encoding: 'utf8' }).stdout.trim().split('\n').sort();
    assert.deepEqual(names, ['altadis-bcn-003-n275-torrent-de-l-olla/p1-vertical-cliente-01-1080x1920.mp4', 'altadis-bcn-003-n275-torrent-de-l-olla/p2-horizontal-cliente-02-1920x1080.mp4', 'manifest.json']);
    const man = JSON.parse(spawnSync('unzip', ['-p', one, 'manifest.json'], { encoding: 'utf8' }).stdout);
    assert.equal(man.proyecto, 'altadis-estancos-bcn'); assert.equal(man.piezas.length, 2);
    for (const pz of man.piezas) {
      assert.equal(pz.estanco, 'altadis-bcn-003'); assert.match(pz.sha256, /^[0-9a-f]{64}$/); assert.equal(pz.duracion, 2); assert.ok(pz.stock && pz.stock.externalRef);
      const out = path.join(tmp, 'x.mp4'); fs.writeFileSync(out, spawnSync('unzip', ['-p', one, pz.archivo], { maxBuffer: 1 << 28 }).stdout);
      assert.equal(require('node:crypto').createHash('sha256').update(fs.readFileSync(out)).digest('hex'), pz.sha256);
      const probe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,codec_name', '-of', 'csv=p=0', out], { encoding: 'utf8' }).stdout.trim();
      assert.equal(probe, `h264,${pz.ancho},${pz.alto}`);
    }
    // ZIP global: los dos estancos.
    const all = await dl('#paquete-zip');
    assert.equal(path.basename(all), 'altadis-estancos-bcn-todos.zip');
    const allNames = spawnSync('unzip', ['-Z1', all], { encoding: 'utf8' }).stdout.trim().split('\n');
    assert.equal(allNames.length, 5); assert.ok(allNames.some(n => n.startsWith('altadis-bcn-007-n359-tabacs-m-angels/p2-horizontal-cliente-02-1920x1080.mp4')));
    await page.evaluate(() => document.body.classList.add('pf-left-off'));
    await page.evaluate(() => window.scrollTo(0, document.querySelector('#paquete').getBoundingClientRect().top + scrollY - 90));
    await page.waitForTimeout(300);
    await shot(page, 'paquete-1440.png');
    assert.deepEqual(errors, []); assert.deepEqual(forbidden, []);
    await ctx.close();
  }

  // ── 390 · inglés: lista, «todos», sin desbordar ──
  {
    const { ctx, page, errors } = await open(390, '/en');
    await page.setInputFiles('#src-file', VIDEO);
    await page.waitForFunction(() => !document.querySelector('#btn-adaptar').disabled, null, { timeout: 15000 });
    await page.click('#btn-adaptar');
    await page.evaluate(() => document.querySelector('#estancos-todos').click());
    const s = await page.evaluate(() => ({ label: document.querySelector('#estancos-preparar').textContent, checked: document.querySelectorAll('#estancos-lista input:checked').length, h3: document.querySelector('#estancos-h').textContent }));
    assert.equal(s.checked, 9); assert.equal(s.label, 'Prepare package · 9 shops · 2 formats'); assert.equal(s.h3, 'Tobacconists');
    await openLibrary(page);
    await page.evaluate(() => { const el = document.querySelector('#estancos'), box = el.closest('.rail') || document.scrollingElement; box.scrollTop += el.getBoundingClientRect().top - 140; });
    await page.waitForTimeout(300);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    assert.equal(overflow, false, 'no horizontal scroll at 390');
    await shot(page, 'estancos-390.png');
    assert.deepEqual(errors, []);
    await ctx.close();
  }
  await browser.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('✓ adaptador-estancos: paquete, ZIP, manifiesto y Stock sin duplicados');
})().catch(e => { console.error(e); process.exit(1); });
