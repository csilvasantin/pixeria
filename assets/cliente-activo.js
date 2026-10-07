/* Cliente activo de Pixeria (Carlos, 4-oct-2026, 20:32).
 * Por defecto el cliente es Admira y Admira lo ve TODO (Stock, vídeos del Adaptador): no se filtra.
 * El selector «Cliente» junto al logo NO se muestra por defecto: solo con `/marca todas` en la CLI
 * Experto (superusuario); `/marca <cliente>` filtra por ese cliente y `/marca off` oculta el
 * selector y vuelve a Admira (assets/expert-cli.js).
 * Con otro cliente activo se ve lo suyo más lo genérico de Admira (PixeriaCliente.visible(item)).
 * Estado de sesión: localStorage pixeria:cliente:v2 + ?cliente=<id> y evento `pixeria:cliente`; el
 * selector visible, solo en sessionStorage (pixeria:cliente-selector:v2).
 * Lista de admiranext.com (CLIENTES_URL; respaldo local), solo clientes con la pata «studio» (o
 * «todas»): primero los globales y luego el resto. Qué cliente es cada asset: campo explícito,
 * etiquetas o nombres según /data/clientes-mapeo.json.
 */
(function () {
  if (window.PixeriaCliente) return;
  var CLIENTES_URL = 'https://www.admiranext.com/api/clientes';
  var CLIENTES_RESPALDO = '/data/clientes.json';
  var MAPEO_URL = '/data/clientes-mapeo.json';
  var PATA = 'studio';
  var KEY = 'pixeria:cliente:v2'; // v2: lo guardado con el selector antiguo ya no filtra en silencio
  // '1' = selector visible (/marca todas). Solo dura la sesión de la pestaña (sessionStorage): antes
  // vivía en localStorage y, quien escribía /marca todas una vez, veía el combo para siempre.
  var SEL_KEY = 'pixeria:cliente-selector:v2';
  try { localStorage.removeItem('pixeria:cliente-selector'); } catch (_) {}
  // Respaldo del rol admin: flag de este navegador (localStorage pixeria:admin = 1).
  // Habilita /marca todas|<cliente>; filtrar es una vista, no una barrera de seguridad.
  var ADMIN_KEY = 'pixeria:admin';
  var EN = (document.documentElement.lang || '').toLowerCase().indexOf('en') === 0;
  var lista = [], porDefecto = null, actual = null, mapeo = null, listo = false, nombresDe = {};

  var slug = function (v) { return String(v == null ? '' : v).toLowerCase().trim().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64); };
  var plano = function (v) { return String(v == null ? '' : v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ''); };
  var TODOS = /^(todos|todas|all|ninguno|off|admira)$/; // = cliente por defecto (Admira, todo)
  // Superusuario: lo dice el servidor (/auth/session → superusuario, para las cuentas de Carlos y
  // la sesión de agente). El flag local pixeria:admin = 1 queda como respaldo.
  var superSesion = false;
  // CUENTA ASIGNADA A UN CLIENTE (Carlos, 7-oct-2026). La identidad central de AdmiraNeXT dice a qué clientes está
  // asignada la cuenta (/auth/session → clientes: null = sin restricción, [ids] = sólo ésos). Una cuenta asignada
  // no puede cambiar de cliente ni volver a «Admira, todo»: ni con /marca, ni con ?cliente=, ni con el flag local.
  // Lo último sabido se recuerda en la pestaña para no enseñar nada ajeno mientras llega la sesión.
  var FIJO_KEY = 'pixeria:cliente-fijo';
  var permitidos = null;
  try { var recordado = JSON.parse(sessionStorage.getItem(FIJO_KEY) || 'null'); if (Array.isArray(recordado)) permitidos = recordado.map(function (x) { return String(x); }); } catch (_) {}
  function restringido() { return Array.isArray(permitidos); }
  function esAdmin() { if (restringido()) return false; if (superSesion) return true; try { return localStorage.getItem(ADMIN_KEY) === '1'; } catch (_) { return false; } }
  var pSesion = Promise.resolve(null);
  try {
    pSesion = fetch('/auth/session', {credentials: 'include', cache: 'no-store', headers: {Accept: 'application/json'}})
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j || !j.ok) return null; // sin respuesta no se toca lo recordado
        superSesion = j.superusuario === true;
        permitidos = Array.isArray(j.clientes) ? j.clientes.map(function (x) { return String(x).toLowerCase().trim().replace(/[^a-z0-9-]+/g, '-'); }).filter(Boolean) : null;
        try { if (permitidos) sessionStorage.setItem(FIJO_KEY, JSON.stringify(permitidos)); else sessionStorage.removeItem(FIJO_KEY); } catch (_) {}
        return j;
      })
      .catch(function () { return null; });
  } catch (_) {}

  var guardado = null, q = null;
  try { guardado = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (_) {}
  try { q = new URLSearchParams(location.search).get('cliente'); } catch (_) {}
  // pedido: id de un cliente que no es el por defecto, o null (Admira, todo).
  var pedido = q != null ? (TODOS.test(slug(q)) ? null : slug(q) || null) : guardado && slug(guardado.id) && !TODOS.test(slug(guardado.id)) ? slug(guardado.id) : null;
  function esDefecto(c) { return !c || (porDefecto ? c.id === porDefecto.id : c.id === 'admira'); }
  function selectorVisible() { try { return sessionStorage.getItem(SEL_KEY) === '1'; } catch (_) { return false; } }

  function guardar() {
    var defecto = esDefecto(actual);
    try { if (defecto) localStorage.removeItem(KEY); else localStorage.setItem(KEY, JSON.stringify(actual)); } catch (_) {}
    try {
      var u = new URL(location.href);
      if (defecto) u.searchParams.delete('cliente'); else u.searchParams.set('cliente', actual.id);
      if (u.href !== location.href) history.replaceState(history.state, '', u.href);
    } catch (_) {}
  }
  function avisar() { document.dispatchEvent(new CustomEvent('pixeria:cliente', {detail: actual})); }
  function porId(id) { return lista.filter(function (c) { return c.id === id; })[0] || null; }
  // «starbucks», «proyectoStarbucks», «Starbucks», «starbucks-mexico»… → cliente | null
  function resolver(texto) {
    var t = plano(String(texto || '').trim().replace(/^\//, '').replace(/^proyecto/i, ''));
    if (!t) return null;
    return lista.filter(function (c) { return plano(c.id) === t || plano(c.nombre) === t; })[0] || null;
  }
  function aplicar(c) {
    c = c || porDefecto;
    actual = c ? {id: c.id, nombre: c.nombre} : null;
    guardar(); pintar(); avisar();
    return actual;
  }
  // id o nombre de cliente; '' / admira / todos / off = Admira (todo).
  function fijar(id) {
    var c = TODOS.test(slug(id)) || !slug(id) ? porDefecto : porId(slug(id)) || resolver(id);
    if (!c) return false;
    if (restringido() && permitidos.indexOf(c.id) < 0) return false;
    aplicar(c);
    return true;
  }
  function selector(on) {
    if (restringido()) on = permitidos.length > 1; // con varios clientes elige entre los suyos; no se oculta ni se amplía
    try { if (on) sessionStorage.setItem(SEL_KEY, '1'); else sessionStorage.removeItem(SEL_KEY); } catch (_) {}
    if (on) colocar(); else if (label.isConnected) label.remove();
  }

  // Todos los clientes que se deducen de un asset (ver data/clientes-mapeo.json). Si casan varios
  // (p. ej. #jti y #altadis), el asset es ambiguo y solo lo ve Admira: deducción conservadora.
  function clientesDe(it) {
    if (!it || !mapeo) return [];
    var C = mapeo.clientes || {}, ids = Object.keys(C);
    var fijo = slug((mapeo.asignaciones || {})[it.id] || it.cliente || (it.catalogo && it.catalogo.cliente) || '');
    if (fijo && (C[fijo] || (mapeo.genericos || []).indexOf(fijo) >= 0)) return [fijo];
    var out = [];
    var tags = (Array.isArray(it.tags) ? it.tags : []).map(function (x) { return String(x).toLowerCase().trim().replace(/^#/, ''); });
    // El nombre único de un centro o de una pantalla empieza por su proyecto (starbucks_paseodegracia_103_pantalla1):
    // esa pieza es del cliente aunque no lleve además la etiqueta «starbucks».
    var cabezas = tags.map(function (x) { var i = x.indexOf('_'); return i > 0 ? plano(x.slice(0, i)) : ''; }).filter(Boolean);
    ids.forEach(function (id) {
      var nombres = [id].concat(C[id].tags || []);
      if (tags.some(function (x) { return nombres.indexOf(x) >= 0; }) || (cabezas.length && [id, nombresDe[id]].concat(C[id].tags || []).some(function (n) { return n && cabezas.indexOf(plano(n)) >= 0; }))) out.push(id);
    });
    // Patrones en orden: lo que casa se consume, para que «Starbucks México» no cuente también como «Starbucks».
    var texto = [it.title, it.name, it.prompt, it.comment].filter(Boolean).join(' \n ');
    ids.forEach(function (id) {
      var pats = C[id]._re || (C[id]._re = (C[id].patrones || []).map(function (p) { try { return new RegExp(p, 'gi'); } catch (_) { return null; } }).filter(Boolean));
      pats.forEach(function (re) {
        re.lastIndex = 0;
        if (re.test(texto)) { if (out.indexOf(id) < 0) out.push(id); re.lastIndex = 0; texto = texto.replace(re, ' '); }
      });
    });
    return out;
  }
  function clienteDe(it) { var l = clientesDe(it); return l.length === 1 ? l[0] : null; }
  function visible(it) {
    if (!listo) return !restringido(); // una cuenta asignada no ve nada hasta saber de quién es cada pieza
    if (esDefecto(actual)) return true; // Admira lo ve todo
    var gen = mapeo.genericos || [];
    return clientesDe(it).every(function (c) { return c === actual.id || gen.indexOf(c) >= 0; });
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
  select.addEventListener('change', function () { fijar(select.value); });

  function opcion(parent, c) { var o = document.createElement('option'); o.value = c.id; o.textContent = c.nombre; parent.appendChild(o); }
  function pintar() {
    select.innerHTML = '';
    var globales = lista.filter(function (c) { return c.global; }), resto = lista.filter(function (c) { return !c.global; });
    if (globales.length && resto.length) {
      var g1 = document.createElement('optgroup'); g1.label = EN ? 'Global' : 'Globales'; globales.forEach(function (c) { opcion(g1, c); }); select.appendChild(g1);
      var g2 = document.createElement('optgroup'); g2.label = EN ? 'Others' : 'Resto'; resto.forEach(function (c) { opcion(g2, c); }); select.appendChild(g2);
    } else lista.forEach(function (c) { opcion(select, c); });
    if (actual && !porId(actual.id)) opcion(select, actual);
    if (actual) select.value = actual.id;
  }
  function colocar() {
    if (label.isConnected || !selectorVisible()) return true;
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
  Promise.all([pLista, pMapeo, pSesion]).then(function (r) {
    // Globales arriba en el orden de admiranext.com; el resto, alfabético.
    lista = r[0].sort(function (a, b) { return (b.global - a.global) || (a.global ? a.orden - b.orden : a.nombre.localeCompare(b.nombre, 'es', {sensitivity: 'base'})); });
    mapeo = r[1] || {clientes: {}};
    porDefecto = lista.filter(function (c) { return c.porDefecto; })[0] || porId('admira') || null;
    lista.forEach(function (c) { nombresDe[c.id] = c.nombre; });
    listo = true;
    if (restringido()) {
      // Sólo sus clientes (aunque alguno no esté en la lista pública); sin ninguno, «sin cliente» = sólo lo genérico.
      var todos = lista;
      lista = permitidos.map(function (id) { return todos.filter(function (c) { return c.id === id; })[0] || {id: id, nombre: id, global: false}; });
      var suyo = pedido && permitidos.indexOf(pedido) >= 0 ? porId(pedido) : lista[0] || {id: 'sin-cliente', nombre: EN ? 'No client' : 'Sin cliente'};
      selector(true);
      aplicar(suyo);
      return;
    }
    aplicar(pedido ? porId(pedido) || porDefecto : porDefecto);
  });

  // Los enlaces a las otras patas (store, tv, app, biz, admiranext) llevan el cliente activo.
  var PATAS = /(^|\.)(admiranext\.com|admira\.(store|tv|app|biz))$/i;
  document.addEventListener('click', function (e) {
    var a = !esDefecto(actual) && e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    try { var u = new URL(a.href, location.href); if (!PATAS.test(u.hostname) || u.searchParams.has('cliente')) return; u.searchParams.set('cliente', actual.id); a.href = u.href; } catch (_) {}
  }, true);

  window.PixeriaCliente = {
    listo: function () { return listo; },
    actual: function () { return actual ? {id: actual.id, nombre: actual.nombre} : null; },
    lista: function () { return lista.slice(); },
    esAdmin: esAdmin,
    restringido: restringido,
    permitidos: function () { return restringido() ? permitidos.slice() : null; },
    filtrar: function (items) { return (Array.isArray(items) ? items : []).filter(visible); },
    porDefecto: function () { return porDefecto ? {id: porDefecto.id, nombre: porDefecto.nombre} : null; },
    esDefecto: function () { return esDefecto(actual); },
    selector: selector,
    selectorVisible: selectorVisible,
    resolver: resolver,
    fijar: fijar,
    clienteDe: clienteDe, clientesDe: clientesDe,
    visible: visible
  };
})();
