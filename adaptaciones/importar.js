/* Adaptaciones · paso 1 · caja 2 «Subirlo / Importarlo» (Carlos, 5-oct-2026, 07:59).
 * Pegar una URL (YouTube, Instagram, TikTok, X, Vimeo… o un mp4 directo) e importarla con el
 * MISMO mecanismo que el Stock (app.js · bindImportModal): admira-tube (yt-dlp en el Mac Mini, con
 * el MacBook Pro de respaldo) por start → status → get. Al llegar, el vídeo entra como si se hubiera
 * subido del equipo (#src-file → setSource), pasa solo a «Adaptar» y se guarda en el Stock como las
 * importaciones del Stock (POST /stock-publish → /stock/publish), con la etiqueta del cliente activo.
 * Un mp4 directo se descarga desde el navegador (si su servidor lo permite por CORS).
 */
(function () {
  var EN = (document.documentElement.lang || '').toLowerCase().indexOf('en') === 0;
  var t = function (es, en) { return EN ? en : es; };
  var $ = function (s) { return document.querySelector(s); };
  var TUBES = [
    {kind: 'admira-tube', base: 'https://macmini.tail48b61c.ts.net/admira/tube'},
    {kind: 'admira-tube-backup', base: 'https://macbook-pro-16.tail48b61c.ts.net/admira/tube'}
  ];
  var MAX_BYTES = 100 * 1024 * 1024, MAX_STOCK = 70 * 1024 * 1024, MAX_MS = 6 * 60 * 1000;
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
  function espera(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function conTiempo(url, opts, ms) {
    var c = new AbortController(), r = setTimeout(function () { c.abort(); }, ms || 4500);
    return fetch(url, Object.assign({signal: c.signal, cache: 'no-store'}, opts || {})).finally(function () { clearTimeout(r); });
  }
  async function errorLegible(r) {
    var txt = '', d = null; try { txt = await r.text(); d = JSON.parse(txt); } catch (_) {}
    if (d && typeof d === 'object') {
      if (d.message) return String(d.message);
      var base = String(d.error || 'HTTP ' + r.status);
      if (Array.isArray(d.allowed)) return base + (d.host ? ' (' + d.host + ')' : '') + '. ' + t('Hosts permitidos: ', 'Allowed hosts: ') + d.allowed.join(', ') + '.';
      return base;
    }
    return 'HTTP ' + r.status;
  }
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
  async function tubeSano() {
    for (var i = 0; i < TUBES.length; i++) {
      estado(t('Comprobando el importador…', 'Checking the importer…')); barra(null);
      try { var r = await conTiempo(TUBES[i].base + '/health'); if (r.ok) { var j = {}; try { j = await r.json(); } catch (_) {} if (j.ok !== false && j.available !== false) return TUBES[i]; } } catch (_) {}
    }
    return null;
  }
  // Mismo flujo que el Stock: start → status (cada 1,5 s) → get.
  async function porTube(url) {
    var ep = await tubeSano();
    if (!ep) throw new Error(t('El importador (yt-dlp en el Mac Mini y su respaldo) no responde ahora mismo. Reintenta en unos segundos o sube el vídeo desde tu equipo.', 'The importer (yt-dlp on the Mac Mini and its backup) is not answering right now. Retry in a few seconds or upload the video from your computer.'));
    var r = await fetch(ep.base + '/start', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({url: url, format: 'video'})});
    if (!r.ok) throw new Error(await errorLegible(r));
    var id = (await r.json()).jobId; if (!id) throw new Error(t('El importador no ha devuelto trabajo.', 'The importer returned no job.'));
    var t0 = Date.now(), titulo = '';
    for (;;) {
      await espera(1500);
      if (Date.now() - t0 > MAX_MS) throw new Error(t('El importador tarda más de 6 minutos; prueba con un vídeo más corto.', 'The importer is taking over 6 minutes; try a shorter video.'));
      var st; try { st = await (await fetch(ep.base + '/status?id=' + encodeURIComponent(id), {cache: 'no-store'})).json(); } catch (_) { continue; }
      if (st.title) titulo = st.title;
      if (st.state === 'running') { estado(t('Descargando con yt-dlp… ', 'Downloading with yt-dlp… ') + mb(st.size || 0) + ' · ' + Math.round((Date.now() - t0) / 1000) + ' s'); barra(null); continue; }
      if (st.state === 'done') break;
      throw new Error(st.error || t('El importador no ha podido con esta URL.', 'The importer could not handle this URL.'));
    }
    var g = await fetch(ep.base + '/get?id=' + encodeURIComponent(id), {cache: 'no-store'});
    if (!g.ok) throw new Error(await errorLegible(g));
    try { titulo = decodeURIComponent(g.headers.get('X-Tube-Title') || '') || titulo; } catch (_) {}
    var total = +g.headers.get('content-length') || 0;
    var blob = await leer(g, total, function (n, tot) { estado(t('Recibiendo… ', 'Receiving… ') + mb(n) + (tot ? ' / ' + mb(tot) : '')); barra(tot ? n / tot * 100 : null); });
    return {blob: blob, titulo: titulo, motor: 'yt-dlp', via: ep.kind};
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
  function base64(blob) {
    return new Promise(function (ok, ko) { var fr = new FileReader(); fr.onload = function () { ok(String(fr.result).replace(/^data:[^,]*,/, '')); }; fr.onerror = function () { ko(fr.error); }; fr.readAsDataURL(blob); });
  }
  // Guardado en el Stock, como las importaciones del Stock; con el cliente activo como etiqueta.
  async function alStock(res, url, file) {
    if (file.size > MAX_STOCK) return {ok: false, error: t('pesa más de 70 MB (tope de subida al Stock)', 'over 70 MB (Stock upload limit)')};
    var cli = clienteActivo();
    var body = {type: 'video', motor: res.motor, mime: 'video/mp4', base64: await base64(file), title: res.titulo || null, prompt: url,
      tags: cli ? [cli.id] : [], costEst: (res.motor === 'yt-dlp' ? 'gratis · ' : 'import · ') + (file.size / 1048576).toFixed(2) + 'MB · adaptador'};
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
      alStock(res, url, file).then(function (s) {
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
  window.PixeriaImportar = {importar: importar};
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
