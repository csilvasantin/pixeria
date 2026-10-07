// Avatar digital compartido (encargo avatar · 4-oct-2026). Inyecta en cada página
// HTML el cargador único de la red, igual que se inyecta la presencia en los
// sitios gemelos: https://www.admiranext.com/assets/avatar.js decide si se ve
// (elección del usuario > interruptor del proyecto en admiranext.com > apagado).
// data-brain="/avatar-ask": las preguntas van al relé de este mismo origen.
export const AVATAR_LOADER = 'https://www.admiranext.com/assets/avatar.js?v=20261007-demo-ack-1';
const TAG = '<script defer src="' + AVATAR_LOADER + '" data-brain="/avatar-ask" data-admira-avatar></script>';
// Sello de versión con novedades (Merovingio, 06-10-2026): mismo mecanismo, mismo origen.
export const SELLO_LOADER = 'https://www.admiranext.com/assets/sello-novedades.js';
const SELLO_TAG = '<script defer src="' + SELLO_LOADER + '?v=20261006-sello-1" data-admira-sello-loader></script>';
const ORIGINS = 'https://www.admiranext.com https://digitalavatar.ai https://cdn.jsdelivr.net';

export function wantsAvatar(response, url) {
  if (!response || response.status !== 200) return false;
  if (!String(response.headers.get('content-type') || '').includes('text/html')) return false;
  const path = url ? url.pathname : '/';
  return !path.startsWith('/auth/');           // ni en la verja ni en el login
}

export function withAvatar(response, url) {
  if (!wantsAvatar(response, url)) return response;
  const csp = response.headers.get('content-security-policy');
  if (csp) {
    const headers = new Headers(response.headers);
    headers.set('content-security-policy', csp
      .replace(/script-src ([^;]+)/, '$& ' + ORIGINS)
      .replace(/connect-src ([^;]+)/, '$& ' + ORIGINS));
    response = new Response(response.body, {status: response.status, statusText: response.statusText, headers});
  }
  return new HTMLRewriter().on('head', {element(el) { el.append(TAG + SELLO_TAG, {html: true}); }}).transform(response);
}
