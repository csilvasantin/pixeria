// Adaptador · formatos de entrada en el navegador (Carlos, 5-oct-2026): pegar una imagen (ClipboardEvent
// con DataTransfer), SVG rasterizado a cada formato, GIF animado (ImageDecoder y, sin WebCodecs, el MP4
// intermedio de FFmpeg WASM), AVIF nativo y HEIC con libheif (WASM). Exporta PNG del SVG, MP4 del GIF
// animado y MP4 del SVG, y los comprueba con ffprobe. La publicación al Stock se intercepta.
// Los ficheros de prueba se crean en local con ffmpeg (y `sips` para el HEIC, en macOS).
// Uso: BASE=http://127.0.0.1:9191 [SHOTS=/dir] [PW=/ruta/playwright-core] [CHROME=/ruta/chrome]
//      [NO_HEIC=1] [NO_FALLBACK=1] node test/adaptador-formatos.browser.cjs
// La verja se simula respondiendo /auth/session en el propio navegador (sin credenciales).
const { chromium } = require(process.env.PW || '/usr/local/lib/node_modules/playwright-core');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const BASE = process.env.BASE || 'http://127.0.0.1:9191', SHOTS = process.env.SHOTS || '';

// ── Ficheros de prueba ──
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'adaptador-formatos-'));
const ff = args => { const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { cwd: DIR, encoding: 'utf8' }); assert.equal(r.status, 0, r.stderr); };
// GIF animado de 6 fotogramas con retardos distintos (5, 20, 0→10, 10, 30 y 15 cs = 0,9 s).
ff(['-f', 'lavfi', '-i', 'testsrc2=size=320x180:rate=10:duration=0.6', '-vf', 'split[a][b];[a]palettegen[p];[b][p]paletteuse', 'anim.gif']);
{ const b = fs.readFileSync(path.join(DIR, 'anim.gif')), d = [5, 20, 0, 10, 30, 15]; let p = 0, n = 0;
  while ((p = b.indexOf(Buffer.from([0x21, 0xF9, 0x04]), p)) >= 0) { b.writeUInt16LE(d[n++], p + 4); p += 8; }
  assert.equal(n, 6); fs.writeFileSync(path.join(DIR, 'anim.gif'), b); }
