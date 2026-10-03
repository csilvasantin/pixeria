// Guardián de los paneles superpuestos (Carlos, 3-oct-2026): «el cuerpo central del sitio
// (contenido) no se desplaza al abrir las barras opcionales, ni verticales ni la horizontal
// inferior». ☰ (raíl izquierdo), ▤ (raíl derecho) y ⌘ (Experto, abajo) se SUPERPONEN: el
// contenido no cambia de posición, ancho ni alto, ni se recoloca. Y los paneles entran
// CERRADOS en cada página (el tamaño redimensionado sí puede recordarse).
// Ver docs/shell-cuadratico.md, apartado «Paneles superpuestos».
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

function walk(ext) {
  const out = [];
  const go = dir => {
    for (const entry of fs.readdirSync(path.join(root, dir), {withFileTypes: true})) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const rel = path.join(dir, entry.name);
      if (entry.isDirectory()) go(rel); else if (entry.name.endsWith(ext)) out.push(rel.split(path.sep).join('/'));
    }
  };
  go('');
  return out.sort();
}

// ── Reglas CSS que dependen del estado de los paneles ─────────────────────────────
// Clase o selector que dice «este panel está abierto/cerrado».
const STATE = /pf-(?:left|right|bottom)-off|pf-cli-open|pf-cli-folded|quad-(?:left|right|bottom)-open|:has\([^)]*(?:rail|pf-cli|quad-|pix-nav-layer)/;
// Variables con el tamaño de un panel: el contenido no puede medirse con ellas.
const PANEL_VAR = /var\(--(?:pf-left-w|pf-right-w|pf-bottom-h|pf-cli-height|pf-cli-viewport)\b/;
// El elemento estilado (último compuesto) es un panel o la barra: eso sí puede cambiar.
const CHROME = /\.(?:rail|rail-[\w-]+|pf-cli(?:-(?:grip|output|form))?|quad-(?:menu|left|right|bottom|top)|pix-nav-[\w-]+|pf-ico|pf-resize[\w-]*|pf-topbar[\w-]*|pf-window[\w-]*|lead-toggle)(?![\w-])/;
// Contenido: main, .cuad-center, .page-head, body/html y lo que cuelga de ellos.
const CONTENT = /(?:^|[\s>+~,(])(?:main|body|html|:root)\b|\.cuad-center|\.page-head|\.pf-cli-viewport|\.cuad\b(?!-)/;
const LAYOUT = /^(?:margin(?:-[a-z]+)?|padding(?:-[a-z]+)?|(?:max-|min-)?width|(?:max-|min-)?height|grid-template-columns|grid-template|grid-column|inset|left|right|top|bottom|transform|translate|font-size|flex(?:-[a-z]+)?|overflow(?:-[xy])?|position|--[\w-]+)$/;

function cssRules(css) {
  css = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = m[1].trim();
    if (!selector || selector.startsWith('@')) continue;
    const decls = m[2].split(';').map(d => d.trim()).filter(Boolean).map(d => {
      const i = d.indexOf(':');
      return {prop: d.slice(0, i).trim().toLowerCase(), value: d.slice(i + 1).trim()};
    });
    rules.push({selector, decls});
  }
  return rules;
}

function subjectOf(sel) {
  const parts = sel.trim().split(/\s*[\s>+~]\s*(?![^(]*\))/);
  return parts[parts.length - 1];
}

// Devuelve las violaciones del principio en una hoja de estilos.
function violations(css, origin) {
  const bad = [];
  for (const {selector, decls} of cssRules(css)) {
    for (const sel of selector.split(/,(?![^(]*\))/).map(s => s.trim()).filter(Boolean)) {
      const subject = subjectOf(sel);
      if (CHROME.test(subject)) continue;
      const touchesContent = CONTENT.test(' ' + sel);
      const layout = decls.filter(d => LAYOUT.test(d.prop));
      if (STATE.test(sel) && layout.length) {
        bad.push(`${origin}: «${sel}» cambia ${layout.map(d => d.prop).join(', ')} según el estado de un panel`);
      } else if (touchesContent) {
        const sized = decls.filter(d => LAYOUT.test(d.prop) && PANEL_VAR.test(d.value));
        if (sized.length) bad.push(`${origin}: «${sel}» mide el contenido con el tamaño de un panel (${sized.map(d => d.prop).join(', ')})`);
      }
    }
  }
  return bad;
}

// CSS que el JS inyecta como cadenas ('…{…}' + …): se juntan los literales y se analizan.
function cssInJs(js) {
  return [...js.matchAll(/'((?:[^'\\\n]|\\.)*)'/g)].map(m => m[1]).filter(s => /\{[^}]*:[^}]*\}/.test(s)).join('\n');
}

const pages = walk('.html');
const cssFiles = walk('.css');
const ownJs = ['assets/site-nav.js', 'assets/cuadratura.js', 'assets/expert-cli.js', 'app.js'];

test('ninguna regla de CSS mueve o redimensiona el contenido al abrir ☰, ▤ o ⌘', () => {
  const bad = [];
  for (const file of cssFiles) bad.push(...violations(read(file), file));
  for (const file of ownJs) bad.push(...violations(cssInJs(read(file)), file));
  for (const page of pages) {
    for (const m of read(page).matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)) bad.push(...violations(m[1], page));
  }
  assert.deepEqual(bad, [], 'Los paneles se superponen: quita la regla (docs/shell-cuadratico.md, «Paneles superpuestos»).');
});

