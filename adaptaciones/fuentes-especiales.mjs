// Adaptaciones · decodificadores de los formatos de entrada nuevos (Carlos, 5-oct-2026), solo navegador.
// - GIF animado: reproductor en un <canvas> con WebCodecs ImageDecoder, con los retardos del propio GIF.
// - HEIC/HEIF: libheif-js (LGPL-3.0) bajo demanda desde jsDelivr, versión y SHA-256 fijados, si el
//   navegador no lo decodifica de forma nativa (hoy solo Safari lo hace).
// - SVG: rasterizado a un tamaño concreto cargándolo como imagen desde un blob (sin scripts ni
//   recursos externos). El SVG nunca se inserta en el DOM.
const PF = () => globalThis.PixeriaFormatos;

// ── GIF animado ────────────────────────────────────────────────────────────
export const hasImageDecoder = () => typeof globalThis.ImageDecoder === 'function';
// Devuelve null si este navegador no tiene ImageDecoder para GIF (se usará el MP4 intermedio).
export async function gifPlayer(bytes, info) {
  if (!hasImageDecoder()) return null;
  try { if (ImageDecoder.isTypeSupported && !(await ImageDecoder.isTypeSupported('image/gif'))) return null; } catch (_) { return null; }
  const decoder = new ImageDecoder({ data: bytes, type: 'image/gif' });
  await decoder.tracks.ready;
  try { await decoder.completed; } catch (_) {}
  const count = Math.max(1, Math.min(info.fotogramas || 1, decoder.tracks.selectedTrack?.frameCount || info.fotogramas || 1));
  const delays = info.retardos.slice(0, count), total = delays.reduce((a, b) => a + b, 0);
  const canvas = document.createElement('canvas'); canvas.width = info.ancho; canvas.height = info.alto;
  const ctx = canvas.getContext('2d');
  let start = performance.now(), pausedAt = 0, paused = false, frameNo = -1, busy = false, closed = false;
  async function show(i) {
    busy = true;
    try {
      const { image } = await decoder.decode({ frameIndex: i });
      if (!closed) { ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(image, 0, 0, canvas.width, canvas.height); frameNo = i; }
      image.close();
    } finally { busy = false; }
  }
  await show(0);
  const elapsed = now => paused ? pausedAt : (now - start);
  return {
    canvas, frames: count, duration: total / 1000,
    get frameNo() { return frameNo; }, get paused() { return paused; }, get ready() { return frameNo >= 0; },
    get currentTime() { return (elapsed(performance.now()) % (total || 1)) / 1000; },
    play() { if (!paused) return; start = performance.now() - pausedAt; paused = false; },
    pause() { if (paused) return; pausedAt = elapsed(performance.now()); paused = true; },
    // Llamado en cada requestAnimationFrame: decodifica solo cuando toca otro fotograma.
    tick(now) { if (closed || paused || busy || count < 2) return; const i = PF().gifFotogramaEn(delays, elapsed(now)); if (i !== frameNo) show(i).catch(() => {}); },
    close() { closed = true; try { decoder.close(); } catch (_) {} canvas.width = canvas.height = 0; }
  };
}

// ── HEIC / HEIF ────────────────────────────────────────────────────────────
// ES module con el .wasm dentro (sin más peticiones). 2 043 959 B sin comprimir; jsDelivr lo sirve
// con brotli (~0,63 MB). Se comprueba el SHA-256 antes de ejecutarlo.
export const LIBHEIF = {
  version: '1.23.5', licencia: 'LGPL-3.0', bytes: 2043959,
  url: 'https://cdn.jsdelivr.net/npm/libheif-js@1.23.5/libheif-wasm/libheif-bundle.mjs',
  sha256: '095194187be00d3e36335b8ad7f5552d70655e5e2159486d7d36cd4daa47bba9'
};
let libheifLoading = null;
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
function loadLibheif() {
  if (!libheifLoading) libheifLoading = (async () => {
    const r = await fetch(LIBHEIF.url, { credentials: 'omit' });
    if (!r.ok) throw new Error('heic-download');
    const code = await r.arrayBuffer();
    if (hex(await crypto.subtle.digest('SHA-256', code)) !== LIBHEIF.sha256) throw new Error('heic-integrity');
    const url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
    try { const mod = await import(/* @vite-ignore */ url); return mod.default(); } finally { URL.revokeObjectURL(url); }
  })().catch(e => { libheifLoading = null; throw e; });
  return libheifLoading;
}
// bytes → {blob: PNG, ancho, alto, imagenes}. Usa la imagen principal (la primera que devuelve libheif).
export async function decodeHEIC(bytes, onStatus = () => {}) {
  onStatus('loading');
  const lib = await loadLibheif();
  onStatus('decoding');
  const decoder = new lib.HeifDecoder();
  const images = decoder.decode(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
  try {
    if (!images || !images.length) throw new Error('heic-empty');
    const image = images[0], w = image.get_width(), h = image.get_height();
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d'), data = ctx.createImageData(w, h);
    await new Promise((resolve, reject) => image.display(data, out => out ? resolve() : reject(new Error('heic-decode'))));
    ctx.putImageData(data, 0, 0);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    canvas.width = canvas.height = 0;
    if (!blob) throw new Error('heic-canvas');
    return { blob, ancho: w, alto: h, imagenes: images.length };
  } finally {
    for (const im of images || []) try { im.free?.(); } catch (_) {}
    try { decoder.delete?.(); } catch (_) {}
  }
}

// ── SVG ────────────────────────────────────────────────────────────────────
// Pinta el SVG a ancho×alto: se reescribe width/height (el viewBox conserva el dibujo) y se carga
// como imagen desde un blob, así el navegador lo rasteriza en vectorial a ese tamaño.
export async function rasterSVG(texto, ancho, alto) {
  const src = PF().svgConTamano(texto, ancho, alto);
  if (!src) throw new Error('svg-root');
  const url = URL.createObjectURL(new Blob([src], { type: 'image/svg+xml' }));
  try {
    const image = new Image(); image.decoding = 'async'; image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = ancho; canvas.height = alto;
    canvas.getContext('2d').drawImage(image, 0, 0, ancho, alto);
    return canvas;
  } finally { URL.revokeObjectURL(url); }
}
// Caché de rásteres de la previsualización (tamaños cuantizados): como mucho `max` entradas.
export function svgCache(texto, max = 16) {
  const map = new Map();
  return {
    // Devuelve el canvas si ya está; si no, lo pide y llama a onReady cuando llega.
    get(w, h, onReady) {
      const key = `${w}x${h}`, hit = map.get(key);
      if (hit) { map.delete(key); map.set(key, hit); return hit.canvas || null; }
      const entry = { canvas: null };
      map.set(key, entry);
      // A failed raster stays in the map (canvas null): it is not retried on every frame.
      rasterSVG(texto, w, h).then(c => { if (map.get(key) === entry) { entry.canvas = c; onReady?.(); } else c.width = c.height = 0; }).catch(() => {});
      while (map.size > max) { const [k, old] = map.entries().next().value; if (old.canvas) old.canvas.width = old.canvas.height = 0; map.delete(k); }
      return null;
    },
    clear() { for (const e of map.values()) if (e.canvas) e.canvas.width = e.canvas.height = 0; map.clear(); }
  };
}
