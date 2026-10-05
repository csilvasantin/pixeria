// /language ESP en pixeria (Carlos, 5-oct-2026): la preferencia del Experto
// (localStorage[admiranext_expert_lang]) manda sobre el auto-redirect a /en/ de site-nav.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(dir, '../assets/site-nav.js'), 'utf8');
const ini = src.indexOf("  var LANG_KEY = 'admiranext_expert_lang';");
const fin = src.indexOf('  if (langRedirect) {');
assert.ok(ini > 0 && fin > ini, 'bloque de idioma de site-nav.js no encontrado');
const bloque = src.slice(ini, fin);

function cargar(url, { pref = null, hreflang = {} } = {}) {
  const u = new URL(url);
  const location = { hostname: u.hostname, pathname: u.pathname, search: u.search, hash: u.hash, href: u.href, origin: u.origin };
  const store = pref ? { admiranext_expert_lang: pref } : {};
  const localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
  const document = {
    querySelector: (sel) => {
      const m = sel.match(/hreflang="([a-z-]+)"/);
      const href = m && hreflang[m[1]];
      return href ? { getAttribute: () => href } : null;
    },
  };
  const window = {};
  const fn = new Function('location', 'localStorage', 'document', 'window', 'URLSearchParams', 'URL', bloque + '\nreturn langRedirect;');
  const redirect = fn(location, localStorage, document, window, URLSearchParams, URL);
  return { redirect, I: window.PixeriaIdioma, store };
}
const STOCK = { es: 'https://www.pixeria.com/stock.html', en: 'https://www.pixeria.com/en/stock.html' };

test('pixeria sin preferencia: ruta ES traducida → /en/ (como siempre)', () => {
  assert.equal(cargar('https://www.pixeria.com/stock.html?cliente=altadis').redirect, '/en/stock.html?cliente=altadis');
  assert.equal(cargar('https://www.pixeria.com/stock').redirect, '/en/stock');
  assert.equal(cargar('https://www.pixeria.com/index.html').redirect, '/en/');
  assert.equal(cargar('https://www.pixeria.com/ideas.html').redirect, '', 'Ideas no tiene /en/');
});

test('pixeria con preferencia es o ?lang=es: no rebota a /en/', () => {
  assert.equal(cargar('https://www.pixeria.com/stock.html', { pref: 'es' }).redirect, '');
  assert.equal(cargar('https://www.pixeria.com/stock.html?lang=es').redirect, '');
  assert.equal(cargar('https://www.pixeria.com/stock', { pref: 'es' }).redirect, '');
});

test('preferencia es desde /en/ traducida → ruta ES (con ?lang=es en pixeria)', () => {
  assert.equal(cargar('https://www.pixeria.com/en/stock?cliente=x', { pref: 'es' }).redirect, '/stock?cliente=x&lang=es');
  assert.equal(cargar('https://admira.studio/en/stock.html', { pref: 'es' }).redirect, '/stock.html');
  assert.equal(cargar('https://www.pixeria.com/en/stock').redirect, '', 'sin preferencia /en/ se queda');
});

test('admira.studio: sin preferencia se queda; preferencia en → /en/', () => {
  assert.equal(cargar('https://admira.studio/stock.html').redirect, '');
  assert.equal(cargar('https://admira.studio/stock.html', { pref: 'en' }).redirect, '/en/stock.html');
  assert.equal(cargar('https://admira.studio/en/stock.html', { pref: 'en' }).redirect, '');
});

test('PixeriaIdioma.url: ruta del hreflang en ESTE origen, query conservado, ?lang=es solo en pixeria', () => {
  const p = cargar('https://www.pixeria.com/en/stock?cliente=altadis', { hreflang: STOCK });
  assert.equal(p.I.url('es'), '/stock.html?cliente=altadis&lang=es');
  assert.equal(p.I.url('en'), '', 'ya estás en la versión inglesa (/en/stock ≡ /en/stock.html)');
  const s = cargar('https://admira.studio/en/stock.html?lang=en', { hreflang: { es: 'https://www.admira.studio/stock.html', en: 'https://www.admira.studio/en/stock.html' } });
  assert.equal(s.I.url('es'), '/stock.html', 'el hreflang dice www.admira.studio pero navegamos en admira.studio');
  const back = cargar('https://www.pixeria.com/stock.html?lang=es&cliente=a', { hreflang: STOCK });
  assert.equal(back.I.url('en'), '/en/stock.html?cliente=a');
  assert.equal(cargar('https://www.pixeria.com/stock.html?lang=es').I.url('en'), '/en/stock.html', 'sin hreflang usa translatedPages');
});
