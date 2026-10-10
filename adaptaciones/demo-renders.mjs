// The historical JTI/Altadis example is explicit: the normal adapter still opens empty.
const MEDIA = '/adaptaciones/media/';
const SOURCE = MEDIA + 'jti-tu-sitio-de-siempre-fuente.mp4';
const RENDERS = [
  {ratio:'9:16', size:'1080×1920', name:'jti-9x16-1080x1920.mp4', poster:'jti-9x16-poster.jpg'},
  {ratio:'16:9', size:'1920×1080', name:'jti-16x9-1920x1080.mp4', poster:'jti-16x9-poster.jpg'},
  {ratio:'1:1', size:'1080×1080', name:'jti-1x1-1080x1080.mp4', poster:'jti-1x1-poster.jpg'},
  {ratio:'4:5', size:'1080×1350', name:'jti-4x5-1080x1350.mp4', poster:'jti-4x5-poster.jpg'},
];

export function demoCase(search) {
  const id = new URLSearchParams(search).get('demo');
  return id === 'jti' || id === 'altadis' ? id : null;
}

export function mountRenderedDemo({document, search, loadSource}) {
  const id = demoCase(search), host = document.getElementById('demo-renders');
  if (!id || !host) return false;
  const en = document.documentElement.lang === 'en', t = (es, english) => en ? english : es;
  const base = en ? '/en/adaptaciones/' : '/adaptaciones/?lang=es';
  const query = (demo, project = '') => base + (en ? '?' : '&') + 'demo=' + demo + (project ? '&proyecto=' + project : '');
  host.innerHTML = `<div class="sec-hd"><h2 id="demo-renders-title">${id === 'altadis' ? t('Caso Altadis · vídeos listos', 'Altadis case · rendered videos') : t('JTI «Tu sitio de siempre» · vídeos listos', 'JTI “Tu sitio de siempre” · rendered videos')}</h2></div>
    <p>${t('Cuatro archivos MP4 completos del mismo vídeo, listos para reproducir o descargar.', 'Four complete MP4 files from the same source, ready to play or download.')}</p>
    <p class="muted">${t('El caso Altadis de los 9 estancos utiliza esta misma pieza JTI: 9:16 para escaparate y 16:9 para mostrador. Ahora también tiene archivos 1:1 y 4:5.', 'The nine-shop Altadis example uses this same JTI piece: 9:16 for the window and 16:9 for the counter. It now also has 1:1 and 4:5 files.')}</p>
    <p class="muted" id="demo-render-settings">${t('Los archivos 1:1 y 4:5 usan Auto, foco X/Y 50% y zoom 1: encaje del vídeo completo con fondo desenfocado. Los controles del adaptador modifican la adaptación interactiva; estos archivos ya renderizados conservan sus ajustes.', 'The 1:1 and 4:5 files use Auto, focus X/Y 50% and zoom 1: the whole video fits over a blurred background. Adapter controls change the interactive adaptation; these rendered files keep their fixed settings.')}</p>
    <div class="demo-render-grid">${RENDERS.map(render => `<article class="demo-render"><h3>${render.ratio} · ${render.size}</h3><video controls playsinline preload="metadata" poster="${MEDIA + render.poster}" src="${MEDIA + render.name}" aria-label="JTI ${render.ratio}"></video><a class="pill" href="${MEDIA + render.name}" download>${t('Descargar MP4', 'Download MP4')} · ${render.ratio}</a></article>`).join('')}</div>
    <nav class="demo-render-links" aria-label="${t('Ejemplos de adaptación', 'Adaptation examples')}"><a href="${query('jti')}">${t('Ver ejemplo JTI', 'View JTI example')}</a><a href="${query('altadis', 'altadis')}">${t('Abrir caso Altadis', 'Open Altadis case')}</a><a href="${SOURCE}" download>${t('Descargar vídeo original', 'Download source video')}</a></nav>`;
  host.hidden = false;
  loadSource({url:SOURCE, nombre:'JTI «Tu sitio de siempre»', origin:{id:null,title:'JTI «Tu sitio de siempre»'}, clase:'video', origen:'demo'});
  return true;
}
