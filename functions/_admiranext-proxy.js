/**
 * Reenvío a admiranext.com — el motor común de pixeria.com/tiktok.
 * ================================================================
 * El compositor de TikTok es la capa CREAR, así que su URL pública debe ser
 * Pixeria; pero su código y su backend viven en admiranext.com, detrás de la
 * verja privada de /presentaciones. Copiarlos dejaría dos bases de código y dos
 * juegos de claves que se separan solos. Así que no se copia: se reenvía.
 *
 * Dos detalles que costaron una vuelta:
 * 1) Los estáticos del compositor cuelgan de /assets en admiranext, y ese
 *    prefijo YA EXISTE en Pixeria con otros ficheros. El cuerpo se reescribe al
 *    vuelo (/assets/… → /tiktok/_assets/…) y aquí se traduce de vuelta: todo
 *    queda en el MISMO origen y no hay CORS que valga (sin él la fuente no carga).
 * 2) En Cloudflare Pages, functions/tiktok/[[path]].js cubre /tiktok/* pero NO
 *    /tiktok a secas (en `wrangler pages dev` sí, y por eso engaña). El módulo es
 *    común para que la ruta exacta y la comodín no se separen nunca.
 *
 * No abre ninguna puerta: sin cookie válida, admiranext sigue devolviendo 401 y
 * su pantalla de acceso. Lo único que cambia es por qué dominio entra.
 */

import { SKIN_PATH, skinResponse, injectSkin } from './_tiktok-skin.js';

const UPSTREAM = 'https://www.admiranext.com';
const ASSET_PREFIX = '_assets/';
// Solo se reescriben cuerpos de texto; vídeo e imágenes pasan intactos.
const REWRITABLE = /^(?:text\/html|text\/css|application\/javascript|text\/javascript|application\/json)/i;

export async function proxyToAdmiranext(context, rest, area) {
  const { request } = context;
  const url = new URL(request.url);
  const path = String(rest || '');

  // La piel de Pixeria se sirve AQUI, no se pide arriba: es nuestra, no del
  // compositor. Va antes de tocar el upstream para que no se reenvie nunca.
  if (area === 'tiktok' && path === SKIN_PATH) return skinResponse();

  const target = new URL(UPSTREAM);
  target.search = url.search;
  target.pathname = (area === 'tiktok' && path.startsWith(ASSET_PREFIX))
    ? `/assets/${path.slice(ASSET_PREFIX.length)}`
    : `/${area}/${path}`;

  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.set('x-forwarded-host', url.host);   // rastro de por dónde entró
  headers.set('origin', UPSTREAM);              // el backend comprueba mismo origen

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

  let body = (await upstream.text())
    .replace(/(["'(])\/assets\//g, `$1/tiktok/${ASSET_PREFIX}`)
    .replace(/https:\/\/www\.admiranext\.com\/tiktok\//g, `${url.origin}/tiktok/`);

  // Solo el HTML se viste, y solo del compositor: una hoja o un JS no llevan
  // <head>, y colarles el enlace los rompería.
  if (area === 'tiktok' && /^text\/html/i.test(type)) body = injectSkin(body);

  return new Response(body, { status: upstream.status, statusText: upstream.statusText, headers: out });
}
