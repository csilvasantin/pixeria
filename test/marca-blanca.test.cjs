// Marca blanca en Pixeria / Admira Studio (FLT-101333): un solo enganche (site-nav.js),
// nada de admiranext.com sin marca activa, catálogo comprobado antes de cargar nada,
// textos AA con cualquier marca y el verbo /marca de la consola experta.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const M = require('../assets/marca-blanca.js');
const CLI = require('../assets/expert-cli.js');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const STAMP = '?v=01.10.2026.r9.1234';
const memory = (init = {}) => {
  const mem = new Map(Object.entries(init));
  return {mem, getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k)};
};
const pages = (() => {
  const out = [];
  const walk = dir => {
    for (const entry of fs.readdirSync(path.join(root, dir), {withFileTypes: true})) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const rel = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(rel); else if (entry.name.endsWith('.html')) out.push(rel);
    }
  };
  walk('');
  return out;
})();
const ticks = async (n = 20) => { for (let i = 0; i < n; i++) await new Promise(r => setImmediate(r)); };

// Ejecuta un script en un navegador mínimo y anota todo lo que intenta cargar o pedir.
function browser({file, src, search = '', session = memory(), extra = {}, loadNodes = false, fetchImpl}) {
  const created = [], fetched = [];
  const node = tag => ({tagName: tag.toUpperCase(), attrs: {}, style: {}, setAttribute(k, v) { this.attrs[k] = v; }, getAttribute(k) { return this.attrs[k]; }, remove() {}});
  const append = n => { created.push(n); if (loadNodes && n.onload) setImmediate(() => n.onload()); };
  const document = {
    readyState: 'loading',
    currentScript: {src},
    documentElement: {lang: 'es', style: {length: 0, setProperty() {}, removeProperty() {}}, getAttribute: () => null, setAttribute() {}, removeAttribute() {}, appendChild: append},
    head: {append, appendChild: append},
    title: 'Pixeria Studio · Audio',
    createElement: tag => node(tag),
    querySelector: () => null, querySelectorAll: () => [], getElementById: () => null,
    dispatchEvent() {}, addEventListener() {},
  };
  const window = {document, sessionStorage: session, location: {search, href: 'https://www.pixeria.com/audio.html' + search, pathname: '/audio.html'},
    setTimeout: () => 0, clearTimeout() {}, history: {replaceState() {}}, console,
    fetch: url => { fetched.push(url); return fetchImpl ? fetchImpl(url) : new Promise(() => {}); }};
  window.window = window;
  const context = vm.createContext(Object.assign(window, {URL, URLSearchParams, CustomEvent: class {}, MutationObserver: class { observe() {} disconnect() {} }, Promise}, extra));
  vm.runInContext(read(file), context);
  return {created, fetched, session, context};
}
const bootMarca = opts => browser(Object.assign({file: 'assets/marca-blanca.js', src: 'https://www.pixeria.com/assets/marca-blanca.js' + STAMP}, opts));
const bootNav = opts => browser(Object.assign({file: 'assets/site-nav.js', src: 'https://www.pixeria.com/assets/site-nav.js' + STAMP}, opts));
const json = (status, body) => Promise.resolve({ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body)});

test('without an active brand Pixeria loads nothing new and never contacts admiranext.com', () => {
  // The shell (site-nav.js) only fetches marca-blanca.js when the tab asks for a brand.
  for (const [search, init] of [['', {}], ['?lang=es', {}], ['?gate=off', {}]]) {
    const r = bootNav({search, session: memory(init)});
    assert.deepEqual(r.created, [], `${search}: site-nav.js injects nothing`);
    assert.deepEqual(r.fetched, []);
    assert.equal(typeof r.context.PixeriaMarca.cargar, 'function', 'the CLI can load it on demand');
  }
  // marca-blanca.js itself is inert without a brand (also with ?marca=admira/off, which forget it).
  for (const [search, init] of [['', {}], ['?marca=admira', {'mb:marca': 'lumbre'}], ['?marca=off', {'mb:marca': 'starbucks'}], ['?marca=', {}]]) {
    const r = bootMarca({search, session: memory(init)});
    assert.deepEqual(r.created, [], `${search}: nothing injected`);
    assert.deepEqual(r.fetched, [], `${search}: no request`);
    assert.equal(r.session.getItem('mb:marca'), null, `${search}: no remembered brand`);
    assert.equal(r.context.AdmiraMarca.actual(), null);
  }
  // No page carries the white-label files statically: only the shell loads them, on demand.
  for (const page of pages) {
    const html = read(page);
    assert.ok(!/admiranext\.com\/marcablanca\/marcablanca\.(?:css|js)/.test(html), `${page}: static marcablanca`);
    assert.ok(!/marca-blanca\.(?:css|js)/.test(html), `${page}: marca-blanca.* only through site-nav.js`);
  }
});

