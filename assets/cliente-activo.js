/* Cliente activo de Pixeria: selector «Cliente» en la barra superior, junto al logo.
 * Estado de sesión compartido por todas las páginas: localStorage + ?cliente=<id> y evento
 * `pixeria:cliente`. Filtra el Stock y la elección de vídeo del Adaptador: se ve lo de ese
 * cliente más lo genérico de Admira (PixeriaCliente.visible(item)).
 * Lista global de admiranext.com (CLIENTES_URL; respaldo local si falla), solo clientes con la
 * pata «studio» (o «todas»): primero los globales y luego el resto. Sin nada guardado, el
 * cliente es el que trae por_defecto (Admira). «Todos» solo lo ve el superusuario (rol admin).
 * Qué cliente es cada asset: campo explícito, etiquetas o nombres según /data/clientes-mapeo.json.
 */
(function () {
  if (window.PixeriaCliente) return;
  var CLIENTES_URL = 'https://www.admiranext.com/api/clientes';
  var CLIENTES_RESPALDO = '/data/clientes.json';
  var MAPEO_URL = '/data/clientes-mapeo.json';
  var PATA = 'studio';
  var KEY = 'pixeria:cliente';
  // Rol admin: Pixeria no tiene roles en servidor todavía; es un flag de este navegador
  // (localStorage pixeria:admin = 1). No es una barrera de seguridad: solo muestra «Todos» y la CLI.
  var ADMIN_KEY = 'pixeria:admin';
  var EN = (document.documentElement.lang || '').toLowerCase().indexOf('en') === 0;
  var lista = [], porDefecto = null, actual = null, mapeo = null, listo = false;

  var slug = function (v) { return String(v == null ? '' : v).toLowerCase().trim().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64); };
  var plano = function (v) { return String(v == null ? '' : v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ''); };
  var TODOS = /^(todos|todas|all|ninguno|off)$/;
  function esAdmin() { try { return localStorage.getItem(ADMIN_KEY) === '1'; } catch (_) { return false; } }

  var guardado = null, q = null;
  try { guardado = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (_) {}
  try { q = new URLSearchParams(location.search).get('cliente'); } catch (_) {}
  // pedido: id, '' (Todos) o null (nada pedido → por defecto).
  var pedido = q != null ? (TODOS.test(slug(q)) || !slug(q) ? '' : slug(q)) : guardado && guardado.todos ? '' : guardado && slug(guardado.id) ? slug(guardado.id) : null;

  function guardar() {
    try { localStorage.setItem(KEY, JSON.stringify(actual ? actual : {todos: true})); } catch (_) {}
    try {
      var u = new URL(location.href);
      if (actual) u.searchParams.set('cliente', actual.id); else u.searchParams.set('cliente', 'todos');
      if (u.href !== location.href) history.replaceState(history.state, '', u.href);
    } catch (_) {}
  }
  function avisar() { document.dispatchEvent(new CustomEvent('pixeria:cliente', {detail: actual})); }
  function porId(id) { return lista.filter(function (c) { return c.id === id; })[0] || null; }
  // «/starbucks», «proyectoStarbucks», «Starbucks», «starbucks-mexico»… → cliente | 'todos' | null
  function resolver(texto) {
    var t = plano(String(texto || '').trim().replace(/^\//, '').replace(/^proyecto/i, ''));
    if (!t) return null;
    if (TODOS.test(t)) return 'todos';
    return lista.filter(function (c) { return plano(c.id) === t || plano(c.nombre) === t; })[0] || null;
  }
  function aplicar(c) {
    if (c === 'todos' || c === '' || c == null) {
      if (!esAdmin()) c = porDefecto; else c = null;
    }
    actual = c ? {id: c.id, nombre: c.nombre} : null;
    guardar(); pintar(); avisar();
    return actual;
  }
  function fijar(id) {
    var c = TODOS.test(slug(id)) || !slug(id) ? 'todos' : porId(slug(id)) || resolver(id);
    if (!c) return false;
    aplicar(c);
    return true;
  }

  // Qué cliente es un asset (o null = genérico de Admira).
  function clienteDe(it) {
    if (!it || !mapeo) return null;
    var C = mapeo.clientes || {};
    var explicito = slug(it.cliente || (it.catalogo && it.catalogo.cliente) || '');
    if (explicito && C[explicito]) return explicito;
    var tags = (Array.isArray(it.tags) ? it.tags : []).map(function (x) { return String(x).toLowerCase().trim().replace(/^#/, ''); });
    var ids = Object.keys(C);
    for (var i = 0; i < ids.length; i++) {
      var regla = C[ids[i]], nombres = [ids[i]].concat(regla.tags || []);
      if (tags.some(function (x) { return nombres.indexOf(x) >= 0; })) return ids[i];
    }
    var texto = [it.title, it.name, it.prompt, it.comment].filter(Boolean).join(' ');
    for (var j = 0; j < ids.length; j++) {
      var pats = C[ids[j]]._re || (C[ids[j]]._re = (C[ids[j]].patrones || []).map(function (p) { try { return new RegExp(p, 'i'); } catch (_) { return null; } }).filter(Boolean));
      if (pats.some(function (re) { return re.test(texto); })) return ids[j];
    }
    return null;
  }
  function visible(it) {
    if (!actual) return true; // «Todos» (superusuario)
    var c = clienteDe(it);
    return !c || c === actual.id || (mapeo.genericos || []).indexOf(c) >= 0;
  }

  var style = document.createElement('style');
  style.textContent = '.pix-cliente{display:inline-flex;flex-direction:column;align-items:flex-start;gap:2px;margin-left:10px;font:11px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;color:#8fbf98;letter-spacing:.04em;white-space:nowrap;flex:0 0 auto}.pix-cliente>span{font-size:9px;text-transform:uppercase;letter-spacing:.12em}' +
    '.pix-cliente select{field-sizing:content;width:auto;min-width:0;max-width:120px;background:rgba(0,255,65,.06);color:#c8ffd0;border:1px solid rgba(0,255,65,.35);border-radius:0;padding:3px 4px;font:inherit;cursor:pointer;text-overflow:ellipsis}' +
    '.pix-cliente select:focus-visible{outline:2px solid #00ff41;outline-offset:2px}' +
    '@media(max-width:900px){.pix-cliente{margin-left:8px}}';
  (document.head || document.documentElement).appendChild(style);

  var label = document.createElement('label');
  label.className = 'pix-cliente';
  label.innerHTML = '<span>' + (EN ? 'Client:' : 'Cliente:') + '</span><select id="pix-cliente"></select>';
  var select = label.querySelector('select');
  select.setAttribute('aria-label', EN ? 'Active client' : 'Cliente activo');
  select.addEventListener('change', function () { fijar(select.value || 'todos'); });

  function opcion(parent, c) { var o = document.createElement('option'); o.value = c.id; o.textContent = c.nombre; parent.appendChild(o); }
  function pintar() {
    select.innerHTML = '';
    if (esAdmin()) { var todos = document.createElement('option'); todos.value = ''; todos.textContent = EN ? 'All' : 'Todos'; select.appendChild(todos); }
    var globales = lista.filter(function (c) { return c.global; }), resto = lista.filter(function (c) { return !c.global; });
    if (globales.length && resto.length) {
      var g1 = document.createElement('optgroup'); g1.label = EN ? 'Global' : 'Globales'; globales.forEach(function (c) { opcion(g1, c); }); select.appendChild(g1);
      var g2 = document.createElement('optgroup'); g2.label = EN ? 'Others' : 'Resto'; resto.forEach(function (c) { opcion(g2, c); }); select.appendChild(g2);
    } else lista.forEach(function (c) { opcion(select, c); });
    if (actual && !porId(actual.id)) opcion(select, actual);
    select.value = actual ? actual.id : '';
  }
  function colocar() {
    if (label.isConnected) return true;
    var brand = document.querySelector('.pf-topbar-left .pf-topbar-brand, .pf-topbar .pf-topbar-brand, .quad-top .quad-brand, .site-header .brand');
    if (!brand) return false;
    brand.insertAdjacentElement('afterend', label);
    return true;
  }
  pintar();
  var intentos = 0;
  (function reintentar() { if (!colocar() && ++intentos < 40) setTimeout(reintentar, 150); })();
  new MutationObserver(function () { if (!label.isConnected) colocar(); }).observe(document.body, {childList: true, subtree: true});

  function normaliza(data) {
    return (Array.isArray(data) ? data : []).filter(function (c) {
      return c && slug(c.id) && c.nombre && Array.isArray(c.patas) && (c.patas.indexOf(PATA) >= 0 || c.patas.indexOf('todas') >= 0);
    }).map(function (c, i) { return {id: slug(c.id), nombre: String(c.nombre).slice(0, 80), global: c.global === true, porDefecto: c.por_defecto === true, orden: i}; });
  }
  function cargar(url, opts) { return fetch(url, opts).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); }
  var pLista = cargar(CLIENTES_URL, {credentials: 'omit', cache: 'no-store'}).then(normaliza)
    .then(function (l) { if (!l.length) throw new Error('vacia'); return l; })
    .catch(function () { return cargar(CLIENTES_RESPALDO, {cache: 'no-store'}).then(normaliza); })
    .catch(function () { return []; });
  var pMapeo = cargar(MAPEO_URL, {cache: 'no-store'}).catch(function () { return {clientes: {}, genericos: ['admira']}; });
  Promise.all([pLista, pMapeo]).then(function (r) {
    // Globales arriba en el orden de admiranext.com; el resto, alfabético.
    lista = r[0].sort(function (a, b) { return (b.global - a.global) || (a.global ? a.orden - b.orden : a.nombre.localeCompare(b.nombre, 'es', {sensitivity: 'base'})); });
    mapeo = r[1] || {clientes: {}};
    porDefecto = lista.filter(function (c) { return c.porDefecto; })[0] || porId('admira') || null;
    listo = true;
    aplicar(pedido === '' ? 'todos' : pedido ? porId(pedido) || porDefecto : porDefecto);
  });

  // Los enlaces a las otras patas (store, tv, app, biz, admiranext) llevan el cliente activo.
  var PATAS = /(^|\.)(admiranext\.com|admira\.(store|tv|app|biz))$/i;
  document.addEventListener('click', function (e) {
    var a = actual && e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    try { var u = new URL(a.href, location.href); if (!PATAS.test(u.hostname) || u.searchParams.has('cliente')) return; u.searchParams.set('cliente', actual.id); a.href = u.href; } catch (_) {}
  }, true);

  window.PixeriaCliente = {
    listo: function () { return listo; },
    actual: function () { return actual ? {id: actual.id, nombre: actual.nombre} : null; },
    lista: function () { return lista.slice(); },
    esAdmin: esAdmin,
    resolver: resolver,
    fijar: fijar,
    clienteDe: clienteDe,
    visible: visible
  };
})();
