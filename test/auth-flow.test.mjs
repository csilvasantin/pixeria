import test from 'node:test';
import assert from 'node:assert/strict';
import {createApiToken, esSuperusuario, handleAuth, hasSession, safeReturnTo, verifyApiToken} from '../functions/_auth.js';
import {onRequest} from '../functions/_middleware.js';
import {readFile} from 'node:fs/promises';

function fakeDatabase(initialUsers = []) {
  const challenges = new Map();
  const users = new Map(initialUsers.map(user => [user.email, user]));
  return {
    users, challenges,
    prepare(sql) {
      let values = [];
      return {
        bind(...next) { values = next; return this; },
        async run() {
          if (sql.startsWith('INSERT INTO pixeria_login_challenges')) {
            challenges.set(values[0], {return_to:values[1], expires_at:values[3], used_at:null});
          }
          if (sql.startsWith('INSERT INTO pixeria_users') && !users.has(values[0])) {
            users.set(values[0], {email:values[0], google_sub:values[1], status:'active', session_version:1});
          }
          return {success:true};
        },
        async first() {
          if (sql.startsWith('UPDATE pixeria_login_challenges')) {
            const row = challenges.get(values[1]);
            if (!row || row.used_at || row.expires_at < values[2]) return null;
            row.used_at = values[0];
            return {return_to:row.return_to};
          }
          if (sql.startsWith('SELECT * FROM pixeria_users WHERE google_sub=')) {
            return [...users.values()].find(user => user.google_sub === values[0]) || null;
          }
          if (sql.startsWith('SELECT * FROM pixeria_users WHERE email=')) {
            const user = users.get(values[0]);
            return user && (values.length === 1 || user.google_sub === values[1]) ? user : null;
          }
          return null;
        }
      };
    }
  };
}

const env = () => ({AUTH_DB:fakeDatabase(), PIXERIA_SIGNING_KEY:'test-signing-key-with-enough-entropy'});

test('return_to sólo admite rutas locales y excluye auth', () => {
  assert.equal(safeReturnTo('/backoffice/?mode=edit'), '/backoffice/?mode=edit');
  assert.equal(safeReturnTo('//evil.example'), '/');
  assert.equal(safeReturnTo('https://evil.example'), '/');
  assert.equal(safeReturnTo('/\\evil.example'), '/');
  assert.equal(safeReturnTo('/audio\r\nLocation: https://evil.example'), '/');
  assert.equal(safeReturnTo('/auth/callback'), '/');
});

const owners = ['csilva@admira.com', 'csilvasantin@gmail.com'];
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const testUser = email => ({email, google_sub:'test-google-' + email, status:'active', session_version:1});

async function signedSession(bindings, user, claims = {}) {
  const now = Math.floor(Date.now() / 1000);
  const payload = encode({v:1, aud:'pixeria.com', email:user.email, sub:user.google_sub,
    sv:1, iat:now, exp:now + 86400, sid:'test-session', ...claims});
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(bindings.PIXERIA_SIGNING_KEY),
    {name:'HMAC', hash:'SHA-256'}, false, ['sign']);
  const signature = Buffer.from(await crypto.subtle.sign('HMAC', key,
    new TextEncoder().encode('px:' + payload))).toString('base64url');
  return '__Host-pixeria_session=' + payload + '.' + signature;
}

