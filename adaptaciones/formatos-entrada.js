/* Adaptaciones · formatos de entrada (Carlos, 5-oct-2026): GIF, SVG, HEIC y AVIF además de JPG, PNG y
 * WebP, y fuentes pegadas con ⌘V / Ctrl+V o arrastradas. Script clásico SIN DOM: lo usan
 * adaptaciones.js, ficha-tecnica.js y los tests de Node (vm), igual que stock-fuentes.js.
 * - detectar(): clase (vídeo/imagen) y extensión por MIME, nombre o URL. firma(): formato real por
 *   los primeros bytes (JPEG, PNG, WebP, GIF, SVG, HEIC, AVIF).
 * - gifInfo(): recorre el GIF entero: fotogramas, retardos, bucle NETSCAPE y si es animado.
 * - svgMedidas() / svgConTamano() / svgRaster(): tamaño intrínseco (atributos o viewBox) y el
 *   rasterizado a la resolución de CADA salida. El SVG solo se manipula como texto; nunca entra en
 *   el DOM: el navegador lo pinta como imagen (<img>/Image desde blob, sin scripts).
 * - portapapeles(): qué trae un ⌘V o un soltar (archivo de imagen o vídeo, o una URL) y a dónde va.
 */
(function (root) {
  // Imágenes: extensión canónica, nombre visible y MIME de la blob que se genera.
  var IMAGEN = {
    jpg: { nombre: 'JPEG', mime: 'image/jpeg' }, png: { nombre: 'PNG', mime: 'image/png' },
    webp: { nombre: 'WebP', mime: 'image/webp' }, gif: { nombre: 'GIF', mime: 'image/gif' },
    svg: { nombre: 'SVG', mime: 'image/svg+xml' }, heic: { nombre: 'HEIC', mime: 'image/heic' },
    avif: { nombre: 'AVIF', mime: 'image/avif' }
  };
  var MIME = {
    'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/pjpeg': 'jpg', 'image/png': 'png', 'image/apng': 'png',
    'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg', 'image/svg': 'svg',
    'image/heic': 'heic', 'image/heif': 'heic', 'image/heic-sequence': 'heic', 'image/heif-sequence': 'heic',
    'image/avif': 'avif'
  };
  var EXT_IMG = /^(jpe?g|png|webp|gif|svg|heic|heif|avif)$/i;
  var EXT_VID = /^(mp4|m4v|mov|webm)$/i;
  // Plataformas que solo sabe bajar el importador (yt-dlp): la URL pegada va a la caja 2.
  var IMPORTAR = /(^|\.)(youtube\.com|youtu\.be|instagram\.com|tiktok\.com|x\.com|twitter\.com|vimeo\.com|facebook\.com|fb\.watch|dailymotion\.com|twitch\.tv|reddit\.com|linkedin\.com|pinterest\.[a-z.]+|threads\.net|bsky\.app|streamable\.com)$/i;

  function limpia(e) {
    e = String(e || '').toLowerCase().replace(/^\./, '');
    return e === 'jpeg' ? 'jpg' : e === 'heif' ? 'heic' : e;
  }
  // Extensión del último segmento de un nombre o de la ruta de una URL (sin ?query ni #hash).
  function extDe(s) {
    s = String(s || '');
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) { try { s = new URL(s).pathname; } catch (_) { s = s.replace(/[?#].*$/, ''); } }
    var m = /\.([a-z0-9]{2,5})$/i.exec(s.replace(/[?#].*$/, ''));
    return m ? limpia(m[1]) : '';
  }
  function mimeLimpio(m) { return String(m || '').toLowerCase().split(';')[0].trim(); }

  // {clase:'imagen'|'video', ext} | null. Manda un MIME conocido; si falta (o es genérico), el nombre o la URL.
  function detectar(o) {
    o = o || {};
    var m = mimeLimpio(o.mime);
    if (MIME[m]) return { clase: 'imagen', ext: MIME[m] };
    if (/^video\//.test(m)) return { clase: 'video', ext: extDe(o.nombre || o.url) || m.slice(6) };
    var e = extDe(o.nombre) || extDe(o.url) || limpia(o.ext);
    if (EXT_IMG.test(e)) return { clase: 'imagen', ext: limpia(e) };
    if (EXT_VID.test(e)) return { clase: 'video', ext: e };
    if (/^image\//.test(m)) return { clase: 'imagen', ext: null }; // imagen de un tipo que no adaptamos
    return null;
  }

  // ─── Firma de los primeros bytes ───
  function bytesDe(buf) {
    if (!buf) return new Uint8Array(0);
    if (buf instanceof Uint8Array) return buf;
    if (ArrayBuffer.isView(buf)) return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    return new Uint8Array(buf);
  }
  function ascii(b, a, n) { var s = ''; for (var i = a; i < a + n && i < b.length; i++) s += String.fromCharCode(b[i]); return s; }
  var AVIF_MARCAS = /^(avif|avis)$/, HEIC_MARCAS = /^(heic|heix|hevc|hevx|heim|heis|hevm|hevs)$/, HEIF_GENERICAS = /^(mif1|msf1)$/;
  // 'JPEG' | 'PNG' | 'WebP' | 'GIF' | 'SVG' | 'HEIC' | 'AVIF' | null
  function firma(buf) {
    var b = bytesDe(buf);
    if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return 'JPEG';
    if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) return 'PNG';
    if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') return 'WebP';
    if (/^GIF8[79]a$/.test(ascii(b, 0, 6))) return 'GIF';
    if (ascii(b, 4, 4) === 'ftyp') {
      // ISO BMFF: marca principal y compatibles. AVIF gana a las genéricas mif1/msf1.
      var tam = ((b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3]) >>> 0, marcas = [ascii(b, 8, 4)];
      for (var o = 16; o + 4 <= Math.min(tam, b.length); o += 4) marcas.push(ascii(b, o, 4));
      if (AVIF_MARCAS.test(marcas[0])) return 'AVIF';
      if (HEIC_MARCAS.test(marcas[0])) return 'HEIC';
      if (marcas.some(function (x) { return AVIF_MARCAS.test(x); })) return 'AVIF';
      if (marcas.some(function (x) { return HEIC_MARCAS.test(x) || HEIF_GENERICAS.test(x); })) return 'HEIC';
      return null;
    }
    // SVG: texto que empieza por «<» (tras BOM y espacios) y abre un <svg en los primeros bytes.
    var txt = ascii(b, 0, Math.min(b.length, 4096)).replace(/^\xEF\xBB\xBF/, '');
    if (/^\s*</.test(txt) && /<svg[\s>]/i.test(txt)) return 'SVG';
    return null;
  }
  var FIRMA_EXT = { JPEG: 'jpg', PNG: 'png', WebP: 'webp', GIF: 'gif', SVG: 'svg', HEIC: 'heic', AVIF: 'avif' };

  // ─── GIF ───
  // Retardo efectivo en ms. Como Chrome/Firefox y el demuxer gif de FFmpeg (min_delay 2 cs,
  // default_delay 10 cs): 0 o 1 centésima se reproducen a 100 ms.
  function retardoMs(cs) { return (cs < 2 ? 10 : cs) * 10; }
  // Recorre el GIF entero (no decodifica el LZW, solo salta sus sub-bloques).
  // animado = más de un fotograma; con datos truncados basta la cabecera NETSCAPE2.0.
  function gifInfo(buf) {
    var b = bytesDe(buf);
    if (!/^GIF8[79]a$/.test(ascii(b, 0, 6))) return null;
    var info = { ancho: b[6] | (b[7] << 8), alto: b[8] | (b[9] << 8), fotogramas: 0, retardos: [], duracionMs: 0, netscape: false, bucles: null, truncado: false, animado: false };
    var p = 13, gce = 0;
    if (b[10] & 0x80) p += 3 * (1 << ((b[10] & 7) + 1));
    function saltaSub() { while (p < b.length) { var n = b[p++]; if (!n) return true; p += n; } return false; }
    for (;;) {
      if (p >= b.length) { info.truncado = true; break; }
      var t = b[p++];
      if (t === 0x3B) break; // trailer
      if (t === 0x21) {
        var label = b[p++];
        if (label === 0xF9 && b[p] >= 4) { gce = b[p + 2] | (b[p + 3] << 8); }
        if (label === 0xFF && b[p] === 11 && /^(NETSCAPE2\.0|ANIMEXTS1\.0)$/.test(ascii(b, p + 1, 11))) {
          info.netscape = true;
          if (b[p + 12] >= 3 && b[p + 13] === 1) info.bucles = b[p + 14] | (b[p + 15] << 8); // 0 = infinito
        }
        if (!saltaSub()) { info.truncado = true; break; }
        continue;
      }
      if (t === 0x2C) {
        if (p + 9 > b.length) { info.truncado = true; break; }
        var pk = b[p + 8]; p += 9;
        if (pk & 0x80) p += 3 * (1 << ((pk & 7) + 1));
        p++; // tamaño mínimo de código LZW
        if (!saltaSub()) { info.truncado = true; break; }
        info.fotogramas++; info.retardos.push(retardoMs(gce)); gce = 0;
        continue;
      }
      info.truncado = p < b.length; // byte inesperado: se para sin inventar fotogramas
      break;
    }
    info.duracionMs = info.retardos.reduce(function (a, x) { return a + x; }, 0);
    info.animado = info.fotogramas > 1 || (info.truncado && info.netscape);
    return info;
  }
  // Índice del fotograma visible en el instante t (ms), en bucle.
  function gifFotogramaEn(retardos, t) {
    var total = 0, i; for (i = 0; i < retardos.length; i++) total += retardos[i];
    if (!retardos.length || !(total > 0)) return 0;
    t = ((t % total) + total) % total;
    for (i = 0; i < retardos.length; i++) { if (t < retardos[i]) return i; t -= retardos[i]; }
    return retardos.length - 1;
  }

  // ─── SVG ───
  var POR_UNIDAD = { '': 1, px: 1, pt: 96 / 72, pc: 16, mm: 96 / 25.4, cm: 96 / 2.54, 'in': 96, q: 96 / 101.6 };
  function longitud(v) {
    var m = /^\s*([0-9]*\.?[0-9]+(?:e[+-]?\d+)?)\s*(px|pt|pc|mm|cm|in|q)?\s*$/i.exec(String(v == null ? '' : v));
    if (!m) return null; // %, em, auto…: no son un tamaño absoluto
    var n = parseFloat(m[1]) * POR_UNIDAD[(m[2] || '').toLowerCase()];
    return n > 0 && isFinite(n) ? n : null;
  }
  // Etiqueta raíz <svg …> tras prólogo XML, comentarios y DOCTYPE.
  function raiz(texto) {
    texto = String(texto || '');
    var com = [], c, re = /<!--[\s\S]*?(?:-->|$)/g, m, tag = /<svg\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi;
    while ((c = re.exec(texto))) { com.push([c.index, c.index + c[0].length]); if (!c[0].length) re.lastIndex++; }
    while ((m = tag.exec(texto))) {
      var i = m.index, dentro = com.some(function (r) { return i >= r[0] && i < r[1]; }); // <svg> dentro de un comentario no cuenta
      if (!dentro) return { tag: m[0], ini: i, fin: i + m[0].length };
    }
    return null;
  }
  function atributo(tag, nombre) {
    var m = new RegExp('\\s' + nombre + '\\s*=\\s*("([^"]*)"|\'([^\']*)\')', 'i').exec(tag);
    return m ? (m[2] != null ? m[2] : m[3]) : null;
  }
  // Tamaño intrínseco: width/height absolutos; si falta uno, se deduce del viewBox; si faltan los dos,
  // el viewBox; sin nada, 300×150 (el tamaño por defecto de CSS para elementos reemplazados).
  function svgMedidas(texto) {
    var r = raiz(texto); if (!r) return null;
    var w = longitud(atributo(r.tag, 'width')), h = longitud(atributo(r.tag, 'height'));
    var vb = (atributo(r.tag, 'viewBox') || '').trim().split(/[\s,]+/).map(Number);
    vb = vb.length === 4 && vb.every(isFinite) && vb[2] > 0 && vb[3] > 0 ? vb : null;
    var origen = 'atributos';
    if (w && !h) h = vb ? w * vb[3] / vb[2] : 150;
    else if (h && !w) w = vb ? h * vb[2] / vb[3] : 300;
    else if (!w && !h) { if (vb) { w = vb[2]; h = vb[3]; origen = 'viewBox'; } else { w = 300; h = 150; origen = 'defecto'; } }
    return { ancho: Math.max(1, Math.round(w)), alto: Math.max(1, Math.round(h)), viewBox: vb, origen: origen };
  }
  // Mismo SVG con width/height en px. Sin viewBox se añade el de su tamaño, para que escalar lo
  // redibuje vectorialmente en vez de recortarlo.
  function svgConTamano(texto, ancho, alto) {
    var r = raiz(texto); if (!r) return null;
    var med = svgMedidas(texto), tag = r.tag;
    tag = tag.replace(/\s(width|height)\s*=\s*("[^"]*"|'[^']*')/gi, '');
    var extra = ' width="' + ancho + '" height="' + alto + '"' + (med.viewBox ? '' : ' viewBox="0 0 ' + med.ancho + ' ' + med.alto + '"');
    // Copiado de un SVG en línea suele venir sin espacio de nombres: como imagen no se pintaría.
    if (!/\sxmlns\s*=/i.test(tag)) extra += ' xmlns="http://www.w3.org/2000/svg"';
    if (/xlink:/.test(texto) && !/\sxmlns:xlink\s*=/i.test(tag)) extra += ' xmlns:xlink="http://www.w3.org/1999/xlink"';
    tag = tag.replace(/^<svg\b/i, '<svg' + extra);
    return texto.slice(0, r.ini) + tag + texto.slice(r.fin);
  }
  // Resolución a la que rasterizar para una salida W×H con ese método: la escala que el reencuadre
  // aplica al origen (recorte: max; contener/expandir: min; × zoom). paso:true redondea la escala a
  // saltos de √2 (caché de las previsualizaciones). Se limita a maxLado y maxPx conservando el aspecto.
  function svgRaster(m, W, H, modo, ajustes, opc) {
    opc = opc || {};
    var z = ajustes && ajustes.zoom > 0 ? ajustes.zoom : 1;
    var k = (modo === 'cover' ? Math.max : Math.min)(W / m.ancho, H / m.alto) * z;
    if (opc.paso) k = Math.pow(2, Math.ceil(Math.log2(k) * 2 - 1e-9) / 2);
    var w = Math.max(1, Math.ceil(m.ancho * k - 1e-9)), h = Math.max(1, Math.ceil(m.alto * k - 1e-9));
    var maxLado = opc.maxLado || 8192, maxPx = opc.maxPx || 4096 * 4096;
    var f = Math.min(1, maxLado / Math.max(w, h), Math.sqrt(maxPx / (w * h)));
    if (f < 1) { w = Math.max(1, Math.floor(w * f)); h = Math.max(1, Math.floor(h * f)); }
    return { ancho: w, alto: h, escala: w / m.ancho, limitado: f < 1 };
  }

  // ─── Portapapeles / soltar ───
  // 'imagen' | 'video' | 'importar' | null para una URL pegada.
  function clasificarURL(u) {
    var url; try { url = new URL(String(u || '').trim()); } catch (_) { return null; }
    if (!/^https?:$/.test(url.protocol)) return null;
    var host = url.hostname.toLowerCase();
    if (IMPORTAR.test(host)) return 'importar';
    var e = extDe(url.pathname);
    if (EXT_IMG.test(e)) return 'imagen';
    if (EXT_VID.test(e)) return 'video';
    return 'importar';
  }
  function primeraURL(texto) {
    var m = /https?:\/\/[^\s<>"']+/i.exec(String(texto || ''));
    return m ? m[0].replace(/[),.;:!?]+$/, '') : null;
  }
  // dt: DataTransfer o cualquier objeto con files / items / getData. Devuelve
  //   {archivo: File, clase, ext}   imagen o vídeo (captura, imagen copiada, archivo de Finder)
  //   {url, destino, origen}        destino 'imagen' | 'video' | 'importar'
  //   {ignorado: 'tipo', nombre}    un archivo que no es imagen ni vídeo
  //   null                          nada utilizable
  function portapapeles(dt) {
    if (!dt) return null;
    var archivos = Array.prototype.slice.call(dt.files || []);
    if (!archivos.length && dt.items) Array.prototype.slice.call(dt.items).forEach(function (it) {
      if (it && it.kind === 'file' && typeof it.getAsFile === 'function') { var f = it.getAsFile(); if (f) archivos.push(f); }
    });
    var otro = null;
    for (var i = 0; i < archivos.length; i++) {
      var f = archivos[i], d = detectar({ mime: f.type, nombre: f.name });
      if (d && (d.clase === 'video' || d.ext)) return { archivo: f, clase: d.clase, ext: d.ext };
      if (!otro) otro = f;
    }
    if (otro) return { ignorado: 'tipo', nombre: otro.name || '', mime: otro.type || '' };
    var get = function (t) { try { return typeof dt.getData === 'function' ? dt.getData(t) || '' : ''; } catch (_) { return ''; } };
    var lista = get('text/uri-list').split(/\r?\n/).filter(function (l) { return l && l.charAt(0) !== '#'; })[0];
    var url = primeraURL(lista) || primeraURL(get('text/plain')), origen = 'texto';
    if (!url) { var im = /<img\b[^>]*\ssrc\s*=\s*["'](https?:\/\/[^"']+)["']/i.exec(get('text/html')); if (im) { url = im[1].replace(/&amp;/g, '&'); origen = 'html'; } }
    if (!url) return null;
    var destino = clasificarURL(url);
    return destino ? { url: url, destino: destino, origen: origen } : null;
  }
  // Nombre legible para lo pegado: una captura llega como «image.png».
  function nombrePegado(f, ahora) {
    var n = f && f.name || '';
    if (n && !/^(image|blob|unknown|clipboard)(\.\w+)?$/i.test(n)) return n;
    var d = ahora || new Date(), p = function (x) { return ('0' + x).slice(-2); };
    var ext = (detectar({ mime: f && f.type, nombre: n }) || {}).ext || extDe(n) || 'png';
    return 'pegado-' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()) + '.' + ext;
  }

  root.PixeriaFormatos = {
    IMAGEN: IMAGEN, MIME: MIME, detectar: detectar, extDe: extDe, firma: firma, FIRMA_EXT: FIRMA_EXT,
    gifInfo: gifInfo, gifFotogramaEn: gifFotogramaEn, retardoMs: retardoMs,
    svgMedidas: svgMedidas, svgConTamano: svgConTamano, svgRaster: svgRaster,
    clasificarURL: clasificarURL, portapapeles: portapapeles, nombrePegado: nombrePegado,
    ACCEPT: 'video/*,image/jpeg,image/png,image/webp,image/gif,image/svg+xml,image/heic,image/heif,image/avif,.heic,.heif,.avif,.svg,.gif'
  };
})(typeof window !== 'undefined' ? window : globalThis);
