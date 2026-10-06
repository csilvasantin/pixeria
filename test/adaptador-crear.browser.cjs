// Adaptador · Crear (formatos extremos) en el navegador (Carlos, 6-oct-2026).
// Sube un 16:9 de 2 s, añade el banner ultralargo 3840×540 (r ≈ 4 → «Crear») y comprueba:
//   · la tarjeta 3840×540 pasa a «Crear» con su etiqueta; la 16:9 sigue en «Adaptar»;
//   · las tres recetas pintan en el canvas y cada una exporta un MP4 con FFmpeg WASM
//     (ffprobe: 3840×540, H.264, 25/1, 50 fotogramas, 2,0 s); la publicación al Stock se intercepta
//     y lleva la etiqueta crear-<receta>;
//   · forzar «Adaptar» en el banner y «Crear» en la 16:9;
//   · 390 px y /en/ sin desbordamiento horizontal.
// Uso: python3 -m http.server 9195 --bind 127.0.0.1 &
//      BASE=http://127.0.0.1:9195 [SHOTS=/dir] PW=/ruta/playwright-core node test/adaptador-crear.browser.cjs
const { chromium } = require(process.env.PW || '/usr/local/lib/node_modules/playwright-core');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const BASE = process.env.BASE || 'http://127.0.0.1:9195', SHOTS = process.env.SHOTS || '';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adaptador-crear-'));
const SRC = path.join(dir, 'clip-16x9.mp4');
const ff = args => { const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { encoding: 'utf8' }); assert.equal(r.status, 0, r.stderr); };
ff(['-f', 'lavfi', '-i', 'testsrc2=size=1280x720:rate=25', '-f', 'lavfi', '-i', 'sine=frequency=660:sample_rate=48000', '-t', '2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', SRC]);

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--no-sandbox'] });
  const published = [];
  const open = async (width, lang = '') => {
    const ctx = await browser.newContext({ viewport: { width, height: width < 500 ? 844 : 900 }, deviceScaleFactor: width < 500 ? 2 : 1 });
    await ctx.route('**/auth/session', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }));
    await ctx.route('**/stock-publish', r => { published.push(JSON.parse(r.request().postData())); r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, id: 'test-' + published.length, num: 9000 + published.length }) }); });
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', e => errors.push(String(e)));
    await page.goto(`${BASE}${lang}/adaptaciones/?proyecto=general`, { waitUntil: 'load' });
    await page.waitForFunction(() => !!document.querySelector('#src-file'), null, { timeout: 30000 });
    await page.evaluate(() => { try { localStorage.clear(); } catch (_) {} });
    await page.setInputFiles('#src-file', SRC);
    await page.waitForFunction(() => !document.querySelector('#btn-adaptar').disabled, null, { timeout: 30000 });
    await page.click('#btn-adaptar');
    // Banner ultralargo 3840×540 como tamaño propio (el panel ☰ entra cerrado: se envía el formulario por script).
    await page.$eval('#custom-width', el => { el.value = '3840'; });
    await page.$eval('#custom-height', el => { el.value = '540'; });
    await page.$eval('#custom-size-form', f => f.requestSubmit());
    await page.waitForSelector('#grid .fmt[data-f="custom-3840x540"]');
    await page.waitForTimeout(600);
    return { ctx, page, errors };
  };
  const card = id => `#grid .fmt[data-f="${id}"]`;
  const info = (page, id) => page.evaluate(sel => {
    const el = document.querySelector(sel), c = el.querySelector('canvas'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let lit = 0; for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 60) lit++;
    const tag = el.querySelector('.accion-tag');
    return { tag: tag && !tag.hidden ? tag.textContent : '', pressed: [...el.querySelectorAll('.accion-btn[aria-pressed="true"]')].map(b => b.dataset.accion),
      receta: el.querySelector('.receta-btn[aria-pressed="true"]')?.dataset.receta || null, recetasVisible: !el.querySelector('.recetas').hidden,
      lit: lit / (d.length / 4), button: el.querySelector('.export-one').textContent.trim(), crear: el.classList.contains('fmt-crear') };
  }, card(id));
  const fetchBlob = (page, href) => page.evaluate(async h => { const b = new Uint8Array(await (await fetch(h)).arrayBuffer()); let s = ''; for (let i = 0; i < b.length; i += 32768) s += String.fromCharCode.apply(null, b.subarray(i, i + 32768)); return btoa(s); }, href).then(b => Buffer.from(b, 'base64'));
  const doneRow = (page, label) => page.waitForFunction(l => [...document.querySelectorAll('.export-queue .eq-item')].some(li => li.textContent.includes(l) && (li.classList.contains('eq-done') || li.classList.contains('eq-error'))), label, { timeout: 300000 })
    .then(() => page.evaluate(l => { const li = [...document.querySelectorAll('.export-queue .eq-item')].find(x => x.textContent.includes(l)); return { ok: li.classList.contains('eq-done'), text: li.textContent, href: li.querySelector('.eq-dl')?.href, file: li.querySelector('.eq-dl')?.download }; }, label));
  const probe = file => {
    const p = JSON.parse(spawnSync('ffprobe', ['-v', 'error', '-count_frames', '-show_streams', '-show_format', '-of', 'json', file], { encoding: 'utf8' }).stdout);
    const v = p.streams.find(s => s.codec_type === 'video');
    return { codec: v.codec_name, w: v.width, h: v.height, rate: v.r_frame_rate, frames: +v.nb_read_frames, dur: +p.format.duration, audio: p.streams.some(s => s.codec_type === 'audio') };
  };
  const recetas = [['tira', 'Tira'], ['barrido', 'Barrido'], ['rotulo', 'Rótulo']];

  // ── Español · 1440 ──
  {
    const { ctx, page, errors } = await open(1440);
    const banner = await info(page, 'custom-3840x540'), normal = await info(page, '16:9');
    console.log('3840×540:', banner.tag, banner.pressed, banner.button, '· 16:9:', normal.pressed, normal.button);
    assert.equal(banner.tag, 'Crear · Barrido', 'visible Crear tag with the default recipe');
    assert.deepEqual(banner.pressed, ['crear']); assert(banner.recetasVisible && banner.crear);
    assert.equal(banner.button, 'Crear MP4 · 2 s');
    assert.equal(normal.tag, ''); assert.deepEqual(normal.pressed, ['adaptar']); assert(!normal.recetasVisible);
    assert.equal(normal.button, 'Exportar MP4');
    await page.click(card('custom-3840x540'));
    assert.match(await page.textContent('#card-settings .aviso'), /Crear · Barrido · MP4 2 s · 25 fps · paneo vertical/);
    assert.match(await page.textContent('#plan-tecnico'), /crop=w=\d+:h=\d+:x='min\(2\*floor/);
    if (SHOTS) await page.locator(card('16:9')).screenshot({ path: path.join(SHOTS, 'tarjeta-normal-adaptar-1440.png') });

    for (const [id, name] of recetas) {
      await page.click(`${card('custom-3840x540')} .receta-btn[data-receta="${id}"]`);
      if (id === 'rotulo') {
        // Avanzado (⚙) entra cerrado: se escribe como lo haría el usuario, con el evento input.
        const type = (k, v) => page.$eval(`#card-settings [data-c="${k}"]`, (el, val) => { el.value = val; el.dispatchEvent(new Event('input', { bubbles: true })); }, v);
        await type('rotulo.texto', 'Nuevo sabor · ya en tu estanco'); await type('rotulo.textoEn', 'New flavour · now in store');
      }
      await page.waitForTimeout(id === 'tira' ? 1500 : 700);
      const c = await info(page, 'custom-3840x540');
      console.log(`${id}: tag «${c.tag}» · ${Math.round(c.lit * 100)}% pintado · ${c.button}`);
      assert.equal(c.receta, id); assert.equal(c.tag, `Crear · ${name}`); assert(c.lit > .05, `${id} paints the canvas (${c.lit})`);
      if (SHOTS) { await page.locator(card('custom-3840x540')).scrollIntoViewIfNeeded(); await page.locator(card('custom-3840x540')).screenshot({ path: path.join(SHOTS, `tarjeta-3840x540-${id}-1440.png`) }); }
      await page.click(`${card('custom-3840x540')} .export-one`);
      const row = await doneRow(page, `· ${name}`); assert(row.ok, row.text);
      const file = path.join(dir, row.file); fs.writeFileSync(file, await fetchBlob(page, row.href));
      const pr = probe(file);
      console.log(`  MP4 ${row.file}:`, pr);
      assert.deepEqual([pr.codec, pr.w, pr.h, pr.rate, pr.frames], ['h264', 3840, 540, '25/1', 50]);
      assert(Math.abs(pr.dur - 2) < .1, `duration ${pr.dur}`);
      assert.equal(pr.audio, id !== 'tira', 'tira has no audio; sweep and ticker keep it');
      if (SHOTS) {
        fs.copyFileSync(file, path.join(SHOTS, row.file));
        ff(['-i', file, '-vf', "select='eq(n\\,10)+eq(n\\,30)+eq(n\\,49)',scale=1280:-2,tile=1x3", '-frames:v', '1', path.join(SHOTS, `fotogramas-${id}.png`)]);
      }
    }
    await page.waitForFunction(n => [...document.querySelectorAll('.export-queue .eq-note')].filter(x => /En el Stock/.test(x.textContent)).length >= n, 3, { timeout: 60000 });
    for (const [id] of recetas) assert(published.some(p => p.tags.includes(`crear-${id}`) && p.validacion.ancho === 3840), `Stock tag crear-${id}`);
    console.log('Stock (interceptado):', published.map(p => p.tags.join(',')).join(' | '));

    // Forzar «Adaptar» en el banner y «Crear» en la 16:9; persiste al recargar.
    await page.click(`${card('custom-3840x540')} .accion-btn[data-accion="adaptar"]`);
    await page.click(`${card('16:9')} .accion-btn[data-accion="crear"]`);
    await page.waitForTimeout(400);
    const b2 = await info(page, 'custom-3840x540'), n2 = await info(page, '16:9');
    assert.equal(b2.tag, ''); assert.deepEqual(b2.pressed, ['adaptar']); assert.equal(b2.button, 'Exportar MP4');
    assert.equal(n2.tag, 'Crear · Barrido'); assert.deepEqual(n2.pressed, ['crear']); assert(n2.lit > .2);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pixeria.adapter.v1')).crear);
    assert.equal(saved['custom-3840x540'].accion, 'adaptar'); assert.equal(saved['16:9'].accion, 'crear');
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'forzado-1440.png') });
    assert.deepEqual(errors, []); await ctx.close();
  }
  // ── Imágenes: PNG fija (tira de zonas), GIF animado (barrido) y SVG (rótulo) → MP4 3840×540 ──
  {
    const PNG = path.join(dir, 'foto.png'), GIF = path.join(dir, 'anim.gif'), SVG = path.join(dir, 'logo.svg');
    ff(['-f', 'lavfi', '-i', 'testsrc2=size=1280x720', '-frames:v', '1', PNG]);
    ff(['-f', 'lavfi', '-i', 'testsrc2=size=320x180:rate=10', '-t', '1', '-loop', '0', GIF]);
    fs.writeFileSync(SVG, '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90" viewBox="0 0 160 90"><rect width="160" height="90" fill="#0a3"/><circle cx="50" cy="45" r="30" fill="#ff0"/><rect x="95" y="20" width="50" height="50" fill="#f0f"/></svg>');
    for (const [file, receta, name, frames] of [[PNG, 'tira', 'Tira', 50], [GIF, 'barrido', 'Barrido', 25], [SVG, 'rotulo', 'Rótulo', 50]]) {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      await ctx.route('**/auth/session', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }));
      await ctx.route('**/stock-publish', r => { published.push(JSON.parse(r.request().postData())); r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, id: 'img-' + published.length }) }); });
      const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(String(e)));
      await page.goto(`${BASE}/adaptaciones/?proyecto=general`, { waitUntil: 'load' });
      await page.waitForFunction(() => !!document.querySelector('#src-file'));
      await page.setInputFiles('#src-file', file);
      await page.waitForFunction(() => !document.querySelector('#btn-adaptar').disabled, null, { timeout: 60000 });
      await page.click('#btn-adaptar');
      await page.$eval('#still-seconds', el => { el.value = '2'; el.dispatchEvent(new Event('change', { bubbles: true })); });
      await page.$eval('#custom-width', el => { el.value = '3840'; }); await page.$eval('#custom-height', el => { el.value = '540'; });
      await page.$eval('#custom-size-form', f => f.requestSubmit());
      await page.waitForSelector(card('custom-3840x540'));
      await page.click(`${card('custom-3840x540')} .receta-btn[data-receta="${receta}"]`);
      await page.waitForTimeout(800);
      const c = await info(page, 'custom-3840x540');
      assert.equal(c.tag, `Crear · ${name}`); assert(c.lit > .05, `${path.basename(file)} ${receta} paints (${c.lit})`);
      await page.click(`${card('custom-3840x540')} .export-one`);
      const row = await doneRow(page, `· ${name}`); assert(row.ok, row.text);
      const out = path.join(dir, row.file); fs.writeFileSync(out, await fetchBlob(page, row.href));
      const pr = probe(out);
      console.log(`${path.basename(file)} · ${receta}:`, row.file, pr);
      assert.deepEqual([pr.codec, pr.w, pr.h, pr.rate, pr.frames, pr.audio], ['h264', 3840, 540, '25/1', frames, false]);
      if (SHOTS) await page.locator(card('custom-3840x540')).screenshot({ path: path.join(SHOTS, `imagen-${path.extname(file).slice(1)}-${receta}-1440.png`) });
      assert.deepEqual(errors, []); await ctx.close();
    }
  }
  // ── 390 px (ES) y 1440 (EN): tarjetas, recetas y sin desbordamiento ──
  for (const [width, lang] of [[390, ''], [1440, '/en']]) {
    const { ctx, page, errors } = await open(width, lang);
    const b = await info(page, 'custom-3840x540'), n = await info(page, '16:9');
    assert.equal(b.tag, lang ? 'Create · Sweep' : 'Crear · Barrido'); assert.equal(n.tag, '');
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert(over <= 1, `no horizontal overflow (${over})`);
    for (const [id] of recetas) {
      await page.click(`${card('custom-3840x540')} .receta-btn[data-receta="${id}"]`);
      await page.waitForTimeout(id === 'tira' ? 1500 : 700);
      assert((await info(page, 'custom-3840x540')).lit > .05);
      if (SHOTS && !lang) { await page.locator(card('custom-3840x540')).scrollIntoViewIfNeeded(); await page.locator(card('custom-3840x540')).screenshot({ path: path.join(SHOTS, `tarjeta-3840x540-${id}-${width}.png`) }); }
    }
    if (SHOTS && !lang) { await page.locator(card('16:9')).scrollIntoViewIfNeeded(); await page.locator(card('16:9')).screenshot({ path: path.join(SHOTS, `tarjeta-normal-adaptar-${width}.png`) }); }
    if (SHOTS && lang) await page.screenshot({ path: path.join(SHOTS, `en-${width}.png`) });
    assert.deepEqual(errors, []); await ctx.close();
  }
  await browser.close();
  fs.rmSync(dir, { recursive: true, force: true });
  console.log('OK · Crear (formatos extremos) en el navegador');
})().catch(e => { console.error(e); fs.rmSync(dir, { recursive: true, force: true }); process.exit(1); });