ff(['-f', 'lavfi', '-i', 'testsrc2=size=800x450:duration=0.04', '-frames:v', '1', 'captura.png']);
ff(['-f', 'lavfi', '-i', 'testsrc2=size=640x480:duration=0.04', '-frames:v', '1', 'base.png']);
ff(['-i', 'base.png', '-c:v', 'libsvtav1', '-pix_fmt', 'yuv420p', 'muestra.avif']);
// SVG solo con viewBox y un <script> que no debe ejecutarse nunca.
fs.writeFileSync(path.join(DIR, 'logo.svg'), `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 90">
  <script>window.__svgScriptRan = true; parent.__svgScriptRan = true;</script>
  <rect width="160" height="90" fill="#0b3d91"/><circle cx="80" cy="45" r="30" fill="#ffcc00"/>
  <path d="M10 80 L150 10" stroke="#ffffff" stroke-width="0.5"/>
</svg>`);
const HEIC = !process.env.NO_HEIC && spawnSync('sips', ['-s', 'format', 'heic', 'base.png', '--out', 'muestra.heic'], { cwd: DIR }).status === 0 && fs.existsSync(path.join(DIR, 'muestra.heic'));
const file = n => path.join(DIR, n);
const probe = f => JSON.parse(spawnSync('ffprobe', ['-v', 'error', '-count_frames', '-show_streams', '-show_format', '-of', 'json', f], { encoding: 'utf8' }).stdout);

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--no-sandbox'] });
  const published = [];
  const open = async (width, { lang = '', noDecoder = false } = {}) => {
    const ctx = await browser.newContext({ viewport: { width, height: width < 500 ? 844 : 900 }, deviceScaleFactor: width < 500 ? 2 : 1 });
    await ctx.route('**/auth/session', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }));
    await ctx.route('**/stock-publish', r => { published.push(JSON.parse(r.request().postData())); r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, id: 'test-' + published.length, num: 9000 + published.length }) }); });
    if (noDecoder) await ctx.addInitScript(() => { delete window.ImageDecoder; });
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', e => errors.push(String(e)));
    await page.goto(`${BASE}${lang}/adaptaciones/`, { waitUntil: 'load' });
    await page.waitForFunction(() => !!window.PixeriaFormatos && !!window.PixeriaAdaptador && document.querySelectorAll('#stock-list li[role=option]').length > 0, null, { timeout: 30000 });
    return { ctx, page, errors };
  };
  const ready = page => page.waitForFunction(() => !document.querySelector('#btn-adaptar').disabled, null, { timeout: 60000 });
  const shot = async (page, name, opts = {}) => { if (!SHOTS) return; await page.waitForTimeout(600); await page.screenshot({ path: path.join(SHOTS, name), ...opts }); };
  const fichaShot = async (page, name) => { if (SHOTS) await page.locator('#src-ficha').screenshot({ path: path.join(SHOTS, name) }); };
  const ficha = page => page.textContent('#src-ficha');
  // Pegar como lo hace el navegador: ClipboardEvent('paste') con un DataTransfer que lleva el archivo o el texto.
  const paste = (page, { name, type, b64, text, target = 'body' }) => page.evaluate(({ name, type, b64, text, target }) => {
    const dt = new DataTransfer();
    if (b64) { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); dt.items.add(new File([u], name, { type })); }
    if (text) dt.setData('text/plain', text);
    const el = document.querySelector(target); if (el !== document.body) el.focus(); else document.activeElement?.blur?.();
    const ev = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true });
    el.dispatchEvent(ev); return ev.defaultPrevented;
  }, { name, type, b64, text, target });
  const fetchBlob = (page, href) => page.evaluate(async h => { const b = new Uint8Array(await (await fetch(h)).arrayBuffer()); let s = ''; for (let i = 0; i < b.length; i += 32768) s += String.fromCharCode.apply(null, b.subarray(i, i + 32768)); return btoa(s); }, href).then(b => Buffer.from(b, 'base64'));
  const doneRow = (page, label) => page.waitForFunction(l => [...document.querySelectorAll('.export-queue .eq-item')].some(li => li.textContent.includes(l) && (li.classList.contains('eq-done') || li.classList.contains('eq-error'))), label, { timeout: 240000 })
    .then(() => page.evaluate(l => { const li = [...document.querySelectorAll('.export-queue .eq-item')].find(x => x.textContent.includes(l)); return { ok: li.classList.contains('eq-done'), text: li.textContent, href: li.querySelector('.eq-dl')?.href, file: li.querySelector('.eq-dl')?.download }; }, label));
  const check = async (page, id) => page.$eval(`#size-categories input[aria-label="${id}"]`, el => { el.checked = true; el.dispatchEvent(new Event('change', { bubbles: true })); });
  const mp4 = async (page, label, dims, frames) => {
    const row = await doneRow(page, label); assert(row.ok, row.text);
    const out = path.join(DIR, row.file); fs.writeFileSync(out, await fetchBlob(page, row.href));
    const d = probe(out), v = d.streams.find(s => s.codec_type === 'video');
    console.log('  MP4', row.file, v.codec_name, `${v.width}x${v.height}`, v.r_frame_rate, v.nb_read_frames, 'fotogramas', d.format.duration, 's');
    assert.deepEqual([v.codec_name, v.width, v.height, v.r_frame_rate, v.pix_fmt], ['h264', ...dims, '25/1', 'yuv420p']);
    assert.equal(+v.nb_read_frames, frames); assert(!d.streams.some(s => s.codec_type === 'audio'), 'sin audio');
    if (SHOTS) fs.copyFileSync(out, path.join(SHOTS, row.file));
    return { d, v };
  };

  // ── 1 · Pegar (1440, ES) ──
  {
    const { ctx, page, errors } = await open(1440);
    assert.match(await page.textContent('.paste-hint'), /o pega una imagen con (⌘V|Ctrl\+V)/);
    // Con el foco en un campo de texto, ⌘V no se toca.
    const b64 = fs.readFileSync(file('captura.png')).toString('base64');
    assert.equal(await paste(page, { name: 'image.png', type: 'image/png', b64, target: '#stock-tag' }), false, 'paste in a text field is left alone');
    assert.equal(await page.$eval('#src-img', el => el.getAttribute('src')), null);
    // Captura de pantalla pegada: llega como «image.png».
    assert.equal(await paste(page, { name: 'image.png', type: 'image/png', b64 }), true);
    await ready(page);
    const st = await page.evaluate(() => ({ status: document.querySelector('#paste-status').textContent, live: document.querySelector('#paste-status').getAttribute('aria-live'), info: document.querySelector('#src-info').textContent, file: document.querySelector('#src-file').files[0]?.name }));
    console.log('Pegar:', st.status, '·', st.info);
    assert.match(st.status, /^Imagen pegada: pegado-\d{8}-\d{6}\.png$/); assert.equal(st.live, 'polite');
    assert.match(st.info, /800×450 · imagen fija$/); assert.equal(st.file, st.status.split(': ')[1]);
    await page.waitForFunction(() => /FormatoPNG[\s\S]*Pegado · pegado-/.test(document.querySelector('#src-ficha')?.textContent || ''), null, { timeout: 10000 });
    await shot(page, 'pegado-1440.png');
    // Texto con la URL de una imagen del Stock: fuente remota en modo CORS.
    const imgURL = await page.evaluate(() => [...document.querySelectorAll('#stock-list li[role=option]')].map(li => window.PixeriaStock.item(li.dataset.url)).find(it => /image\/(jpeg|png)/.test(it.mime || ''))?.url);
    if (imgURL) {
      assert.equal(await paste(page, { text: `mira esto ${imgURL}` }), true);
      await page.waitForFunction(u => (document.querySelector('#src-img').getAttribute('src') || '').startsWith(u.split('?')[0]) && document.querySelector('#src-img').complete && !document.querySelector('#btn-adaptar').disabled, imgURL, { timeout: 30000 });
      assert.match(await page.$eval('#src-img', el => el.getAttribute('src')), /[?&]cors=1/);
      assert.match(await page.textContent('#paste-status'), /^Imagen por URL: /);
    }
    // URL de YouTube: va al importador (se sustituye para no descargar nada).
    await page.evaluate(() => { window.PixeriaImportar.importar = u => { window.__importada = u; }; });
    assert.equal(await paste(page, { text: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }), true);
    assert.equal(await page.evaluate(() => window.__importada), 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    assert.equal(await page.inputValue('#imp-url'), 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    assert.deepEqual(errors, []); await ctx.close();
  }

  // ── 2 · SVG: rasterizado a cada formato, sin ejecutar su script; PNG y MP4 ──
  {
    const { ctx, page, errors } = await open(1440);
    await page.setInputFiles('#src-file', file('logo.svg')); await ready(page);
    assert.match(await page.textContent('#src-info'), /logo\.svg · 160×90 · SVG vectorial$/);
    await page.waitForFunction(() => /SVG vectorial/.test(document.querySelector('#src-ficha')?.textContent || ''), null, { timeout: 10000 });
    const f = await ficha(page); assert.match(f, /Vectorial · 160 × 90 px/); assert.match(f, /viewBox \(sin width\/height\)/); assert.match(f, /Rasterizadopor formato de salida/);
    assert.equal(await page.evaluate(() => window.__svgScriptRan), undefined, 'the SVG script never runs');
    assert.equal(await page.evaluate(() => document.querySelectorAll('svg script').length), 0, 'the SVG is never inserted into the DOM');
    await shot(page, 'svg-paso1-1440.png'); await fichaShot(page, 'ficha-svg-1440.png');
    // Raster vectorial: a 1280×720 el borde del círculo es nítido; la base de 160×90 ampliada, no.
    const sharp = await page.evaluate(async () => {
      const m = await import('/adaptaciones/fuentes-especiales.mjs'), text = window.PixeriaAdaptador.fuente.svgTexto;
      const big = await m.rasterSVG(text, 1280, 720), small = await m.rasterSVG(text, 160, 90);
      const up = document.createElement('canvas'); up.width = 1280; up.height = 720; up.getContext('2d').drawImage(small, 0, 0, 1280, 720);
      const blurred = c => { const d = c.getContext('2d').getImageData(0, 360, 1280, 1).data; let n = 0; for (let i = 0; i < d.length; i += 4) { const yellow = d[i] > 245 && d[i + 1] > 195 && d[i + 2] < 10, blue = d[i] < 16 && d[i + 1] < 70 && d[i + 2] > 140; if (!yellow && !blue) n++; } return n; };
      return { big: [big.width, big.height], small: [small.width, small.height], edgeBig: blurred(big), edgeUp: blurred(up) };
    });
    console.log('SVG raster:', JSON.stringify(sharp));
    assert.deepEqual(sharp.big, [1280, 720]); assert.deepEqual(sharp.small, [160, 90]);
    // Bordes del círculo y la línea blanca de 0,5: unos pocos píxeles de antialias frente a decenas al ampliar.
    assert(sharp.edgeBig <= 16 && sharp.edgeUp >= sharp.edgeBig * 3, 'vector raster is sharp');
    await page.click('#btn-adaptar');
    await page.fill('#still-seconds', '1'); await page.$eval('#still-seconds', el => el.dispatchEvent(new Event('change', { bubbles: true })));
    await check(page, 'Tamaño Medium rectangle'); await check(page, 'Tamaño Póster / Poster');
    await page.waitForTimeout(800);
    const lit = await page.evaluate(() => [...document.querySelectorAll('#grid .fmt canvas')].map(c => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 60) n++; return n / (d.length / 4); }));
    assert(lit.every(x => x > .2), `SVG painted in every card ${lit}`);
    await shot(page, 'svg-tarjetas-1440.png');
    // PNG 300×250 y póster 2362×3543: el raster de cada uno a su resolución.
    await page.click('#grid .fmt[data-f="display-300x250"] .export-one:not(.export-jpg)');
    const png = await doneRow(page, 'Medium rectangle · PNG'); assert(png.ok, png.text);
    const pb = await fetchBlob(page, png.href); assert.equal(pb.readUInt32BE(16), 300); assert.equal(pb.readUInt32BE(20), 250);
    await page.click('#grid .fmt[data-f="print-poster"] .export-one');
    const poster = await doneRow(page, 'Póster / Poster · PNG'); assert(poster.ok, poster.text);
    const qb = await fetchBlob(page, poster.href); assert.equal(qb.readUInt32BE(16), 2362); assert.equal(qb.readUInt32BE(20), 3543);
    console.log('SVG → PNG', png.file, pb.length, 'B ·', poster.file, qb.length, 'B');
    if (SHOTS) { fs.writeFileSync(path.join(SHOTS, png.file), pb); }
    // MP4 9:16 de 1 s: la línea indica el raster usado (recorte: 1920 de alto; contener: 1080 de ancho).
    // Reencuadre de siempre: se fuerza «Adaptar» (16:9 → 9:16 pasa a «Crear» por la desproporción).
    await page.click('#grid .fmt[data-f="9:16"] .accion-btn[data-accion="adaptar"]'); 
    await page.click('#grid .fmt[data-f="9:16"] .export-one');
    await mp4(page, 'Vertical 9:16', [1080, 1920], 25);
    assert.match(await page.textContent('.export-queue'), /Vertical 9:16[\s\S]*SVG vectorial · (3414×1920|1080×608)/);
    await page.waitForFunction(() => /En el Stock/.test(document.querySelector('.export-queue').textContent), null, { timeout: 30000 });
    assert.deepEqual(errors, []); await ctx.close();
  }

  // ── 3 · GIF animado: ImageDecoder, bucle, ficha y MP4 de 25 fps con su duración ──
  {
    const { ctx, page, errors } = await open(1440);
    await page.setInputFiles('#src-file', file('anim.gif')); await ready(page);
    const st = await page.evaluate(() => ({ anim: !document.querySelector('#src-anim').hidden, video: !document.querySelector('#src').hidden, img: !document.querySelector('#src-img').hidden, play: !document.querySelector('#btn-play').hidden, sound: !document.querySelector('#btn-sound').hidden, info: document.querySelector('#src-info').textContent, via: window.PixeriaAdaptador.fuente.previo }));
    console.log('GIF animado:', st.info, '· vista previa', st.via);
    assert(st.anim && !st.video && !st.img && st.play && !st.sound); assert.equal(st.via, 'imagedecoder');
    assert.match(st.info, /anim\.gif · 320×180 · GIF animado · 6 fotogramas · 0,9 s$/);
    // Se reproduce en bucle: el fotograma cambia y vuelve a empezar.
    const seen = await page.evaluate(async () => { const c = document.querySelector('#src-anim canvas'), seen = new Set(); for (let i = 0; i < 40; i++) { await new Promise(r => setTimeout(r, 50)); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let h = 0; for (let j = 0; j < d.length; j += 4) h = (h * 31 + d[j] + 7 * d[j + 1] + 13 * d[j + 2]) | 0; seen.add(h); } return seen.size; });
    assert.equal(seen, 6, `the GIF plays and loops: ${seen} distinct frames in 2 s`);
    await page.waitForFunction(() => /GIF animado/.test(document.querySelector('#src-ficha')?.textContent || ''), null, { timeout: 10000 });
    const f = await ficha(page); assert.match(f, /Fotogramas6 · 6,67 fps de media/); assert.match(f, /00:00:00 · 0,900 s · un bucle/); assert.match(f, /BuclesInfinito|Buclesinfinito/); assert.match(f, /WebCodecs ImageDecoder/);
    await shot(page, 'gif-animado-1440.png'); await fichaShot(page, 'ficha-gif-1440.png');
    await page.click('#btn-adaptar'); await page.waitForTimeout(600);
    // 16:9 → 9:16 (r ≈ 3,16) pasa a «Crear» desde el 6-oct-2026: aquí se prueba el reencuadre, así que se fuerza «Adaptar».
    await page.click('#grid .fmt[data-f="9:16"] .accion-btn[data-accion="adaptar"]'); await page.waitForTimeout(200);
    assert.equal(await page.textContent('#grid .fmt[data-f="9:16"] .export-one'), 'Exportar MP4 · 0,9 s');
    assert.equal(await page.isHidden('#still-wrap'), true);
    await check(page, 'Tamaño Medium rectangle'); await page.waitForTimeout(300);
    assert.deepEqual(await page.$$eval('#grid .fmt[data-f="display-300x250"] .export-one', bs => bs.filter(b => !b.hidden).map(b => b.textContent)), ['Exportar PNG', 'JPG']);
    assert.match(await page.textContent('#plan-tecnico'), /"-ignore_loop" "1" "-i" "input\.gif"[^\n]*tpad=stop_mode=clone[^\n]*trim=end_frame=23/);
    await page.click('#btn-play-2'); await page.waitForTimeout(400);
    await shot(page, 'gif-animado-tarjetas-1440.png');
    await page.click('#grid .fmt[data-f="display-300x250"] .export-jpg');
    const jpg = await doneRow(page, 'Medium rectangle · JPG'); assert(jpg.ok); assert.deepEqual([...(await fetchBlob(page, jpg.href)).subarray(0, 3)], [0xFF, 0xD8, 0xFF]);
    await page.click('#grid .fmt[data-f="9:16"] .export-one');
    const { d } = await mp4(page, 'Vertical 9:16', [1080, 1920], 23);
    assert(Math.abs(+d.format.duration - 0.9) <= 0.04, `duration ${d.format.duration} ≈ 0.9 s`);
    await page.waitForFunction(() => /En el Stock/.test(document.querySelector('.export-queue').textContent), null, { timeout: 30000 });
    const pub = published[published.length - 1]; assert.equal(pub.type, 'video'); assert.equal(pub.validacion.duracion, 0.9); assert(!pub.tags.includes('imagen-fija'));
    await shot(page, 'gif-animado-exportado-1440.png');
    // GIF estático: imagen fija normal.
    await page.click('#btn-volver');
    ff(['-f', 'lavfi', '-i', 'testsrc2=size=200x120:duration=0.04', '-frames:v', '1', 'estatico.gif']);
    await page.setInputFiles('#src-file', file('estatico.gif')); await ready(page);
    assert.match(await page.textContent('#src-info'), /200×120 · imagen fija$/);
    await page.waitForFunction(() => /GIF estático/.test(document.querySelector('#src-ficha')?.textContent || ''), null, { timeout: 10000 });
    assert.deepEqual(errors, []); await ctx.close();
  }

  // ── 4 · GIF animado sin WebCodecs: MP4 intermedio con FFmpeg WASM ──
  if (!process.env.NO_FALLBACK) {
    const { ctx, page, errors } = await open(1440, { noDecoder: true });
    assert.equal(await page.evaluate(() => typeof window.ImageDecoder), 'undefined');
    await page.setInputFiles('#src-file', file('anim.gif')); await ready(page);
    const st = await page.evaluate(() => ({ video: !document.querySelector('#src').hidden, src: document.querySelector('#src').getAttribute('src'), loop: document.querySelector('#src').loop, w: document.querySelector('#src').videoWidth, via: window.PixeriaAdaptador.fuente.previo }));
    console.log('GIF sin ImageDecoder:', JSON.stringify(st));
    assert(st.video && /^blob:/.test(st.src) && st.loop); assert.equal(st.via, 'ffmpeg'); assert.equal(st.w, 320);
    await page.waitForFunction(() => /MP4 intermedio/.test(document.querySelector('#src-ficha')?.textContent || ''), null, { timeout: 10000 });
    assert.deepEqual(errors, []); await ctx.close();
  }

  // ── 5 · AVIF (nativo) y HEIC (libheif WASM en Chrome) ──
  {
    const { ctx, page, errors } = await open(1440);
    await page.setInputFiles('#src-file', file('muestra.avif')); await ready(page);
    assert.match(await page.textContent('#src-info'), /muestra\.avif · 640×480 · imagen fija$/);
    await page.waitForFunction(() => /FormatoAVIF/.test(document.querySelector('#src-ficha')?.textContent || ''), null, { timeout: 10000 });
    assert.match(await ficha(page), /Decodificaciónnativa del navegador/);
    await fichaShot(page, 'ficha-avif-1440.png');
    await page.click('#btn-adaptar'); await page.waitForTimeout(500);
    await page.click('#grid .fmt[data-f="1:1"]');
    if (HEIC) {
      await page.click('#btn-volver');
      await page.setInputFiles('#src-file', file('muestra.heic'));
      await page.waitForFunction(() => !document.querySelector('#btn-adaptar').disabled || /No se pudo abrir este HEIC/.test(document.querySelector('#src-msg').textContent), null, { timeout: 90000 });
      const msg = await page.textContent('#src-msg'); assert(!/No se pudo/.test(msg), msg);
      await page.waitForFunction(() => /libheif-js/.test(document.querySelector('#src-ficha')?.textContent || ''), null, { timeout: 10000 });
      const f = await ficha(page); console.log('HEIC:', await page.textContent('#src-info'));
      assert.match(f, /FormatoHEIC/); assert.match(f, /libheif-js 1\.23\.5 · WASM/); assert.match(f, /640 × 480 px/);
      await fichaShot(page, 'ficha-heic-1440.png');
    } else console.log('HEIC: sin muestra (sips no disponible o NO_HEIC): no se prueba');
    assert.deepEqual(errors, []); await ctx.close();
  }

  // ── 6 · Móvil 390 (ES) e inglés: pegar, SVG, GIF animado y ficha ──
  for (const [width, lang] of [[390, ''], [1440, '/en']]) {
    const { ctx, page, errors } = await open(width, { lang });
    const tag = `${lang ? 'en-' : ''}${width}`;
    if (lang) assert.match(await page.textContent('.paste-hint'), /or paste an image with (⌘V|Ctrl\+V)/);
    await paste(page, { name: 'image.png', type: 'image/png', b64: fs.readFileSync(file('captura.png')).toString('base64') }); await ready(page);
    assert.match(await page.textContent('#paste-status'), lang ? /^Image pasted: / : /^Imagen pegada: /);
    await shot(page, `pegado-${tag}.png`, { fullPage: width < 500 });
    await page.setInputFiles('#src-file', file('logo.svg')); await ready(page);
    assert.equal(await page.textContent('#paste-status'), '', 'the paste notice is cleared by a new source');
    await page.waitForFunction(() => /SVG/.test(document.querySelector('#src-ficha')?.textContent || ''), null, { timeout: 10000 });
    await shot(page, `svg-paso1-${tag}.png`, { fullPage: width < 500 });
    await page.setInputFiles('#src-file', file('anim.gif')); await ready(page);
    await page.waitForFunction(() => /(GIF animado|Animated GIF)/.test(document.querySelector('#src-ficha')?.textContent || ''), null, { timeout: 10000 });
    if (lang) assert.match(await ficha(page), /Animated GIF/);
    await shot(page, `gif-animado-${tag}.png`, { fullPage: width < 500 }); await fichaShot(page, `ficha-gif-${tag}.png`);
    await page.click('#btn-adaptar'); await page.waitForTimeout(800);
    assert.equal(await page.textContent('#btn-volver'), lang ? '← Change GIF' : '← Cambiar GIF');
    await shot(page, `gif-animado-tarjetas-${tag}.png`, { fullPage: width < 500 });
    assert.deepEqual(errors, []); await ctx.close();
  }
  await browser.close();
  fs.rmSync(DIR, { recursive: true, force: true });
  console.log('OK · formatos de entrada del Adaptador en el navegador');
})().catch(e => { console.error(e); process.exit(1); });
