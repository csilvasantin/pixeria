// Guardián del shell cuadrático (FLT-101334): la interfaz de 4 bandas de Pixeria
// (barra · ☰ Opciones · ▤ Avanzado · ⌘ Experto con la consola) está en TODAS las páginas.
// Cada .html del repo, o carga el shell y su barra es montable, o figura en
// SHELL_EXCEPTIONS con su motivo. Una página nueva sin shell hace fallar este test.
// Ver docs/shell-cuadratico.md.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

// Páginas que NO llevan el shell, con el motivo. Añadir aquí es una decisión de
// producto: si dudas, la página lleva el shell.
const SHELL_EXCEPTIONS = {
  'idea.html': 'Redirección inmediata a /concepto.html; no pinta nada.',
  'en/crear/index.html': 'Redirección inmediata a /crear/; no pinta nada.',
  'xpacios/index.html': 'Redirección a xpaceos.com/xpacios/ (Xpacios se mudó a XpaceOS).',
  'xpacios/crear/index.html': 'Redirección a xpaceos.com (Xpacios se mudó a XpaceOS).',
  'xpacios/crear/phone.html': 'Redirección a xpaceos.com (Xpacios se mudó a XpaceOS).',
  'xpacios/grok/index.html': 'Redirección a xpaceos.com (Xpacios se mudó a XpaceOS).',
  'xpacios/xtanco-barcelona/index.html': 'Redirección a xpaceos.com (Xpacios se mudó a XpaceOS).',
  'xpacios/xtanco-valencia/index.html': 'Redirección a xpaceos.com (Xpacios se mudó a XpaceOS).',
  'signage.html': 'Player del Pixer Feed a pantalla completa (overflow oculto) para las pantallas: una barra encima cortaría la emisión.',
  'xtore.html': 'Player del Pixer Feed a pantalla completa para las pantallas de tienda.',
  'en/signage.html': 'Player del Pixer Feed a pantalla completa (versión inglesa).',
  'en/xtore.html': 'Player del Pixer Feed a pantalla completa para tienda (versión inglesa).',
  'campanas/sabiasque-tabaco/bucle.html': 'Bucle de la campaña a pantalla completa: es lo que emite la pantalla y lo que se previsualiza en el iframe de /campanas/.',
  'campanas/sabiasque-tabaco/slide.html': 'Fragmento: cada pieza que el bucle carga en su iframe.',
  'xpacios/aulestia-i-pijoan/index.html': 'Ruta pública sin sesión (functions/_middleware.js): mapa friends and family. La barra llevaría a un estudio cerrado con login de Google.',
  'xpacios/cafebreria/ci/index.html': 'Ruta pública sin sesión (functions/_middleware.js): ficha de cada aparato que se abre con un QR en el móvil. La barra llevaría a un estudio cerrado con login de Google.',
};

const pages = (() => {
  const out = [];
  const walk = dir => {
    for (const entry of fs.readdirSync(path.join(root, dir), {withFileTypes: true})) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const rel = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(rel); else if (entry.name.endsWith('.html')) out.push(rel.split(path.sep).join('/'));
    }
  };
  walk('');
  return out.sort();
})();

// El sello vigente: el <meta name="admiranext-version"> de index.html (sellar.py lo propaga
// al ?v= de todos los assets propios).
function currentToken() {
  const m = read('index.html').match(/<meta\s+name="admiranext-version"\s+content="Pixeria v\.([^"]+)">/);
  assert.ok(m, 'index.html sin sello');
  return m[1].replace(':', '');
}

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
// ¿Tiene el <header> un hijo DIRECTO con clase .brand? Es lo que exige canonicalHeader() de site-nav.js.
function hasDirectBrand(inner) {
  let depth = 0;
  for (const m of inner.matchAll(/<(\/?)([a-zA-Z][\w-]*)([^>]*)>/g)) {
    const [, closing, tag, attrs] = m;
    const name = tag.toLowerCase();
    if (closing) { depth--; continue; }
    if (depth === 0 && /\bclass="(?:[^"]*\s)?brand(?:\s[^"]*)?"/.test(attrs)) return true;
    if (!VOID.has(name) && !attrs.trim().endsWith('/')) depth++;
  }
  return false;
}