test('el JS no empuja ni envuelve el contenido según los paneles', () => {
  for (const file of ownJs) {
    const js = read(file);
    assert.ok(!/pf-cli-viewport/.test(js), `${file}: la consola no envuelve el <body> en un viewport con altura reducida`);
    assert.doesNotMatch(js, /\b(?:main|center|content|body|document\.body|document\.documentElement|head)\.style\.(?:margin|padding|width|height|maxWidth|minHeight|gridTemplateColumns|overflow)\w*\s*=/,
      `${file}: no se cambia por estilo en línea el tamaño o el margen del contenido`);
    assert.doesNotMatch(js, /\.style\.setProperty\(\s*['"](?:margin|padding|width|height|grid-template-columns)/, `${file}: ídem con setProperty`);
  }
  for (const file of cssFiles) assert.ok(!/pf-cli-viewport/.test(read(file)), `${file}: sin .pf-cli-viewport`);
});

test('los paneles entran cerrados en cada carga: nada restaura el estado abierto', () => {
  const RESTORE = /(?:getItem|setItem)\(\s*['"]pixeria_pf_(?:left|right|bottom)['"]|pixeria_pf_(?:left|right|bottom)\s*:/;
  for (const file of [...ownJs, ...walk('.js').filter(f => !ownJs.includes(f) && !f.startsWith('test/'))]) {
    assert.doesNotMatch(read(file), RESTORE, `${file}: el estado abierto de ☰/▤/⌘ no se guarda ni se lee (solo el tamaño: pixeria_pf_*_w / _h)`);
  }
  // Ficha de QA explícita: enseña los paneles abiertos y no guarda nada. Ninguna otra página los abre.
  const QA_ABIERTA = new Set(['_cuadopen.html', 'en/_cuadopen.html']);
  const CLOSE = "document.body.classList.add('pf-left-off','pf-right-off','pf-bottom-off');";
  const bad = [];
  for (const page of pages) {
    const html = read(page);
    if (RESTORE.test(html)) bad.push(`${page}: lee o guarda pixeria_pf_left/right/bottom`);
    if (/classList\.remove\([^)]*pf-(?:left|right|bottom)-off/.test(html) && !QA_ABIERTA.has(page)) bad.push(`${page}: abre un panel al cargar`);
    if (!/assets\/site-nav\.js/.test(html)) continue;
    // El script en línea al abrir <body> es el mismo en todas: cierra los tres, sin leer nada.
    const body = html.slice(html.search(/<body\b/));
    const first = body.match(/<script>([\s\S]*?)<\/script>/);
    if (!first || first[1].trim() !== CLOSE) bad.push(`${page}: el primer <script> del <body> debe ser exactamente ${CLOSE}`);
  }
  assert.deepEqual(bad, []);
  const nav = read('assets/site-nav.js');
  assert.match(nav, /document\.body\.classList\.add\('pf-left-off', 'pf-right-off'\);/, 'site-nav.js monta los raíles interiores cerrados');
  assert.match(nav, /localStorage\.removeItem/, 'site-nav.js borra el rastro del estado abierto que se guardaba antes');
  assert.doesNotMatch(read('assets/cuadratura.js'), /localStorage\.setItem\(\s*p\./, 'cuadratura.js no persiste el toggle');
});

test('una regresión hace fallar al guardián', () => {
  // Lo que había hasta el 3-oct-2026, regla a regla.
  const old = [
    'body.pf-has-frame:not(.pf-left-off) .cuad-center{margin-left:var(--pf-left-w)}',
    'body.pf-has-frame:not(.pf-right-off) .page-head{margin-right:calc(var(--pf-right-w) + 46px);max-width:calc(100vw - var(--pf-right-w) - 92px)}',
    'body.pf-has-frame:not(.pf-bottom-off) .cuad-center{margin-bottom:var(--pf-bottom-h)}',
    'body.pf-has-frame:not(.pf-left-off) .cuad-center h1{font-size:clamp(38px, 6vw, 72px)}',
    'body.pf-has-frame:not(.pf-left-off) .cuad-center .stock-pager{grid-template-columns:auto minmax(220px,1fr)}',
    '@media (min-width:981px){body.pf-has-frame:not(.pf-right-off) .cuad-center { margin-left:var(--pf-right-w); }}',
    '.pix-nav-home-rails main{margin-left:var(--pf-left-w,300px);margin-right:var(--pf-right-w,330px)}',
    '.pix-nav-home-rails.pf-left-off main{margin-left:0}',
    'body.pf-cli-open { overflow: hidden; }',
    'body.pf-cli-open .pf-cli-viewport{height:calc(var(--pf-cli-viewport, 100dvh) - var(--pf-cli-height, 48px))}',
    'body.quad-ui.quad-left-open { --quad-side: 74px; }',
    'body.quad-ui.quad-bottom-open { padding-bottom: 58px; }',
    'body:has(.rail-left:not([hidden])) main{width:60%}',
  ];
  for (const css of old) assert.ok(violations(css, 'x').length >= 1, `no detecta: ${css}`);
  // Y lo que sí vale: los paneles cambian ellos solos.
  const ok = [
    'body.pf-left-off .rail-left{display:none}',
    'body.pf-cli-open .rail { bottom: calc(var(--pf-cli-height, 48px) + var(--pf-cli-keyboard, 0px)); }',
    '.cuad .rail{position:fixed;width:var(--pf-left-w)}',
    '.quad-left:not(.is-collapsed){transform:translateX(0)}',
    'body.quad-ui{padding:var(--quad-top) var(--quad-side) var(--quad-bottom)}',
  ];
  for (const css of ok) assert.deepEqual(violations(css, 'x'), [], `falso positivo: ${css}`);
});

test('la documentación recoge el principio', () => {
  const doc = read('docs/shell-cuadratico.md');
  assert.match(doc, /Paneles superpuestos/);
  assert.match(doc, /no se desplaza al abrir las barras opcionales/);
  assert.match(doc, /entran cerrados/i);
  assert.match(doc, /paneles-superpuestos\.test\.cjs/);
});
