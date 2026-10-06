// Selección por grupos del panel ☰ en el navegador (Carlos, 6-oct-2026): un clic en la casilla de
// un grupo lo marca entero y otro lo desmarca, en General y en Altadis (estándar, MyBlu, especiales),
// con ratón, Espacio y Enter, con filtro (solo lo visible) y a 1440 y 390 px. «Todos los tamaños»
// funciona igual. Opcionalmente guarda capturas del panel con un grupo vacío, parcial y completo.
// Uso: BASE=http://127.0.0.1:9197 [SHOTS=/dir] [PW=/ruta/playwright-core] [CHROME=/ruta/chrome]
//      node test/adaptador-grupos.browser.cjs
// La verja se simula respondiendo /auth/session en el propio navegador (sin credenciales).
const { chromium } = require(process.env.PW || '/usr/local/lib/node_modules/playwright-core');
const assert = require('node:assert/strict');
const path = require('node:path');
const BASE = process.env.BASE || 'http://127.0.0.1:9197', SHOTS = process.env.SHOTS || '';

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--no-sandbox'] });
  const open = async (width, query = '', { lang = '' } = {}) => {
    const ctx = await browser.newContext({ viewport: { width, height: width < 500 ? 844 : 900 }, deviceScaleFactor: width < 500 ? 2 : 1 });
    await ctx.route('**/auth/session', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }));
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', e => errors.push(String(e)));
    await page.goto(`${BASE}${lang}/adaptaciones/${query}`, { waitUntil: 'load' });
    await page.waitForFunction(() => document.querySelector('#adapter-project option[value="altadis-estancos-bcn"]') && document.querySelector('#project-status').textContent, null, { timeout: 15000 });
    await openPanel(page);
    return { ctx, page, errors };
  };
  // ☰ empieza cerrado: se abre como lo haría el usuario.
  const openPanel = async page => {
    const menu = await page.$('.pix-nav-icon-menu');
    if (menu && await page.evaluate(() => document.body.classList.contains('pf-left-off'))) await menu.click();
    await page.waitForTimeout(900);
  };
  // Estado de cada grupo tal como lo ve el usuario y la tecnología de asistencia.
  const groups = page => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#size-categories details')].map(d => {
    const box = d.querySelector('.group-toggle input'), opts = [...d.querySelectorAll('.size-option input')];
    return [d.dataset.group, { on: opts.filter(i => i.checked).length, n: opts.length, checked: box.checked, mixed: box.indeterminate, action: d.querySelector('.group-toggle span').textContent, aria: box.getAttribute('aria-label'), count: d.querySelector('.group-count').textContent }];
  })));
  const selected = page => page.$eval('#selected-count', e => parseInt(e.textContent, 10));
  const toggle = id => `#size-categories details[data-group="${id}"] .group-toggle input`;
  const shot = async (page, name, id) => {
    if (!SHOTS) return;
    await page.evaluate(g => { const d = document.querySelector(`#size-categories details[data-group="${g}"]`); d.open = true; d.querySelector('summary').scrollIntoView({ block: 'center' }); }, id);
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(SHOTS, name) });
  };

  for (const width of [1440, 390]) {
    // General: Redes vacío → un tamaño (parcial) → clic en el grupo (completo) → clic (vacío).
    {
      const { ctx, page, errors } = await open(width);
      let g = await groups(page);
      assert.deepEqual(Object.keys(g), ['social', 'digital', 'display', 'print']);
      assert.deepEqual([g.social.on, g.social.checked, g.social.mixed, g.social.action], [0, false, false, 'Marcar los 8']);
      assert.deepEqual([g.digital.on, g.digital.mixed, g.digital.action, g.digital.count], [4, true, 'Marcar los 6', '4/6']);
      assert.match(g.digital.aria, /Digital · pantallas: 4 de 6 marcados\. Marcar los 6/);
      await shot(page, `general-vacio-${width}.png`, 'social');
      await page.evaluate(() => { const d = document.querySelector('#size-categories details[data-group="social"]'); d.open = true; });
      await page.click('#size-categories details[data-group="social"] .size-option input');
      g = await groups(page);
      assert.deepEqual([g.social.on, g.social.checked, g.social.mixed, g.social.count], [1, false, true, '1/8']);
      await shot(page, `general-parcial-${width}.png`, 'social');
      await page.click(toggle('social'));
      g = await groups(page);
      assert.deepEqual([g.social.on, g.social.checked, g.social.mixed, g.social.action], [8, true, false, 'Desmarcar los 8']);
      assert.equal(await selected(page), 12);
      assert.match(await page.textContent('#group-status'), /Redes sociales: 8 de 8 marcados/);
      await shot(page, `general-completo-${width}.png`, 'social');
      await page.click(toggle('social'));
      g = await groups(page);
      assert.deepEqual([g.social.on, g.social.checked, g.social.mixed], [0, false, false]);
      assert.equal(await selected(page), 4);
      // Teclado: Espacio marca Display entero, Enter lo desmarca; el foco vuelve a la casilla.
      await page.focus(toggle('display'));
      await page.keyboard.press('Space');
      assert.equal((await groups(page)).display.on, 23);
      assert.equal(await page.evaluate(() => document.activeElement.dataset.selectKey), 'group:display');
      await page.keyboard.press('Enter');
      assert.equal((await groups(page)).display.on, 0);
      // El clic en el rótulo no abre ni cierra el grupo, solo cambia la selección.
      const wasOpen = await page.$eval('#size-categories details[data-group="print"]', d => d.open);
      await page.click('#size-categories details[data-group="print"] .group-toggle span');
      assert.equal(await page.$eval('#size-categories details[data-group="print"]', d => d.open), wasOpen);
      assert.equal((await groups(page)).print.on, 5);
      await page.click(toggle('print'));
      // Filtro: «300» deja 5 display visibles; el rótulo lo dice y solo cambian esos 5.
      await page.fill('#size-search', '300');
      g = await groups(page);
      assert.deepEqual(Object.keys(g), ['display']);
      assert.deepEqual([g.display.n, g.display.action], [5, 'Marcar 5 visibles']);
      assert.equal(await page.textContent('#all-sizes-action'), 'Marcar 5 visibles');
      await page.click(toggle('display'));
      assert.equal((await groups(page)).display.action, 'Desmarcar 5 visibles');
      await page.fill('#size-search', '');
      g = await groups(page);
      assert.deepEqual([g.display.on, g.display.n, g.display.mixed], [5, 23, true]);
      // Persistencia: la selección de grupo sobrevive a la recarga.
      await page.reload({ waitUntil: 'load' });
      await page.waitForFunction(() => document.querySelector('#project-status').textContent, null, { timeout: 15000 });
      await openPanel(page);
      assert.equal((await groups(page)).display.on, 5);
      // «Todos los tamaños»: parcial → todos → ninguno.
      assert.equal(await page.$eval('#all-sizes', i => i.indeterminate), true);
      assert.equal(await page.textContent('#all-sizes-action'), 'Marcar los 42');
      await page.click('#all-sizes');
      assert.equal(await selected(page), 42);
      assert.equal(await page.textContent('#all-sizes-action'), 'Desmarcar los 42');
      await page.click('#all-sizes');
      assert.equal(await selected(page), 0);
      assert.equal(await page.$eval('#all-sizes', i => i.checked || i.indeterminate), false);
      // A 390 px la casilla y el rótulo caben sin desbordar el panel.
      const fits = await page.$$eval('#size-categories summary', ss => ss.every(s => s.scrollWidth <= s.clientWidth + 1));
      assert.ok(fits, 'el control de grupo cabe en su fila');
      assert.deepEqual(errors, []); await ctx.close();
    }
    // Altadis: estándar 18, MyBlu 6, especiales 5; un clic desmarca/marca solo los suyos.
    {
      const { ctx, page, errors } = await open(width, '?proyecto=altadis');
      let g = await groups(page);
      assert.deepEqual(Object.keys(g), ['estandar', 'myblu', 'especiales']);
      assert.deepEqual([g.estandar.n, g.myblu.n, g.especiales.n], [18, 6, 5]);
      assert.deepEqual([g.estandar.checked, g.especiales.checked, g.especiales.action], [true, false, 'Marcar los 5']);
      assert.equal(await selected(page), 24);
      await page.click(toggle('estandar'));
      g = await groups(page);
      assert.deepEqual([g.estandar.on, g.myblu.on], [0, 6]);
      assert.equal(await selected(page), 6);
      await page.click(toggle('estandar'));
      assert.equal((await groups(page)).estandar.on, 18);
      await page.click(toggle('especiales'));
      g = await groups(page);
      assert.deepEqual([g.especiales.on, g.especiales.checked], [5, true]);
      assert.equal(await selected(page), 29);
      await shot(page, `altadis-completo-${width}.png`, 'estandar');
      await page.click(toggle('especiales'));
      assert.equal((await groups(page)).especiales.on, 0);
      // Un tamaño suelto de MyBlu → parcial.
      await page.click('#size-categories details[data-group="myblu"] .size-option input');
      g = await groups(page);
      assert.deepEqual([g.myblu.on, g.myblu.mixed, g.myblu.action], [5, true, 'Marcar los 6']);
      await shot(page, `altadis-parcial-${width}.png`, 'myblu');
      // Filtro de orientación: solo los verticales visibles del grupo estándar.
      await page.selectOption('#size-orientation', 'portrait');
      g = await groups(page);
      const visibles = g.estandar.n;
      assert.ok(visibles > 0 && visibles < 18);
      assert.equal(g.estandar.action, `Desmarcar ${visibles} visibles`);
      await page.click(toggle('estandar'));
      await page.selectOption('#size-orientation', 'all');
      g = await groups(page);
      assert.deepEqual([g.estandar.on, g.estandar.mixed], [18 - visibles, true]);
      // «Todos los tamaños» en el proyecto: los 29 propios, y otra vez para vaciar.
      await page.click('#all-sizes');
      assert.equal(await selected(page), 29);
      await page.click('#all-sizes');
      assert.equal(await selected(page), 0);
      await shot(page, `altadis-vacio-${width}.png`, 'estandar');
      assert.equal(await page.$eval('#format-profile', s => s.value), 'proyecto', 'el proyecto sigue en su familia');
      assert.deepEqual(errors, []); await ctx.close();
    }
  }
  // Inglés: rótulos traducidos.
  {
    const { ctx, page, errors } = await open(1440, '', { lang: '/en' });
    const g = await groups(page);
    assert.equal(g.social.action, 'Select all 8');
    await page.click(toggle('social'));
    assert.equal((await groups(page)).social.action, 'Clear all 8');
    assert.deepEqual(errors, []); await ctx.close();
  }
  await browser.close();
  console.log('✓ selección por grupos: General y Altadis, 1440 y 390, ratón, Espacio, Enter, filtro, Todos los tamaños' + (SHOTS ? ` · capturas en ${SHOTS}` : ''));
})().catch(e => { console.error(e); process.exit(1); });
