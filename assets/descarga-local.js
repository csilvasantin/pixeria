/* Pixeria · Descarga en local ────────────────────────────────────────────────
 *
 * El problema que resuelve: en toda la casa el botón de descargar era
 * `<a href="https://…r2.dev/…" download>`. El atributo `download` lo IGNORAN los
 * navegadores cuando el href es de otro origen (spec HTML: solo se respeta en
 * same-origin), así que el clic no guardaba nada — abría el asset en una pestaña
 * y, si el navegador sabía pintarlo (mp4, jpg, mp3), se quedaba ahí reproducido.
 * Encima el nombre del fichero lo ponía R2: `asset.mp4`, igual para los 756.
 *
 * Aquí se descarga de verdad: fetch → blob → objectURL (que YA es same-origin, y
 * ahí `download` manda) → nombre legible. El bucket sirve `Access-Control-Allow-
 * Origin: *` y expone `content-length`, así que además se puede dar progreso.
 *
 * Si el fetch falla (CORS de un motor nuevo, red, fichero enorme) no se queda
 * mudo: cae al enlace directo de siempre, que es exactamente lo que había antes.
 *
 * API — window.PixeriaDescarga:
 *   nombre(item)             → 'pixeria-video-robot-de-rescate-20260827-hwtk.mp4'
 *   descargar(url, nombre)   → Promise<{ok, via, bytes}>
 *   item(it)                 → descarga un asset del Stock con su nombre bueno
 *   lote(items)              → varios en serie, con un solo aviso de progreso
 *   soportada()              → false en navegadores sin Blob/objectURL
 *
 * v.28.08.2026.r1 · NeoMBP16 · MacBookPro16
 */
