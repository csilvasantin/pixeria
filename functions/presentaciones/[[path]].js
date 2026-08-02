/**
 * pixeria.com/presentaciones/* — reenvío al área privada de admiranext.
 * =====================================================================
 * El compositor de /tiktok llama a /presentaciones/api/{ad-idea, grok-video,
 * video-reference, video-package}, y esa área está protegida por la verja de
 * admiranext (identidad + contraseña, cookies firmadas con HMAC). Para que el
 * compositor funcione bajo pixeria.com sin relajar NADA de esa verja, se
 * reenvían también estas rutas: llega la misma pantalla de acceso, se validan
 * los mismos tokens y las cookies se quedan en el dominio de Pixeria.
 *
 * No se abre ninguna puerta: sin cookie válida, admiranext sigue devolviendo
 * 401 igual que ahora. Lo único que cambia es por qué dominio entra la petición.
 */

const UPSTREAM = 'https://www.admiranext.com';
const REWRITABLE = /^(?:text\/html|text\/css|application\/javascript|text\/javascript|application\/json)/i;

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const rest = (context.params.path || []).join('/');

  const target = new URL(`${UPSTREAM}/presentaciones/${rest}`);
  target.search = url.search;

  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.set('x-forwarded-host', url.host);
  headers.set('origin', UPSTREAM);

  const upstream = await fetch(new Request(target.toString(), {
    method: request.method,
    headers,
    body: (request.method === 'GET' || request.method === 'HEAD') ? undefined : request.body,
    redirect: 'manual',
  }));

  const out = new Headers(upstream.headers);
  out.delete('content-encoding');
  out.delete('content-length');

  const loc = out.get('location');
  if (loc) {
    try {
      const abs = new URL(loc, UPSTREAM);
      if (abs.hostname.endsWith('admiranext.com')) {
        abs.protocol = url.protocol; abs.host = url.host;
        out.set('location', abs.toString());
      }
    } catch (_) {}
  }

  const type = out.get('content-type') || '';
  if (!REWRITABLE.test(type)) {
    return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers: out });
  }
  const body = (await upstream.text()).replace(/(["'(])\/assets\//g, '$1/tiktok/_assets/');
  return new Response(body, { status: upstream.status, statusText: upstream.statusText, headers: out });
}
