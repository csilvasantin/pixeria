import {handleAuth, hasSession, safeReturnTo} from './_auth.js';

export async function onRequest(context) {
  const {request, env} = context;
  const url = new URL(request.url);
  const authResponse = await handleAuth(request, env);
  if (authResponse) return authResponse;

  const wantsDocument = request.method === 'GET' && (
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

