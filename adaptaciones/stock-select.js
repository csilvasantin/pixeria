/* Adaptaciones · paso 1 · tarjeta Stock (Carlos, 4-oct-2026, 21:41).
 * Script clásico e independiente del módulo adaptaciones.js: si el módulo (o uno de sus imports)
 * falla en un navegador, el desplegable del Stock se llena igual y nunca se queda vacío en silencio.
 * - Contador en el texto de la tarjeta: «Ready-made 774 videos…» / «774 vídeos listos…», con el
 *   cliente activo (Admira = todo; /marca <cliente> = filtrado) y en directo (evento pixeria:cliente).
 *   Mientras carga, «…»; nunca un número inventado.
 * - Índice: /stock-index (mismo dominio, comprimido) y, si no da JSON, el bucket público con CORS.
 *   Cada intento tiene tiempo máximo; si todo falla, mensaje claro en la tarjeta y en el desplegable.
 */
(function () {
  var EN = (document.documentElement.lang || '').toLowerCase().indexOf('en') === 0;
  var t = function (es, en) { return EN ? en : es; };
  var $ = function (s) { return document.querySelector(s); };
  var ORIGENES = ['/stock-index', 'https://stock.admira.store/stock/index.json'];
  var ESPERA_MS = 20000, ESPERA_CLIENTE_MS = 4000;
  var videos = null, error = false, esperaAgotada = false;

  function placeholder(texto) { var o = $('#src-select option[value=""]'); if (o) o.textContent = texto; }
  function contador(texto) { var n = $('#stock-count'); if (n) n.textContent = texto; }
  function aviso(texto) { var s = $('#stock-status'); if (s) s.textContent = texto || ''; }

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
      var items = (data && Array.isArray(data.items) ? data.items : []).filter(function (it) {
        var u = it && it.type === 'video' && (it.url || it.mediaUrl);
        return u && /^https:\/\//.test(u);
      });
      if (!items.length) throw new Error(url + ' sin vídeos');
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

  // ¿Se pidió un cliente que no es Admira y su lista aún no ha llegado? Se espera un poco para no
  // enseñar un número que cambie al momento; Admira lo ve todo y no espera.
  function clientePendiente() {
    try {
      var q = new URLSearchParams(location.search).get('cliente');
      var g = JSON.parse(localStorage.getItem('pixeria:cliente:v2') || 'null');
      var id = String(q != null ? q : (g && g.id) || '').toLowerCase();
      return !!id && !/^(admira|todos|todas|all|off|ninguno)$/.test(id);
    } catch (_) { return false; }
  }
  function visibles() {
    var PC = window.PixeriaCliente, listo = !!(PC && PC.listo && PC.listo());
    if (!listo) return {lista: videos, activo: null};
    try {
      var activo = !PC.esDefecto() && PC.actual();
      return {lista: videos.filter(function (it) { return PC.visible(it); }), activo: activo || null};
    } catch (e) { return {lista: videos, activo: null}; } // si el filtro falla, Admira: todo
  }
  function pintar() {
    var select = $('#src-select');
    if (!select) return;
    if (error) {
      contador('—'); placeholder(t('Stock no disponible · sube un vídeo', 'Stock unavailable · upload a video'));
      aviso(t('No se ha podido leer el Stock ahora mismo. Recarga la página o sube tu vídeo.', 'The Stock could not be loaded right now. Reload the page or upload your video.'));
      return;
    }
    var PC = window.PixeriaCliente;
    if (!videos || (!(PC && PC.listo && PC.listo()) && clientePendiente() && !esperaAgotada)) { contador('…'); placeholder(t('Cargando el Stock…', 'Loading the Stock…')); return; }
    var v = visibles(), actual = select.value, frag = document.createDocumentFragment();
    v.lista.forEach(function (it) {
      var o = document.createElement('option');
      o.value = it.url || it.mediaUrl; o.dataset.id = it.id || ''; o.dataset.title = it.title || it.name || it.id || '';
      o.textContent = 'Stock · ' + (it.title || it.name || it.id);
      frag.appendChild(o);
    });
    Array.prototype.slice.call(select.querySelectorAll('option[data-id]')).forEach(function (o) { o.remove(); });
    select.appendChild(frag);
    var nombre = v.activo ? ' · ' + v.activo.nombre : '';
    contador(String(v.lista.length));
    var cli = $('#stock-cliente'); if (cli) cli.textContent = nombre;
    if (v.lista.length) { placeholder(t('Elige un vídeo…', 'Choose a video…')); aviso(''); }
    else {
      placeholder(t('Sin vídeos para este cliente', 'No videos for this client'));
      aviso(t('Este cliente no tiene vídeos en el Stock. /marca off vuelve a Admira, que lo ve todo.', 'This client has no Stock videos. /marca off returns to Admira, which sees everything.'));
    }
    if (Array.prototype.some.call(select.options, function (o) { return o.value === actual; })) select.value = actual;
  }

  function iniciar() {
    pintar();
    setTimeout(function () { esperaAgotada = true; pintar(); }, ESPERA_CLIENTE_MS);
    document.addEventListener('pixeria:cliente', pintar);
    cargar().then(function (items) { videos = items; pintar(); }, function () { error = true; pintar(); });
  }
  window.PixeriaStock = {total: function () { return videos ? videos.length : null; }, visibles: function () { return videos ? visibles().lista.length : null; }};
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
