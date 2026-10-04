/* Adaptaciones · paso 1 · ficha técnica del vídeo de vista previa (Carlos, 4-oct-2026, 23:52).
 * Script clásico e independiente. Solo datos reales; lo que no se puede saber sale «—».
 * - <video>: resolución, duración. Peso: Content-Range/Content-Length (Range 0-64 KB) o File.size;
 *   si no, el `size` del índice. Bitrate medio = peso × 8 / duración.
 * - MP4/MOV: se lee el `moov` en el cliente (con Range si está al final): fps (stts), códec y perfil
 *   (avcC/hvcC/vpcC/av1C), pista de audio (mp4a/esds…), marca del contenedor (ftyp) y si es faststart.
 * - Índice del Stock: id, fuente (motor / referencia), fecha de alta y cliente (PixeriaCliente).
 */
(function () {
  var EN = (document.documentElement.lang || '').toLowerCase().indexOf('en') === 0;
  var t = function (es, en) { return EN ? en : es; };
  var $ = function (s) { return document.querySelector(s); };
  var NADA = '—', origen = null, turno = 0;

  // ─── Lectura de bytes (Stock por Range; archivo local por slice) ───
  function lector(o) {
    if (o && o.file) { var f = o.file; return { total: f.size, leer: function (a, b) { return f.slice(a, b).arrayBuffer(); } }; }
    var url = o.url, L = { total: null, tipo: '' };
    L.leer = function (a, b) {
      return fetch(url, { headers: { Range: 'bytes=' + a + '-' + (b - 1) }, credentials: 'omit', cache: 'force-cache' }).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        var cr = r.headers.get('content-range'), m = cr && /\/(\d+)\s*$/.exec(cr);
        if (m) L.total = +m[1]; else if (r.status === 200 && r.headers.get('content-length')) L.total = +r.headers.get('content-length');
        if (!L.tipo) L.tipo = (r.headers.get('content-type') || '').split(';')[0];
        if (r.status === 200 && b - a < 2e6 && L.total > 4e6) throw new Error('sin Range'); // no bajar el archivo entero
        return r.arrayBuffer();
      });
    };
    return L;
  }
  function u32(v, o) { return v.getUint32(o); }
  function tipo(v, o) { return String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3)); }
  function cajas(v, ini, fin, fn) {
    for (var o = ini; o + 8 <= fin;) {
      var s = u32(v, o), ty = tipo(v, o + 4), h = 8;
      if (s === 1) { s = u32(v, o + 8) * 4294967296 + u32(v, o + 12); h = 16; } else if (s === 0) s = fin - o;
      if (s < h) break;
      if (fn(ty, o + h, Math.min(o + s, fin), o) === false) break;
      o += s;
    }
  }
  // Cajas de primer nivel: busca ftyp y moov sin bajar el mdat.
  function leerMoov(L) {
    var info = { marca: null, faststart: null };
    return L.leer(0, 65536).then(function (buf) {
      var v = new DataView(buf), total = L.total || buf.byteLength, pos = 0, vistoMdat = false, saltos = 0;
      function paso(v, base) {
        var o = pos - base; if (o + 16 > v.byteLength) return null;
        var s = u32(v, o), ty = tipo(v, o + 4), h = 8;
        if (s === 1) { s = u32(v, o + 8) * 4294967296 + u32(v, o + 12); h = 16; } else if (s === 0) s = total - pos;
        return { s: s, ty: ty, h: h, o: o };
      }
      function seguir(v, base) {
        while (pos < total && saltos++ < 40) {
          var c = paso(v, base);
          if (!c) return L.leer(pos, Math.min(total, pos + 16)).then(function (b) { return seguirDesde(new DataView(b), pos); });
          if (c.s < c.h || !/^[\x20-\x7e]{4}$/.test(c.ty)) return null;
          if (c.ty === 'ftyp') info.marca = tipo(v, c.o + c.h);
          if (c.ty === 'mdat') vistoMdat = true;
          if (c.ty === 'moov') {
            info.faststart = !vistoMdat;
            if (c.o + c.s <= v.byteLength) return { v: v, ini: c.o + c.h, fin: c.o + c.s, info: info };
            if (c.s > 8e6) return null;
            var p0 = pos;
            return L.leer(p0, p0 + c.s).then(function (b) { return { v: new DataView(b), ini: c.h, fin: c.s, info: info }; });
          }
          pos += c.s;
        }
        return null;
      }
      function seguirDesde(v, base) { return seguir(v, base); }
      return seguir(v, 0);
    }).then(function (r) { return r || { info: info }; });
  }
  var PERFIL_AVC = { 66: 'Baseline', 77: 'Main', 88: 'Extended', 100: 'High', 110: 'High 10', 122: 'High 4:2:2', 244: 'High 4:4:4' };
  var PERFIL_HEVC = { 1: 'Main', 2: 'Main 10', 3: 'Main Still Picture', 4: 'RExt' };
  var AAC = { 1: 'AAC Main', 2: 'AAC-LC', 5: 'HE-AAC', 29: 'HE-AAC v2' };
  function hex2(n) { return ('0' + n.toString(16)).slice(-2); }
  function parseMoov(m) {
    var v = m.v, pistas = [];
    function trak(ini, fin) {
      var p = {};
      (function rec(a, b) {
        cajas(v, a, b, function (ty, i, f) {
          if (/^(mdia|minf|stbl|dinf)$/.test(ty)) rec(i, f);
          else if (ty === 'hdlr') p.handler = tipo(v, i + 8);
          else if (ty === 'mdhd') { var ver = v.getUint8(i); p.escala = ver === 1 ? u32(v, i + 20) : u32(v, i + 12); p.dur = ver === 1 ? u32(v, i + 24) * 4294967296 + u32(v, i + 28) : u32(v, i + 16); }
          else if (ty === 'stts') { var n = u32(v, i + 4), mu = 0, de = 0, d0 = null, cfr = true; for (var k = 0; k < n && i + 16 + k * 8 <= f; k++) { var c = u32(v, i + 8 + k * 8), d = u32(v, i + 12 + k * 8); mu += c; de += c * d; if (d0 === null) d0 = d; else if (d !== d0 && c > 1) cfr = false; } p.muestras = mu; p.deltas = de; p.cfr = cfr; }
          else if (ty === 'stsd') {
            var e = i + 8, fourcc = tipo(v, e + 4), es = u32(v, e); p.fourcc = fourcc;
            if (p.handler === 'vide') cajas(v, e + 8 + 78, e + es, function (t2, i2) {
              if (t2 === 'avcC') { var pr = v.getUint8(i2 + 1), co = v.getUint8(i2 + 2), lv = v.getUint8(i2 + 3); p.codec = 'H.264 / AVC'; p.perfil = (pr === 66 && co & 0x40 ? 'Constrained Baseline' : PERFIL_AVC[pr] || 'perfil ' + pr) + ' @ L' + (lv / 10); p.codecs = fourcc + '.' + hex2(pr) + hex2(co) + hex2(lv); }
              else if (t2 === 'hvcC') { var b1 = v.getUint8(i2 + 1), pi = b1 & 31, lv2 = v.getUint8(i2 + 12); p.codec = 'H.265 / HEVC'; p.perfil = (PERFIL_HEVC[pi] || 'perfil ' + pi) + (b1 & 32 ? ' · High tier' : ' · Main tier') + ' @ L' + (lv2 / 30); }
              else if (t2 === 'vpcC') { p.codec = 'VP9'; p.perfil = 'Profile ' + v.getUint8(i2 + 4) + ' · ' + (v.getUint8(i2 + 6) >> 4) + ' bit'; }
              else if (t2 === 'av1C') { var b = v.getUint8(i2 + 1); p.codec = 'AV1'; p.perfil = (['Main', 'High', 'Professional'][b >> 5] || 'perfil ' + (b >> 5)) + ' · seq_level_idx ' + (b & 31); }
            });
            if (p.handler === 'soun') {
              p.canales = v.getUint16(e + 8 + 16); p.hz = u32(v, e + 8 + 24) >>> 16;
              cajas(v, e + 8 + 28, e + es, function (t2, i2, f2) {
                if (t2 !== 'esds') return;
                for (var o = i2 + 4; o < f2 - 2;) { // descriptores MPEG-4: 3 ES → 4 DecoderConfig → 5 DecSpecificInfo
                  var tag = v.getUint8(o++), len = 0, bb; do { bb = v.getUint8(o++); len = (len << 7) | (bb & 127); } while (bb & 128 && o < f2);
                  if (tag === 3) { o += 3; continue; }
                  if (tag === 4) { p.oti = v.getUint8(o); o += 13; continue; }
                  if (tag === 5) { p.aot = v.getUint8(o) >> 3; if (p.aot === 31) p.aot = 32 + ((v.getUint8(o) & 7) << 3 | v.getUint8(o + 1) >> 5); break; }
                  o += len;
                }
              });
            }
          }
        });
      })(ini, fin);
      pistas.push(p);
    }
    cajas(v, m.ini, m.fin, function (ty, i, f) { if (ty === 'trak') trak(i, f); });
    return pistas;
  }
  function audioNombre(p) {
    var f = p.fourcc;
    if (f === 'mp4a') return p.oti === 0x6B || p.oti === 0x69 ? 'MP3' : p.oti === 0x40 || p.oti === 0x67 ? (AAC[p.aot] || 'AAC') : 'MPEG-4 audio';
    return { Opus: 'Opus', 'ac-3': 'Dolby Digital (AC-3)', 'ec-3': 'Dolby Digital Plus (E-AC-3)', alac: 'Apple Lossless', fLaC: 'FLAC', lpcm: 'PCM', sowt: 'PCM', twos: 'PCM' }[f] || f;
  }

  // ─── Formatos ───
  function mcd(a, b) { return b ? mcd(b, a % b) : a; }
  var COMUNES = [[16, 9], [9, 16], [4, 3], [3, 4], [1, 1], [4, 5], [5, 4], [21, 9], [9, 21], [3, 2], [2, 3], [2, 1], [1, 2], [1.85, 1], [2.39, 1]];
  function aspecto(w, h) {
    var g = mcd(w, h), a = w / g, b = h / g, dec = (w / h).toFixed(3).replace('.', EN ? '.' : ',');
    if (a <= 32 && b <= 32) return a + ':' + b + ' · ' + dec;
    var c = COMUNES.filter(function (x) { return Math.abs(x[0] / x[1] - w / h) / (w / h) < 0.01; })[0];
    return (c ? '≈ ' + c[0] + ':' + c[1] : a + ':' + b) + ' · ' + dec;
  }
  function num(n, d) { return Number(n).toLocaleString(EN ? 'en-US' : 'es-ES', { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function tc(s, fps) {
    if (!isFinite(s) || s <= 0) return NADA;
    var h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), ss = Math.floor(s % 60), p = function (n) { return ('0' + n).slice(-2); };
    var base = p(h) + ':' + p(m) + ':' + p(ss);
    if (fps) return base + '.' + p(Math.min(Math.round(fps) - 1, Math.floor((s - Math.floor(s)) * fps + 1e-6))) + ' · ' + num(s, 3) + ' s';
    return base + ' · ' + num(s, 3) + ' s';
  }
  function fecha(iso) { var d = new Date(iso); return isNaN(d) ? NADA : d.toLocaleString(EN ? 'en-GB' : 'es-ES', { dateStyle: 'medium', timeStyle: 'short' }); }
  function clienteDe(it) {
    var PC = window.PixeriaCliente; if (!it || !PC || !PC.listo || !PC.listo() || !PC.clientesDe) return NADA;
    var l = PC.clientesDe(it);
    if (!l.length) return t('Genérico · sin cliente', 'Generic · no client');
    if (l.length > 1) return t('Ambiguo · solo Admira', 'Ambiguous · Admira only');
    var c = (PC.lista() || []).filter(function (x) { return x.id === l[0]; })[0];
    return c && c.nombre || l[0];
  }

  // ─── Pintar ───
  function pintar(f) {
    var box = $('#src-ficha'); if (!box) return;
    var G = [
      [t('Vídeo', 'Video'), [[t('Resolución', 'Resolution'), f.res], [t('Aspecto', 'Aspect ratio'), f.asp], [t('Orientación', 'Orientation'), f.ori], [t('Duración', 'Duration'), f.dur], ['FPS', f.fps], [t('Códec', 'Codec'), f.codec], [t('Perfil', 'Profile'), f.perfil]]],
      [t('Archivo', 'File'), [[t('Peso', 'Size'), f.peso], [t('Bitrate medio', 'Avg. bitrate'), f.br], [t('Contenedor', 'Container'), f.cont], ['MIME', f.mime]]],
      ['Audio', [[t('Pista', 'Track'), f.audio]]],
      [t('Origen', 'Source'), [[t('Origen', 'Origin'), f.origen], [t('Fuente', 'Provider'), f.fuente], [t('Alta', 'Added'), f.alta], [t('Cliente', 'Client'), f.cliente]]]
    ];
    var h = '<header class="ficha-hd"><span class="ficha-tit">' + t('Ficha técnica', 'Tech specs') + '</span><button type="button" class="ficha-copy">' + t('Copiar', 'Copy') + '</button></header>';
    G.forEach(function (g) {
      h += '<section class="ficha-g"><h4>' + g[0] + '</h4><dl>';
      g[1].forEach(function (r) { var val = r[1] == null || r[1] === '' ? NADA : String(r[1]); h += '<div><dt>' + r[0] + '</dt><dd' + (val === NADA ? ' class="nd"' : '') + ' title="' + esc(val) + '">' + esc(val) + '</dd></div>'; });
      h += '</dl></section>';
    });
    box.innerHTML = h; box.hidden = false;
    box._texto = G.map(function (g) { return '[' + g[0] + ']\n' + g[1].map(function (r) { return r[0] + ': ' + (r[1] == null || r[1] === '' ? NADA : r[1]); }).join('\n'); }).join('\n');
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function construir() {
    var video = $('#src'); if (!video || !video.videoWidth) return;
    var yo = ++turno, o = origen || {}, src = video.currentSrc || video.src;
    if (!o.file && o.url !== src) o = { url: src };
    var it = o.url && window.PixeriaStock && window.PixeriaStock.item ? window.PixeriaStock.item(o.url) : null;
    var w = video.videoWidth, hgt = video.videoHeight, dur = video.duration;
    var f = { res: w + ' × ' + hgt + ' px', asp: aspecto(w, hgt), ori: w > hgt ? t('Horizontal', 'Landscape') : w < hgt ? t('Vertical', 'Portrait') : t('Cuadrado', 'Square'), dur: tc(dur) };
    f.mime = (o.file && o.file.type) || (it && it.mime) || null;
    f.origen = o.file ? t('Subida local · ', 'Local upload · ') + o.file.name : it ? 'Stock · ' + it.id : /^blob:/.test(src) ? t('Subida local', 'Local upload') : NADA;
    f.fuente = it ? [it.motor, it.externalRef || it.externalIdOrigen].filter(Boolean).join(' · ') || null : null;
    f.alta = it && it.createdAt ? fecha(it.createdAt) : null;
    f.cliente = it ? clienteDe(it) : null;
    pintar(f);
    var L = (o.file || o.url) && !/^blob:/.test(o.url || '') ? lector(o) : null;
    if (!L) return;
    leerMoov(L).then(function (m) {
      if (yo !== turno) return;
      var total = L.total || (it && it.size) || null;
      if (total) { f.peso = num(total / 1e6, 2) + ' MB · ' + num(total, 0) + ' B'; if (isFinite(dur) && dur > 0) f.br = num(total * 8 / dur / 1e6, 2) + ' Mb/s'; }
      f.mime = f.mime || L.tipo || null;
      var marca = m.info && m.info.marca;
      if (marca) f.cont = (/^qt/.test(marca) ? 'QuickTime MOV' : 'MP4 · ISO BMFF') + ' (' + marca.trim() + ')' + (m.info.faststart === true ? ' · faststart' : m.info.faststart === false ? t(' · moov al final', ' · moov at end') : '');
      if (m.v) {
        var ps = parseMoov(m), vi = ps.filter(function (p) { return p.handler === 'vide'; })[0], au = ps.filter(function (p) { return p.handler === 'soun'; });
        if (vi) {
          if (vi.muestras && vi.deltas && vi.escala) { var fps = vi.muestras * vi.escala / vi.deltas; f.fps = num(fps, Math.abs(fps - Math.round(fps)) < 0.005 ? 0 : 3) + (vi.cfr ? ' · CFR' : ' · VFR (' + t('media', 'avg') + ')'); f.dur = tc(dur, fps); }
          f.codec = vi.codec ? vi.codec + ' (' + (vi.codecs || vi.fourcc) + ')' : vi.fourcc || null; f.perfil = vi.perfil || null;
        }
        f.audio = au.length ? t('Sí · ', 'Yes · ') + au.map(function (p) { return audioNombre(p) + (p.hz ? ' · ' + num(p.hz / 1000, 1) + ' kHz' : '') + (p.canales ? ' · ' + (p.canales === 1 ? 'mono' : p.canales === 2 ? t('estéreo', 'stereo') : p.canales + ' ch') : ''); }).join(' / ') : t('No', 'No');
      }
      pintar(f);
    }).catch(function (e) {
      if (yo !== turno) return;
      try { console.warn('[ficha]', e && e.message || e); } catch (_) {}
      var total = (o.file && o.file.size) || (it && it.size) || null;
      if (total) { f.peso = num(total / 1e6, 2) + ' MB · ' + num(total, 0) + ' B'; if (isFinite(dur) && dur > 0) f.br = num(total * 8 / dur / 1e6, 2) + ' Mb/s'; }
      pintar(f);
    });
  }

  function iniciar() {
    var video = $('#src'), sel = $('#src-select'), file = $('#src-file'), box = $('#src-ficha');
    if (!video || !box) return;
    if (sel) sel.addEventListener('change', function () { origen = sel.value ? { url: sel.value } : null; }, true);
    if (file) file.addEventListener('change', function () { var f = file.files && file.files[0]; origen = f ? { file: f } : null; }, true);
    video.addEventListener('loadedmetadata', construir);
    video.addEventListener('emptied', function () { turno++; box.hidden = true; box.innerHTML = ''; });
    box.addEventListener('click', function (e) {
      var b = e.target.closest('.ficha-copy'); if (!b || !box._texto) return;
      var ok = function () { b.textContent = t('Copiada ✓', 'Copied ✓'); setTimeout(function () { b.textContent = t('Copiar', 'Copy'); }, 1600); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(box._texto).then(ok, function () {}); 
    });
    if (video.videoWidth) construir();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
