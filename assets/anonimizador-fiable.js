/* Anonimizador fiable · Pixeria (6-oct-2026, MorfeoMacMini).
 *
 * Por qué existe: el Anonimizador fallaba con frecuencia y dejaba al usuario
 * delante de un «Error: …» crudo («unauthorized», «HTTP 200», «Generated image
 * rejected by content moderation.»…) o colgado para siempre si Grok no contestaba.
 * Este módulo, compartido por /anonimizador.html y /en/anonimizador.html, reúne:
 *
 *   · classify(err)       → motivo legible (session, timeout, declined, empty…)
 *   · tryRandomPhotos()   → con fotos aleatorias, si una no sirve se descarta y se
 *                           prueba otra, con un máximo duro (5) y sin bucles infinitos;
 *                           los motivos fatales (sesión caducada, sin red) cortan ya.
 *   · msg()/ownMessage()  → avisos breves ES/EN de cada descarte y, para la foto
 *                           PROPIA del usuario (que nunca se sustituye), qué pasó y qué hacer.
 *   · paidFetch()         → token de /auth/api-token cacheado hasta su caducidad, 401
 *                           de sesión detectado ANTES de llamar al motor, y timeout real.
 *   · prepareImage()      → decodifica y valida (MIME, tamaño, lado mínimo) antes de
 *                           mandar nada: un HEIC o un archivo roto se explica, no se envía.
 *   · mountUI()           → aviso, registro plegable de descartes y error final con
 *                           «Probar otra vez», dentro del contenido (sin cabeceras propias).
 *
 * Funciona en el navegador (window.AnonFiable) y en Node (module.exports) para los tests.
 */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AnonFiable = api;
})(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';

  var DEFAULTS = {
    maxRandom: 5,                    // fotos aleatorias como máximo por pasada
    xaiTimeoutMs: 60000,             // Grok (texto→imagen) suele tardar 5-20 s
    editTimeoutMs: 90000,            // Gemini (imagen→imagen) suele tardar 10-40 s
    editRetries: 3,                  // reintentos de saturación DENTRO de una misma foto
    maxUploadBytes: 20 * 1024 * 1024,
    minSide: 64
  };
  var config = Object.assign({}, DEFAULTS, (root && root.__anonFiableConfig) || {});

  var CODES = ['session', 'offline', 'network', 'timeout', 'declined', 'empty', 'overload',
    'bad-image', 'too-big', 'no-data', 'cors', 'unknown'];
  // Motivos que fallarían igual con cualquier otra foto: no se gastan más intentos.
  var FATAL = { session: 1, offline: 1 };

  function fail(code, message, extra) {
    var e = new Error(message || code);
    e.code = code;
    if (extra) Object.keys(extra).forEach(function (k) { e[k] = extra[k]; });
    return e;
  }
  function isOffline() {
    try { return !!(root && root.navigator && root.navigator.onLine === false); } catch (_) { return false; }
  }
  function info(code, e) {
    return {
      code: code,
      fatal: !!FATAL[code],
      status: (e && Number(e.status)) || 0,
      detail: e ? String(e.detail || e.message || '').slice(0, 200) : ''
    };
  }

  // Clasifica cualquier error del flujo (red, worker, Gemini, Grok, canvas) en un motivo.
  function classify(e) {
    if (!e) return info('unknown');
    if (e.code && CODES.indexOf(e.code) >= 0) return info(e.code, e);
    var s = Number(e.status) || 0;
    var reason = String(e.reason || '');
    var text = (String(e.message || '') + ' ' + reason + ' ' + String(e.detail || '')).toLowerCase();
    if (s === 401 || s === 403 || /unauthori[sz]ed|forbidden/.test(text)) return info('session', e);
    if (e.name === 'AbortError' || reason === 'timeout' || s === 408 || s === 504 || /timed? ?out|tiempo de espera/.test(text)) return info('timeout', e);
    if (e.name === 'SecurityError' || reason === 'cors' || /tainted|cross-origin|\bcors\b/.test(text)) return info('cors', e);
    if (reason === 'image-declined' || reason === 'safety' || reason === 'copyright' ||
        /moderation|rejected|prohibited|safety|copyright|policy/.test(text)) return info('declined', e);
    if (reason === 'empty' || /no-image-out/.test(text)) return info('empty', e);
    if (s === 413 || /too-big|too large|demasiado grande/.test(text)) return info('too-big', e);
    if (s === 415 || /unable to process input image|invalid (image|base64)|not-an-image|no es una imagen|decode/.test(text)) return info('bad-image', e);
    if (s === 429 || s >= 500 || /high demand|overload|try again|temporar|unavailable|resource_exhausted|rate.?limit|busy/.test(text)) return info('overload', e);
    if (reason === 'network' || s === 0 && /failed to fetch|networkerror|load failed|network|sin conexión|no connection/.test(text)) {
      return info(isOffline() ? 'offline' : 'network', e);
    }
    return info('unknown', e);
  }

  // ── Textos ES/EN ───────────────────────────────────────────────────────────
  var TXT = {
    es: {
      why: {
        session: 'Tu sesión de Pixeria ha caducado',
        offline: 'No hay conexión a internet',
        network: 'No hubo conexión con el motor de imagen (red o CORS)',
        timeout: 'La fuente tardó demasiado en responder',
        declined: 'El motor rechazó la foto (la tomó por persona reconocible o contenido sensible)',
        empty: 'El motor no devolvió imagen para esta foto',
        overload: 'El motor de imagen está saturado',
        'bad-image': 'La imagen llegó dañada o en un formato que no se puede leer',
        'too-big': 'La imagen es demasiado grande',
        'no-data': 'La fuente no entregó la imagen',
        cors: 'La imagen no permite procesarse en el navegador (CORS)',
        unknown: 'Fallo inesperado del motor'
      },
      next: 'probamos con otra foto…',
      photo: 'Foto',
      at: { original: 'al crear la foto', '8-bit': 'en el NPC 8-bit', '16-bit': 'en el NPC 16-bit', retrato: 'en la persona nueva', portrait: 'en la persona nueva' },
      discards: 'Fotos descartadas',
      trying: 'Probando foto aleatoria',
      finalAll: 'No se pudo con ninguna de las {max} fotos aleatorias.',
      lastWhy: 'Último motivo',
      retryAll: '↻ Probar otra vez',
      fatal: {
        session: 'Tu sesión de Pixeria ha caducado. Recarga la página y vuelve a entrar; no hemos gastado más intentos.',
        offline: 'No hay conexión a internet. Revisa la red y pulsa «Probar otra vez».'
      },
      own: {
        session: 'Tu sesión de Pixeria ha caducado. Recarga la página y vuelve a entrar; tu foto no se ha enviado.',
        offline: 'No hay conexión a internet. Revisa la red y pulsa ✨ Anonimizar: tu foto sigue cargada.',
        network: 'No hubo conexión con el motor de imagen. Pulsa ✨ Anonimizar para reintentarlo con tu misma foto.',
        timeout: 'El motor tardó demasiado con tu foto. Pulsa ✨ Anonimizar para reintentarlo; si se repite, prueba una foto más ligera.',
        declined: 'El motor rechazó tu foto: suele pasar con primeros planos, famosos o contenido sensible. Prueba una foto de cuerpo entero tomada a cierta distancia.',
        empty: 'El motor no devolvió imagen con tu foto. Suele pasar si la persona no se ve entera, está muy lejos o a oscuras. Prueba otra con la persona de cuerpo entero y bien iluminada.',
        overload: 'El motor de imagen está saturado ahora mismo. Espera un minuto y pulsa ✨ Anonimizar: tu foto sigue cargada.',
        'bad-image': 'No se puede leer tu imagen (formato no compatible, como HEIC, o archivo dañado). Expórtala como JPG o PNG y vuelve a subirla.',
        'too-big': 'Tu imagen pesa más de 20 MB. Redúcela o expórtala como JPG y vuelve a subirla.',
        'no-data': 'El motor no entregó el resultado. Pulsa ✨ Anonimizar para reintentarlo con tu misma foto.',
        cors: 'Esa imagen no permite procesarse en el navegador (CORS). Descárgala a tu equipo y súbela como archivo.',
        unknown: 'Fallo inesperado del motor con tu foto. Pulsa ✨ Anonimizar para reintentarlo.'
      }
    },
    en: {
      why: {
        session: 'Your Pixeria session has expired',
        offline: 'There is no internet connection',
        network: 'Could not reach the image engine (network or CORS)',
        timeout: 'The source took too long to respond',
        declined: 'The engine refused the photo (it took it for a recognizable person or sensitive content)',
        empty: 'The engine returned no image for this photo',
        overload: 'The image engine is overloaded',
        'bad-image': 'The image arrived damaged or in an unreadable format',
        'too-big': 'The image is too large',
        'no-data': 'The source did not deliver the image',
        cors: 'The image cannot be processed in the browser (CORS)',
        unknown: 'Unexpected engine failure'
      },
      next: 'trying another photo…',
      photo: 'Photo',
      at: { original: 'while creating the photo', '8-bit': 'on the 8-bit NPC', '16-bit': 'on the 16-bit NPC', retrato: 'on the new person', portrait: 'on the new person' },
      discards: 'Discarded photos',
      trying: 'Trying random photo',
      finalAll: 'None of the {max} random photos could be processed.',
      lastWhy: 'Last reason',
      retryAll: '↻ Try again',
      fatal: {
        session: 'Your Pixeria session has expired. Reload the page and sign in again; no more attempts were spent.',
        offline: 'There is no internet connection. Check your network and press “Try again”.'
      },
      own: {
        session: 'Your Pixeria session has expired. Reload the page and sign in again; your photo was not sent.',
        offline: 'There is no internet connection. Check your network and press ✨ Anonymize: your photo is still loaded.',
        network: 'Could not reach the image engine. Press ✨ Anonymize to retry with the same photo.',
        timeout: 'The engine took too long with your photo. Press ✨ Anonymize to retry; if it happens again, try a lighter photo.',
        declined: 'The engine refused your photo: this happens with close-ups, celebrities or sensitive content. Try a full-body photo taken from some distance.',
        empty: 'The engine returned no image for your photo. This happens when the person is not fully visible, too far away or in the dark. Try another with the full body, well lit.',
        overload: 'The image engine is overloaded right now. Wait a minute and press ✨ Anonymize: your photo is still loaded.',
        'bad-image': 'Your image cannot be read (unsupported format such as HEIC, or a damaged file). Export it as JPG or PNG and upload it again.',
        'too-big': 'Your image is larger than 20 MB. Shrink it or export it as JPG and upload it again.',
        'no-data': 'The engine did not deliver the result. Press ✨ Anonymize to retry with the same photo.',
        cors: 'That image cannot be processed in the browser (CORS). Download it to your device and upload it as a file.',
        unknown: 'Unexpected engine failure with your photo. Press ✨ Anonymize to retry.'
      }
    }
  };
  function lang(l) { return String(l || 'es').toLowerCase().indexOf('en') === 0 ? 'en' : 'es'; }
  function T(l) { return TXT[lang(l)]; }
  // Aviso breve de una foto aleatoria descartada: «Foto 2/5 descartada: <motivo>; probamos con otra…».
  function discardMessage(d, n, max, l) {
    var t = T(l), why = t.why[d.code] || t.why.unknown;
    var where = d.step && t.at[d.step] ? ' ' + t.at[d.step] : '';
    return t.photo + ' ' + n + '/' + max + ': ' + why + where + '; ' + t.next;
  }
  function finalMessage(res, l) {
    var t = T(l);
    if (res && res.fatal) return t.fatal[res.fatal.code] || t.why[res.fatal.code];
    var max = (res && res.attempts) || config.maxRandom;
    var last = res && res.discards && res.discards[res.discards.length - 1];
    return t.finalAll.replace('{max}', max) + (last ? ' ' + t.lastWhy + ': ' + (t.why[last.code] || t.why.unknown).toLowerCase() + '.' : '');
  }
  function ownMessage(inf, l) { var t = T(l); return t.own[inf && inf.code] || t.own.unknown; }

  // ── Política: probar con otra foto aleatoria, con máximo duro ──────────────
  function clampMax(max) {
    var n = Math.floor(Number(max));
    if (!isFinite(n) || n < 1) n = config.maxRandom;
    return Math.max(1, Math.min(10, n));
  }
  function pauseFor(inf, n) {
    if (inf.code === 'overload') return Math.min(6000, 1500 * n);   // saturación: dejar respirar
    if (inf.code === 'network') return Math.min(3000, 600 * n);
    return 250;
  }
  var defaultSleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  // attempt(n, max) crea y procesa UNA foto aleatoria; si lanza, la foto se descarta.
  // Nunca hace más de `max` intentos; un motivo fatal corta en el acto.
  async function tryRandomPhotos(opts) {
    var limit = clampMax(opts && opts.max);
    var sleep = (opts && opts.sleep) || defaultSleep;
    var discards = [];
    for (var n = 1; n <= limit; n++) {
      try {
        var value = await opts.attempt(n, limit);
        return { ok: true, value: value, attempts: n, discards: discards };
      } catch (e) {
        var d = classify(e);
        d.n = n; d.step = (e && e.step) || '';
        discards.push(d);
        if (d.fatal) return { ok: false, fatal: d, attempts: n, discards: discards };
        if (opts.onDiscard) { try { opts.onDiscard(d, n, limit); } catch (_) {} }
        if (n < limit) await sleep(pauseFor(d, n));
      }
    }
    return { ok: false, exhausted: true, attempts: limit, discards: discards };
  }

  // ── Red: token de pago cacheado + timeout real ────────────────────────────
  var tok = null;   // { token, exp (s) }
  function forgetToken() { tok = null; }
  async function paidHeaders(fetchImpl) {
    var f = fetchImpl || root.fetch.bind(root);
    var h = { 'Content-Type': 'application/json' };
    var now = Date.now() / 1000;
    if (!tok || tok.exp - 60 < now) {
      tok = null;
      var r = null;
      try { r = await f('/auth/api-token', { credentials: 'include', cache: 'no-store' }); } catch (_) { r = null; }
      // Sin sesión, el worker contestará 401 a TODO: se dice ya, sin gastar la foto.
      if (r && (r.status === 401 || r.status === 403)) throw fail('session', 'sesión caducada', { status: 401 });
      if (r && r.ok) {
        var d = {}; try { d = await r.json(); } catch (_) {}
        if (d && d.token) tok = { token: d.token, exp: Number(d.exp) || (now + 600) };
      }
    }
    if (tok) h.Authorization = 'Bearer ' + tok.token;
    return h;
  }
  async function fetchWithTimeout(url, init, ms, fetchImpl) {
    var f = fetchImpl || root.fetch.bind(root);
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, ms);
    try {
      var r = await f(url, Object.assign({}, init, { signal: ctrl.signal }));
      var body = {}; try { body = await r.json(); } catch (_) { body = {}; }
      return { r: r, d: body || {} };
    } catch (e) {
      if (ctrl.signal.aborted) throw fail('timeout', 'tiempo de espera agotado (' + Math.round(ms / 1000) + ' s)', { status: 408 });
      throw fail(isOffline() ? 'offline' : 'network', String((e && e.message) || e), { status: 0 });
    } finally { clearTimeout(timer); }
  }
  // POST de pago al worker: añade el token; si el worker rechaza un token cacheado
  // (rotado o caducado entre medias) se pide uno nuevo UNA vez.
  async function paidFetch(url, payload, ms, fetchImpl) {
    for (var i = 0; i < 2; i++) {
      var hadCached = !!tok;
      var headers = await paidHeaders(fetchImpl);
      var res = await fetchWithTimeout(url, { method: 'POST', headers: headers, body: JSON.stringify(payload) }, ms, fetchImpl);
      if (res.r.status === 401 && hadCached && i === 0) { forgetToken(); continue; }
      return res;
    }
  }

  // ── Imagen: decodificar y validar antes de mandar nada ────────────────────
  function checkFile(f) {
    if (!f) throw fail('bad-image', 'sin archivo');
    var looksImage = /^image\//.test(f.type || '') || /\.(jpe?g|png|webp|gif|avif|heic|heif|bmp)$/i.test(f.name || '');
    if (!looksImage) throw fail('bad-image', 'no es una imagen (' + (f.type || 'tipo desconocido') + ')');
    if (f.size > config.maxUploadBytes) throw fail('too-big', 'imagen demasiado grande (' + Math.round(f.size / 1048576) + ' MB)', { status: 413 });
  }
  // Decodifica src (dataURL/URL) y la devuelve reducida a `max` px de lado mayor.
  function prepareImage(src, max, mime) {
    return new Promise(function (resolve, reject) {
      var im = new root.Image();
      im.onload = function () {
        var w = im.naturalWidth, h = im.naturalHeight;
        if (!w || !h || Math.min(w, h) < config.minSide) { reject(fail('bad-image', 'imagen demasiado pequeña (' + w + '×' + h + ')')); return; }
        var sc = Math.min(1, max / Math.max(w, h));
        var c = root.document.createElement('canvas');
        c.width = Math.round(w * sc); c.height = Math.round(h * sc);
        try {
          c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
          resolve(mime === 'image/png' ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.86));
        } catch (e) { reject(fail('cors', 'canvas bloqueado por CORS: ' + (e && e.name))); }
      };
      im.onerror = function () { reject(fail('bad-image', 'el navegador no pudo decodificar la imagen')); };
      im.src = src;
    });
  }

  // ── UI: aviso, registro plegable de descartes y error final ───────────────
  var CSS = '' +
    '.anon-notice{max-width:760px;margin:0 auto;display:flex;gap:10px;align-items:flex-start;border:1px dashed var(--accent,#39d353);border-radius:12px;padding:10px 14px;background:rgba(2,18,6,.72);color:var(--fg,#dffbe6);font-size:13px;line-height:1.45}' +
    '.anon-notice[hidden],.anon-discards[hidden],.anon-final[hidden],.anon-final .btn[hidden]{display:none!important}' +
    '.anon-notice .ic{color:#ffd166;flex:0 0 auto}' +
    '.anon-discards{max-width:760px;margin:0 auto;border:1px solid var(--line,#1c3a22);border-radius:12px;background:rgba(2,12,5,.55);font-size:12px;color:var(--muted,#9fc7ab)}' +
    '.anon-discards>summary{cursor:pointer;padding:8px 14px;font-family:var(--mono,ui-monospace,monospace);letter-spacing:.06em;text-transform:uppercase;color:var(--accent,#39d353);list-style:none}' +
    '.anon-discards>summary::-webkit-details-marker{display:none}' +
    '.anon-discards>summary::before{content:"+ "}.anon-discards[open]>summary::before{content:"− "}' +
    '.anon-discards ol{margin:0;padding:0 14px 10px 34px;display:flex;flex-direction:column;gap:4px;line-height:1.4}' +
    '.anon-discards li small{display:block;opacity:.7;font-family:var(--mono,ui-monospace,monospace);word-break:break-word}' +
    '.anon-final{max-width:760px;margin:0 auto;display:flex;flex-wrap:wrap;gap:10px 14px;align-items:center;justify-content:center;border:1px solid #ff6b6b;border-radius:12px;padding:12px 14px;background:rgba(40,6,6,.45);color:#ffd2d2;font-size:13px;line-height:1.45;text-align:center}' +
    '.anon-final p{margin:0;flex:1 1 260px}';
  function mountUI(anchor, l) {
    var doc = root.document, t = T(l);
    if (!doc.getElementById('anon-fiable-css')) {
      var st = doc.createElement('style'); st.id = 'anon-fiable-css'; st.textContent = CSS; doc.head.appendChild(st);
    }
    var notice = doc.createElement('div'); notice.className = 'anon-notice'; notice.id = 'anonNotice';
    notice.setAttribute('role', 'status'); notice.setAttribute('aria-live', 'polite'); notice.hidden = true;
    var ic = doc.createElement('span'); ic.className = 'ic'; ic.setAttribute('aria-hidden', 'true'); ic.textContent = '⚠';
    var nt = doc.createElement('span'); notice.append(ic, nt);
    var det = doc.createElement('details'); det.className = 'anon-discards'; det.id = 'anonDiscards'; det.hidden = true;
    var sum = doc.createElement('summary'); var ol = doc.createElement('ol'); det.append(sum, ol);
    var fin = doc.createElement('div'); fin.className = 'anon-final'; fin.id = 'anonFinal'; fin.setAttribute('role', 'alert'); fin.hidden = true;
    var fp = doc.createElement('p'); var fb = doc.createElement('button'); fb.type = 'button'; fb.className = 'btn primary'; fb.id = 'btnRetryAll'; fb.textContent = t.retryAll;
    fin.append(fp, fb);
    anchor.after(notice, fin, det);
    var onRetry = null; fb.addEventListener('click', function () { if (onRetry) onRetry(); });
    var count = 0;
    return {
      reset: function () { count = 0; ol.replaceChildren(); det.hidden = true; det.open = false; notice.hidden = true; fin.hidden = true; },
      notice: function (text) { nt.textContent = text; notice.hidden = !text; },
      discard: function (d, n, max) {
        count++;
        var li = doc.createElement('li'); li.textContent = discardMessage(d, n, max, l).replace(/; [^;]*$/, '');
        if (d.detail) { var sm = doc.createElement('small'); sm.textContent = d.code + (d.status ? ' · ' + d.status : '') + ' · ' + d.detail; li.appendChild(sm); }
        ol.appendChild(li); sum.textContent = t.discards + ' (' + count + ')'; det.hidden = false;
      },
      final: function (text, retry) { fp.textContent = text; onRetry = retry || null; fb.hidden = !retry; fin.hidden = false; notice.hidden = true; },
      hideFinal: function () { fin.hidden = true; }
    };
  }

  return {
    config: config, CODES: CODES, fail: fail, classify: classify, clampMax: clampMax,
    tryRandomPhotos: tryRandomPhotos, discardMessage: discardMessage, finalMessage: finalMessage,
    ownMessage: ownMessage, texts: TXT, paidHeaders: paidHeaders, paidFetch: paidFetch,
    fetchWithTimeout: fetchWithTimeout, forgetToken: forgetToken, checkFile: checkFile,
    prepareImage: prepareImage, mountUI: mountUI
  };
});
