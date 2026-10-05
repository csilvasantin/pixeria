// Adaptador · imágenes fijas en el navegador (Carlos, 5-oct-2026): la lista del Stock trae imágenes y
// vídeos por fecha; se elige la imagen más reciente, se reencuadra en las tarjetas y se exportan un PNG
// (display 300×250) y un MP4 (9:16) con FFmpeg WASM. El MP4 se comprueba con ffprobe y la publicación
// al Stock se intercepta (no se publica nada). Opcionalmente guarda capturas a 1440 y 390 px.
// Uso: BASE=http://127.0.0.1:9187 [SHOTS=/dir] [PW=/ruta/playwright-core] [CHROME=/ruta/chrome]
//      [IMAGE=/ruta/imagen.jpg] node test/adaptador-imagenes.browser.cjs
// La verja se simula respondiendo /auth/session en el propio navegador (sin credenciales). El índice real
// del Stock (https://stock.admira.store/stock/index.json) es público y con CORS abierto.
const { chromium } = require(process.env.PW || '/usr/local/lib/node_modules/playwright-core');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const BASE = process.env.BASE || 'http://127.0.0.1:9187', SHOTS = process.env.SHOTS || '', SECONDS = 3;

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--no-sandbox'] });
  const published = [];
  const open = async (width, lang = '') => {
    const ctx = await browser.newContext({ viewport: { width, height: width < 500 ? 844 : 900 }, deviceScaleFactor: width < 500 ? 2 : 1 });
    await ctx.route('**/auth/session', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }));
    // Publicar al Stock: se captura el cuerpo y se responde como el Worker, sin salir del navegador.
    await ctx.route('**/stock-publish', r => { published.push(JSON.parse(r.request().postData())); r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, id: 'test-' + published.length, num: 9000 + published.length }) }); });
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', e => errors.push(String(e)));
    await page.goto(`${BASE}${lang}/adaptaciones/`, { waitUntil: 'load' });
    await page.waitForFunction(() => document.querySelectorAll('#stock-list li[role=option]').length > 0, null, { timeout: 30000 });
    return { ctx, page, errors };
  };
  // Elige el primer contenido de la lista (el más reciente) o sube IMAGE desde el equipo.
  const chooseFirst = async page => {
    if (process.env.IMAGE) await page.setInputFiles('#src-file', process.env.IMAGE);
    else { await page.click('#stock-pick'); await page.click('#stock-list li[role=option]'); }
    await page.waitForFunction(() => !document.querySelector('#btn-adaptar').disabled, null, { timeout: 30000 });
  };
  const fetchBlob = (page, href) => page.evaluate(async h => { const b = new Uint8Array(await (await fetch(h)).arrayBuffer()); let s = ''; for (let i = 0; i < b.length; i += 32768) s += String.fromCharCode.apply(null, b.subarray(i, i + 32768)); return btoa(s); }, href).then(b => Buffer.from(b, 'base64'));
  const doneRow = (page, label) => page.waitForFunction(l => [...document.querySelectorAll('.export-queue .eq-item')].some(li => li.textContent.includes(l) && (li.classList.contains('eq-done') || li.classList.contains('eq-error'))), label, { timeout: 240000 })
    .then(() => page.evaluate(l => { const li = [...document.querySelectorAll('.export-queue .eq-item')].find(x => x.textContent.includes(l)); return { ok: li.classList.contains('eq-done'), text: li.textContent, href: li.querySelector('.eq-dl')?.href, file: li.querySelector('.eq-dl')?.download }; }, label));

  // ── Español · 1440: lista, elección, ficha, tarjetas, PNG y MP4 ──
  {
    const { ctx, page, errors } = await open(1440);
    const list = await page.evaluate(() => {
      const lis = [...document.querySelectorAll('#stock-list li[role=option]')];
      const items = lis.map(li => window.PixeriaStock.item(li.dataset.url));
      return { n: lis.length, types: [...new Set(lis.map(li => li.dataset.type))].sort(), first: { type: lis[0].dataset.type, badge: lis[0].querySelector('.stk-k')?.textContent || '', title: lis[0].dataset.title },
        sorted: items.every((it, i) => !i || window.PixeriaStockFuentes.fecha(items[i - 1]) >= window.PixeriaStockFuentes.fecha(it)),
        newest: Math.max(...items.map(it => window.PixeriaStockFuentes.fecha(it))) === window.PixeriaStockFuentes.fecha(items[0]),
        nombre: document.querySelector('#stock-nombre').textContent, count: document.querySelector('#stock-count').textContent };
    });
    assert.deepEqual(list.types, ['image', 'video'], 'images and videos in the same list');
    assert(list.sorted && list.newest, 'most recent first');
    assert.equal(String(list.n), list.count); assert.equal(list.nombre, 'vídeos e imágenes listos');
    console.log('Stock:', list.n, 'contenidos · primero:', list.first.type, '«' + list.first.title.slice(0, 50) + '»');
    if (!process.env.IMAGE) assert.equal(list.first.type, 'image', 'the newest Stock item today is an image (set IMAGE= otherwise)');
    if (list.first.type === 'image') assert.equal(list.first.badge, 'Imagen');
    await chooseFirst(page);
    const src = await page.evaluate(() => ({ img: !document.querySelector('#src-img').hidden, video: !document.querySelector('#src').hidden, info: document.querySelector('#src-info').textContent,
      play: document.querySelector('#btn-play').hidden, sound: document.querySelector('#btn-sound').hidden, imgSrc: document.querySelector('#src-img').getAttribute('src') }));
    assert(src.img && !src.video, 'the image is on stage'); assert(src.play && src.sound, 'no playback controls for a still');
    assert.match(src.info, /\d+×\d+ · imagen fija$/);
    if (!process.env.IMAGE) assert.match(src.imgSrc, /[?&]cors=1/, 'remote image requested in CORS mode (corsURL)');
    await page.waitForFunction(() => /Imagen fija.*Formato(JPEG|PNG|WebP)/.test(document.querySelector('#src-ficha')?.textContent || ''), null, { timeout: 10000 });
    const ficha = await page.textContent('#src-ficha');
    assert.match(ficha, /Imagen fija/); assert.match(ficha, /\d+ × \d+ px/); assert.match(ficha, /JPEG|PNG|WebP/);
    if (!process.env.IMAGE) assert.match(ficha, /Stock · /, 'Stock data despite ?cors=1');
    if (SHOTS) { await page.waitForTimeout(800); await page.screenshot({ path: path.join(SHOTS, 'paso1-imagen-1440.png') }); }

    await page.click('#btn-adaptar');
    await page.waitForSelector('#still-wrap:not([hidden])');
    await page.fill('#still-seconds', String(SECONDS)); await page.$eval('#still-seconds', el => el.dispatchEvent(new Event('change', { bubbles: true })));
    // Display 300×250 además de los cuatro formatos de proporción (el panel ☰ entra cerrado: se marca por script, como un clic).
    await page.$eval('#size-categories input[aria-label="Tamaño Medium rectangle"]', el => { el.checked = true; el.dispatchEvent(new Event('change', { bubbles: true })); });
    // Foco a la izquierda y zoom en el 9:16, como haría el usuario en Avanzado.
    await page.click('#grid .fmt[data-f="9:16"]');
    await page.$eval('#card-settings [data-k="modo"]', el => { el.value = 'cover'; el.dispatchEvent(new Event('input')); });
    await page.$eval('#card-settings [data-k="fx"]', el => { el.value = '0.2'; el.dispatchEvent(new Event('input')); });
    await page.$eval('#card-settings [data-k="zoom"]', el => { el.value = '1.2'; el.dispatchEvent(new Event('input')); });
    await page.waitForTimeout(500);
    const cards = await page.evaluate(() => [...document.querySelectorAll('#grid .fmt')].map(el => {
      const c = el.querySelector('canvas'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let lit = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 60) lit++;
      return { id: el.dataset.f || 'original', lit: lit / (d.length / 4), buttons: [...el.querySelectorAll('.export-one')].filter(b => !b.hidden).map(b => b.textContent.trim()) };
    }));
    console.log('Tarjetas:', cards.map(c => `${c.id} ${Math.round(c.lit * 100)}% [${c.buttons.join(' | ')}]`).join(' · '));
    for (const c of cards) assert(c.lit > .2, `${c.id} shows the image (${c.lit})`);
    const card = id => cards.find(c => c.id === id);
    assert.deepEqual(card('9:16').buttons, [`Exportar MP4 · ${SECONDS} s`]);
    assert.deepEqual(card('display-300x250').buttons, ['Exportar PNG', 'JPG']);
    assert.match(await page.textContent('#card-settings .aviso'), new RegExp(`MP4 ${SECONDS} s · imagen fija, sin audio · Recorte`));
    assert.match(await page.textContent('#plan-tecnico'), /"-loop" "1" "-framerate" "25" "-t" "3"/);
    if (SHOTS) { await page.waitForTimeout(500); await page.screenshot({ path: path.join(SHOTS, 'tarjetas-imagen-1440.png') }); }

    // PNG del display: firma, dimensiones del IHDR.
    await page.click('#grid .fmt[data-f="display-300x250"] .export-one:not(.export-jpg)');
    const png = await doneRow(page, 'Medium rectangle · PNG'); assert(png.ok, png.text);
    const pngBytes = await fetchBlob(page, png.href);
    assert.equal(pngBytes.subarray(1, 4).toString(), 'PNG'); assert.equal(pngBytes.readUInt32BE(16), 300); assert.equal(pngBytes.readUInt32BE(20), 250);
    console.log('PNG:', png.file, pngBytes.length, 'B');
    // JPG del mismo display.
    await page.click('#grid .fmt[data-f="display-300x250"] .export-jpg');
    const jpg = await doneRow(page, 'Medium rectangle · JPG'); assert(jpg.ok, jpg.text);
    const jpgBytes = await fetchBlob(page, jpg.href); assert.deepEqual([...jpgBytes.subarray(0, 3)], [0xFF, 0xD8, 0xFF]); assert.match(jpg.file, /\.jpg$/);

    // MP4 9:16 desde la imagen fija: FFmpeg WASM, después ffprobe.
    await page.click('#grid .fmt[data-f="9:16"] .export-one');
    const mp4 = await doneRow(page, 'Vertical 9:16'); assert(mp4.ok, mp4.text);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adaptador-imagenes-')), file = path.join(dir, mp4.file);
    fs.writeFileSync(file, await fetchBlob(page, mp4.href));
    const probe = JSON.parse(spawnSync('ffprobe', ['-v', 'error', '-count_frames', '-show_streams', '-show_format', '-of', 'json', file], { encoding: 'utf8' }).stdout);
    const v = probe.streams.find(s => s.codec_type === 'video');
    console.log('MP4:', mp4.file, v.codec_name, `${v.width}x${v.height}`, v.r_frame_rate, v.nb_read_frames, 'frames', probe.format.duration, 's', v.pix_fmt, v.color_range);
    assert.deepEqual([v.codec_name, v.width, v.height, v.r_frame_rate, v.pix_fmt], ['h264', 1080, 1920, '25/1', 'yuv420p']);
    assert.equal(+v.nb_read_frames, SECONDS * 25); assert(Math.abs(+probe.format.duration - SECONDS) < .05);
    assert(!probe.streams.some(s => s.codec_type === 'audio'), 'no audio');
    // Publicación al Stock interceptada: el MP4 de imagen sale como vídeo con la etiqueta imagen-fija.
    await page.waitForFunction(() => /En el Stock/.test(document.querySelector('.export-queue').textContent), null, { timeout: 30000 });
    const pub = published.find(p => p.tags.includes('imagen-fija'));
    assert(pub, 'published to Stock'); assert.equal(pub.type, 'video'); assert.equal(pub.mime, 'video/mp4'); assert.equal(pub.validacion.duracion, SECONDS);
    assert.equal(pub.validacion.ancho, 1080); assert(typeof pub.poster === 'string' && pub.poster.startsWith('data:image/'), 'poster frame');
    console.log('Stock (interceptado):', pub.title, '·', pub.tags.join(', '));
    if (SHOTS) { await page.waitForTimeout(400); await page.screenshot({ path: path.join(SHOTS, 'exportado-imagen-1440.png') }); fs.copyFileSync(file, path.join(SHOTS, mp4.file)); fs.writeFileSync(path.join(SHOTS, png.file), pngBytes); }
    fs.rmSync(dir, { recursive: true, force: true });
    assert.deepEqual(errors, []); await ctx.close();
  }
  // ── Móvil 390 (ES) e inglés 1440: elección y tarjetas reencuadradas ──
  for (const [width, lang] of [[390, ''], [1440, '/en']]) {
    const { ctx, page, errors } = await open(width, lang);
    if (lang && !process.env.IMAGE) assert.equal(await page.textContent('#stock-list li[role=option] .stk-k'), 'Image');
    await chooseFirst(page);
    if (SHOTS) { await page.waitForTimeout(800); await page.screenshot({ path: path.join(SHOTS, `paso1-imagen-${lang ? 'en-' : ''}${width}.png`), fullPage: width < 500 }); }
    await page.click('#btn-adaptar'); await page.waitForTimeout(800);
    assert.match(await page.textContent('#grid .fmt[data-f="9:16"] .export-one'), lang ? /^Export MP4 · \d+ s$/ : /^Exportar MP4 · \d+ s$/);
    assert.equal(await page.textContent('#btn-volver'), lang ? '← Change image' : '← Cambiar imagen');
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `tarjetas-imagen-${lang ? 'en-' : ''}${width}.png`), fullPage: width < 500 });
    assert.deepEqual(errors, []); await ctx.close();
  }
  await browser.close();
  console.log('OK · adaptador de imágenes en el navegador');
})().catch(e => { console.error(e); process.exit(1); });
