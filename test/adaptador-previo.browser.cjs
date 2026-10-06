// Adaptador · previo animado de «Crear» y recetas de la ficha de Altadis (Carlos, 6-oct-2026).
// Con una imagen fija 16:9 y el banner 3840×540 (barrido):
//   · con prefers-reduced-motion el previo arranca en pausa y lo indica; ▶ lo anima con su propio reloj:
//     el canvas cambia entre dos instantes y la barra de tiempo avanza («0:0x / 0:10»);
//   · seek: clic en la barra y valor exacto; el mismo instante pinta lo mismo (determinista);
//   · tira: en t = 0 no hay piezas, al final están todas (cascada); rótulo: el texto se desplaza;
//   · al cambiar un ajuste de la receta el previo se actualiza en vivo;
//   · «Previsualizar todas» anima todas las tarjetas «Crear» a la vez y las vuelve a pausar;
//   · vídeo reproduciéndose: la tarjeta sigue al vídeo y ▶ queda como alternativa;
//   · Altadis aplica las recetas de la ficha (también con r < umbral) y el videowall anima pared y entrega;
//   · 390 px y /en/ sin desbordamiento. Graba un vídeo corto del previo (recordVideo) si SHOTS está definido.
// Uso: python3 -m http.server 9195 --bind 127.0.0.1 &
//      BASE=http://127.0.0.1:9195 [SHOTS=/dir] PW=/ruta/playwright-core node test/adaptador-previo.browser.cjs
const { chromium } = require(process.env.PW || '/usr/local/lib/node_modules/playwright-core');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const BASE = process.env.BASE || 'http://127.0.0.1:9195', SHOTS = process.env.SHOTS || '';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adaptador-previo-'));
const ff = args => { const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { encoding: 'utf8' }); assert.equal(r.status, 0, r.stderr); };
const PNG = path.join(dir, 'foto-16x9.png'), MP4 = path.join(dir, 'clip-16x9.mp4');
ff(['-f', 'lavfi', '-i', 'testsrc2=size=1920x1080', '-frames:v', '1', PNG]);
ff(['-f', 'lavfi', '-i', 'testsrc2=size=1280x720:rate=25', '-t', '3', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', MP4]);
const card = id => `#grid .fmt[data-f="${id}"]`;
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--no-sandbox'] });
  const open = async ({ width = 1440, lang = '', query = '?proyecto=general', file = PNG, reduced = false, video = null } = {}) => {
    const ctx = await browser.newContext({ viewport: { width, height: width < 500 ? 844 : 900 }, deviceScaleFactor: width < 500 ? 2 : 1, reducedMotion: reduced ? 'reduce' : 'no-preference', ...(video ? { recordVideo: video } : {}) });
    await ctx.route('**/auth/session', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }));
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', e => errors.push(String(e)));
    await page.goto(`${BASE}${lang}/adaptaciones/${query}`, { waitUntil: 'load' });
    await page.waitForFunction(() => !!document.querySelector('#src-file'), null, { timeout: 30000 });
    await page.evaluate(() => { try { localStorage.clear(); } catch (_) {} });
    await page.setInputFiles('#src-file', file);
    await page.waitForFunction(() => !document.querySelector('#btn-adaptar').disabled, null, { timeout: 60000 });
    await page.click('#btn-adaptar');
    await page.waitForTimeout(500);
    return { ctx, page, errors };
  };
  const addSize = async (page, w, h) => {
    await page.$eval('#custom-width', (el, v) => { el.value = v; }, String(w));
    await page.$eval('#custom-height', (el, v) => { el.value = v; }, String(h));
    await page.$eval('#custom-size-form', f => f.requestSubmit());
    await page.waitForSelector(card(`custom-${w}x${h}`));
    await page.waitForTimeout(400);
  };
  // Estado del previo de una tarjeta + una firma de los píxeles de su canvas (o de la pared).
  const previo = (page, id, sel = 'canvas') => page.evaluate(([s, cs]) => {
    const el = document.querySelector(s), c = el.querySelector(cs), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let h = 0, lit = 0; for (let i = 0; i < d.length; i += 4) { h = (h * 31 + d[i] + 7 * d[i + 1] + 13 * d[i + 2]) >>> 0; if (d[i] + d[i + 1] + d[i + 2] > 60) lit++; }
    const b = el.querySelector('.previo'), btn = b.querySelector('.previo-btn'), pos = b.querySelector('.previo-pos'), nota = b.querySelector('.previo-nota');
    const tag = el.querySelector('.accion-tag');
    return { visible: !b.hidden, pressed: btn.getAttribute('aria-pressed') === 'true', label: btn.textContent.trim(), value: +pos.value, max: +pos.max,
      time: b.querySelector('.previo-t').textContent, nota: nota.hidden ? '' : nota.textContent, hash: h, lit: lit / (d.length / 4),
      tag: tag && !tag.hidden ? tag.textContent : '', tagTitle: tag ? tag.title : '', crear: el.classList.contains('fmt-crear') };
  }, [card(id), sel]);
  const seek = (page, id, v) => page.$eval(`${card(id)} .previo-pos`, (el, val) => { el.value = String(val); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }, v);
  const shot = async (page, id, name) => { if (!SHOTS) return; const l = page.locator(card(id)); await l.scrollIntoViewIfNeeded(); await l.screenshot({ path: path.join(SHOTS, name) }); };
  const B = 'custom-3840x540';

  // ── 1. Imagen fija · barrido · prefers-reduced-motion: arranca en pausa y ▶ anima ──
  {
    const { ctx, page, errors } = await open({ reduced: true });
    await addSize(page, 3840, 540);
    await page.locator(card(B)).scrollIntoViewIfNeeded();
    const p0 = await previo(page, B);
    console.log('reducido:', p0.label, p0.time, p0.nota);
    assert.equal(p0.tag, 'Crear · Barrido'); assert(p0.visible, 'barra del previo visible en «Crear»');
    assert.equal(p0.pressed, false); assert.match(p0.label, /Previsualizar animación/); assert.match(p0.nota, /Movimiento reducido/);
    assert.match(p0.time, /^0:0\d \/ 0:10$/, 'imagen fija: 10 s');
    await page.waitForTimeout(500);
    assert.equal((await previo(page, B)).hash, p0.hash, 'en pausa no se mueve');
    await page.click(`${card(B)} .previo-btn`);
    await page.waitForTimeout(150);
    const a = await previo(page, B); await page.waitForTimeout(900); const b = await previo(page, B);
    console.log('▶:', a.label, a.time, '→', b.time, a.hash !== b.hash ? 'canvas cambia' : 'canvas igual');
    assert(a.pressed && /Pausar/.test(a.label), 'el botón pasa a ⏸'); assert.equal(a.nota, '');
    assert.notEqual(a.hash, b.hash, 'el canvas cambia entre dos instantes');
    assert(b.value > a.value + .5, `la barra avanza (${a.value} → ${b.value})`);
    if (SHOTS) await shot(page, B, 'barrido-instante-1-1440.png');
    // Seek: valor exacto, y clic real en la barra (≈ la mitad). Pausado, el mismo instante pinta lo mismo.
    await page.click(`${card(B)} .previo-btn`);
    await seek(page, B, 1); await page.waitForTimeout(120); const s1 = await previo(page, B);
    await seek(page, B, 8); await page.waitForTimeout(120); const s8 = await previo(page, B);
    await seek(page, B, 1); await page.waitForTimeout(120); const s1b = await previo(page, B);
    console.log('seek:', s1.time, s8.time, s1.hash === s1b.hash ? 'determinista' : 'distinto');
    assert.equal(s1.time, '0:01 / 0:10'); assert.equal(s8.time, '0:08 / 0:10');
    assert.notEqual(s1.hash, s8.hash); assert.equal(s1.hash, s1b.hash, 'mismo instante, mismo fotograma');
    assert.equal(s1.pressed, false, 'seek desde la pausa no arranca');
    if (SHOTS) await shot(page, B, 'barrido-instante-2-1440.png');
    const bar = await page.locator(`${card(B)} .previo-pos`).boundingBox();
    await page.mouse.click(bar.x + bar.width * .5, bar.y + bar.height / 2); await page.waitForTimeout(150);
    const mid = await previo(page, B);
    assert(Math.abs(mid.value - 5) < 1, `clic a mitad de la barra → ~5 s (${mid.value})`);
    // Ajuste en vivo: sentido inverso en el mismo instante → otro fotograma, sin pulsar nada.
    await page.click(`${card(B)} .dims`); // Avanzado ajusta la tarjeta seleccionada
    await seek(page, B, 2); await page.waitForTimeout(120); const before = await previo(page, B);
    await page.$eval('#card-settings [data-c="barrido.sentido"]', el => { el.value = '-1'; el.dispatchEvent(new Event('change', { bubbles: true })); });
    await page.waitForTimeout(150); const after = await previo(page, B);
    assert.notEqual(before.hash, after.hash, 'cambiar el ajuste actualiza el previo en vivo'); assert.equal(after.time, before.time);
    // Paneo de 4 s en ida y vuelta: la duración no cambia (10 s) y el previo sigue en el mismo instante.
    assert.deepEqual(errors, []); await ctx.close();
  }

  // ── 2. Tira (cascada) y rótulo · sin movimiento reducido: el previo arranca solo ──
  {
    const { ctx, page, errors } = await open();
    await page.$eval('#still-seconds', el => { el.value = '4'; el.dispatchEvent(new Event('change', { bubbles: true })); });
    await addSize(page, 3840, 540);
    await page.locator(card(B)).scrollIntoViewIfNeeded();
    const auto = await previo(page, B);
    assert(auto.pressed, 'imagen fija: el previo arranca en marcha'); assert.equal(auto.nota, '');
    await page.click(`${card(B)} .receta-btn[data-receta="tira"]`);
    await page.click(`${card(B)} .previo-btn`); // pausa
    const cascada = [];
    for (const t of [0, .12, .4, 3.9]) { await seek(page, B, t); await page.waitForTimeout(120); cascada.push(await previo(page, B)); if (SHOTS) await shot(page, B, `tira-cascada-${String(t).replace('.', '_')}s-1440.png`); }
    console.log('tira:', cascada.map(c => `${c.time} ${Math.round(c.lit * 100)}%`).join(' · '));
    assert(cascada[0].lit < .02, 'en t = 0 aún no hay piezas');
    assert(cascada[1].lit > cascada[0].lit && cascada[2].lit > cascada[1].lit, 'las piezas aparecen en cascada');
    assert(cascada[3].lit > .3, 'al final se ven todas');
    await page.click(`${card(B)} .receta-btn[data-receta="rotulo"]`); await page.click(`${card(B)} .dims`);
    await page.$eval('#card-settings [data-c="rotulo.texto"]', el => { el.value = 'Nuevo sabor · ya en tu estanco'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await seek(page, B, .4); await page.waitForTimeout(150); const r1 = await previo(page, B);
    await seek(page, B, 1.6); await page.waitForTimeout(150); const r2 = await previo(page, B);
    assert.notEqual(r1.hash, r2.hash, 'el rótulo se desplaza');
    if (SHOTS) await shot(page, B, 'rotulo-1440.png');
    // Previsualizar todas: dos tarjetas «Crear» (banner + rascacielos 160×600) a la vez.
    await addSize(page, 160, 600);
    const todas = page.locator('#previo-todas');
    assert(await todas.isVisible()); assert.match(await todas.textContent(), /Previsualizar todas · 2/);
    await todas.click(); await page.waitForTimeout(200);
    const [x, y] = [await previo(page, B), await previo(page, 'custom-160x600')];
    assert(x.pressed && y.pressed, 'todas en marcha'); assert.match(await todas.textContent(), /Pausar todas/);
    await page.locator(card('custom-160x600')).scrollIntoViewIfNeeded(); // solo se pintan las visibles
    const y1 = await previo(page, 'custom-160x600'); await page.waitForTimeout(400);
    assert.notEqual((await previo(page, 'custom-160x600')).hash, y1.hash, 'la segunda también se anima');
    await todas.click(); await page.waitForTimeout(150);
    assert(!(await previo(page, B)).pressed && !(await previo(page, 'custom-160x600')).pressed, 'y se pausan todas');
    assert.match(await todas.textContent(), /Previsualizar todas/);
    assert.deepEqual(errors, []); await ctx.close();
  }

  // ── 3. Vídeo: reproduciéndose, la tarjeta sigue al vídeo; ▶ usa su propio reloj ──
  {
    const { ctx, page, errors } = await open({ file: MP4 });
    await addSize(page, 3840, 540);
    await page.evaluate(() => { const v = document.querySelector('#src'); v.muted = true; return v.play(); });
    await page.waitForTimeout(400);
    const v = await previo(page, B);
    assert.match(v.nota, /Sigue al vídeo/); assert.equal(v.pressed, false);
    await page.click(`${card(B)} .previo-btn`); await page.waitForTimeout(200);
    const own = await previo(page, B);
    assert(own.pressed && own.nota === '', 'con ▶ manda el reloj del previo');
    await page.evaluate(() => document.querySelector('#src').pause());
    await page.waitForTimeout(200);
    assert((await previo(page, B)).pressed, 'con el vídeo en pausa sigue animando');
    assert.deepEqual(errors, []); await ctx.close();
  }

  // ── 4. Altadis: recetas de la ficha (también con r < umbral) y videowall animado ──
  {
    const { ctx, page, errors } = await open({ query: '?proyecto=altadis' });
    await page.$eval('#campaigns [data-campaign="altadis"]', b => b.click()); await page.waitForTimeout(800); // ☰ entra cerrado
    const expect = { 'cliente-06': 'Barrido', 'cliente-10': 'Barrido', 'cliente-14': 'Barrido', 'cliente-12': 'Tira', 'cliente-15': 'Tira', 'cliente-21': 'Tira',
      'cliente-09': 'Rótulo', 'cliente-18': 'Rótulo', 'cliente-19': 'Rótulo', 'cliente-esp-1': 'Tira', 'cliente-esp-2': 'Barrido', 'cliente-esp-3': 'Barrido', 'cliente-esp-4': 'Rótulo', 'cliente-esp-5': 'Barrido' };
    const tags = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#grid .fmt[data-f]')].map(el => { const t = el.querySelector('.accion-tag'); return [el.dataset.f, { tag: t && !t.hidden ? t.textContent : '', title: t ? t.title : '' }]; })));
    for (const [id, name] of Object.entries(expect)) assert.equal(tags[id]?.tag, `Crear · ${name}`, `${id}: receta de la ficha`);
    for (const id of ['cliente-01', 'cliente-02', 'cliente-03', 'cliente-05', 'cliente-08', 'cliente-16', 'cliente-17', 'cliente-20', 'cliente-24']) assert.equal(tags[id]?.tag, '', `${id}: sin receta, adapta`);
    assert.match(tags['cliente-14'].title, /r = 3 .*receta de la ficha/, 'cliente-14: r = 3 < 3,5 y crea por la ficha');
    console.log('Altadis:', Object.entries(tags).filter(([, v]) => v.tag).map(([k, v]) => `${k}=${v.tag.replace('Crear · ', '')}`).join(' '));
    // Forzar «Adaptar» en una tarjeta con receta de la ficha.
    await page.click(`${card('cliente-14')} .accion-btn[data-accion="adaptar"]`); await page.waitForTimeout(200);
    assert.equal((await previo(page, 'cliente-14')).tag, ''); assert.equal((await previo(page, 'cliente-14')).visible, false, 'en «Adaptar» no hay previo animado');
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pixeria.adapter.v1.proyecto.altadis-estancos-bcn')).crear);
    assert.equal(saved['cliente-14'].accion, 'adaptar'); assert(!saved['cliente-06'], 'lo que coincide con la ficha no se guarda');
    // Videowall 13x1 V: la pared y la entrega se animan con sus cortes.
    await page.locator(card('cliente-esp-5')).scrollIntoViewIfNeeded(); await page.waitForTimeout(300);
    const w1 = await previo(page, 'cliente-esp-5', 'canvas.wall'), a1 = await previo(page, 'cliente-esp-5', 'canvas.atlas');
    await page.waitForTimeout(800);
    const w2 = await previo(page, 'cliente-esp-5', 'canvas.wall'), a2 = await previo(page, 'cliente-esp-5', 'canvas.atlas');
    assert(w1.visible && w1.pressed, 'videowall: previo en marcha'); assert.notEqual(w1.hash, w2.hash, 'la pared se anima'); assert.notEqual(a1.hash, a2.hash, 'la entrega se anima');
    if (SHOTS) { await shot(page, 'cliente-esp-5', 'altadis-videowall-13x1-1440.png'); await page.locator(card('cliente-12')).scrollIntoViewIfNeeded(); await page.screenshot({ path: path.join(SHOTS, 'altadis-recetas-1440.png') }); }
    assert.deepEqual(errors, []); await ctx.close();
  }

  // ── 5. 390 px (ES) y /en/ (1440): sin desbordamiento; textos ingleses ──
  for (const [width, lang] of [[390, ''], [1440, '/en']]) {
    const { ctx, page, errors } = await open({ width, lang, query: lang ? '?proyecto=altadis' : '?proyecto=general' });
    if (!lang) await addSize(page, 3840, 540);
    const id = lang ? 'cliente-18' : B;
    await page.locator(card(id)).scrollIntoViewIfNeeded(); await page.waitForTimeout(300);
    const p = await previo(page, id);
    if (lang) { assert.equal(p.tag, 'Create · Ticker'); assert.match(p.label, /Pause animation|Preview animation/); assert.match(await page.textContent('#previo-todas'), /Preview all|Pause all/); }
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert(over <= 1, `sin desbordamiento horizontal a ${width} (${over})`);
    if (SHOTS) await shot(page, id, lang ? 'en-altadis-shuttle-1440.png' : 'barrido-390.png');
    if (SHOTS && !lang) { await page.click(`${card(B)} .previo-btn`); await seek(page, B, 7); await page.waitForTimeout(150); await shot(page, B, 'barrido-instante-2-390.png'); }
    if (SHOTS && lang) { await page.locator(card('cliente-12')).scrollIntoViewIfNeeded(); await page.screenshot({ path: path.join(SHOTS, 'en-altadis-1440.png') }); }
    assert.deepEqual(errors, []); await ctx.close();
  }

  // ── 6. Vídeo corto del previo de una tarjeta (recordVideo → MP4/GIF recortado a la tarjeta) ──
  if (SHOTS) {
    const vdir = path.join(dir, 'video');
    const { ctx, page, errors } = await open({ video: { dir: vdir, size: { width: 1440, height: 900 } } });
    await page.$eval('#still-seconds', el => { el.value = '4'; el.dispatchEvent(new Event('change', { bubbles: true })); });
    await addSize(page, 3840, 540);
    const l = page.locator(card(B)); await l.scrollIntoViewIfNeeded();
    await page.click(`${card(B)} .previo-btn`); await seek(page, B, 0); await page.click(`${card(B)} .previo-btn`);
    const t0 = Date.now(); await sleep(4300);
    const box = await l.boundingBox(); const webm = await page.video().path();
    assert.deepEqual(errors, []); await ctx.close();
    const skip = Math.max(0, (Date.now() - t0) / 1000 - 4.3 - .2);
    const crop = `crop=${2 * Math.floor(box.width / 2)}:${2 * Math.floor(box.height / 2)}:${Math.round(box.x)}:${Math.round(box.y)}`;
    const mp4 = path.join(SHOTS, 'previo-barrido-3840x540.mp4'), gif = path.join(SHOTS, 'previo-barrido-3840x540.gif');
    const len = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', webm], { encoding: 'utf8' }).stdout.trim();
    const ss = Math.max(0, +len - 4.4 - skip);
    ff(['-ss', String(ss), '-i', webm, '-t', '4.2', '-vf', `${crop},scale=1152:-2`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-an', mp4]);
    ff(['-i', mp4, '-vf', 'fps=12,scale=720:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse', gif]);
    console.log('vídeo del previo:', mp4, gif);
  }
  await browser.close();
  fs.rmSync(dir, { recursive: true, force: true });
  console.log('OK · previo animado de «Crear» y recetas de Altadis');
})().catch(e => { console.error(e); fs.rmSync(dir, { recursive: true, force: true }); process.exit(1); });
