// Visita guiada de distribución (#4762): la ruta /distribucion de clearchannel-tv
// (Smith) se sirve bajo este mismo origen para que el motor /demo pueda seguir
// la visita dentro de ella (sessionStorage y clics reales solo funcionan en el
// mismo origen). Solo lectura de la ruta + el puente de la pantalla de sala de
// la demo, que en origen ya fija el destino a la sala de la demo.
// DEMO_RUTA_ORIGIN (variable de entorno de Pages) cambia de preview sin tocar código.
const RUTA_POR_DEFECTO = 'https://smith-demo-distribucion-ruta.clearchannel-tv.pages.dev';
const MOTOR = '<script src="/assets/demo-motor.js?v=4762"></script>';

function origenRuta(env) {
  const o = (env && env.DEMO_RUTA_ORIGIN) || RUTA_POR_DEFECTO;
  const u = new URL(o);
  if (u.protocol !== 'https:' || (!u.hostname.endsWith('.pages.dev') && !u.hostname.endsWith('admira.app'))) {
    throw new Error('DEMO_RUTA_ORIGIN no válido');
  }
  return u.origin;
}

// prefijo: lo que se quita de la ruta local antes de ir al origen ('/demo/ruta' o '').
export async function proxyRuta(context, prefijo) {
  const {request, env} = context;
  const url = new URL(request.url);
  // Solo en previews: en producción esta ruta no existe.
  if (!url.hostname.endsWith('.pixeria.pages.dev')) return new Response('not found', {status: 404});
  const destino = new URL(url.pathname.slice(prefijo.length) + url.search, origenRuta(env));
  const init = {method: request.method, headers: {accept: request.headers.get('accept') || '*/*'}};
  if (request.method === 'POST') {
    init.headers['content-type'] = request.headers.get('content-type') || 'application/json';
    init.body = await request.text();
  } else if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('method not allowed', {status: 405});
  }
  const r = await fetch(destino, {...init, redirect: 'manual'});
  const headers = new Headers(r.headers);
  headers.set('x-robots-tag', 'noindex, nofollow');
  headers.set('cache-control', 'no-store');
  const loc = headers.get('location');
  if (loc) {
    const l = new URL(loc, destino);
    if (l.origin === destino.origin) headers.set('location', prefijo + l.pathname + l.search);
  }
  const res = new Response(r.body, {status: r.status, headers});
  if (!(headers.get('content-type') || '').includes('text/html')) return res;
  return new HTMLRewriter()
    .on('head', {element(el) { el.append('<meta name="robots" content="noindex, nofollow">', {html: true}); }})
    .on('body', {element(el) { el.append(MOTOR, {html: true}); }})
    .transform(res);
}