test('las dos cuentas reutilizan su sesión en ventanas nuevas y en la página de acceso', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({emails:owners}));
  for (const email of owners) {
    const user = testUser(email);
    const bindings = {...env(), AUTH_DB:fakeDatabase([user])};
    const cookie = await signedSession(bindings, user);
    const request = new Request('https://www.pixeria.com/auth/login?return_to=%2Faudio%3Fx%3D1',
      {headers:{Cookie:cookie}});
    const login = await handleAuth(request, bindings);
    assert.equal(login.status, 302);
    assert.equal(login.headers.get('location'), '/audio?x=1');
    assert.equal(login.headers.get('cache-control'), 'no-store');
    assert.equal(login.headers.get('set-cookie'), null, 'no cambia una sesión de 24 h válida');
    assert.equal(bindings.AUTH_DB.challenges.size, 0, 'no inicia otro acceso Google');
    const document = await onRequest({request:new Request('https://www.pixeria.com/audio',
      {headers:{Cookie:cookie}}), env:bindings, next:async () => new Response('Audio autorizado')});
    assert.equal(await document.text(), 'Audio autorizado');
    for (const returnTo of ['//evil.example', '/\\evil.example', 'https://evil.example', '/auth/login']) {
      const result = await handleAuth(new Request('https://www.pixeria.com/auth/login?return_to=' +
        encodeURIComponent(returnTo), {headers:{Cookie:cookie}}), bindings);
      assert.equal(result.headers.get('location'), '/');
    }
  }
});

test('una sesión anterior de 12 h se amplía una sola vez desde el acceso original', async t => {
  t.mock.timers.enable({apis:['Date'], now:Date.parse('2026-09-30T06:00:00Z')});
  t.mock.method(globalThis, 'fetch', async () => Response.json({emails:owners}));
  const user = testUser(owners[0]);
  const bindings = {...env(), AUTH_DB:fakeDatabase([user])};
  const iat = Math.floor(Date.now() / 1000) - 7200;
  const legacy = await signedSession(bindings, user, {iat, exp:iat + 43200});
  for (const path of ['/auth/login?return_to=%2Faudio', '/auth/session', '/auth/api-token']) {
    const result = await handleAuth(new Request('https://www.pixeria.com' + path,
      {headers:{Cookie:legacy}}), bindings);
    const renewed = result.headers.get('set-cookie');
    assert.match(renewed, /Max-Age=79200; HttpOnly; Secure; SameSite=Lax/);
    const cookie = renewed.split(';')[0];
    const payload = JSON.parse(Buffer.from(cookie.split('=')[1].split('.')[0], 'base64url'));
    assert.equal(payload.iat, iat);
    assert.equal(payload.exp, iat + 86400);
    const revisit = await handleAuth(new Request('https://www.pixeria.com/auth/session',
      {headers:{Cookie:cookie}}), bindings);
    assert.equal(revisit.status, 200);
    assert.equal(revisit.headers.get('set-cookie'), null, 'la actividad no prolonga el plazo');
    assert.deepEqual(await revisit.json(), {ok:true, email:user.email, superusuario:esSuperusuario({email:user.email})}, 'no expone claims internos');
  }
});

test('el acceso Google real emite una cookie de 24 h y exige login al caducar', async t => {
  t.mock.timers.enable({apis:['Date'], now:Date.parse('2026-09-30T06:00:00Z')});
  const pair = await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5', modulusLength:2048,
    publicExponent:new Uint8Array([1,0,1]), hash:'SHA-256'}, true, ['sign','verify']);
  const jwk = {...await crypto.subtle.exportKey('jwk', pair.publicKey), kid:'test-key', alg:'RS256'};
  t.mock.method(globalThis, 'fetch', async url => Response.json(String(url).includes('/certs')
    ? {keys:[jwk]} : {emails:owners}));
  const bindings = env();
  const login = await handleAuth(new Request('https://www.pixeria.com/auth/login?return_to=%2Faudio'), bindings);
  const nonce = login.headers.get('set-cookie').split(';')[0].split('=')[1];
  const now = Math.floor(Date.now() / 1000);
  const user = testUser(owners[0]);
  const unsigned = encode({alg:'RS256', kid:'test-key'}) + '.' + encode({
    iss:'https://accounts.google.com', aud:'861856772040-e1ri6kpu6maagtb6crdfbb923hsaalgb.apps.googleusercontent.com',
    sub:user.google_sub, email:user.email, email_verified:true, hd:'admira.com', nonce, exp:now + 300});
  const signature = Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', pair.privateKey,
    new TextEncoder().encode(unsigned))).toString('base64url');
  const callback = await handleAuth(new Request('https://www.pixeria.com/auth/callback', {
    method:'POST', headers:{Cookie:'__Host-pixeria_login_nonce=' + nonce, Origin:'https://accounts.google.com'},
    body:new URLSearchParams({credential:unsigned + '.' + signature})
  }), bindings);
  assert.equal(callback.status, 200);
  const cookieHeader = callback.headers.getSetCookie().find(value => value.startsWith('__Host-pixeria_session='));
  assert.match(cookieHeader, /Max-Age=86400; HttpOnly; Secure; SameSite=Lax/);
  assert.doesNotMatch(cookieHeader, /Domain=/i);
  const cookie = cookieHeader.split(';')[0];
  const payload = JSON.parse(Buffer.from(cookie.split('=')[1].split('.')[0], 'base64url'));
  assert.equal(payload.exp - payload.iat, 86400);
  t.mock.timers.tick(23 * 3600 * 1000);
  assert.equal(await hasSession(new Request('https://www.pixeria.com/audio', {headers:{Cookie:cookie}}), bindings), true);
  t.mock.timers.tick(3600 * 1000);
  const expired = await handleAuth(new Request('https://www.pixeria.com/auth/login', {headers:{Cookie:cookie}}), bindings);
  assert.equal(expired.status, 401);
  assert.match(await expired.text(), /Acceso con Google/);
});

