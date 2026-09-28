// Fases reales de la canción. El porcentaje solo existe si el motor lo manda.
// Medias del 28 sep 2026 en este Mac: dos piezas tardaron 93 s y 99 s de encargada
// a vídeo listo. Un vídeo pedido con la pieza ya completa tardó 13 s. No hay media
// medida de la letra ni de la publicación.

export const MUESTRAS = {
  hastaVideoSeg: [93, 99],
  videoSoloSeg: [13],
};

const LABELS = {
  es: {
    cola: 'En cola',
    letra: 'Generando letra',
    audio: 'Generando audio',
    video: 'Generando vídeo',
    publicar: 'Publicando',
    listo: 'Listo',
    fallo: 'Falló',
  },
  en: {
    cola: 'Queued',
    letra: 'Writing lyrics',
    audio: 'Generating audio',
    video: 'Generating video',
    publicar: 'Publishing',
    listo: 'Ready',
    fallo: 'Failed',
  },
};

export function mediaSeg(nums) {
  if (!nums || !nums.length) return null;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

export function realPercent(value) {
  const n = typeof value === 'number' ? value : Number.NaN;
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return Math.round(n);
}

export function hideMotorName(text) {
  return String(text || '').replace(/su\s*no/ig, 'motor').replace(/\s+/g, ' ').trim().slice(0, 180);
}

function cleanUrl(value) {
  const url = String(value || '').trim();
  if (!url || /forbidden/i.test(url)) return '';
  return url;
}

export function phaseFromClip(clip) {
  if (!clip) return 'cola';
  const st = String(clip.status || '').toLowerCase();
  const meta = clip.metadata || {};
  if (st === 'error' || st === 'failed' || meta.error_message || meta.error_type) return 'fallo';
  if (clip.video_pending || meta.video_is_pending) return 'video';
  if (cleanUrl(clip.video_url)) return 'listo';
  if (st === 'complete' && cleanUrl(clip.audio_url)) return 'listo';
  if (cleanUrl(clip.audio_url) || st === 'streaming' || st === 'running' || st === 'generating') return 'audio';
  return 'cola';
}

export function estimateFor(phase) {
  if (phase === 'audio' || phase === 'cola') {
    return { sec: mediaSeg(MUESTRAS.hastaVideoSeg), n: MUESTRAS.hastaVideoSeg.length, kind: 'hasta-video' };
  }
  if (phase === 'video') {
    return { sec: mediaSeg(MUESTRAS.videoSoloSeg), n: MUESTRAS.videoSoloSeg.length, kind: 'video' };
  }
  return { sec: null, n: 0, kind: 'none' };
}

export function progressView({ phase, elapsedSec, percent, error, en }) {
  const lang = en ? 'en' : 'es';
  const name = LABELS[lang][phase] || LABELS[lang].cola;
  const pct = realPercent(percent);
  const est = estimateFor(phase);
  const elapsed = Math.max(0, Math.round(Number(elapsedSec) || 0));
  let time;
  if (phase === 'fallo') time = en ? 'stopped' : 'parado';
  else if (phase === 'listo') time = en ? `done in ${elapsed}s` : `listo en ${elapsed}s`;
  else if (est.sec == null) time = en ? `${elapsed}s elapsed · no average for this phase` : `${elapsed}s · sin media de esta fase`;
  else if (elapsed > est.sec) time = en ? `${elapsed}s elapsed · average was ${est.sec}s (${est.n})` : `${elapsed}s · la media fue ${est.sec}s (${est.n})`;
  else if (est.kind === 'video') time = en ? `${elapsed}s elapsed · about ${est.sec}s once the piece is complete (${est.n})` : `${elapsed}s · estimado ~${est.sec}s con la pieza ya completa (${est.n})`;
  else time = en ? `${elapsed}s elapsed · about ${est.sec}s until the video (${est.n})` : `${elapsed}s · estimado ~${est.sec}s hasta el vídeo (${est.n})`;
  const detail = phase === 'fallo' && error ? `${name}: ${hideMotorName(error)}` : name;
  return { label: detail, time, percent: pct };
}
