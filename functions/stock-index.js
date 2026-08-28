/* /stock-index — el índice del Stock, pero comprimido.
 *
 * El problema: la galería lee el índice de `pub-….r2.dev/stock/index.json`, que
 * son 635 KB y viajan SIN COMPRIMIR. El bucket público de R2 sirve los bytes tal
 * como están guardados y no negocia `Accept-Encoding`, así que da igual lo que
 * pida el navegador. En gzip ese mismo JSON son 120 KB: un 81% menos.
 *
 * La solución sin tocar el Worker del Stock: servirlo desde el propio dominio.
 * pixeria.com es una zona de Cloudflare, y todo lo que sale por ella se comprime
 * en Brotli automáticamente. Esta Function no hace más que traerlo de R2 y
 * devolverlo — la compresión la pone el borde, gratis.
 *
 * Se responde con headers NUEVOS a propósito: reenviar los del origen arrastraría
 * su `Content-Length` (el del JSON sin comprimir) y el navegador cortaría la
 * respuesta comprimida a mitad.
 *
 * El `cacheTtl` guarda la copia en el borde un minuto, igual que el
 * `max-age=60` que ya trae R2: así una ráfaga de visitas no son N viajes al
 * bucket. Y el middleware de la verja no estorba: solo redirige documentos HTML
 * (`Sec-Fetch-Dest: document`), no un fetch de JSON.
 *
 * Respaldo: si esto falla, stock.html sigue teniendo el r2.dev directo.
 *
 * v.28.08.2026.r6 · NeoMBP16 · MacBook Pro 16
 */
const ORIGEN = 'https://pub-bf043a4daa3b43b7a0b769617729d074.r2.dev/stock/index.json';

export async function onRequestGet() {
  let r;
  try {
    r = await fetch(ORIGEN, {
      cf: { cacheTtl: 60, cacheEverything: true },
      headers: { Accept: 'application/json' },
    });
  } catch (e) {
    return error(502, 'no se pudo leer el índice de R2: ' + String(e && e.message || e));
  }
  if (!r.ok) return error(502, 'R2 respondió ' + r.status);

  return new Response(r.body, {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=60',
      'Access-Control-Allow-Origin': '*',
      'X-Stock-Index': 'r2-via-pages',
    },
  });
}

export function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Max-Age': '86400',
    },
  });
}

function error(status, message) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
