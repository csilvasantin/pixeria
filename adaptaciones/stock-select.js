/* Adaptaciones · paso 1 · tarjeta Stock (Carlos, 4-oct-2026, 21:41 y 21:49).
 * Script clásico e independiente del módulo adaptaciones.js: si el módulo (o uno de sus imports)
 * falla en un navegador, el Stock se lista igual y nunca se queda vacío en silencio.
 * - Selector propio contenido en la tarjeta (#stock-pick + #stock-list, listbox con teclado): títulos
 *   decodificados y truncados con elipsis (completo en el tooltip), miniatura si el índice la trae.
 *   El <select id="src-select"> oculto sigue siendo el modelo: al elegir se fija su valor y se lanza
 *   `change`, que es lo que escucha adaptaciones.js (setSource → paso 2).
 * - Combo de hashtags (#stock-tag + datalist): tags del índice (campo `tags`) y #hashtags de title,
 *   prompt y comment, del Stock del cliente activo, por frecuencia y con el número. Vacío = todos.
 * - Contador «Ready-made N videos…» / «N vídeos listos…» = cliente activo (Admira = todo;
 *   /marca <cliente> = filtrado) ∩ hashtag, en directo, en singular con 1. Cargando «…»; Stock caído «—».
 * - Al aplicar un hashtag (elegido del datalist, Enter o PixeriaStock.tag) la caja muestra ya la
 *   coincidencia más reciente (createdAt del índice) y carga su vista previa; las demás siguen debajo en
 *   el mismo orden. Enter en el campo o en la caja = «Adaptar →». Sin coincidencias: sin preselección y aviso.
 * - Imágenes (Carlos, 5-oct-2026): además de los vídeos entran las imágenes JPG, PNG y WebP del Stock,
 *   marcadas «Imagen», en la misma lista y por fecha (más reciente primero): qué entra y en qué orden lo
 *   decide ./stock-fuentes.js. La opción del <select> lleva data-type="image" para que adaptaciones.js
 *   cargue la imagen fija en vez de un vídeo.
 */