test('reutilizar login no admite sesión manipulada, caducada, suspendida o revocada', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({emails:owners}));
  const user = testUser(owners[1]);
  const bindings = {...env(), AUTH_DB:fakeDatabase([user])};
  const valid = await signedSession(bindings, user);
  const now = Math.floor(Date.now() / 1000);
  const expired = await signedSession(bindings, user, {iat:now - 86401, exp:now - 1});
  const revoked = await signedSession(bindings, user, {sv:2});
  for (const cookie of [valid + 'tampered', expired, revoked]) {
    const response = await handleAuth(new Request('https://www.pixeria.com/auth/login', {headers:{Cookie:cookie}}), bindings);
    assert.equal(response.status, 401);
    assert.match(response.headers.get('set-cookie'), /__Host-pixeria_login_nonce=/);
  }
  user.status = 'suspended';
  assert.equal(await hasSession(new Request('https://www.pixeria.com/audio', {headers:{Cookie:valid}}), bindings), false);
  user.status = 'active';
  t.mock.method(globalThis, 'fetch', async () => Response.json({emails:[]}));
  assert.equal(await hasSession(new Request('https://www.pixeria.com/audio', {headers:{Cookie:valid}}), bindings), false);
});

test('login emite desafío durable y cookie HttpOnly first-party', async () => {
  const response = await handleAuth(new Request('https://www.pixeria.com/auth/login?return_to=%2Fbackoffice%2F'), env());
  assert.equal(response.status, 401);
  assert.match(response.headers.get('set-cookie'), /__Host-pixeria_login_nonce=.*HttpOnly; Secure; SameSite=None/);
  const html = await response.text();
  assert.match(html, /data-ux_mode="redirect"/);
  assert.match(html, /data-login_uri="https:\/\/www\.pixeria\.com\/auth\/callback"/);
  assert.match(html, /Acceso con Google/);
  assert.doesNotMatch(html, /Acceso interno/i);
  assert.doesNotMatch(html, /localStorage|callback:/);
});

test('session ausente falla cerrada y un documento redirige a login', async () => {
  const bindings = env();
  assert.equal(await hasSession(new Request('https://www.pixeria.com/'), bindings), false);
  const response = await onRequest({
    request:new Request('https://www.pixeria.com/backoffice/?x=1', {headers:{Accept:'text/html'}}),
    env:bindings,
    next:async () => new Response('unexpected')
  });
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), '/auth/login?return_to=%2Fbackoffice%2F%3Fx%3D1');
});

