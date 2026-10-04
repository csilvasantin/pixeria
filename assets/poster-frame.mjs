// Miniatura de un vídeo en el navegador (Carlos, 4-oct-2026, 23:32): fotograma representativo
// (~10 % de la duración o el segundo 1; si sale oscuro, 30 % y 50 %), 320 px de ancho, JPEG.
// Lo usan las subidas al Stock (app.js y el Adaptador) para mandar `poster` con el vídeo y que
// nada llegue al Stock sin imagen. Devuelve un data:image/jpeg o null (nunca una imagen inventada).
export function posterFromVideo(src, {width = 320, timeout = 20000} = {}) {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.preload = 'auto';
    if (!/^(blob|data):/.test(src)) v.crossOrigin = 'anonymous';
    let done = false, tiempos = [], mejor = null;
    const fin = (r) => { if (done) return; done = true; clearTimeout(reloj); try { v.removeAttribute('src'); v.load(); } catch (_) {} resolve(r); };
    const reloj = setTimeout(() => fin(mejor && mejor.url), timeout);
    v.onerror = () => fin(null);
    v.onloadedmetadata = () => {
      const d = v.duration;
      tiempos = Number.isFinite(d) && d > 2 ? [Math.max(1, d * 0.1), d * 0.3, d * 0.5] : [Math.min(1, (d || 0) / 2)];
      v.currentTime = tiempos.shift();
    };
    v.onseeked = () => {
      try {
        const w = width, h = Math.max(2, Math.round(w * v.videoHeight / v.videoWidth));
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        const ctx = c.getContext('2d'); ctx.drawImage(v, 0, 0, w, h);
        const px = ctx.getImageData(0, 0, w, h).data; let y = 0;
        for (let i = 0; i < px.length; i += 16) y += 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
        y /= px.length / 16;
        const url = c.toDataURL('image/jpeg', 0.8);
        if (!mejor || Math.abs(y - 110) < Math.abs(mejor.y - 110)) mejor = {url, y};
        if ((y >= 25 && y <= 235) || !tiempos.length) return fin(mejor.url);
        v.currentTime = tiempos.shift();
      } catch (_) { fin(null); } // lienzo contaminado (vídeo sin CORS): sin póster, el Stock lo genera después
    };
    v.src = src;
  });
}
