/* Adaptaciones · paso 1 · caja 2 «Subirlo / Importarlo» (Carlos, 5-oct-2026, 07:59).
 * Pegar una URL (YouTube, Instagram, TikTok, X, Vimeo… o un mp4 directo) e importarla con el
 * MISMO mecanismo que Stock: import-failover.mjs con Mac Studio, Mac Mini y portátil,
 * por start → status → get y relevo automático antes de guardar. Al llegar, el vídeo entra como si se hubiera
 * subido del equipo (#src-file → setSource), pasa solo a «Adaptar» y se guarda en el Stock como las
 * importaciones del Stock (POST /stock-publish → /stock/publish), con la etiqueta del cliente activo.
 * Un mp4 directo se descarga desde el navegador (si su servidor lo permite por CORS).
 * Subida por partes (9-oct-2026): con el mismo cliente que las exportaciones del Adaptador
 * (stock-publish.mjs · stockSource). Hasta 8 MB va en base64; por encima sube crudo y en trozos por
 * /stock-upload/* y se publica con r2Staged. En base64, desde unos 40 MB el Worker se quedaba sin
 * memoria (503). Tope: 500 MB, el del Adaptador.
 */
(function () {
  var EN = (document.documentElement.lang || '').toLowerCase().indexOf('en') === 0;
  var t = function (es, en) { return EN ? en : es; };
  var $ = function (s) { return document.querySelector(s); };
  var MAX_BYTES = 100 * 1024 * 1024;
  var CLIENTE_STOCK = '/adaptaciones/stock-publish.mjs'; // el mismo módulo que importa adaptaciones.js
  var DIRECTO = /\.(mp4|m4v|mov|webm)(?:[?#]|$)/i;
  var enCurso = false;

  function estado(txt, tipo) {
    var p = $('#imp-status'); if (!p) return;
    p.textContent = txt || ''; p.className = 'imp-status' + (tipo ? ' is-' + tipo : '');
    var box = $('#imp-prog'); if (box) box.hidden = !txt;
  }
  function barra(pct) {
    var b = $('#imp-bar'); if (!b) return;
    b.classList.toggle('is-indet', pct == null);
    b.firstElementChild.style.width = pct == null ? '' : Math.max(2, Math.min(100, pct)) + '%';
  }
  function mb(n) { return (n / 1048576).toFixed(1).replace('.', EN ? '.' : ',') + ' MB'; }
  async function leer(resp, total, alAvanzar) {
    var lector = resp.body && resp.body.getReader ? resp.body.getReader() : null;
    if (!lector) return resp.blob();
    var trozos = [], n = 0;
    for (;;) {
      var x = await lector.read(); if (x.done) break;
      trozos.push(x.value); n += x.value.byteLength;
      if (n > MAX_BYTES) { try { lector.cancel(); } catch (_) {} throw new Error(t('El vídeo pasa de 100 MB, el máximo del Adaptador.', 'The video is over 100 MB, the Adapter maximum.')); }
      alAvanzar(n, total);
    }
    return new Blob(trozos, {type: resp.headers.get('content-type') || 'video/mp4'});
  }
  async function porTube(url) {
    var module = await import('/assets/import-failover.mjs?v=import-ha-20261018-16');
    var result = await module.downloadWithFailover({url: url, format: 'video', maxBytes: MAX_BYTES,
      onProgress: function (state) {
        estado(state.phase === 'switching' ? t('Continuando la importación automáticamente…', 'Continuing the import automatically…')
          : t('Importando contenido… ', 'Importing media… ') + (state.bytes ? mb(state.bytes) : ''));
        barra(state.total ? state.bytes / state.total * 100 : null);
      }});
    return {blob: result.blob, titulo: result.title, motor: 'yt-dlp', via: result.kind};
  }
  async function directo(url) {
    estado(t('Descargando el archivo…', 'Downloading the file…')); barra(null);
    var r;
    try { r = await fetch(url, {credentials: 'omit'}); }
    catch (_) { throw new Error(t('El servidor de ese archivo no deja descargarlo desde el navegador. Descárgalo y súbelo desde tu equipo.', 'That file\'s server does not allow downloading it from the browser. Download it and upload it from your computer.')); }
    if (!r.ok) throw new Error('HTTP ' + r.status);
    var total = +r.headers.get('content-length') || 0;
    if (total > MAX_BYTES) throw new Error(t('El vídeo pasa de 100 MB, el máximo del Adaptador.', 'The video is over 100 MB, the Adapter maximum.'));
    var blob = await leer(r, total, function (n, tot) { estado(t('Descargando… ', 'Downloading… ') + mb(n) + (tot ? ' / ' + mb(tot) : '')); barra(tot ? n / tot * 100 : null); });
    if (!/^video\//.test(blob.type) && !DIRECTO.test(url)) throw new Error(t('Esa URL no es un vídeo.', 'That URL is not a video.'));
    var nombre = decodeURIComponent((new URL(url).pathname.split('/').pop() || 'video').replace(/\.[^.]+$/, ''));
    return {blob: blob, titulo: nombre, motor: 'import', via: 'directo'};
  }
  // Entra como una subida del equipo: el Adaptador ya sabe tratar #src-file (setSource, ficha técnica).
  function elegir(res) {
    var input = $('#src-file'); if (!input || typeof DataTransfer !== 'function') throw new Error(t('Este navegador no permite usar el vídeo importado.', 'This browser cannot use the imported video.'));
    var nombre = (res.titulo || 'video').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 120) || 'video';
    var file = new File([res.blob], nombre + '.mp4', {type: res.blob.type && /^video\//.test(res.blob.type) ? res.blob.type : 'video/mp4'});
    window.PixeriaImportar.ultimo = {file: file, url: res.url, motor: res.motor, via: res.via}; // la ficha técnica lo enseña como «Importado»
    var dt = new DataTransfer(); dt.items.add(file); input.files = dt.files;
    input.dispatchEvent(new Event('change', {bubbles: true}));
    // En cuanto el vídeo esté listo (loadedmetadata habilita «Adaptar →»), pasa solo al paso 2.
    var video = $('#src'), btn = $('#btn-adaptar');
    if (video && btn) video.addEventListener('loadedmetadata', function () { setTimeout(function () { if (!btn.disabled) btn.click(); }, 0); }, {once: true});
    return file;
  }
  function clienteActivo() {
    try { var PC = window.PixeriaCliente; if (PC && PC.listo && PC.listo() && !PC.esDefecto()) return PC.actual(); } catch (_) {}
    return null;
  }
  // Guardado en el Stock, como las importaciones del Stock; con el cliente activo como etiqueta.
  // onProgress(bytes, total) informa de la subida por partes (solo por encima de 8 MB).
  async function alStock(res, url, file, onProgress) {
    var SP = await import(CLIENTE_STOCK);
    var fuente = await SP.stockSource(file, {motor: res.motor, type: 'video', mime: 'video/mp4', onProgress: onProgress || null});
    if (!fuente.ok) {
      return {ok: false, error: fuente.error === 'too-big'
        ? t('pesa más de ' + (SP.MAX_STOCK_BYTES / 1048576) + ' MB (tope de subida al Stock)', 'over ' + (SP.MAX_STOCK_BYTES / 1048576) + ' MB (Stock upload limit)')
        : fuente.error};
    }
    var cli = clienteActivo();
    var body = Object.assign({type: 'video', motor: res.motor, mime: 'video/mp4', title: res.titulo || null, prompt: url,
      tags: cli ? [cli.id] : [], costEst: (res.motor === 'yt-dlp' ? 'gratis · ' : 'import · ') + (file.size / 1048576).toFixed(2) + 'MB · adaptador'}, fuente.fields);
    try { var orientation = await import('/assets/content-orientation.mjs?v=orientation-1'); body.dimensions = await orientation.readMediaDimensions(file, 'video'); } catch (_) {}
    try { var m = await import('/assets/poster-frame.mjs'); var u = URL.createObjectURL(file); try { var p = await m.posterFromVideo(u); if (p) body.poster = p; } finally { URL.revokeObjectURL(u); } } catch (_) {}
    var r = await fetch('/stock-publish', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});
    var d = {}; try { d = await r.json(); } catch (_) {}
    if (!r.ok || d.ok === false || d.error) return {ok: false, error: d.error || 'HTTP ' + r.status};
    return {ok: true, id: d.id, reused: !!d.reused, cliente: cli};
  }
  async function importar(url) {
    if (enCurso) return; enCurso = true;
    var form = $('#imp-form'), go = $('#imp-go'); if (form) form.setAttribute('aria-busy', 'true'); if (go) go.disabled = true;
    try {
      var res = DIRECTO.test(url) ? await directo(url) : await porTube(url);
      res.url = url;
      barra(100);
      var file = elegir(res);
      estado(t('✓ Importado (' + mb(file.size) + '): pasando a Adaptar… · guardando en el Stock…', '✓ Imported (' + mb(file.size) + '): moving to Adapt… · saving to the Stock…'), 'ok');
      var guardando = t('✓ Importado (' + mb(file.size) + '): pasando a Adaptar… · guardando en el Stock…', '✓ Imported (' + mb(file.size) + '): moving to Adapt… · saving to the Stock…');
      alStock(res, url, file, function (hecho, total) { estado(guardando + ' ' + Math.floor(hecho / total * 100) + ' %', 'ok'); }).then(function (s) {
        estado(s.ok ? t('✓ Importado (' + mb(file.size) + ') y guardado en el Stock' + (s.cliente ? ' · ' + s.cliente.nombre : '') + (s.id ? ' · ' + s.id : '') + '.', '✓ Imported (' + mb(file.size) + ') and saved to the Stock' + (s.cliente ? ' · ' + s.cliente.nombre : '') + (s.id ? ' · ' + s.id : '') + '.')
          : t('✓ Importado (' + mb(file.size) + '). No se ha guardado en el Stock: ' + s.error + '.', '✓ Imported (' + mb(file.size) + '). Not saved to the Stock: ' + s.error + '.'), s.ok ? 'ok' : 'warn');
      }, function (e) { estado(t('✓ Importado. No se ha guardado en el Stock: ', '✓ Imported. Not saved to the Stock: ') + (e && e.message || e), 'warn'); });
      var inp = $('#imp-url'); if (inp) inp.value = '';
    } catch (e) {
      barra(0); estado('✗ ' + String(e && e.message || e), 'err');
    } finally {
      enCurso = false; if (form) form.removeAttribute('aria-busy'); if (go) go.disabled = false;
    }
  }
  function iniciar() {
    var form = $('#imp-form'), inp = $('#imp-url'); if (!form || !inp) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var url = (inp.value || '').trim().split(/\s+/)[0] || '';
      if (!/^https?:\/\/\S+$/i.test(url)) { estado(t('Pega una URL que empiece por http:// o https://', 'Paste a URL starting with http:// or https://'), 'err'); inp.focus(); return; }
      importar(url);
    });
    // Pegar una URL ya la importa (como en el Stock al pulsar 📥), sin tener que pulsar Enter.
    inp.addEventListener('paste', function () { setTimeout(function () { if (/^https?:\/\/\S+$/i.test((inp.value || '').trim())) form.requestSubmit(); }, 0); });
  }
  window.PixeriaImportar = {importar: importar, alStock: alStock};
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
