/** Proxy same-origin del canal de emisión para la demo de la Cafebrería.
 *  pages.dev no puede llamar a api.admira.store desde el navegador: el canal
 *  responde con otro origen. Aquí solo pasan las seis pantallas fijas. */

const ALLOW = new Set([
  'cafebreria-pizarra-1',
  'cafebreria-pizarra-2',
  'cafebreria-pizarra-3',
  'cafebreria-recogida',
  'cafebreria-tele',
  'cafebreria-hilo',
]);
const ORIGIN = 'https://api.admira.store';
const SOURCE = 'demo-cafebreria';

export function demoScreenIds() {
  return [...ALLOW];
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {'content-type':'application/json; charset=utf-8', 'cache-control':'no-store'},
  });
}

export function allowedAsset(src) {
  try {
    const url = new URL(src);
    return url.protocol === 'https:' && url.hostname === 'api.admira.store' &&
      (url.pathname.startsWith('/stock/asset/') || url.pathname.startsWith('/signage/'));
  } catch {
    return false;
  }
}

/** Cuerpo que sí puede salir hacia /signage/push. Sin broadcast, sin interrupt, sin local. */
export function rewritePush(body) {
  if (!body || typeof body !== 'object') return {error:'bad-json', status:400};
  const target = String(body.target || '');
  if (!ALLOW.has(target)) return {error:'pantalla-fuera-de-la-demo', status:400};
  const kind = String(body.kind || '');
  if (!['image', 'video', 'audio'].includes(kind)) return {error:'bad-kind', status:400};
  if (!allowedAsset(body.src)) return {error:'asset-fuera-de-stock', status:400};
  return {
    status: 200,
    payload: {
      kind,
      src: String(body.src),
      mime: typeof body.mime === 'string' ? body.mime.slice(0, 80) : '',
      title: typeof body.title === 'string' ? body.title.slice(0, 200) : '',
      target,
      interrupt: false,
      source: SOURCE,
      meta: {source: SOURCE, page: 'Cafebreria demo'},
    },
  };
}

async function pass(upstream) {
  const headers = new Headers(upstream.headers);
  headers.set('cache-control', 'no-store');
  headers.delete('set-cookie');
  return new Response(upstream.body, {status: upstream.status, headers});
}

export async function proxyDemoSignage(request, url, fetchImpl = fetch) {
  const rest = url.pathname.replace(/^\/api\/demo-signage\/?/, '');
  const method = request.method.toUpperCase();
  if (method === 'GET' && rest === 'feed') {
    const screen = url.searchParams.get('screen') || '';
    if (!ALLOW.has(screen)) return json({error:'pantalla-fuera-de-la-demo'}, 400);
    return pass(await fetchImpl(ORIGIN + '/signage/feed?screen=' + encodeURIComponent(screen), {headers:{accept:'application/json'}}));
  }
  if (method === 'GET' && rest === 'screens') {
    return pass(await fetchImpl(ORIGIN + '/signage/screens', {headers:{accept:'application/json'}}));
  }
  if (method === 'POST' && rest === 'push') {
    let body;
    try { body = await request.json(); } catch { return json({error:'bad-json'}, 400); }
    const rewritten = rewritePush(body);
    if (rewritten.error) return json({error:rewritten.error}, rewritten.status);
    return pass(await fetchImpl(ORIGIN + '/signage/push', {
      method: 'POST',
      headers: {'content-type':'application/json'},
      body: JSON.stringify(rewritten.payload),
    }));
  }
  if (method === 'POST' && rest === 'heartbeat') {
    let body = {};
    try { body = await request.json(); } catch { return json({error:'bad-json'}, 400); }
    const screen = String(body.screen || '');
    if (!ALLOW.has(screen)) return json({error:'pantalla-fuera-de-la-demo'}, 400);
    return pass(await fetchImpl(ORIGIN + '/signage/heartbeat', {
      method: 'POST',
      headers: {'content-type':'application/json'},
      body: JSON.stringify({
        screen,
        role: SOURCE,
        version: '4742',
        feed_count: Number(body.feed_count) || 0,
        showing_id: body.showing_id || null,
      }),
    }));
  }
  if (method === 'POST' && /^ack\/[A-Za-z0-9-]+$/.test(rest)) {
    return pass(await fetchImpl(ORIGIN + '/signage/' + rest, {method:'POST'}));
  }
  return json({error:'ruta-no-demo'}, 404);
}
