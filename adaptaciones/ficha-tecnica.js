/* Adaptaciones · paso 1 · ficha técnica del vídeo de vista previa (Carlos, 4-oct-2026, 23:52).
 * Script clásico e independiente. Solo datos reales; lo que no se puede saber sale «—».
 * - <video>: resolución, duración. Peso: Content-Range/Content-Length (Range 0-64 KB) o File.size;
 *   si no, el `size` del índice. Bitrate medio = peso × 8 / duración.
 * - MP4/MOV: se lee el `moov` en el cliente (con Range si está al final): fps (stts), códec y perfil
 *   (avcC/hvcC/vpcC/av1C), pista de audio (mp4a/esds…), marca del contenedor (ftyp) y si es faststart.
 * - Índice del Stock: id, fuente (motor / referencia), fecha de alta y cliente (PixeriaCliente).
 * - Imagen fija (5-oct-2026, #src-img): dimensiones, aspecto y orientación de la imagen; duración
 *   «Imagen fija»; formato leído de la firma del archivo (JPEG/PNG/WebP), peso y MIME; sin audio.
 * - Formatos de entrada (5-oct-2026): GIF estático o animado (fotogramas, duración de un bucle, bucles),
 *   SVG vectorial (tamaño de atributos o viewBox; se rasteriza a cada formato), HEIC (decodificación
 *   nativa o libheif WASM) y AVIF. La firma la decide window.PixeriaFormatos.firma; los datos de la
 *   fuente llegan de adaptaciones.js con el evento pixeria:fuente (window.PixeriaAdaptador.fuente).
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
    if (!l.length) {
      // Sólo un grupo (Alsea = Starbucks en España y México): se dice el grupo y por quién vale.
      var gs = PC.gruposDe ? PC.gruposDe(it) : [], g = gs.length === 1 && PC.grupo ? PC.grupo(gs[0]) : null;
      if (g) return g.nombre + ' · ' + g.miembros.map(function (id) { var c = (PC.lista() || []).filter(function (x) { return x.id === id; })[0]; return c && c.nombre || id; }).join(EN ? ' and ' : ' y ');
      return t('Genérico · sin cliente', 'Generic · no client');
    }
    if (l.length > 1) return t('Ambiguo · solo Admira', 'Ambiguous · Admira only');
    var c = (PC.lista() || []).filter(function (x) { return x.id === l[0]; })[0];
    return c && c.nombre || l[0];
  }

  // ─── Pintar ───
  function pintar(f) {
    var box = $('#src-ficha'); if (!box) return;
    var G = f.imagen ? [
      [t('Imagen', 'Image'), [[t('Resolución', 'Resolution'), f.res], [t('Aspecto', 'Aspect ratio'), f.asp], [t('Orientación', 'Orientation'), f.ori], [t('Duración', 'Duration'), f.dur], [t('Formato', 'Format'), f.formato]].concat(f.extra || [])],
      [t('Archivo', 'File'), [[t('Peso', 'Size'), f.peso], ['MIME', f.mime]]],
      ['Audio', [[t('Pista', 'Track'), f.audio]]],
      [t('Origen', 'Source'), [[t('Origen', 'Origin'), f.origen], [t('Fuente', 'Provider'), f.fuente], [t('Alta', 'Added'), f.alta], [t('Cliente', 'Client'), f.cliente]]]
    ] : [
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

  // Datos comunes de origen (Stock, subida local o importación) para vídeo e imagen.
  function origenDe(o, src, it, f) {
    var imp = o.file && window.PixeriaImportar && window.PixeriaImportar.ultimo && window.PixeriaImportar.ultimo.file === o.file ? window.PixeriaImportar.ultimo : null;
    var F = fuente(), via = F && F.origen, host = function (u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (_) { return u; } };
    f.origen = imp ? t('Importado · ', 'Imported · ') + host(imp.url)
      : o.file ? (via === 'pegado' ? t('Pegado · ', 'Pasted · ') : via === 'soltado' ? t('Soltado · ', 'Dropped · ') : t('Subida local · ', 'Local upload · ')) + o.file.name
      : it ? 'Stock · ' + it.id : o.url && via === 'url' ? 'URL · ' + host(o.url) : /^blob:/.test(src) ? t('Subida local', 'Local upload') : NADA;
    f.fuente = imp ? [imp.motor, imp.via].filter(Boolean).join(' · ') : it ? [/suno/i.test(it.motor || '') ? 'Pixeria Music' : it.motor, it.externalRef || it.externalIdOrigen].filter(Boolean).join(' · ') || null : null;
    f.alta = it && it.createdAt ? fecha(it.createdAt) : null;
    f.cliente = it ? clienteDe(it) : null;
  }
  // Formato real por la firma de los primeros bytes (formatos-entrada.js; JPEG/PNG/WebP si no ha cargado).
  function firma(buf) {
    if (window.PixeriaFormatos) return window.PixeriaFormatos.firma(buf);
    var b = new Uint8Array(buf || new ArrayBuffer(0));
    if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return 'JPEG';
    if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) return 'PNG';
    if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'WebP';
    return null;
  }
  // La fuente que publica adaptaciones.js (pixeria:fuente): URL original, archivo y detalles del formato.
  function fuente() { var A = window.PixeriaAdaptador; return A && A.fuente || null; }
  var MIME_NOMBRE = { 'image/jpeg': 'JPEG', 'image/png': 'PNG', 'image/webp': 'WebP', 'image/gif': 'GIF', 'image/svg+xml': 'SVG', 'image/heic': 'HEIC', 'image/heif': 'HEIC', 'image/avif': 'AVIF' };
  function seg(ms) { return num(ms / 1000, 2) + ' s'; }
  // Filas y nombre del formato según la fuente: GIF animado/estático, SVG vectorial, HEIC (vía), AVIF.
  function detalles(F, f) {
    if (!F) return;
    var g = F.gif, x = [];
    if (F.formato === 'SVG' && F.svg) {
      f.formato = t('SVG vectorial', 'Vector SVG');
      f.res = t('Vectorial · ', 'Vector · ') + F.svg.ancho + ' × ' + F.svg.alto + ' px';
      x.push([t('Tamaño base', 'Base size'), F.svg.origen === 'viewBox' ? t('viewBox (sin width/height)', 'viewBox (no width/height)') : F.svg.origen === 'defecto' ? t('300 × 150 por defecto (sin tamaño ni viewBox)', '300 × 150 default (no size or viewBox)') : t('atributos width/height', 'width/height attributes')]);
      if (F.svg.viewBox) x.push(['viewBox', F.svg.viewBox.join(' ')]);
      x.push([t('Rasterizado', 'Rasterised'), t('por formato de salida', 'per output format')]);
    } else if (g && g.animado) {
      f.formato = t('GIF animado', 'Animated GIF');
      f.dur = tc(g.duracionMs / 1000) + t(' · un bucle', ' · one loop');
      x.push([t('Fotogramas', 'Frames'), num(g.fotogramas, 0) + ' · ' + num(g.fotogramas / (g.duracionMs / 1000 || 1), 2) + t(' fps de media', ' fps average')]);
      x.push([t('Bucles', 'Loops'), g.bucles === 0 ? t('infinito', 'infinite') : g.bucles ? String(g.bucles) : t('sin bloque NETSCAPE', 'no NETSCAPE block')]);
      x.push([t('Vista previa', 'Preview'), F.previo === 'ffmpeg' ? t('MP4 intermedio (FFmpeg WASM)', 'intermediate MP4 (FFmpeg WASM)') : 'WebCodecs ImageDecoder']);
      x.push([t('Exporta', 'Exports'), t('MP4 H.264 · 25 fps · ', 'H.264 MP4 · 25 fps · ') + seg(g.duracionMs)]);
    } else if (g) {
      f.formato = t('GIF estático', 'Static GIF');
    } else if (F.ext === 'heic') {
      f.formato = 'HEIC';
      if (F.heic) x.push([t('Decodificación', 'Decoding'), F.heic.via === 'nativo' ? t('nativa del navegador', 'native, by the browser') : 'libheif-js ' + (F.heic.version || '') + ' · WASM']);
    } else if (F.ext === 'avif') {
      f.formato = 'AVIF'; x.push([t('Decodificación', 'Decoding'), t('nativa del navegador', 'native, by the browser')]);
    }
    f.extra = x;
  }
  function confirmaFormato(f, F, sig) {
    if (!sig) return;
    if (F && (F.gif || F.svg || F.ext === 'heic' || F.ext === 'avif') && { GIF: 1, SVG: 1, HEIC: 1, AVIF: 1 }[sig]) return; // ya está detallado
    f.formato = sig;
  }
  // La fuente remota se carga con ?cors=1 (corsURL de adaptaciones.js): para el índice es la misma URL.
  function sinCors(u) { try { var x = new URL(u, location.href); if (x.searchParams.get('cors') === '1') { x.searchParams.delete('cors'); return x.href; } } catch (_) {} return u; }
  // Origen real de la fuente: el archivo o la URL que eligió el usuario (no el blob derivado de un SVG o HEIC).
  function origenReal(src) {
    var F = fuente(), o = origen || {};
    if (F && (F.file || F.url)) return F.file ? { file: F.file } : { url: F.url };
    if (!o.file && o.url !== src) o = { url: src };
    return o;
  }
  function construirImagen() {
    var im = $('#src-img'); if (!im || !im.getAttribute('src') || !im.naturalWidth) return;
    var yo = ++turno, src = sinCors(im.currentSrc || im.src), o = origenReal(src), F = fuente();
    var it = o.url && window.PixeriaStock && window.PixeriaStock.item ? window.PixeriaStock.item(o.url) : null;
    var w = F && F.svg ? F.svg.ancho : im.naturalWidth, hgt = F && F.svg ? F.svg.alto : im.naturalHeight;
    var f = { imagen: true, res: w + ' × ' + hgt + ' px', asp: aspecto(w, hgt), ori: w > hgt ? t('Horizontal', 'Landscape') : w < hgt ? t('Vertical', 'Portrait') : t('Cuadrado', 'Square'),
      dur: t('Imagen fija', 'Still image'), audio: t('No · imagen fija', 'No · still image') };
    f.mime = (o.file && o.file.type) || (it && it.mime) || null;
    f.formato = MIME_NOMBRE[f.mime] || null; // la firma lo confirma abajo
    detalles(F, f);
    origenDe(o, src, it, f);
    var total = (o.file && o.file.size) || (it && it.size) || null;
    if (total) f.peso = num(total / 1e6, 2) + ' MB · ' + num(total, 0) + ' B';
    pintar(f);
    var L = (o.file || o.url) && !/^blob:/.test(o.url || '') ? lector(o) : null;
    if (!L) return;
    L.leer(0, 512).then(function (buf) {
      if (yo !== turno) return;
      confirmaFormato(f, F, firma(buf));
      var tot = L.total || total;
      if (tot) f.peso = num(tot / 1e6, 2) + ' MB · ' + num(tot, 0) + ' B';
      f.mime = f.mime || L.tipo || null;
      pintar(f);
    }).catch(function (e) { try { console.warn('[ficha]', e && e.message || e); } catch (_) {} });
  }

  // GIF animado: la ficha es del GIF (no del MP4 intermedio de la vista previa, si lo hay).
  function construirAnim() {
    var F = fuente(); if (!F || F.tipo !== 'anim' || !F.gif) return;
    var yo = ++turno, g = F.gif, o = F.file ? { file: F.file } : { url: F.url };
    var it = o.url && window.PixeriaStock && window.PixeriaStock.item ? window.PixeriaStock.item(o.url) : null;
    var f = { imagen: true, res: g.ancho + ' × ' + g.alto + ' px', asp: aspecto(g.ancho, g.alto), ori: g.ancho > g.alto ? t('Horizontal', 'Landscape') : g.ancho < g.alto ? t('Vertical', 'Portrait') : t('Cuadrado', 'Square'), audio: t('No', 'No') };
    f.mime = (o.file && o.file.type) || (it && it.mime) || 'image/gif';
    detalles(F, f);
    origenDe(o, F.url || '', it, f);
    var total = (o.file && o.file.size) || (it && it.size) || null;
    if (total) f.peso = num(total / 1e6, 2) + ' MB · ' + num(total, 0) + ' B';
    if (yo === turno) pintar(f);
  }
  function construir() {
    var Fa = fuente(); if (Fa && Fa.tipo === 'anim') { construirAnim(); return; }
    var video = $('#src'); if (!video || !video.videoWidth) return;
    var yo = ++turno, src = sinCors(video.currentSrc || video.src), o = origenReal(src);
    var it = o.url && window.PixeriaStock && window.PixeriaStock.item ? window.PixeriaStock.item(o.url) : null;
    var w = video.videoWidth, hgt = video.videoHeight, dur = video.duration;
    var f = { res: w + ' × ' + hgt + ' px', asp: aspecto(w, hgt), ori: w > hgt ? t('Horizontal', 'Landscape') : w < hgt ? t('Vertical', 'Portrait') : t('Cuadrado', 'Square'), dur: tc(dur) };
    f.mime = (o.file && o.file.type) || (it && it.mime) || null;
    origenDe(o, src, it, f);
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
    var video = $('#src'), im = $('#src-img'), sel = $('#src-select'), file = $('#src-file'), box = $('#src-ficha');
    if (!video || !box) return;
    if (sel) sel.addEventListener('change', function () { origen = sel.value ? { url: sel.value } : null; }, true);
    if (file) file.addEventListener('change', function () { var f = file.files && file.files[0]; origen = f ? { file: f } : null; }, true);
    video.addEventListener('loadedmetadata', construir);
    // Al pasar a una imagen el vídeo se vacía: su «emptied» no debe borrar la ficha de la imagen.
    video.addEventListener('emptied', function () { var F = fuente(); if ((im && im.getAttribute('src')) || (F && F.tipo === 'anim')) return; turno++; box.hidden = true; box.innerHTML = ''; });
    document.addEventListener('pixeria:fuente', function (e) {
      var d = e.detail || {}, F = d.fuente;
      if (!F) { turno++; box.hidden = true; box.innerHTML = ''; origen = null; return; }
      origen = F.file ? { file: F.file } : F.url ? { url: F.url } : origen;
      if (d.fase === 'listo' && F.tipo === 'anim') construirAnim();
    });
    if (im) im.addEventListener('load', construirImagen);
    box.addEventListener('click', function (e) {
      var b = e.target.closest('.ficha-copy'); if (!b || !box._texto) return;
      var ok = function () { b.textContent = t('Copiada ✓', 'Copied ✓'); setTimeout(function () { b.textContent = t('Copiar', 'Copy'); }, 1600); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(box._texto).then(ok, function () {}); 
    });
    if (im && im.getAttribute('src') && im.naturalWidth) construirImagen(); else if (video.videoWidth) construir();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