// Qué le falta a una página para llevar el shell. Vacío = la página lo lleva.
function shellProblems(html, token) {
  const problems = [];
  const headEnd = html.indexOf('</head>');
  const head = headEnd >= 0 ? html.slice(0, headEnd) : '';
  const v = '\\?v=' + token.replace(/\./g, '\\.');
  if (!new RegExp('<script defer src="/assets/site-nav\\.js' + v + '"></script>').test(head)) problems.push('site-nav.js con defer y el sello en el <head>');
  const css = head.search(new RegExp('<link rel="stylesheet" href="(?:\\.\\./|/)*assets/cuadratura\\.css' + v + '">'));
  if (css < 0) problems.push('cuadratura.css con el sello en el <head>');
  else {
    const own = [...head.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/g)].filter(m => !/cuadratura\.css|^https?:|href="https?:/.test(m[0]));
    if (own.some(m => m.index > css)) problems.push('cuadratura.css después del CSS propio de la página');
  }
  if (!new RegExp('<script defer src="/assets/cuadratura\\.js' + v + '"></script>').test(html)) problems.push('cuadratura.js con el sello');
  if (!/<main[\s>]/.test(html)) problems.push('<main>');
  const quad = /<body[^>]*class="[^"]*\bquad-ui\b/.test(html) && /<nav\b[^>]*class="[^"]*\bquad-top\b/.test(html) && /class="quad-brand\b/.test(html) && /class="quad-links\b/.test(html);
  const header = html.match(/<header\s+class="(?:[^"]*\s)?(?:site-header|topnav)(?:\s[^"]*)?"[^>]*>([\s\S]*?)<\/header>/);
  const canonical = header && hasDirectBrand(header[1]) && /<nav\b[^>]*class="(?:[^"]*\s)?(?:nav|primary-nav)(?:\s[^"]*)?"/.test(header[1]);
  if (!quad && !canonical) problems.push('barra montable: <header class="site-header|topnav"> con .brand hijo directo y <nav class="nav|primary-nav">, o body.quad-ui');
  return problems;
}

test('toda página carga el shell cuadrático o es una excepción con motivo', () => {
  const token = currentToken();
  const bad = [];
  for (const page of pages) {
    if (Object.hasOwn(SHELL_EXCEPTIONS, page)) continue;
    const problems = shellProblems(read(page), token);
    if (problems.length) bad.push(`${page}: falta ${problems.join(' · ')}`);
  }
  assert.deepEqual(bad, [], 'Página sin shell. Adóptalo (docs/shell-cuadratico.md) o, si de verdad no puede llevarlo, añádela a SHELL_EXCEPTIONS con su motivo.');
});

test('las excepciones existen, tienen motivo y de verdad van sin shell', () => {
  for (const [page, motivo] of Object.entries(SHELL_EXCEPTIONS)) {
    assert.ok(pages.includes(page), `${page}: excepción de una página que ya no existe`);
    assert.ok(motivo.length > 20, `${page}: motivo vacío`);
    assert.ok(!/assets\/site-nav\.js/.test(read(page)), `${page}: carga site-nav.js; si lleva el shell, sácala de SHELL_EXCEPTIONS`);
  }
});

test('una página nueva sin shell hace fallar al guardián', () => {
  const token = currentToken();
  const nueva = '<!DOCTYPE html><html lang="es"><head><title>Nueva</title><link rel="stylesheet" href="/assets/styles.css"></head><body><header class="hero"><h1>Nueva</h1></header><section>…</section></body></html>';
  assert.ok(shellProblems(nueva, token).length >= 4);
  // Medio shell tampoco vale: sin <main>, con el CSS antes que el propio y la marca anidada.
  const media = `<!DOCTYPE html><html><head><link rel="stylesheet" href="/assets/cuadratura.css?v=${token}"><link rel="stylesheet" href="/assets/styles.css"><script defer src="/assets/site-nav.js?v=${token}"></script></head><body><header class="site-header"><div class="wrap"><a class="brand" href="/">Pixeria</a></div><nav class="nav"></nav></header><script defer src="/assets/cuadratura.js?v=${token}"></script></body></html>`;
  const problems = shellProblems(media, token);
  assert.ok(problems.some(p => /<main>/.test(p)), 'sin <main>');
  assert.ok(problems.some(p => /después del CSS propio/.test(p)), 'orden del CSS');
  assert.ok(problems.some(p => /barra montable/.test(p)), '.brand anidada');
  // Un sello viejo en el ?v= tampoco: la web serviría el shell de ayer desde la caché.
  const vieja = media.replace(/\?v=[^"]+/g, '?v=01.01.2026.r1.0000');
  assert.ok(shellProblems(vieja, token).some(p => /site-nav\.js/.test(p)));
  // Y una página bien adoptada pasa.
  const buena = `<!DOCTYPE html><html><head><link rel="stylesheet" href="/assets/styles.css"><link rel="stylesheet" href="/assets/cuadratura.css?v=${token}"><script defer src="/assets/site-nav.js?v=${token}"></script></head><body><header class="site-header"><a class="brand" href="/"><span>Pixeria</span></a><nav class="nav"></nav></header><main></main><script defer src="/assets/cuadratura.js?v=${token}"></script></body></html>`;
  assert.deepEqual(shellProblems(buena, token), []);
});

test('el shell aísla la barra de la página y publica su altura real', () => {
  const css = read('assets/cuadratura.css');
  const nav = read('assets/site-nav.js');
  assert.match(css, /:root\{--pf-topbar-h:70px\}/);
  assert.match(css, /:root:not\(\[data-mb-marca\]\) body \.pf-topbar\{[^}]*font-family:"JetBrains Mono"/, 'la barra no hereda la tipografía de la página');
  assert.match(css, /body \.pf-topbar \.pix-nav-icon\[aria-pressed\]/, 'los botones de la barra no heredan button[aria-pressed] de la página');
  assert.match(nav, /setProperty\('--pf-topbar-h'/);
  assert.match(nav, /\.pix-nav-home-rails \.rail\{position:fixed;top:var\(--pf-topbar-h,70px\)/, 'los raíles de las interiores empiezan bajo la barra real');
  // Ninguna página adoptada vuelve a la altura fija de la cabecera vieja.
  for (const page of pages.filter(p => !Object.hasOwn(SHELL_EXCEPTIONS, p))) {
    assert.ok(!/calc\(100d?vh - \d+px\)/.test(read(page)), `${page}: usa var(--pf-topbar-h) en vez de «100vh - Npx»`);
  }
});

test('la documentación del shell lista cada excepción y la regla de las páginas nuevas', () => {
  const doc = read('docs/shell-cuadratico.md');
  assert.match(doc, /toda página nueva usa el shell/i);
  for (const page of Object.keys(SHELL_EXCEPTIONS)) assert.ok(doc.includes('`' + page + '`'), `docs/shell-cuadratico.md no menciona ${page}`);
});