test('site-nav.js is the single hook: ?marca= or a remembered brand loads marca-blanca.js with its own stamp', () => {
  for (const [search, init] of [['?marca=lumbre', {}], ['', {'mb:marca': 'starbucks'}], ['?marca=admira', {'mb:marca': 'lumbre'}]]) {
    const r = bootNav({search, session: memory(init)});
    const scripts = r.created.filter(n => n.tagName === 'SCRIPT');
    assert.equal(scripts.length, 1, `${search}: one script`);
    assert.equal(scripts[0].src, '/assets/marca-blanca.js' + STAMP);
    const veil = r.created.find(n => n.tagName === 'STYLE');
    if (search === '?marca=admira') assert.equal(veil, undefined, 'turning the brand off never blanks the page');
    else assert.ok(veil && /html:not\(\[data-mb-marca\]\) body\{opacity:0/.test(veil.textContent), 'a short veil hides the Matrix look while the brand loads');
    assert.deepEqual(r.fetched, [], 'site-nav.js itself never talks to admiranext.com');
  }
  const nav = read('assets/site-nav.js');
  assert.match(nav, /'\/assets\/expert-cli\.js' \+ \(STAMP \|\| '\?v=4663'\)/, 'the expert console follows the release stamp too');
  assert.match(nav, /'\/assets\/expert-cli\.css' \+ \(STAMP \|\| '\?v=4663'\)/);
  assert.ok(!/marca-blanca/.test(read('assets/cuadratura.js')), 'cuadratura.js does not load it a second time');
  assert.match(nav, /setTimeout\(lift, 1500\)/, 'the veil never lasts more than 1.5 s');
  assert.match(nav, /addEventListener\('admira:marca-error', lift\)/);
});

test('with a brand the catalogue is checked first; only then the loader, the common sheet and the local sheet', async () => {
  let release;
  const gate = new Promise(r => { release = r; });
  const r = bootMarca({search: '?marca=Starbucks', loadNodes: true, fetchImpl: url => gate.then(() => json(200, {id: 'starbucks', nombre: 'Starbucks'}))});
  assert.deepEqual(r.fetched, [M.BASE + 'api/marcas/starbucks'], 'first and only request: the catalogue entry');
  assert.deepEqual(r.created, [], 'nothing is loaded before the catalogue answers');
  release();
  await ticks();
  const script = r.created.find(n => n.tagName === 'SCRIPT');
  assert.ok(script && script.src === M.BASE + 'marcablanca.js', 'loader');
  assert.equal(script.attrs['data-mb-plataforma'], 'studio');
  assert.equal(script.attrs['data-mb-auto'], 'false', 'Pixeria applies the brand itself, after checking the catalogue');
  const links = r.created.filter(n => n.tagName === 'LINK').map(n => n.href);
  assert.ok(links.includes(M.BASE + 'marcablanca.css'), 'common sheet');
  assert.ok(links.includes('https://www.pixeria.com/assets/marca-blanca.css' + STAMP), 'local sheet with the same stamp');
});

test('an unknown brand or a silent admiranext.com applies nothing and forgets the unknown id', async () => {
  const unknown = bootMarca({search: '', session: memory({'mb:marca': 'noexiste'}), fetchImpl: () => json(404, {})});
  await ticks();
  assert.deepEqual(unknown.created, [], 'no sheet, no loader');
  assert.equal(unknown.session.getItem('mb:marca'), null, 'unknown id forgotten');
  assert.equal(unknown.context.AdmiraMarca.actual(), null);
  const down = bootMarca({search: '?marca=lumbre', fetchImpl: () => Promise.reject(new Error('offline'))});
  await ticks();
  assert.deepEqual(down.created, []);
  assert.deepEqual(down.fetched, [M.BASE + 'api/marcas/lumbre', M.BASE + 'clientes/lumbre.json'], 'API, then the static fallback, then nothing');
  assert.equal(down.context.AdmiraMarca.actual(), null);
  assert.match(read('assets/marca-blanca.js'), /TIMEOUT = 8000/);
});

test('the brand decision follows the common loader: ?marca= wins and is remembered, admira/off forget it', () => {
  const s = memory();
  assert.deepEqual(M.decide('?marca=lumbre', s), {id: 'lumbre', remember: true});
  assert.deepEqual(M.decide('?marca=LÚMBRE', s), {id: 'lumbre', remember: true});
  assert.deepEqual(M.decide('?marca=admira', memory({'mb:marca': 'lumbre'})), {id: null, forget: true});
  assert.deepEqual(M.decide('?marca=off', s), {id: null, forget: true});
  assert.deepEqual(M.decide('', memory({'mb:marca': 'brumelle'})), {id: 'brumelle'});
  assert.deepEqual(M.decide('?marca=<script>', memory({'mb:marca': 'brumelle'})), {id: 'brumelle'}, 'a malformed id is ignored');
  assert.deepEqual(M.decide('', memory({'mb:marca': '../evil'})), {id: null});
  assert.equal(M.SESSION_KEY, 'mb:marca');
  assert.equal(M.decideMode('?modo=oscuro', memory()), 'oscuro');
  assert.equal(M.decideMode('?modo=raro', memory()), 'marca');
});

test('/marca arguments: ids, off, websites and garbage', () => {
  assert.deepEqual(M.parseArg(''), {kind: 'status'});
  assert.deepEqual(M.parseArg('Lúmbre'), {kind: 'id', id: 'lumbre'});
  assert.deepEqual(M.parseArg('marca=brumelle'), {kind: 'id', id: 'brumelle'});
  for (const off of ['off', 'admira', 'OFF', 'ninguna']) assert.deepEqual(M.parseArg(off), {kind: 'off'}, off);
  assert.deepEqual(M.parseArg('starbucks.es'), {kind: 'web', url: 'https://starbucks.es/'});
  assert.deepEqual(M.parseArg('web=https://www.starbucks.es/menu?x=1'), {kind: 'web', url: 'https://www.starbucks.es/menu?x=1'});
  for (const bad of ['<img src=x>', 'javascript:alert(1)', 'https://user:pw@x.com', 'http://localhost']) assert.equal(M.parseArg(bad).kind, 'invalid', bad);
  assert.equal(M.analyzerUrl('https://starbucks.es/'), 'https://www.admiranext.com/marcablanca/?web=https%3A%2F%2Fstarbucks.es%2F');
});

test('texts reach WCAG AA with light, dark and hostile palettes (Starbucks first)', () => {
  const palettes = {
    starbucks: {modo: 'claro', primario: '#006241', 'primario-texto': '#FFFFFF', secundario: '#000000', 'secundario-texto': '#FFFFFF', acento: '#C58800', 'acento-texto': '#231800', fondo: '#FFFFFF', superficie: '#FFFFFF', 'superficie-alt': '#EEEFEF', texto: '#0F1C1D', 'texto-suave': '#576061', ok: '#2F7D4F', aviso: '#B7791F', error: '#C0392B', info: '#2B6CB0'},
    lumbre: {modo: 'claro', primario: '#3B2318', 'primario-texto': '#FFF7EC', secundario: '#C2703F', acento: '#E0703A', 'acento-texto': '#FFFFFF', fondo: '#F7F0E6', superficie: '#FFFAF3', 'superficie-alt': '#F3E7D6', texto: '#2A1A12', 'texto-suave': '#6E5646', ok: '#4F7D3A', error: '#B8432F', info: '#3A6C8C'},
    frescaria: {modo: 'claro', primario: '#2546D9', 'primario-texto': '#FFFFFF', secundario: '#34C759', acento: '#FF8A00', fondo: '#F3F6FE', superficie: '#FFFFFF', 'superficie-alt': '#E9EEFB', texto: '#121A33', 'texto-suave': '#4A5578', ok: '#1E8E3E', error: '#D93025', info: '#1A73E8'},
    brumelle: {modo: 'oscuro', primario: '#D4FF3A', 'primario-texto': '#0A0A0A', secundario: '#F2EFE9', acento: '#FF3D7F', 'acento-texto': '#0A0A0A', fondo: '#0A0A0A', superficie: '#161616', 'superficie-alt': '#1F1F1F', texto: '#F2EFE9', 'texto-suave': '#A8A39A', ok: '#7EE08A', error: '#FF4D4D', info: '#6EA8FF'},
    // Una propuesta automática mal contrastada: amarillo sobre blanco y texto gris claro.
    hostil: {modo: 'claro', primario: '#FFE14D', 'primario-texto': '#FFFFFF', acento: '#FFF3B0', fondo: '#FFFFFF', superficie: '#FAFAFA', 'superficie-alt': '#F0F0F0', texto: '#BBBBBB', 'texto-suave': '#DDDDDD', ok: '#9BE29B', error: '#FFB3B3', info: '#A0D8FF'},
  };
  for (const [name, p] of Object.entries(palettes)) {
    const vars = Object.fromEntries(Object.entries(p).filter(([k]) => k !== 'modo').map(([k, v]) => ['--mb-' + k, v]));
    const t = M.shellTokens(vars, p.modo);
    for (const token of ['--mbx-ink', '--mbx-mut', '--mbx-brand', '--mbx-accent', '--mbx-ok', '--mbx-error', '--mbx-warn', '--mbx-image', '--mbx-video', '--mbx-audio', '--mbx-music']) {
      for (const bg of [p.fondo, p.superficie, p['superficie-alt']]) assert.ok(M.contrast(t[token], bg) >= 4.5, `${name} ${token} ${t[token]} on ${bg}: ${M.contrast(t[token], bg).toFixed(2)}`);
    }
    assert.ok(M.contrast(t['--mbx-on-brand'], t['--mbx-brand']) >= 4.5, `${name} text on brand`);
    assert.ok(M.contrast(t['--mbx-on-accent'], t['--mbx-accent']) >= 4.5, `${name} text on accent`);
  }
  // Starbucks (light) keeps its own green and grey: they are readable.
  const sb = M.shellTokens(Object.fromEntries(Object.entries(palettes.starbucks).filter(([k]) => k !== 'modo').map(([k, v]) => ['--mb-' + k, v])), 'claro');
  assert.equal(sb['--mbx-brand'], '#006241');
  assert.equal(sb['--mbx-mut'], '#576061');
  assert.equal(sb['--mbx-on-brand'], '#FFFFFF');
  assert.equal(sb['--mbx-accent'], '#006241', 'the gold accent (#C58800) is not AA on white: the green takes over');
  assert.equal(M.contrast('#000', '#fff').toFixed(1), '21.0');
});

test('the local sheet only applies under a studio brand and never recolours media', () => {
  const css = read('assets/marca-blanca.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = css.replace(/@media[^{]*\{([\s\S]*?\})\s*\}/g, '$1').match(/[^{}]+\{[^{}]*\}/g);
  assert.ok(rules.length > 60);
  for (const rule of rules) for (const sel of rule.slice(0, rule.indexOf('{')).split(/,(?![^(]*\))/)) {
    assert.match(sel.trim(), /^:root\[data-mb-marca\]\[data-mb-plataforma="studio"\]/, 'unscoped selector: ' + sel.trim());
  }
  assert.ok(!/(^|[\s,(>])(img|video|canvas|picture|iframe)\b[^{]*\{[^}]*(filter|mix-blend|background|color)/i.test(css.replace(/#matrix-rain\{display:none\}/, '')), 'previews are never recoloured');
  assert.ok(!/\bfilter\s*:\s*(?!none)/.test(css), 'no colour filters');
  // The bar: client logo, then a discreet «powered by Pixeria».
  assert.match(css, /\.pf-topbar-brand \.pf-brand-name::before\{content:"powered by "/);
  const js = read('assets/marca-blanca.js');
  assert.match(js, /home\.parentNode\.insertBefore\(slot, home\)/, 'the logo goes right before the Pixeria brand');
  assert.match(js, /propuesta generada automáticamente, no es la marca oficial/);
  assert.match(js, /marca ficticia de ejemplo/);
  assert.match(js, /T\('Volver a Admira', 'Back to Admira'\)/);
  assert.match(js, /querySelector\('\.rail-left'\)/, '«Volver a Admira» lives in the Options band');
  assert.match(js, /current\.nombre \+ ' · '/, 'tab title «Nombre · título»');
});

// ─── Verbo /marca de la consola experta ───
const fakeMarca = (over = {}) => {
  const calls = [];
  const api = Object.assign({}, M, {
    actual: () => null,
    conocidas: () => [{id: 'admira', nombre: 'Admira'}, {id: 'lumbre', nombre: 'Lumbre Café', ejemplo: true}],
    listar: () => Promise.resolve([{id: 'admira', nombre: 'Admira'}, {id: 'lumbre', nombre: 'Lumbre Café', ejemplo: true}, {id: 'starbucks', nombre: 'Starbucks', propuesta: true}]),
    activar: id => { calls.push(['activar', id]); return Promise.resolve(id === 'lumbre' ? {ok: true, id, nombre: 'Lumbre Café', ejemplo: true} : id === 'caida' ? {ok: false, reason: 'network'} : {ok: false, reason: 'unknown', id}); },
    desactivar: () => { calls.push(['desactivar']); return {ok: true, changed: true, previous: {id: 'lumbre', nombre: 'Lumbre Café'}}; },
    analizar: url => { calls.push(['analizar', url]); return {ok: true, href: M.analyzerUrl(url), url}; },
  }, over);
  return {calls, api};
};
const run = async (arg, api, en = false) => { const lines = []; const r = await CLI.runMarca(arg, api, en, l => lines.push(l)); return {r, text: lines.join('\n')}; };

test('/marca <id>, off, <web>, alone and garbage drive the white label; unknown ids apply nothing', async () => {
  const {calls, api} = fakeMarca();
  let o = await run('lumbre', api);
  assert.ok(o.r.ok);
  assert.match(o.text, /Aplicando la marca lumbre…\nMarca Lumbre Café \(lumbre\) activa · marca ficticia de ejemplo/);
  o = await run('noexiste', api);
  assert.equal(o.r.ok, false);
  assert.match(o.text, /no está en el catálogo de admiranext\.com\. No se ha aplicado nada/);
  o = await run('caida', api, true);
  assert.match(o.text, /Could not reach admiranext\.com/);
  o = await run('off', api);
  assert.deepEqual(calls.at(-1), ['desactivar']);
  assert.match(o.text, /Marca Lumbre Café desactivada: vuelve Admira/);
  o = await run('starbucks.es', api);
  assert.deepEqual(calls.at(-1), ['analizar', 'https://starbucks.es/']);
  assert.match(o.text, /otra pestaña: https:\/\/www\.admiranext\.com\/marcablanca\/\?web=https%3A%2F%2Fstarbucks\.es%2F/);
  o = await run('', fakeMarca({actual: () => ({id: 'starbucks', nombre: 'Starbucks', propuesta: true})}).api);
  assert.match(o.text, /Marca activa: Starbucks \(starbucks\) · propuesta automática, no es la marca oficial/);
  assert.match(o.text, /Disponibles: admira, lumbre \(ejemplo\), starbucks \(propuesta\)/);
  o = await run('', api, true);
  assert.match(o.text, /No white label: you see the Admira look/);
  o = await run('<img src=x>', api);
  assert.match(o.text, /Marca no válida: «<img src=x>»[\s\S]*off para volver a Admira/);
  o = await run('lumbre', null);
  assert.match(o.text, /aún no está lista/);
});

test('/marca is in help and docs, /brand is an alias and Tab completes commands and catalogue ids', () => {
  assert.ok(CLI.MARCA_VERB.test('/marca') && CLI.MARCA_VERB.test('marca') && CLI.MARCA_VERB.test('/brand') && CLI.MARCA_VERB.test('BRAND'));
  assert.equal(CLI.complete('/mar').value, '/marca ');
  assert.equal(CLI.complete('mar').value, '/marca ');
  assert.equal(CLI.complete('he').value, 'help ');
  assert.deepEqual(CLI.complete('/marca ').options, ['admira', 'lumbre', 'brumelle', 'frescaria', 'off']);
  assert.equal(CLI.complete('/marca lu').value, '/marca lumbre');
  assert.equal(CLI.complete('/brand star', ['admira', 'starbucks']).value, '/brand starbucks');
  assert.equal(CLI.complete('open au', [], ['audio', 'assets']).value, 'open audio');
  assert.deepEqual(CLI.complete('/marca zz').options, []);
  const cli = read('assets/expert-cli.js');
  assert.match(cli, /\/marca \[marca\] — Marca blanca del catálogo de admiranext\.com\/marcablanca/);
  assert.match(cli, /Tab completa comandos, marcas y secciones/);
  for (const [file, words] of [['docs/marca-blanca.md', ['?marca=', '/marca off', 'Volver a Admira', 'powered by Pixeria', 'Qué no cambia', 'site-nav.js']], ['docs/expert-cli.md', ['/marca']], ['help/index.html', ['/marca', 'Marca blanca']]]) {
    const text = read(file);
    for (const w of words) assert.ok(text.includes(w), `${file}: ${w}`);
  }
});
