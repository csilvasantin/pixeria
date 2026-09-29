const container = document.querySelector('#piezas');
const status = document.querySelector('#status');
const catalogURL = new URL('./piezas.json', location.href);
function node(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text) el.textContent = text;
  return el;
}
try {
  const [catalogResponse, configResponse] = await Promise.all([fetch(catalogURL), fetch('./config.json')]);
  if (!catalogResponse.ok || !configResponse.ok) throw new Error('Catálogo no disponible');
  const {items} = await catalogResponse.json();
  const config = await configResponse.json();
  const base = new URL(config.distributionBase);
  if (base.protocol !== 'https:') throw new Error('Destino de distribución no válido');
  for (const item of items) {
    const card = node('article', 'card'); card.dataset.circuito = item.circuito;
    const visual = node('div', 'visual');
    const video = node('video'); video.controls = true; video.preload = 'none'; video.playsInline = true;
    video.src = item.url; video.poster = new URL(item.miniatura, catalogURL).href;
    video.setAttribute('aria-label', `Vídeo ${item.marca}: ${item.titulo}`);
    visual.append(video, node('span', 'tag', 'VÍDEO PRINCIPAL · EJEMPLO'));
    const body = node('div', 'body'); const meta = node('div', 'meta');
    meta.append(node('strong', '', item.marca), node('span', '', `${item.duration.toLocaleString('es-ES', {maximumFractionDigits:1})} s · Vertical`));
    body.append(meta, node('h3', '', item.titulo), node('p', 'desc', item.circuito === 'jti' ? 'Comercio de proximidad · Sin tabaco' : 'Una pausa, un café y una sonrisa.'));
    const audioWrap = node('details', 'audio'); const audio = node('audio');
    audio.controls = true; audio.preload = 'none'; audio.src = item.audioUrl;
    audio.setAttribute('aria-label', `Hilo musical ${item.marca}`);
    audioWrap.append(node('summary', '', 'Hilo musical · Escuchar acompañamiento'), audio);
    const actions = node('div', 'actions'); const stock = node('a', 'stock', 'Ver en Stock ↗');
    stock.href = `/stock.html?highlight=${encodeURIComponent(item.videoId)}`;
    const distribute = node('a', 'distribute', 'Distribuir →');
    distribute.setAttribute('aria-label', `Distribuir ${item.marca}: ${item.titulo}`);
    const target = new URL(base); target.searchParams.set('pieza', item.videoId); target.searchParams.set('piezas', catalogURL.href);
    distribute.href = target.href; actions.append(stock, distribute); body.append(audioWrap, actions); card.append(visual, body); container.append(card);
  }
  status.hidden = true;
  document.querySelector('#circuito').addEventListener('change', e => {
    for (const card of container.children) card.hidden = e.target.value !== 'all' && card.dataset.circuito !== e.target.value;
  });
  // Keep previews from playing over one another.
  document.addEventListener('play', e => {
    for (const media of document.querySelectorAll('video,audio')) if (media !== e.target) media.pause();
  }, true);
} catch (error) {
  status.textContent = 'No se pudo cargar la biblioteca. Recarga la página para volver a intentarlo.';
  console.error(error);
}
