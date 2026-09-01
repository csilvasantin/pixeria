import {handleAuth, hasSession, safeReturnTo} from './_auth.js';

export async function onRequest(context) {
  const {request, env} = context;
  const url = new URL(request.url);
  const authResponse = await handleAuth(request, env);
  if (authResponse) return authResponse;

  // La verja NO puede depender de lo que diga el cliente. Hasta el 1-sep-2026
  // bastaba `curl https://www.pixeria.com/` (Accept: */*) para llevarse la página
  // entera sin sesión: el Accept lo elige quien llama, así que cualquier bot o
  // scraper con cabecera por defecto entraba (FLT-1484). Ahora manda la RUTA:
  // es documento todo lo que no sea un asset con extensión propia.
  const wantsDocument = request.method === 'GET' && (
    isDocumentPath(url.pathname) ||
    request.headers.get('Sec-Fetch-Dest') === 'document' ||
    (request.headers.get('Accept') || '').includes('text/html')
  );
  if (!wantsDocument) return context.next();
  if (await hasSession(request, env)) return context.next();

  const returnTo = safeReturnTo(url.pathname + url.search);
  return new Response(null, {
    status:302,
    headers:{
      location:`/auth/login?return_to=${encodeURIComponent(returnTo)}`,
      'cache-control':'no-store',
      'x-robots-tag':'noindex, nofollow',
      'referrer-policy':'no-referrer'
    }
  });
}

// Documento = lo que sirve una página: raíz, carpeta, .html o ruta sin extensión.
// Los assets (.js, .css, .png, .woff2, .txt, .json…) se sirven sin verja para que
// no se rompan las páginas ni /llms.txt, /robots.txt y compañía.
function isDocumentPath(pathname) {
  if (pathname.endsWith('/')) return true;
  const last = pathname.slice(pathname.lastIndexOf('/') + 1);
  if (!last.includes('.')) return true;
  return last.endsWith('.html') || last.endsWith('.htm');
}
