/** Ids fijos de la Cafebrería y a qué material del GLB corresponde cada uno.
 *  El id de emisión no es el id del inventario: PANTALLA_<id de inventario>.
 *  Hilo y tele no tienen material de pantalla en alsea-4380.json. */

export const CAFE_ASSETS = new Set(['1790375438696-1ladz7', '1790370079244-cv7t5i']);

export const EMISION = [
  {id:'cafebreria-pizarra-1', material:'PANTALLA_pizarra-1', inventory:'pizarra-1', kind:'video'},
  {id:'cafebreria-pizarra-2', material:'PANTALLA_pizarra-2', inventory:'pizarra-2', kind:'video'},
  {id:'cafebreria-pizarra-3', material:'PANTALLA_pizarra-3', inventory:'pizarra-3', kind:'video'},
  {id:'cafebreria-recogida', material:'PANTALLA_pantalla-recogida', inventory:'pantalla-recogida', kind:'video'},
  {id:'cafebreria-tele', material:null, inventory:null, kind:'dom'},
  {id:'cafebreria-hilo', material:null, inventory:null, kind:'audio'},
];

export const TU_PAUSA = {
  video:'https://api.admira.store/stock/asset/1790609061411-86drpb',
  audio:'https://api.admira.store/stock/asset/1790608402098-xubtdh',
  title:'Tu pausa',
};

const SOURCE = 'demo-cafebreria';

export function signageURL(tail, hostname) {
  const host = hostname ?? globalThis.location?.hostname ?? '';
  const path = String(tail || '').replace(/^\//, '');
  if (String(host).endsWith('.pages.dev')) return '/api/demo-signage/' + path;
  return 'https://api.admira.store/signage/' + path;
}

/** El feed también devuelve broadcasts (sin target). Esos no se pintan. */
export function pickFeedItem(payload, screenId) {
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const mine = items.filter(it => it && it.target === screenId && typeof it.src === 'string' && it.src.startsWith('https://'));
  mine.sort((a, b) => (Number(b.ts) || 0) - (Number(a.ts) || 0));
  return mine[0] || null;
}

/** La tele con vídeo suena. Una pizarra con vídeo va muda (es textura). El audio siempre habla. */
export function screenSpeaks(id, item) {
  if (!item || id === 'cafebreria-hilo') return false;
  const kind = String(item.kind || '');
  const mime = String(item.mime || '');
  if (kind === 'audio' || mime.startsWith('audio/')) return true;
  return id === 'cafebreria-tele' && !!item.src;
}

export function bedVolume(byId) {
  const talking = EMISION.some(row => screenSpeaks(row.id, byId?.[row.id]));
  return talking ? 0.15 : 1;
}

export function pushBody(screenId) {
  const row = EMISION.find(item => item.id === screenId);
  if (!row) return null;
  const audio = row.kind === 'audio';
  return {
    kind: audio ? 'audio' : 'video',
    src: audio ? TU_PAUSA.audio : TU_PAUSA.video,
    mime: audio ? 'audio/mpeg' : 'video/mp4',
    title: TU_PAUSA.title,
    target: screenId,
    interrupt: false,
    source: SOURCE,
    meta: {source: SOURCE, page: 'Cafebreria demo'},
  };
}