test('la verja no depende del Accept: curl y los bots tampoco pasan', async () => {
  // El 1-sep-2026 `curl https://www.pixeria.com/` devolvía la página entera con
  // 200: el middleware solo protegía si el cliente PEDÍA text/html, y el Accept
  // lo elige quien llama (FLT-1484). Ahora manda la ruta.
  const bindings = env();
  const documentos = ['/', '/plataforma.html', '/radar/', '/stock', '/en/index.html'];
  for (const pathname of documentos) {
    const response = await onRequest({
      request:new Request('https://www.pixeria.com' + pathname, {headers:{Accept:'*/*'}}),
      env:bindings,
      next:async () => new Response('fuga: servido sin sesión')
    });
    assert.equal(response.status, 302, pathname + ' se sirvió sin sesión');
    assert.match(response.headers.get('location'), /^\/auth\/login\?return_to=/);
  }
  // Los assets siguen abiertos: si se cerraran, las propias páginas se romperían.
  for (const pathname of ['/assets/site-nav.js', '/assets/cuadratura.css', '/llms.txt', '/favicon.ico']) {
    const response = await onRequest({
      request:new Request('https://www.pixeria.com' + pathname, {headers:{Accept:'*/*'}}),
      env:bindings,
      next:async () => new Response('asset')
    });
    assert.equal(await response.text(), 'asset', pathname + ' quedó tras la verja');
  }
});

test('el token de API sale de la sesión y se verifica sin abrir el proveedor', async () => {
  const bindings = env();
  const minted = await createApiToken(bindings, 'csilva@admira.com');
  assert.equal((await verifyApiToken(minted.token, bindings)).email, 'csilva@admira.com');
  const verify = await handleAuth(new Request('https://www.pixeria.com/auth/verify', {
    method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({token:minted.token})
  }), bindings);
  assert.equal(verify.status, 200);
  assert.equal((await verify.json()).ok, true);
  const anon = await handleAuth(new Request('https://www.pixeria.com/auth/api-token'), bindings);
  assert.equal(anon.status, 401);
});

test('logout directo borra la sesión y vuelve al acceso común', async () => {
  const response = await handleAuth(new Request('https://www.pixeria.com/auth/logout'), env());
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('location'), '/auth/login');
  assert.match(response.headers.get('set-cookie'), /__Host-pixeria_session=;.*Max-Age=0/);
});

test('los clientes ya no usan popup, FedCM, JWT ni almacenamiento local', async () => {
  const gate = await readFile(new URL('../auth-gate.js', import.meta.url), 'utf8');
  const backoffice = await readFile(new URL('../backoffice/backoffice-auth.js', import.meta.url), 'utf8');
  for (const source of [gate, backoffice]) {
    const executable = source.replace(/\/\*[\s\S]*?\*\//g, '');
    assert.doesNotMatch(executable, /google\.accounts|FedCM|localStorage|parseJwt|response\.credential/);
    assert.match(source, /\/auth\/session/);
  }
});


test('Google login exposes only the origin and allows the GIS stylesheet', async () => {
  const response = await handleAuth(new Request('https://www.pixeria.com/auth/login'),
    {AUTH_DB:fakeDatabase(), PIXERIA_SIGNING_KEY:'test-signing-key'});
  assert.equal(response.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
  assert.match(response.headers.get('content-security-policy'), /style-src 'unsafe-inline' https:\/\/accounts\.google\.com\/gsi\/style;/);
  assert.match(response.headers.get('set-cookie'), /HttpOnly; Secure; SameSite=None/);
});

test('canonical login host is selected before issuing a host-only nonce', async () => {
  // No DB bindings: issuing a challenge here would throw and fail the test.
  const response = await handleAuth(new Request('https://pixeria.com/auth/login?return_to=%2Fbackoffice%2F'), {});
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), 'https://www.pixeria.com/auth/login?return_to=%2Fbackoffice%2F');
  assert.equal(response.headers.get('set-cookie'), null);
});

