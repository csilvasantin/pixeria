// Proyectos del Adaptador en el navegador (Carlos, 5-oct-2026): selector Proyecto, ?proyecto=,
// herencia de la biblioteca general, proyecto de Yokup sin ficha y migración de preferencias
// de Altadis guardadas antes de las fichas. Opcionalmente guarda capturas a 1440 y 390 px.
// Uso: BASE=http://127.0.0.1:9187 VIDEO=/ruta/clip.mp4 [SHOTS=/dir] [PW=/ruta/playwright-core]
//      [CHROME=/ruta/chrome] node test/adaptador-proyectos.browser.cjs
// La verja se simula respondiendo /auth/session en el propio navegador (sin credenciales).
const { chromium } = require(process.env.PW || '/usr/local/lib/node_modules/playwright-core');
const assert = require('node:assert/strict');
const path = require('node:path');
const BASE = process.env.BASE || 'http://127.0.0.1:9187', VIDEO = process.env.VIDEO, SHOTS = process.env.SHOTS || '';
const OLD = { version: 1, profile: 'cliente', compat: 'uhd', modoGlobal: 'cover', custom: [[500, 500]], selected: ['9:16', 'cliente-01', 'altadis-02', 'cliente-esp-2'], fmt: { 'cliente-01': { modo: 'blur', fx: 0.25, fy: 0.75, zoom: 1.4 } } };

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const open = async (width, query, seed, { lang = '', offline = false } = {}) => {
    const ctx = await browser.newContext({ viewport: { width, height: width < 500 ? 844 : 900 }, deviceScaleFactor: width < 500 ? 2 : 1 });
    await ctx.route('**/auth/session', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }));
    if (offline) await ctx.route('https://api.yokup.com/**', r => r.abort());
    if (seed) await ctx.addInitScript(([k, v]) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem(k, v); sessionStorage.setItem('seeded', '1'); } }, ['pixeria.adapter.v1', JSON.stringify(seed)]);
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', e => errors.push(String(e)));
    await page.goto(`${BASE}${lang}/adaptaciones/${query}`, { waitUntil: 'load' });
    await page.waitForFunction(() => document.querySelector('#adapter-project option[value="altadis-estancos-bcn"]') && document.querySelector('#project-status').textContent, null, { timeout: 15000 });
    if (VIDEO) {
      await page.setInputFiles('#src-file', VIDEO);
      await page.waitForFunction(() => !document.querySelector('#btn-adaptar').disabled, null, { timeout: 15000 });
      await page.click('#btn-adaptar');
      await page.waitForTimeout(600);
    }
    return { ctx, page, errors };
  };
  const info = page => page.evaluate(() => ({
    url: location.search, project: document.querySelector('#adapter-project').value,
    status: document.querySelector('#project-status').textContent,
    campaigns: [...document.querySelectorAll('#campaigns [data-campaign]')].map(b => b.dataset.campaign),
    profiles: [...document.querySelectorAll('#format-profile option')].filter(o => !o.disabled).map(o => o.value),
    profile: document.querySelector('#format-profile').value,
    cards: document.querySelectorAll('#grid .fmt[data-f]').length,
    sizes: document.querySelector('#search-status').textContent,
    stored: Object.keys(localStorage).filter(k => k.startsWith('pixeria.adapter')).sort(),
  }));
  // ▤ and ☰ start closed: set the value and fire change, as the user's pick would.
  const pick = (page, sel, value) => page.$eval(sel, (el, v) => { el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); }, value).then(() => page.waitForTimeout(250));
  const shot = async (page, name) => {
    if (!SHOTS) return;
    const menu = await page.$('.pix-nav-icon-menu');
    if (menu && await page.evaluate(() => document.body.classList.contains('pf-left-off'))) await menu.click(); else await page.click('#btn-sizes').catch(() => {});
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(SHOTS, name) });
  };

  // General: sin parámetro, sin campaña Altadis, solo la familia biblioteca.
  for (const width of [1440, 390]) {
    const { ctx, page, errors } = await open(width, '');
    const g = await info(page);
    assert.equal(g.project, 'general'); assert.equal(g.url, '');
    assert.deepEqual(g.campaigns, ['social', 'display', 'mobile']); assert.deepEqual(g.profiles, ['standard']);
    await shot(page, `general-${width}.png`);
    assert.deepEqual(errors, []); await ctx.close();
  }
  // Altadis por alias en la URL: id canónico, campaña propia, 3 familias, 24 tarjetas propias.
  for (const width of [1440, 390]) {
    const { ctx, page, errors } = await open(width, '?proyecto=altadis');
    const a = await info(page);
    assert.equal(a.project, 'altadis-estancos-bcn'); assert.equal(a.url, '?proyecto=altadis-estancos-bcn');
    assert.deepEqual(a.campaigns, ['altadis', 'social', 'display', 'mobile']);
    assert.deepEqual(a.profiles, ['standard', 'proyecto', 'especiales']); assert.equal(a.profile, 'proyecto');
    assert.match(a.status, /24 formatos propios \(6 MyBlu\) \+ 5 videowalls/);
    if (VIDEO) assert.equal(a.cards, 24);
    // La biblioteca general sigue ahí.
    await pick(page, '#format-profile', 'standard');
    assert.match(await page.textContent('#search-status'), /^4[26] tamaños/);
    await pick(page, '#format-profile', 'proyecto');
    await shot(page, `altadis-${width}.png`);
    assert.deepEqual(errors, []); await ctx.close();
  }
  // Proyecto de Yokup sin ficha: solo biblioteca general, URL y clave propias.
  for (const width of [1440, 390]) {
    const { ctx, page, errors } = await open(width, '?proyecto=pixeria-alsea');
    const n = await info(page);
    assert.equal(n.project, 'pixeria-alsea'); assert.deepEqual(n.profiles, ['standard']);
    assert.deepEqual(n.campaigns, ['social', 'display', 'mobile']); assert.match(n.status, /Sin ficha propia/);
    await pick(page, '#modo-global', 'contain');
    assert.ok((await info(page)).stored.includes('pixeria.adapter.v1.proyecto.pixeria-alsea') || !VIDEO);
    await shot(page, `sin-ficha-pixeria-alsea-${width}.png`);
    assert.deepEqual(errors, []); await ctx.close();
  }
  // Migración: preferencias de Altadis en la clave general → proyecto Altadis, y se vuelve a él.
  {
    const { ctx, page, errors } = await open(1440, '', OLD);
    const m = await info(page);
    assert.equal(m.project, 'altadis-estancos-bcn'); assert.equal(m.profile, 'proyecto');
    const moved = await page.evaluate(() => JSON.parse(localStorage.getItem('pixeria.adapter.v1.proyecto.altadis-estancos-bcn')));
    assert.ok(moved.selected.includes('cliente-02') && moved.selected.includes('cliente-esp-2'), JSON.stringify(moved.selected));
    assert.deepEqual(moved.fmt['cliente-01'], OLD.fmt['cliente-01']);
    assert.equal(await page.$eval('#modo-global', s => s.value), 'cover');
    // Cambiar a General desde el selector: URL limpia y la biblioteca con el tamaño propio compartido.
    await pick(page, '#adapter-project', 'general');
    const back = await info(page);
    assert.equal(back.url, ''); assert.deepEqual(back.profiles, ['standard']);
    assert.ok(await page.evaluate(() => [...document.querySelectorAll('#size-categories strong')].some(s => /500×500/.test(s.textContent))), 'el tamaño propio sigue en la biblioteca general');
    assert.deepEqual(errors, []); await ctx.close();
  }
  // Inglés y sin Yokup: la copia guardada da la lista y Altadis sigue con sus formatos.
  {
    const { ctx, page, errors } = await open(1440, '?proyecto=altadis', null, { lang: '/en', offline: true });
    await page.waitForTimeout(500);
    const e = await info(page);
    assert.equal(e.project, 'altadis-estancos-bcn'); assert.match(e.status, /24 own formats \(6 MyBlu\) \+ 5 segmented video walls\. Yokup projects: saved copy \(\d{4}-\d{2}-\d{2}\)\./);
    assert.equal(await page.$eval('#format-profile option[value="proyecto"]', o => o.textContent), 'Altadis · standard + ESPECIAL + MyBlu');
    assert.equal(await page.$eval('#adapter-project option[value="general"]', o => o.textContent), 'General (no project)');
    assert.deepEqual(errors, []); await ctx.close();
  }
  await browser.close();
  console.log('✓ proyectos del Adaptador: General, Altadis (alias), sin ficha, migración' + (SHOTS ? ` · capturas en ${SHOTS}` : ''));
})().catch(e => { console.error(e); process.exit(1); });