(function () {
  var EN = (document.documentElement.lang || '').toLowerCase().indexOf('en') === 0;
  var t = function (es, en) { return EN ? en : es; };
  var $ = function (s) { return document.querySelector(s); };
  var ORIGENES = ['/stock-index', 'https://stock.admira.store/stock/index.json'];
  var ESPERA_MS = 20000, ESPERA_CLIENTE_MS = 4000;
  var F = window.PixeriaStockFuentes;
  var videos = null, error = false, esperaAgotada = false, tagActivo = '', tagAplicado = null, mostrados = [];

  var dec = document.createElement('textarea');
  function decodificar(s) { dec.innerHTML = String(s == null ? '' : s); return dec.value; }
  function titulo(it) { return decodificar(it.title || it.name || it.id || '').replace(/^Stock\s*·\s*/i, '').replace(/\s+/g, ' ').trim(); }
  function norm(tag) { return decodificar(tag).toLowerCase().trim().replace(/^#+/, '').replace(/[-_.]+$/, ''); }
  // Tags de un vídeo: campo `tags` + #hashtags del texto (sin números sueltos como el #39 de &#39;).
  function tagsDe(it) {
    if (it._tags) return it._tags;
    var s = {};
    (Array.isArray(it.tags) ? it.tags : []).forEach(function (x) { var n = norm(x); if (n && !/^\d+$/.test(n)) s[n] = 1; });
    [it.title, it.name, it.prompt, it.comment].forEach(function (txt) {
      var m, re = /#([^\s#.,;:!?¡¿()\[\]{}"'<>|\/\\]+)/g, d = decodificar(txt || '');
      while ((m = re.exec(d))) { var n = norm(m[1]); if (n && !/^\d+$/.test(n)) s[n] = 1; }
    });
    // Suno es un motor oculto: su etiqueta se ve como #pixeria-music.
    return (it._tags = Object.keys(s).map(function (g) { return /^suno/.test(g) ? 'pixeria-music' : g; }).filter(function (g, i, l) { return l.indexOf(g) === i; }));
  }

  // «N vídeos listos», «N imágenes listas» o «N vídeos e imágenes listos», según lo que se ve.
  function contador(texto, lista) {
    var n = $('#stock-count'); if (n) n.textContent = texto;
    var w = $('#stock-nombre'); if (!w) return;
    var img = (lista || []).filter(function (it) { return F.tipo(it) === 'image'; }).length, vid = (lista || []).length - img, uno = texto === '1';
    w.textContent = img && vid ? t('vídeos e imágenes listos', 'videos and images')
      : img ? (uno ? t('imagen lista', 'image') : t('imágenes listas', 'images'))
      : uno ? t('vídeo listo', 'video') : t('vídeos listos', 'videos');
  }
  function aviso(texto) { var s = $('#stock-status'); if (s) s.textContent = texto || ''; }
  function boton(texto, full) { var b = $('#stock-pick .stk-btn-txt'); if (b) { b.textContent = texto; b.parentNode.title = full || ''; } }

  function pedir(url) {
    var ctl = typeof AbortController === 'function' ? new AbortController() : null;
    var reloj = ctl ? setTimeout(function () { ctl.abort(); }, ESPERA_MS) : 0;
    var opts = url.charAt(0) === '/' ? {redirect: 'manual', credentials: 'same-origin', cache: 'no-store'} : {credentials: 'omit', cache: 'no-store'};
    if (ctl) opts.signal = ctl.signal;
    return fetch(url, opts).then(function (r) {
      // Sin sesión, la verja redirige /stock-index a /auth/login (opaqueredirect): siguiente origen.
      if (!r.ok || !/json/i.test(r.headers.get('content-type') || '')) throw new Error(url + ' ' + (r.status || r.type));
      return r.json();
    }).then(function (data) {
      // Vídeos e imágenes (JPG, PNG, WebP) con URL https, el más reciente primero.
      var items = F.fuentes(data && data.items);
      if (!items.length) throw new Error(url + ' sin vídeos ni imágenes');
      return items;
    }).finally(function () { clearTimeout(reloj); });
  }
  function cargar(i) {
    i = i || 0;
    return pedir(ORIGENES[i]).catch(function (e) {
      try { console.warn('[stock]', e && e.message || e); } catch (_) {}
      if (i + 1 < ORIGENES.length) return cargar(i + 1);
      throw e;
    });
  }
  function clientePendiente() {
    try {
      var q = new URLSearchParams(location.search).get('cliente');
      var g = JSON.parse(localStorage.getItem('pixeria:cliente:v2') || 'null');
      var id = String(q != null ? q : (g && g.id) || '').toLowerCase();
      return !!id && !/^(admira|todos|todas|all|off|ninguno)$/.test(id);
    } catch (_) { return false; }
  }
  function delCliente() {
    var PC = window.PixeriaCliente, listo = !!(PC && PC.listo && PC.listo());
    if (!listo) return {lista: videos, activo: null};
    try {
      var activo = !PC.esDefecto() && PC.actual();
      return {lista: videos.filter(function (it) { return PC.visible(it); }), activo: activo || null};
    } catch (e) { return {lista: videos, activo: null}; } // si el filtro falla, Admira: todo
  }

  // ─── Combo de hashtags ───
  function pintarTags(lista) {
    var cuenta = {};
    lista.forEach(function (it) { tagsDe(it).forEach(function (g) { cuenta[g] = (cuenta[g] || 0) + 1; }); });
    var orden = Object.keys(cuenta).sort(function (a, b) { return cuenta[b] - cuenta[a] || a.localeCompare(b, 'es', {sensitivity: 'base'}); });
    var dl = $('#stock-tags'); if (!dl) return orden;
    var frag = document.createDocumentFragment();
    orden.forEach(function (g) { var o = document.createElement('option'); o.value = '#' + g; o.label = '#' + g + ' (' + cuenta[g] + ')'; o.textContent = '(' + cuenta[g] + ')'; frag.appendChild(o); });
    dl.innerHTML = ''; dl.appendChild(frag);
    window.PixeriaStock._tags = orden.map(function (g) { return {tag: g, n: cuenta[g]}; });
    return orden;
  }
  function leerTag() {
    var inp = $('#stock-tag'), v = inp ? norm(inp.value) : '';
    tagActivo = v;
    if (v !== tagAplicado) tagAplicado = null;
    var clr = $('#stock-tag-clear'); if (clr) clr.hidden = !inp || !inp.value;
    pintar();
  }
  // Coincidencia más reciente del filtro: mayor createdAt del índice (o el sello del id); empate = la primera.
  function fecha(it) { return F.fecha(it); }
  function masReciente(lista) { var r = null; lista.forEach(function (it) { if (!r || fecha(it) > fecha(r)) r = it; }); return r; }
  // Aplica el hashtag del campo: filtra y preselecciona la coincidencia más reciente (vista previa incluida).
  function aplicarTag() {
    var inp = $('#stock-tag'); tagAplicado = inp ? norm(inp.value) || null : null;
    leerTag();
    if (!tagActivo || !videos) return;
    var it = masReciente(mostrados);
    if (!it) return; // pintar() ya muestra el aviso de «sin coincidencias»
    var url = it.url || it.mediaUrl, li = Array.prototype.slice.call($('#stock-list').querySelectorAll('li[role=option]')).filter(function (x) { return x.dataset.url === url; })[0];
    if (li) elegir(li, {sinFoco: true});
  }
  // Enter = «Adaptar →» con el vídeo de la caja; si aún carga, en cuanto el botón se habilite.
  var esperaAdaptar = null;
  function adaptar() {
    var btn = $('#btn-adaptar'), select = $('#src-select'); if (!btn || !select || !select.value) return false;
    if (!btn.disabled) { btn.click(); return true; }
    if (esperaAdaptar) esperaAdaptar.disconnect();
    var obs = esperaAdaptar = new MutationObserver(function () { if (!btn.disabled) { obs.disconnect(); esperaAdaptar = null; btn.click(); } });
    obs.observe(btn, {attributes: true, attributeFilter: ['disabled']});
    setTimeout(function () { obs.disconnect(); if (esperaAdaptar === obs) esperaAdaptar = null; }, 20000);
    return true;
  }

  // ─── Lista propia ───
  var abierta = false;
  function abrir(foco) {
    var ul = $('#stock-list'), b = $('#stock-pick');
    if (!ul || !b || !mostrados.length) return;
    ul.hidden = false; abierta = true; b.setAttribute('aria-expanded', 'true');
    var sel = ul.querySelector('li[aria-selected=true]') || ul.querySelector('li[role=option]');
    if (foco !== false && sel) { sel.focus(); sel.scrollIntoView({block: 'nearest'}); }
  }
  function cerrar(devolverFoco) {
    var ul = $('#stock-list'), b = $('#stock-pick');
    if (!ul || ul.hidden) return;
    ul.hidden = true; abierta = false; if (b) b.setAttribute('aria-expanded', 'false');
    if (devolverFoco && b) b.focus();
  }
  function elegir(li, op) {
    var select = $('#src-select'); if (!select || !li) return;
    select.value = li.dataset.url;
    $('#stock-list').querySelectorAll('li[aria-selected=true]').forEach(function (x) { x.setAttribute('aria-selected', 'false'); });
    li.setAttribute('aria-selected', 'true');
    boton(li.dataset.title, li.dataset.title);
    cerrar(!(op && op.sinFoco));
    select.dispatchEvent(new Event('change', {bubbles: true}));
  }
  // Vídeo aún sin miniatura en el índice (recién subido): el fotograma lo saca el navegador al hacerse
  // visible, con un <video preload=metadata> en el segundo 1 (#t=1), en vez de dejar el recuadro vacío.
  var io = null;
  // Si ni la miniatura ni el vídeo se pueden decodificar, un icono neutro con aviso (no una imagen inventada).
  function sinVista() {
    var s = document.createElement('span'); s.className = 'stk-ph stk-sin';
    s.title = EN ? 'No preview available' : 'Sin vista previa'; s.setAttribute('aria-label', s.title);
    return s;
  }
  // Misma URL en modo CORS que usará el Adaptador (corsURL de adaptaciones.js): comparten caché.
  function corsDe(u) { try { var uu = new URL(u, location.href); if (uu.origin !== location.origin) { uu.searchParams.set('cors', '1'); return uu.href; } } catch (_) {} return u; }
  function fotogramaEnCliente(ph) {
    var v = document.createElement('video');
    v.className = 'stk-ph stk-vid'; v.muted = true; v.playsInline = true; v.preload = 'metadata';
    v.setAttribute('aria-hidden', 'true'); v.tabIndex = -1;
    v.onerror = function () { v.replaceWith(sinVista()); };
    // Modo CORS y la misma URL que usará el Adaptador: así la copia en caché sirve también para adaptar.
    v.crossOrigin = 'anonymous';
    var su = corsDe(ph.dataset.video);
    v.src = su + (su.indexOf('#') < 0 ? '#t=1' : '');
    ph.replaceWith(v);
  }
  function observarSinMiniatura(ph) {
    if (!('IntersectionObserver' in window)) return fotogramaEnCliente(ph);
    if (!io) io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { io.unobserve(e.target); fotogramaEnCliente(e.target); } }); }, {root: $('#stock-list'), rootMargin: '200px'});
    io.observe(ph);
  }
  function pintarLista(lista) {
    var ul = $('#stock-list'), select = $('#src-select'); if (!ul || !select) return;
    var actual = select.value, fragL = document.createDocumentFragment(), fragS = document.createDocumentFragment();
    lista.forEach(function (it, i) {
      var url = it.url || it.mediaUrl, tit = titulo(it), tipo = F.tipo(it), esImg = tipo === 'image';
      // Una imagen sin miniatura en el índice es su propia miniatura (carga perezosa).
      var img = it.poster || it.thumbnail || (esImg ? url : null);
      var li = document.createElement('li');
      li.setAttribute('role', 'option'); li.tabIndex = -1; li.id = 'stk-o' + i;
      li.dataset.url = url; li.dataset.title = tit; li.dataset.type = tipo; li.title = tit;
      li.setAttribute('aria-selected', url === actual ? 'true' : 'false');
      // La imagen que hace de su propia miniatura se pide en modo CORS con la URL del Adaptador: al
      // elegirla, el canvas reutiliza esa copia (con Access-Control-Allow-Origin) en vez de una sin CORS.
      var propia = esImg && img === url;
      if (img && /^https:\/\//.test(img)) { var im = document.createElement('img'); im.loading = 'lazy'; im.decoding = 'async'; im.alt = ''; if (propia) im.crossOrigin = 'anonymous'; im.src = propia ? corsDe(img) : img; im.onerror = esImg ? function () { this.replaceWith(sinVista()); } : function () { var ph = document.createElement('span'); ph.className = 'stk-ph'; ph.dataset.video = url; this.replaceWith(ph); observarSinMiniatura(ph); }; li.appendChild(im); }
      else { var ph = document.createElement('span'); ph.className = 'stk-ph'; ph.dataset.video = url; li.appendChild(ph); observarSinMiniatura(ph); }
      var sp = document.createElement('span'); sp.className = 'stk-t'; sp.textContent = tit; li.appendChild(sp);
      if (esImg) { var k = document.createElement('span'); k.className = 'stk-k'; k.textContent = t('Imagen', 'Image'); li.appendChild(k); li.setAttribute('aria-label', tit + ' · ' + t('imagen', 'image')); }
      fragL.appendChild(li);
      var o = document.createElement('option'); o.value = url; o.dataset.id = it.id || ''; o.dataset.title = tit; o.dataset.type = tipo; o.textContent = tit; fragS.appendChild(o);
    });
    if (!lista.length) { var v = document.createElement('li'); v.className = 'stk-vacio'; v.textContent = t('Ningún contenido con este filtro', 'Nothing matches this filter'); fragL.appendChild(v); }
    ul.innerHTML = ''; ul.appendChild(fragL);
    Array.prototype.slice.call(select.querySelectorAll('option[data-id]')).forEach(function (o) { o.remove(); });
    select.appendChild(fragS);
    // El vídeo ya elegido se mantiene aunque el filtro lo deje fuera de la lista (no se cambia la fuente a escondidas).
    if (actual) {
      if (!lista.some(function (it) { return (it.url || it.mediaUrl) === actual; })) {
        var previo = (videos || []).filter(function (it) { return (it.url || it.mediaUrl) === actual; })[0];
        var o = document.createElement('option'); o.value = actual; o.dataset.id = previo && previo.id || ''; o.dataset.title = previo ? titulo(previo) : ''; o.dataset.type = previo ? F.tipo(previo) : 'video'; o.textContent = o.dataset.title; select.appendChild(o);
      }
      select.value = actual; var op = select.selectedOptions[0]; boton(op && op.dataset.title || actual, op && op.dataset.title);
    } else boton(lista.length ? t('Elige un vídeo o una imagen…', 'Choose a video or an image…') : t('Ningún contenido con este filtro', 'Nothing matches this filter'));
  }

  function pintar() {
    if (!$('#stock-list')) return;
    if (error) {
      contador('—'); boton(t('Stock no disponible · sube un archivo', 'Stock unavailable · upload a file')); mostrados = []; cerrar();
      aviso(t('No se ha podido leer el Stock ahora mismo. Recarga la página o sube tu vídeo o imagen.', 'The Stock could not be loaded right now. Reload the page or upload your video or image.'));
      return;
    }
    var PC = window.PixeriaCliente;
    if (!videos || (!(PC && PC.listo && PC.listo()) && clientePendiente() && !esperaAgotada)) { contador('…'); boton(t('Cargando el Stock…', 'Loading the Stock…')); return; }
    var c = delCliente();
    pintarTags(c.lista);
    var lista = tagActivo ? c.lista.filter(function (it) { return tagsDe(it).indexOf(tagActivo) >= 0; }) : c.lista;
    mostrados = lista;
    pintarLista(lista);
    contador(String(lista.length), lista);
    var cli = $('#stock-cliente'); if (cli) cli.textContent = c.activo ? ' · ' + c.activo.nombre : ''; // el tag ya se ve en su combo
    if (!c.lista.length) aviso(t('Este cliente no tiene vídeos ni imágenes en el Stock. /marca off vuelve a Admira, que lo ve todo.', 'This client has no Stock videos or images. /marca off returns to Admira, which sees everything.'));
    else if (tagAplicado && !lista.length) aviso(t('Ningún vídeo ni imagen del Stock con #' + tagAplicado + '. Prueba otro hashtag o bórralo para ver todos.', 'No Stock videos or images with #' + tagAplicado + '. Try another hashtag or clear it to see them all.'));
    else aviso('');
  }

  function teclado() {
    var b = $('#stock-pick'), ul = $('#stock-list'), inp = $('#stock-tag'), clr = $('#stock-tag-clear');
    if (b) {
      b.addEventListener('click', function () { if (abierta) cerrar(); else abrir(); });
      b.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); abrir(); }
        else if (e.key === 'Enter' && !abierta && $('#src-select') && $('#src-select').value) { e.preventDefault(); adaptar(); }
      });
    }
    if (ul) {
      ul.addEventListener('click', function (e) { var li = e.target.closest('li[role=option]'); if (li) elegir(li); });
      ul.addEventListener('keydown', function (e) {
        var items = Array.prototype.slice.call(ul.querySelectorAll('li[role=option]')), i = items.indexOf(document.activeElement), n = null;
        if (e.key === 'ArrowDown') n = items[Math.min(items.length - 1, i + 1)];
        else if (e.key === 'ArrowUp') n = items[Math.max(0, i - 1)];
        else if (e.key === 'Home') n = items[0];
        else if (e.key === 'End') n = items[items.length - 1];
        else if (e.key === 'PageDown') n = items[Math.min(items.length - 1, i + 10)];
        else if (e.key === 'PageUp') n = items[Math.max(0, i - 10)];
        else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (items[i]) elegir(items[i]); return; }
        else if (e.key === 'Escape') { e.preventDefault(); cerrar(true); return; }
        else if (e.key === 'Tab') { cerrar(); return; }
        if (n) { e.preventDefault(); n.focus(); n.scrollIntoView({block: 'nearest'}); }
      });
    }
    document.addEventListener('click', function (e) { if (abierta && !e.target.closest('.stk-pick')) cerrar(); });
    if (inp) {
      // Escribir filtra en directo; elegir del datalist (input sin inputType de tecleo) aplica el hashtag.
      inp.addEventListener('input', function (e) { if (!e.inputType || e.inputType === 'insertReplacementText') aplicarTag(); else leerTag(); });
      inp.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && inp.value) { e.preventDefault(); inp.value = ''; leerTag(); }
        else if (e.key === 'ArrowDown' && mostrados.length && tagAplicado !== null) { e.preventDefault(); abrir(); }
        else if (e.key === 'Enter') {
          e.preventDefault();
          var v = norm(inp.value);
          if (v && v !== tagAplicado) aplicarTag();          // escrito a mano: 1.º Enter aplica y preselecciona
          else if (!v || mostrados.length) adaptar();         // ya aplicado (o sin filtro): Enter = Adaptar →
        }
      });
    }
    if (clr) clr.addEventListener('click', function () { if (inp) { inp.value = ''; inp.focus(); } leerTag(); });
  }

  function iniciar() {
    teclado();
    pintar();
    setTimeout(function () { esperaAgotada = true; pintar(); }, ESPERA_CLIENTE_MS);
    document.addEventListener('pixeria:cliente', pintar);
    cargar().then(function (items) { videos = items; pintar(); }, function () { error = true; pintar(); });
  }
  window.PixeriaStock = {
    total: function () { return videos ? videos.length : null; },
    visibles: function () { return videos ? mostrados.length : null; },
    item: function (url) { return (videos || []).filter(function (it) { return (it.url || it.mediaUrl) === url; })[0] || null; },
    // 'video' | 'image' | null del contenido con esa URL.
    tipo: function (url) { var it = window.PixeriaStock.item(url); return it ? F.tipo(it) : null; },
    tags: function () { return (window.PixeriaStock._tags || []).slice(); },
    tag: function (g) { var inp = $('#stock-tag'); if (inp) { inp.value = g ? '#' + norm(g) : ''; if (g) aplicarTag(); else leerTag(); } }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