test('con WHITELIST_SITE_TOKEN la verja pregunta /access?site=pixeria y deja entrar a casilla o superuser', async t => {
  const calls = [];
  const verdicts = {
    'agonzalez@admira.com':{ok:true, allowed:true, superuser:false},
    'jsedano@admira.com':{ok:true, allowed:false, superuser:true},
    'nadie@admira.com':{ok:true, allowed:false, superuser:false},
  };
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    calls.push({url:String(url), token:init?.headers?.['X-Whitelist-Token']});
    const email = new URL(String(url)).searchParams.get('email');
    return Response.json(verdicts[email] || {ok:true, allowed:false, superuser:false});
  });
  for (const [email, expected] of [['agonzalez@admira.com', true], ['jsedano@admira.com', true], ['nadie@admira.com', false]]) {
    const user = testUser(email);
    const bindings = {...env(), AUTH_DB:fakeDatabase([user]), WHITELIST_SITE_TOKEN:'site-token-test'};
    const cookie = await signedSession(bindings, user);
    assert.equal(await hasSession(new Request('https://www.pixeria.com/audio', {headers:{Cookie:cookie}}), bindings), expected, email);
  }
  assert.ok(calls.every(call => call.url.startsWith('https://whitelist.admira.store/access?site=pixeria&email=')));
  assert.ok(calls.every(call => call.token === 'site-token-test'));
});

test('sin token y con /list en 401 solo entran los owners (comportamiento previo)', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ok:false, error:'auth required'}, {status:401}));
  const owner = testUser(owners[0]);
  const other = testUser('jsedano@admira.com');
  for (const [user, expected] of [[owner, true], [other, false]]) {
    const bindings = {...env(), AUTH_DB:fakeDatabase([user])};
    const cookie = await signedSession(bindings, user);
    assert.equal(await hasSession(new Request('https://www.pixeria.com/audio', {headers:{Cookie:cookie}}), bindings), expected);
  }
});

test('auth/agente: el formulario se pinta y un token malo no abre sesión', async () => {
  const token = 't'.repeat(64);
  const bindings = {...env(), ADMIRA_AGENT_LOGIN_TOKEN:token};
  const page = await handleAuth(new Request('https://www.pixeria.com/auth/agente'), bindings);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Entrada de agentes/);
  const bad = await handleAuth(new Request('https://www.pixeria.com/auth/agente', {
    method:'POST', headers:{Authorization:'Bearer token-malo-de-prueba-123456789012345678901234', 'X-Agente':'SmithMacMini'}
  }), bindings);
  assert.equal(bad.status, 401);
  assert.equal((await bad.json()).ok, false);
  const absent = await handleAuth(new Request('https://www.pixeria.com/auth/agente'), env());
  assert.equal(absent.status, 404);
});

test('auth/agente: el token bueno devuelve 200 y la cookie abre la verja', async () => {
  const token = 't'.repeat(64);
  const bindings = {...env(), ADMIRA_AGENT_LOGIN_TOKEN:token};
  const good = await handleAuth(new Request('https://www.pixeria.com/auth/agente', {
    method:'POST', headers:{Authorization:`Bearer ${token}`, 'X-Agente':'SmithMacMini'}
  }), bindings);
  assert.equal(good.status, 200);
  const body = await good.json();
  assert.equal(body.ok, true);
  assert.equal(body.agent, true);
  assert.equal(body.email, 'agentes@silicio.admiranext.com');
  const setCookie = good.headers.get('set-cookie') || '';
  assert.match(setCookie, /__Host-pixeria_session=/);
  const cookie = setCookie.split(';', 1)[0];
  assert.equal(await hasSession(new Request('https://www.pixeria.com/', {headers:{Cookie:cookie}}), bindings), true);
  const home = await onRequest({
    request:new Request('https://www.pixeria.com/', {headers:{Cookie:cookie, Accept:'text/html'}}),
    env:bindings,
    next:async () => new Response('dentro')
  });
  assert.equal(await home.text(), 'dentro');
});

test('superusuario: las cuentas de Carlos y la sesión de agente; nadie más', () => {
  assert.equal(esSuperusuario({email:'csilvasantin@gmail.com'}), true);
  assert.equal(esSuperusuario({email:'CSilva@Admira.com'}), true);
  assert.equal(esSuperusuario({email:'agentes@silicio.admiranext.com', agent:true}), true);
  assert.equal(esSuperusuario({email:'otra@admira.com'}), false);
  assert.equal(esSuperusuario(null), false);
});
