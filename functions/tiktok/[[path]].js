/**
 * pixeria.com/tiktok — el compositor de TikTok, servido desde su casa.
 * ====================================================================
 * El compositor es la capa CREAR, así que su URL pública debe ser Pixeria. Pero
 * su código y su backend viven en admiranext.com (detrás de la verja privada de
 * /presentaciones), y duplicarlos significaría dos copias que se separan y dos
 * juegos de claves. Así que no se copia: se REENVÍA.
 *
 * Esta función sirve, bajo pixeria.com/tiktok, exactamente lo que responde
 * admiranext.com/tiktok. Una sola base de código, una sola verja: lo que se
 * arregle en admiranext queda arreglado aquí en el mismo despliegue.
 *
 * Los estáticos del compositor cuelgan de /assets en admiranext, y ese prefijo
 * YA EXISTE en Pixeria con otros ficheros. Para no pisarlos, el HTML se reescribe
 * al vuelo: /assets/… → /tiktok/_assets/…, que esta misma función traduce de
 * vuelta. Así todo queda en el mismo origen y no hay CORS que valga (importante
 * para las fuentes, que sin CORS no cargarían).
 *
 * Las llamadas a /presentaciones/api/* las atiende functions/presentaciones/.
 */

const UPSTREAM = 'https://www.admiranext.com';
const ASSET_PREFIX = '_assets/';
// Solo se reescriben cuerpos de texto; el vídeo y las imágenes pasan intactos.
const REWRITABLE = /^(?:text\/html|text\/css|application\/javascript|text\/javascript|application\/json)/i;

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const rest = (context.params.path || []).join('/');

  const target = new URL(UPSTREAM);
  target.search = url.search;
  target.pathname = rest.startsWith(ASSET_PREFIX)
    ? `/assets/${rest.slice(ASSET_PREFIX.length)}`
    : `/tiktok/${rest}`;

  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.set('x-forwarded-host', url.host);          // rastro de por dónde entró
  headers.set('origin', UPSTREAM);                     // el backend comprueba mismo origen

  const upstream = await fetch(new Request(target.toString(), {
    method: request.method,
    headers,
    body: (request.method === 'GET' || request.method === 'HEAD') ? undefined : request.body,
    redirect: 'manual',
  }));

  const out = new Headers(upstream.headers);
  out.delete('content-encoding');
  out.delete('content-length');

  // Una redirección a admiranext sacaría al usuario de pixeria.com a mitad de faena.
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

  const body = (await upstream.text())
    .replace(/(["'(])\/assets\//g, `$1/tiktok/${ASSET_PREFIX}`)
    .replace(/https:\/\/www\.admiranext\.com\/tiktok\//g, `${url.origin}/tiktok/`);

  return new Response(body, { status: upstream.status, statusText: upstream.statusText, headers: out });
}
