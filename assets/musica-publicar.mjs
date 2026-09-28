// Plan de publicación de una pieza musical. El vídeo es la pieza principal;
// el mp3, si existe, va detrás. El enlace público es el del vídeo.

export function musicTitle(style, clientName, songTitle) {
  const base = String(songTitle || style || 'Pieza').trim() || 'Pieza';
  const client = String(clientName || '').trim();
  return (client ? `${client} · ${base}` : base).slice(0, 80);
}

export function musicPrompt(style, voice, durationHint) {
  return [voice, style, durationHint].map(v => String(v || '').trim()).filter(Boolean).join(', ');
}

export function musicPublishPlan(clip) {
  const videoUrl = String(clip && clip.videoUrl || '').trim();
  const audioUrl = String(clip && clip.audioUrl || '').trim();
  const pieces = [];
  if (videoUrl) {
    pieces.push({ role: 'primary', type: 'video', mime: 'video/mp4', url: videoUrl });
  }
  if (audioUrl) {
    pieces.push({
      role: videoUrl ? 'secondary' : 'primary',
      type: 'music',
      mime: 'audio/mpeg',
      url: audioUrl,
    });
  }
  return pieces;
}

export function stockLinks(id) {
  const safe = encodeURIComponent(String(id || '').trim());
  return {
    page: `https://www.pixeria.com/stock.html?highlight=${safe}`,
    asset: `https://api.admira.store/stock/asset/${safe}`,
  };
}

export function playerAudioUrl(clip) {
  const videoUrl = String(clip && clip.videoUrl || '').trim();
  const audioUrl = String(clip && clip.audioUrl || '').trim();
  return videoUrl || audioUrl;
}
