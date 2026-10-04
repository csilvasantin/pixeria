/* Cliente activo de Pixeria: «Cliente: Todos / …» en la barra superior, junto al logo.
 * Es un estado de sesión compartido por todas las páginas: se guarda en localStorage y en
 * la URL (?cliente=<id>) y se avisa con el evento `pixeria:cliente`. Aún no filtra nada:
 * hoy solo lo usa el Adaptador para titular y etiquetar sus exportaciones.
 * La lista es global y la sirve admiranext.com; si no responde, se usa el respaldo local.
 * Solo se ofrecen los clientes con la pata «studio» (Pixeria) o «todas».
 */
(function () {
  if (window.PixeriaCliente) return;
  var CLIENTES_URL = 'https://www.admiranext.com/api/clientes';
  var CLIENTES_RESPALDO = '/data/clientes.json';
  var PATA = 'studio';
  var KEY = 'pixeria:cliente';
  var EN = (document.documentElement.lang || '').toLowerCase().indexOf('en') === 0;
  var lista = [];
  var actual = null;

  var slug = function (v) { return String(v == null ? '' : v).toLowerCase().trim().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64); };
  try { actual = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (_) { actual = null; }
  if (actual && !slug(actual.id)) actual = null;
  var q = null;
  try { q = new URLSearchParams(location.search).get('cliente'); } catch (_) {}
  if (q != null) {
    var id = slug(q);
    actual = !id || id === 'todos' || id === 'all' ? null : (actual && actual.id === id ? actual : {id: id, nombre: id});
  }

  function guardar() {
    try { if (actual) localStorage.setItem(KEY, JSON.stringify(actual)); else localStorage.removeItem(KEY); } catch (_) {}
    try {
      var u = new URL(location.href);
      if (actual) u.searchParams.set('cliente', actual.id); else u.searchParams.delete('cliente');
      if (u.href !== location.href) history.replaceState(history.state, '', u.href);
    } catch (_) {}
  }
  function avisar() { document.dispatchEvent(new CustomEvent('pixeria:cliente', {detail: actual})); }
  function fijar(id) {
    var s = slug(id);
    var c = s && s !== 'todos' && s !== 'all' ? lista.filter(function (x) { return x.id === s; })[0] : null;
    if (s && s !== 'todos' && s !== 'all' && !c) return false;
    actual = c ? {id: c.id, nombre: c.nombre} : null;
    guardar(); pintar(); avisar();
    return true;
  }

  var style = document.createElement('style');
  style.textContent = '.pix-cliente{display:inline-flex;align-items:center;gap:6px;margin-left:14px;font:12px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;color:#8fbf98;letter-spacing:.04em;white-space:nowrap}' +
    '.pix-cliente select{background:rgba(0,255,65,.06);color:#c8ffd0;border:1px solid rgba(0,255,65,.35);border-radius:0;padding:5px 6px;font:inherit;max-width:180px;cursor:pointer}' +
    '.pix-cliente select:focus-visible{outline:2px solid #00ff41;outline-offset:2px}' +
    '@media(max-width:900px){.pix-cliente>span{display:none}.pix-cliente{margin-left:8px}}';
  (document.head || document.documentElement).appendChild(style);

  var label = document.createElement('label');
  label.className = 'pix-cliente';
  label.innerHTML = '<span>' + (EN ? 'Client:' : 'Cliente:') + '</span><select id="pix-cliente"></select>';
  var select = label.querySelector('select');
  select.setAttribute('aria-label', EN ? 'Active client' : 'Cliente activo');
  select.addEventListener('change', function () { fijar(select.value); });

  function pintar() {
    var opciones = lista.slice();
    if (actual && !opciones.some(function (c) { return c.id === actual.id; })) opciones.push(actual);
    select.innerHTML = '';
    var todos = document.createElement('option'); todos.value = ''; todos.textContent = EN ? 'All' : 'Todos'; select.appendChild(todos);
    opciones.forEach(function (c) { var o = document.createElement('option'); o.value = c.id; o.textContent = c.nombre; select.appendChild(o); });
    select.value = actual ? actual.id : '';
  }
  // La barra canónica la monta site-nav.js (y en la home, cuadratura.js de forma diferida).
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
  // Si la barra se rehace, el selector vuelve a su sitio.
  new MutationObserver(function () { if (!label.isConnected) colocar(); }).observe(document.body, {childList: true, subtree: true});

  function normaliza(data) {
    return (Array.isArray(data) ? data : []).filter(function (c) {
      return c && slug(c.id) && c.nombre && Array.isArray(c.patas) && (c.patas.indexOf(PATA) >= 0 || c.patas.indexOf('todas') >= 0);
    }).map(function (c) { return {id: slug(c.id), nombre: String(c.nombre).slice(0, 80)}; });
  }
  function cargar(url, opts) { return fetch(url, opts).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(normaliza); }
  cargar(CLIENTES_URL, {credentials: 'omit', cache: 'no-store'})
    .then(function (l) { if (!l.length) throw new Error('vacia'); return l; })
    .catch(function () { return cargar(CLIENTES_RESPALDO, {cache: 'no-store'}); })
    .catch(function () { return []; })
    .then(function (l) {
      lista = l.sort(function (a, b) { return a.nombre.localeCompare(b.nombre, 'es', {sensitivity: 'base'}); });
      var c = actual && lista.filter(function (x) { return x.id === actual.id; })[0];
      // Un id que no está en la lista (enlace viejo o mal escrito) vuelve a «Todos».
      actual = c ? {id: c.id, nombre: c.nombre} : (lista.length ? null : actual);
      guardar(); pintar(); avisar();
    });
  guardar();

  // Los enlaces a las otras patas (store, tv, app, biz, admiranext) llevan el cliente activo.
  var PATAS = /(^|\.)(admiranext\.com|admira\.(store|tv|app|biz))$/i;
  document.addEventListener('click', function (e) {
    var a = actual && e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    try { var u = new URL(a.href, location.href); if (!PATAS.test(u.hostname) || u.searchParams.has('cliente')) return; u.searchParams.set('cliente', actual.id); a.href = u.href; } catch (_) {}
  }, true);

  window.PixeriaCliente = {
    actual: function () { return actual ? {id: actual.id, nombre: actual.nombre} : null; },
    lista: function () { return lista.slice(); },
    fijar: fijar
  };
})();
