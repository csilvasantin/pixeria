/* Adaptaciones · qué contenidos del Stock entran en el Adaptador (Carlos, 5-oct-2026).
 * Script clásico sin DOM, para que stock-select.js lo use en el navegador y los tests en Node (vm):
 * - Vídeos (type video) y, desde el 5-oct-2026, imágenes (type image) JPG, PNG, WebP, GIF (estático o
 *   animado), SVG, HEIC/HEIF y AVIF. Las entradas sin formato reconocible (bin, text/html…) quedan fuera.
 * - Solo URL https (el canvas y FFmpeg leen el archivo con CORS).
 * - Orden: el más reciente primero (createdAt del índice, o el sello del id), sea imagen o vídeo;
 *   el empate conserva el orden del índice. Así «el último contenido generado» es siempre el primero.
 */
(function (root) {
  var MIME = { 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/pjpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
    'image/gif': 'gif', 'image/svg+xml': 'svg', 'image/heic': 'heic', 'image/heif': 'heic', 'image/heic-sequence': 'heic', 'image/heif-sequence': 'heic', 'image/avif': 'avif' };
  var EXT = /^(jpe?g|png|webp|gif|svg|heic|heif|avif)$/i;
  function url(it) { return (it && (it.url || it.mediaUrl)) || ''; }
  function limpia(e) { e = String(e || '').toLowerCase(); return e === 'jpeg' ? 'jpg' : e === 'heif' ? 'heic' : e; }
  // jpg | png | webp | gif | svg | heic | avif | null. Manda el MIME del índice; si no lo trae, la extensión o la URL.
  function extension(it) {
    if (!it) return null;
    var m = String(it.mime || '').toLowerCase().split(';')[0].trim();
    if (m) return MIME[m] || null;
    if (EXT.test(it.ext || '')) return limpia(it.ext);
    var p = /\.([a-z0-9]+)(?:[?#]|$)/i.exec(url(it).replace(/^https?:\/\/[^/]+/i, ''));
    return p && EXT.test(p[1]) ? limpia(p[1]) : null;
  }
  // 'video' | 'image' | null (no entra en el Adaptador).
  function tipo(it) {
    if (!it || !/^https:\/\//.test(url(it))) return null;
    if (it.type === 'video') return 'video';
    if (it.type === 'image' && extension(it)) return 'image';
    return null;
  }
  function fecha(it) {
    var d = Date.parse((it && it.createdAt) || '');
    if (!isNaN(d)) return d;
    var m = /^(\d{12,})-/.exec((it && it.id) || '');
    return m ? +m[1] : 0;
  }
  // Más reciente primero; orden estable (Array.prototype.sort lo es en los motores actuales, pero
  // el índice se compara igualmente para no depender de ello).
  function ordenar(lista) {
    return lista.map(function (it, i) { return { it: it, i: i, f: fecha(it) }; })
      .sort(function (a, b) { return b.f - a.f || a.i - b.i; })
      .map(function (x) { return x.it; });
  }
  function fuentes(items) {
    return ordenar((Array.isArray(items) ? items : []).filter(function (it) { return !!tipo(it); }));
  }
  root.PixeriaStockFuentes = { tipo: tipo, extension: extension, fecha: fecha, ordenar: ordenar, fuentes: fuentes, url: url };
})(typeof window !== 'undefined' ? window : globalThis);