(function (global) {
  'use strict';

  // Por encima de esto no nos lo traemos a memoria: un blob de 600 MB tumba la
  // pestaña en un portátil con la sesión cargada. Se va al respaldo.
  var MAX_BLOB = 512 * 1024 * 1024;

  var EXT_POR_TIPO = {
    video: 'mp4', animation: 'mp4', image: 'png', 'digital-twin': 'png',
    'twin-npc': 'png', furni: 'png', audio: 'mp3', music: 'mp3', locucion: 'mp3'
  };
  var EXT_POR_MIME = {
    'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov',
    'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif',
    'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/wav': 'wav', 'audio/ogg': 'ogg',
    'application/json': 'json', 'text/plain': 'txt'
  };

  function soportada() {
    return typeof Blob !== 'undefined' && typeof URL !== 'undefined' &&
           typeof URL.createObjectURL === 'function';
  }

  // ── Nombre de fichero ──────────────────────────────────────────────────────
  // Objetivo: que la carpeta de Descargas se pueda leer. Nada de `asset(3).mp4`.
  function slug(txt, max) {
    return String(txt || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')   // quita tildes
      .replace(/[·—–]/g, '-')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, max || 60)
      .replace(/-+$/, '');
  }

  function extDeUrl(url) {
    try {
      var p = new URL(url, global.location.href).pathname;
      var m = p.match(/\.([a-z0-9]{2,5})$/i);
      return m ? m[1].toLowerCase() : '';
    } catch (e) { return ''; }
  }

  function fecha(v) {
    var d = v ? new Date(v) : new Date();
    if (isNaN(d.getTime())) d = new Date();
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate());
  }

  function nombre(it, opts) {
    it = it || {}; opts = opts || {};
    var tipo = slug(opts.tipo || it.type || 'asset', 20) || 'asset';
    // Muchos assets importados traen por título la URL de origen (LinkedIn, X…).
    // Eso da nombres como «pixeria-image-https-lnkd-in-p-...»: fuera los enlaces.
    var rotulo = String(it.title || it.prompt || it.comment || '')
      .replace(/https?:\/\/\S+/gi, ' ')
      .replace(/\b[\w.-]+\.(com|net|org|es|tv|io|ai|co|app|dev)\b\S*/gi, ' ');
    // Si del rótulo solo quedaba el enlace, mejor sin rótulo que con la URL.
    var texto = slug(rotulo, 55);
    var ext = opts.ext || extDeUrl(it.url) || EXT_POR_MIME[it.mime] || EXT_POR_TIPO[it.type] || 'bin';
    // Cola corta del id: en un lote de variantes del mismo prompt evita que el
    // navegador vaya poniendo (1), (2), (3) y se pierda cuál es cuál.
    var cola = slug(String(it.id || '').split('-').pop(), 8);
    var partes = ['pixeria', tipo];
    if (texto) partes.push(texto);
    partes.push(fecha(it.createdAt));
    if (cola) partes.push(cola);
    return partes.join('-') + '.' + ext;
  }

  // ── Guardado ───────────────────────────────────────────────────────────────
  function guardarBlob(blob, filename) {
    var href = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = href;
    a.download = filename;              // same-origin (blob:) → el navegador obedece
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    // Safari necesita que el objectURL siga vivo un rato tras el click.
    setTimeout(function () {
      try { URL.revokeObjectURL(href); } catch (e) {}
      if (a.parentNode) a.parentNode.removeChild(a);
    }, 60000);
  }

  // Lo de antes: enlace directo. Ni renombra ni garantiza guardado, pero abre el
  // asset y desde ahí el usuario siempre puede hacer «Guardar como».
  function respaldo(url, filename) {
    try {
      var a = document.createElement('a');
      a.href = url;
      a.download = filename || '';
      a.target = '_blank';
      a.rel = 'noopener';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { if (a.parentNode) a.parentNode.removeChild(a); }, 1000);
      return true;
    } catch (e) { return false; }
  }

  function descargar(url, filename, opts) {
    opts = opts || {};
    var onProgress = typeof opts.onProgress === 'function' ? opts.onProgress : function () {};
    if (!url) return Promise.resolve({ ok: false, via: 'ninguno', error: 'sin url' });
    if (!soportada()) {
      return Promise.resolve({ ok: respaldo(url, filename), via: 'enlace', error: 'navegador sin Blob/objectURL', filename: filename });
    }
    return fetch(url, { mode: 'cors', credentials: 'omit', cache: 'no-store', signal: opts.signal })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        var total = parseInt(r.headers.get('content-length') || '0', 10) || 0;
        var mime = r.headers.get('content-type') || 'application/octet-stream';
        if (total > MAX_BLOB) throw new Error('demasiado grande para memoria (' + Math.round(total / 1048576) + ' MB)');
        if (!r.body || typeof r.body.getReader !== 'function') {
          return r.blob().then(function (b) { onProgress(b.size, b.size); return b; });
        }
        var reader = r.body.getReader(), trozos = [], leido = 0;
        return (function tirar() {
          return reader.read().then(function (res) {
            if (res.done) return new Blob(trozos, { type: mime });
            trozos.push(res.value);
            leido += res.value.length;
            if (leido > MAX_BLOB) { try { reader.cancel(); } catch (e) {} throw new Error('demasiado grande para memoria'); }
            onProgress(leido, total);
            return tirar();
          });
        })();
      })
      .then(function (blob) {
        guardarBlob(blob, filename);
        return { ok: true, via: 'blob', bytes: blob.size, filename: filename };
      })
      .catch(function (err) {
        // No dejamos al usuario sin nada: se abre el enlace de toda la vida.
        var ok = respaldo(url, filename);
        return { ok: ok, via: 'enlace', error: String((err && err.message) || err), filename: filename };
      });
  }

  // ── Aviso flotante (progreso + resultado) ──────────────────────────────────
  // Sin dependencias: la hoja de estilos de Pixeria puede no estar cargada en la
  // página que use el módulo, así que va todo en línea con el verde de la casa.
  var VERDE = '#00ff41';
  function caja() {
    var el = document.getElementById('pixeria-descarga-avisos');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'pixeria-descarga-avisos';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:99999;display:flex;' +
      'flex-direction:column;gap:8px;max-width:min(360px,90vw);pointer-events:none;font:12px/1.45 ' +
      'ui-monospace,SFMono-Regular,Menlo,monospace;';
    document.body.appendChild(el);
    return el;
  }
  function aviso(texto) {
    var n = document.createElement('div');
    n.style.cssText = 'pointer-events:auto;background:rgba(2,6,2,.94);color:' + VERDE +
      ';border:1px solid ' + VERDE + ';box-shadow:0 0 14px rgba(0,255,65,.28);padding:9px 12px;';
    var t = document.createElement('div'); t.textContent = texto; n.appendChild(t);
    var barra = document.createElement('div');
    barra.style.cssText = 'height:3px;margin-top:7px;background:rgba(0,255,65,.18);display:none;';
    var relleno = document.createElement('div');
    relleno.style.cssText = 'height:100%;width:0;background:' + VERDE + ';transition:width .12s linear;';
    barra.appendChild(relleno); n.appendChild(barra);
    caja().appendChild(n);
    var vivo = true;
    return {
      texto: function (s) { if (vivo) t.textContent = s; },
      progreso: function (leido, total) {
        if (!vivo) return;
        barra.style.display = 'block';
        relleno.style.width = total ? Math.min(100, (leido / total) * 100) + '%'
                                    : Math.min(95, (leido / 1048576) * 2) + '%';
      },
      cerrar: function (ms) {
        setTimeout(function () { vivo = false; if (n.parentNode) n.parentNode.removeChild(n); }, ms == null ? 3200 : ms);
      }
    };
  }

  function mb(n) { return (n / 1048576).toFixed(1) + ' MB'; }

  // ── Cara pública: un asset del Stock ───────────────────────────────────────
  function item(it, opts) {
    opts = opts || {};
    var url = opts.url || (it && it.url);
    var fn = opts.filename || nombre(it, opts);
    if (!url) return Promise.resolve({ ok: false, error: 'el asset no tiene fichero' });
    var av = opts.silencioso ? null : aviso('⬇ ' + fn);
    return descargar(url, fn, {
      onProgress: function (l, t) { if (av) av.progreso(l, t); if (opts.onProgress) opts.onProgress(l, t); }
    }).then(function (res) {
      if (av) {
        if (res.ok && res.via === 'blob') av.texto('✓ Guardado · ' + fn + ' · ' + mb(res.bytes));
        else if (res.ok) av.texto('↗ Abierto en pestaña (no se pudo guardar directo: ' + res.error + ')');
        else av.texto('✗ No se pudo descargar · ' + res.error);
        av.cerrar(res.ok ? 3600 : 7000);
      }
      return res;
    });
  }

  // ── Cara pública: varios, en serie ─────────────────────────────────────────
  // En serie a propósito: en paralelo el navegador corta las descargas múltiples
  // y además se comería la RAM con varios vídeos a la vez.
  function lote(items, opts) {
    opts = opts || {};
    var lista = (items || []).filter(function (i) { return i && i.url; });
    if (!lista.length) { aviso('Nada que descargar en la selección').cerrar(); return Promise.resolve([]); }
    var av = aviso('⬇ Descargando 1 de ' + lista.length + '…');
    var hechos = [], i = 0;
    function siguiente() {
      if (i >= lista.length) {
        var ok = hechos.filter(function (r) { return r.ok; }).length;
        av.texto((ok === lista.length ? '✓ ' : '⚠ ') + ok + ' de ' + lista.length + ' descargados');
        av.cerrar(5000);
        if (opts.onDone) opts.onDone(hechos);
        return hechos;
      }
      var it = lista[i];
      av.texto('⬇ ' + (i + 1) + ' de ' + lista.length + ' · ' + nombre(it));
      return item(it, { silencioso: true, onProgress: function (l, t) { av.progreso(l, t); } })
        .then(function (res) {
          hechos.push(res); i++;
          // Respiro entre ficheros: Chrome bloquea la ráfaga si van pegados.
          return new Promise(function (r) { setTimeout(r, 350); }).then(siguiente);
        });
    }
    return Promise.resolve().then(siguiente);
  }

  // Para lo que no es un fichero remoto sino texto que vive en el propio índice
  // (las cápsulas del Stock no tienen url: su contenido es el comentario).
  function texto(contenido, filename) {
    if (!soportada()) return { ok: false, error: 'navegador sin Blob' };
    guardarBlob(new Blob([String(contenido == null ? '' : contenido)], { type: 'text/plain;charset=utf-8' }), filename);
    var av = aviso('\u2713 Guardado \u00b7 ' + filename); av.cerrar();
    return { ok: true, via: 'texto', filename: filename };
  }

  global.PixeriaDescarga = {
    soportada: soportada,
    texto: texto,
    nombre: nombre,
    slug: slug,
    descargar: descargar,
    item: item,
    lote: lote,
    aviso: aviso
  };
})(window);
