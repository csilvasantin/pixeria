// Read displayed media dimensions, including the browser's image/video rotation.
// No canvas, OCR or inference: unavailable metadata never guesses orientation.
export function readMediaDimensions(source, type, {timeout = 12000} = {}) {
  if (!source || !['image', 'video'].includes(type)) return Promise.resolve(null);
  return new Promise(resolve => {
    const owned = typeof Blob !== 'undefined' && source instanceof Blob;
    const url = owned ? URL.createObjectURL(source) : source;
    const el = type === 'image' ? new Image() : document.createElement('video');
    let done = false;
    const finish = value => {
      if (done) return; done = true; clearTimeout(timer);
      el.onload = el.onloadedmetadata = el.onerror = null;
      el.removeAttribute('src');
      if (type === 'video') { try { el.load(); } catch {} }
      if (owned) URL.revokeObjectURL(url);
      resolve(value);
    };
    const timer = setTimeout(() => finish(null), timeout);
    const loaded = () => {
      const width = type === 'image' ? el.naturalWidth : el.videoWidth;
      const height = type === 'image' ? el.naturalHeight : el.videoHeight;
      finish(Number.isInteger(width) && Number.isInteger(height) && width > 0 && height > 0 && width <= 65535 && height <= 65535 ? {width, height} : null);
    };
    el.onerror = () => finish(null);
    if (type === 'image') el.onload = loaded;
    else { el.preload = 'metadata'; el.muted = true; el.playsInline = true; el.onloadedmetadata = loaded; }
    el.src = url;
  });
}
