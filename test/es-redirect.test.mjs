// /es/… no existe (el español vive en la raíz): la verja lo lleva a la misma ruta sin /es.
import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequest} from '../functions/_middleware.js';
const pedir = (path) => onRequest({request: new Request('https://www.pixeria.com' + path, {headers: {Accept: 'text/html'}}), env: {}, next: () => new Response('ok'), waitUntil() {}});
test('/es/adaptaciones/?cliente=admira → /adaptaciones/?cliente=admira', async () => {
  const r = await pedir('/es/adaptaciones/?cliente=admira');
  assert.equal(r.status, 301); assert.equal(r.headers.get('location'), '/adaptaciones/?cliente=admira');
});
test('/es → /', async () => { assert.equal((await pedir('/es')).headers.get('location'), '/'); });
test('/estancos no se toca (sigue la verja)', async () => { assert.match((await pedir('/estancos')).headers.get('location'), /^\/auth\/login/); });
