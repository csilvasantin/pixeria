const CLIENT_ID = '861856772040-e1ri6kpu6maagtb6crdfbb923hsaalgb.apps.googleusercontent.com';
const CALLBACK_URI = 'https://www.pixeria.com/auth/callback';
const WHITELIST_URL = 'https://admira-whitelist.csilvasantin.workers.dev/list';
const SESSION_COOKIE = '__Host-pixeria_session';
const CHALLENGE_COOKIE = '__Host-pixeria_login_nonce';
const SESSION_TTL_SECONDS = 12 * 60 * 60;
const CHALLENGE_TTL_MS = 10 * 60 * 1000;
const OWNER_FALLBACK = new Set(['csilva@admira.com', 'csilvasantin@gmail.com']);
const encoder = new TextEncoder();
const READY = new WeakSet();

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS pixeria_users (
    email TEXT PRIMARY KEY,
    google_sub TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended')),
    session_version INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    last_login_at INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS pixeria_login_challenges (
    nonce TEXT PRIMARY KEY,
    return_to TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    used_at INTEGER
  )`,
  `CREATE INDEX IF NOT EXISTS idx_pixeria_login_expiry
    ON pixeria_login_challenges(expires_at)`
];

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  })[char]);
}

function base64url(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeBase64url(value) {
  const raw = String(value).replace(/-/g, '+').replace(/_/g, '/');
  const padded = raw + '='.repeat((4 - raw.length % 4) % 4);
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

function sameValue(left, right) {
  left = String(left || '');
  right = String(right || '');
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function randomId() {
  return crypto.randomUUID ? crypto.randomUUID() : base64url(crypto.getRandomValues(new Uint8Array(24)));
}

function cookieJar(request) {
  const jar = {};
  (request.headers.get('Cookie') || '').split(/;\s*/).forEach((part) => {
    const separator = part.indexOf('=');
    if (separator > 0) jar[part.slice(0, separator)] = part.slice(separator + 1);
  });
  return jar;
}

function cookiesNamed(request, name) {
  return (request.headers.get('Cookie') || '').split(/;\s*/).flatMap((part) => {
    const separator = part.indexOf('=');
    return separator > 0 && part.slice(0, separator) === name ? [part.slice(separator + 1)] : [];
  });
}

function normalEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}

export function safeReturnTo(value) {
  const candidate = String(value || '/');
  if (!candidate.startsWith('/') || candidate.startsWith('//') || candidate.length > 1024) return '/';
  if (candidate.startsWith('/auth/')) return '/';
  return candidate;
}

async function hmac(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), {name:'HMAC', hash:'SHA-256'}, false, ['sign']
  );
  return base64url(await crypto.subtle.sign('HMAC', key, encoder.encode(message)));
}

async function ensureSchema(env) {
  if (!env.AUTH_DB) throw new Error('AUTH_DB no configurado');
  if (READY.has(env.AUTH_DB)) return;
  for (const statement of SCHEMA) await env.AUTH_DB.prepare(statement).run();
  READY.add(env.AUTH_DB);
}

async function createChallenge(env, returnTo, now = Date.now()) {
  await ensureSchema(env);
  const nonce = randomId();
  const destination = safeReturnTo(returnTo);
  await env.AUTH_DB.prepare(
    'INSERT INTO pixeria_login_challenges(nonce,return_to,created_at,expires_at,used_at) VALUES(?,?,?,?,NULL)'
  ).bind(nonce, destination, now, now + CHALLENGE_TTL_MS).run();
  try {
    await env.AUTH_DB.prepare(
      'DELETE FROM pixeria_login_challenges WHERE expires_at<? OR (used_at IS NOT NULL AND used_at<?)'
    ).bind(now - CHALLENGE_TTL_MS, now - CHALLENGE_TTL_MS).run();
  } catch (_) {}
  return {nonce, returnTo:destination};
}

async function consumeChallenge(env, nonce, now = Date.now()) {
  await ensureSchema(env);
  if (String(nonce || '').length < 32 || String(nonce).length > 128) return null;
  const row = await env.AUTH_DB.prepare(
    'UPDATE pixeria_login_challenges SET used_at=? WHERE nonce=? AND used_at IS NULL AND expires_at>=? RETURNING return_to'
  ).bind(now, String(nonce), now).first();
  return row ? safeReturnTo(row.return_to) : null;
}

async function emailAllowed(email, fetchImpl = fetch) {
  const normalized = normalEmail(email);
  if (!normalized) return false;
  try {
    const response = await fetchImpl(WHITELIST_URL, {
      headers:{Accept:'application/json'},
      cf:{cacheTtl:60, cacheEverything:true}
    });
    if (!response.ok) throw new Error('whitelist_unavailable');
    const payload = await response.json();
    return Array.isArray(payload.emails) && payload.emails.map(normalEmail).includes(normalized);
  } catch (_) {
    return OWNER_FALLBACK.has(normalized);
  }
}

export async function verifyGoogleCredential(credential, fetchImpl = fetch) {
  if (!credential || credential.length > 6000) return null;
  try {
    const parts = credential.split('.');
    if (parts.length !== 3) return null;
    const header = JSON.parse(new TextDecoder().decode(decodeBase64url(parts[0])));
    const payload = JSON.parse(new TextDecoder().decode(decodeBase64url(parts[1])));
    if (header.alg !== 'RS256' || !header.kid || !payload.sub) return null;
    const certificates = await fetchImpl('https://www.googleapis.com/oauth2/v3/certs', {
      headers:{Accept:'application/json'},
      cf:{cacheTtl:21600, cacheEverything:true}
    });
    if (!certificates.ok) return null;
    const jwks = await certificates.json();
    const jwk = Array.isArray(jwks.keys) && jwks.keys.find((item) =>
      item.kid === header.kid && item.kty === 'RSA' && item.alg === 'RS256'
    );
    if (!jwk) return null;
    const key = await crypto.subtle.importKey(
      'jwk', jwk, {name:'RSASSA-PKCS1-v1_5', hash:'SHA-256'}, false, ['verify']
    );
    const validSignature = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5', key, decodeBase64url(parts[2]), encoder.encode(parts[0] + '.' + parts[1])
    );
    const email = normalEmail(payload.email);
    const now = Math.floor(Date.now() / 1000);
    const issuerValid = payload.iss === 'accounts.google.com' || payload.iss === 'https://accounts.google.com';
    const emailVerified = payload.email_verified === true || payload.email_verified === 'true';
    const googleAuthoritative = email.endsWith('@gmail.com') || (emailVerified && typeof payload.hd === 'string' && payload.hd.length > 0);
    if (!validSignature || payload.aud !== CLIENT_ID || !issuerValid || !emailVerified || !googleAuthoritative || Number(payload.exp) <= now) return null;
    return {email, sub:String(payload.sub), nonce:String(payload.nonce || '')};
  } catch (_) {
    return null;
  }
}

async function upsertUser(env, identity) {
  await ensureSchema(env);
  const now = Date.now();
  const existingBySubject = await env.AUTH_DB.prepare(
    'SELECT * FROM pixeria_users WHERE google_sub=? LIMIT 1'
  ).bind(identity.sub).first();
  if (existingBySubject && existingBySubject.email !== identity.email) return null;
  const existingByEmail = await env.AUTH_DB.prepare(
    'SELECT * FROM pixeria_users WHERE email=? LIMIT 1'
  ).bind(identity.email).first();
  if (existingByEmail && existingByEmail.google_sub !== identity.sub) return null;
  await env.AUTH_DB.prepare(
    `INSERT INTO pixeria_users(email,google_sub,status,session_version,created_at,updated_at,last_login_at)
     VALUES(?,?,'active',1,?,?,?)
     ON CONFLICT(email) DO UPDATE SET updated_at=excluded.updated_at,last_login_at=excluded.last_login_at`
  ).bind(identity.email, identity.sub, now, now, now).run();
  return env.AUTH_DB.prepare('SELECT * FROM pixeria_users WHERE email=?').bind(identity.email).first();
}

async function createSessionToken(env, user) {
  if (!env.PIXERIA_SIGNING_KEY) throw new Error('PIXERIA_SIGNING_KEY no configurado');
  const now = Math.floor(Date.now() / 1000);
  const payload = base64url(encoder.encode(JSON.stringify({
    v:1, aud:'pixeria.com', email:user.email, sub:user.google_sub,
    sv:Number(user.session_version), iat:now, exp:now + SESSION_TTL_SECONDS,
    sid:randomId()
  })));
  return `${payload}.${await hmac(env.PIXERIA_SIGNING_KEY, `px:${payload}`)}`;
}

async function readSession(request, env) {
  try {
    if (!env.PIXERIA_SIGNING_KEY) return null;
    const token = cookieJar(request)[SESSION_COOKIE];
    if (!token || token.length > 4096) return null;
    const separator = token.lastIndexOf('.');
    if (separator < 0) return null;
    const payloadPart = token.slice(0, separator);
    const signature = token.slice(separator + 1);
    if (!sameValue(signature, await hmac(env.PIXERIA_SIGNING_KEY, `px:${payloadPart}`))) return null;
    const payload = JSON.parse(new TextDecoder().decode(decodeBase64url(payloadPart)));
    const now = Math.floor(Date.now() / 1000);
    if (payload.aud !== 'pixeria.com' || Number(payload.exp) <= now || Number(payload.iat) > now + 60) return null;
    const email = normalEmail(payload.email);
    if (!email || !(await emailAllowed(email))) return null;
    await ensureSchema(env);
    const user = await env.AUTH_DB.prepare('SELECT * FROM pixeria_users WHERE email=? AND google_sub=?').bind(email, String(payload.sub || '')).first();
    if (!user || user.status !== 'active' || Number(user.session_version) !== Number(payload.sv)) return null;
    return {email:user.email};
  } catch (_) {
    return null;
  }
}

function loginCsrfValid(request, formToken) {
  const origin = request.headers.get('Origin');
  if (origin && origin !== 'null' && origin !== 'https://accounts.google.com' && origin !== new URL(request.url).origin) return false;
  const officialCookies = cookiesNamed(request, 'g_csrf_token').filter((value) => value.length >= 32);
  const field = String(formToken || '');
  return !(officialCookies.length && (field.length < 32 || !officialCookies.some((value) => sameValue(value, field))));
}

function secureHeaders(contentType = 'text/html; charset=utf-8') {
  return {
    'content-type':contentType,
    'cache-control':'no-store',
    'x-robots-tag':'noindex, nofollow',
    'referrer-policy':'no-referrer',
    'content-security-policy':"default-src 'none'; script-src https://accounts.google.com/gsi/client; frame-src https://accounts.google.com/gsi/; style-src 'unsafe-inline'; img-src data: https://*.googleusercontent.com; connect-src https://accounts.google.com/gsi/; form-action 'self' https://accounts.google.com; frame-ancestors 'none'; base-uri 'none'"
  };
}

function loginPage(nonce, error = '') {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pixeria · Acceso</title><style>
  :root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at 50% 35%,#18240e,#070a04 68%);color:#f4e2b0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.box{width:100%;max-width:430px;padding:36px 30px;border:1px solid #b5651d;border-radius:16px;background:#120d06;box-shadow:0 25px 80px #000b;text-align:center}.mark{color:#e8c25a;font:700 12px ui-monospace,monospace;letter-spacing:.24em;text-transform:uppercase}h1{margin:16px 0 8px;font-size:28px}p{margin:0 0 24px;color:#baaa86;line-height:1.55}.picker{display:flex;justify-content:center;min-height:44px}.error{margin-top:18px;color:#ff8f7a;font:600 13px ui-monospace,monospace}.foot{margin-top:24px;color:#74684f;font:11px ui-monospace,monospace}</style></head><body><main class="box"><div class="mark">Pixeria · Google</div><h1>Acceso con Google</h1><p>El mismo acceso de Google funciona en cualquier navegador. Pixeria comprueba que la cuenta esté autorizada y crea una sesión segura en este dispositivo.</p><div id="g_id_onload" data-client_id="${CLIENT_ID}" data-login_uri="${CALLBACK_URI}" data-nonce="${escapeHtml(nonce)}" data-ux_mode="redirect" data-auto_prompt="false"></div><div class="picker"><div class="g_id_signin" data-type="standard" data-shape="rectangular" data-theme="outline" data-text="continue_with" data-size="large" data-width="320" data-ux_mode="redirect"></div></div>${error ? `<div class="error">${escapeHtml(error)}</div>` : ''}<div class="foot">csilva@admira.com · csilvasantin@gmail.com</div></main><script src="https://accounts.google.com/gsi/client" async defer></script></body></html>`;
}

async function loginResponse(env, returnTo = '/', error = '', status = 401) {
  const challenge = await createChallenge(env, returnTo);
  const response = new Response(loginPage(challenge.nonce, error), {status, headers:secureHeaders()});
  response.headers.append('Set-Cookie', `${CHALLENGE_COOKIE}=${challenge.nonce}; Path=/; Max-Age=600; HttpOnly; Secure; SameSite=None`);
  return response;
}

function continuationResponse(returnTo) {
  const destination = safeReturnTo(returnTo);
  return new Response(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${escapeHtml(destination)}"><title>Entrando · Pixeria</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#070a04;color:#e8c25a;font:600 14px ui-monospace,monospace}</style></head><body>Sesión verificada. Entrando…</body></html>`, {
    status:200,
    headers:{...secureHeaders(), refresh:`0;url=${destination}`, 'content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'"}
  });
}

export async function handleAuth(request, env) {
  const url = new URL(request.url);
  if (url.pathname === '/auth/login' && request.method === 'GET') {
    return loginResponse(env, url.searchParams.get('return_to') || '/');
  }
  if (url.pathname === '/auth/callback' && request.method === 'POST') {
    const form = await request.formData();
    const identity = await verifyGoogleCredential(String(form.get('credential') || ''));
    const ownNonce = cookieJar(request)[CHALLENGE_COOKIE] || '';
    if (!identity || !loginCsrfValid(request, form.get('g_csrf_token')) || !sameValue(identity.nonce, ownNonce)) {
      return loginResponse(env, '/', 'No se pudo verificar el acceso.', 401);
    }
    const returnTo = await consumeChallenge(env, identity.nonce);
    if (!returnTo || !(await emailAllowed(identity.email))) {
      return loginResponse(env, '/', 'Cuenta no autorizada para Pixeria.', 403);
    }
    const user = await upsertUser(env, identity);
    if (!user || user.status !== 'active') return loginResponse(env, '/', 'Cuenta no autorizada para Pixeria.', 403);
    const token = await createSessionToken(env, user);
    const response = continuationResponse(returnTo);
    response.headers.append('Set-Cookie', `${SESSION_COOKIE}=${token}; Path=/; Max-Age=${SESSION_TTL_SECONDS}; HttpOnly; Secure; SameSite=Lax`);
    response.headers.append('Set-Cookie', `${CHALLENGE_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=None`);
    response.headers.append('Set-Cookie', 'g_csrf_token=; Path=/; Max-Age=0; Secure; SameSite=Lax');
    return response;
  }
  if (url.pathname === '/auth/session' && request.method === 'GET') {
    const session = await readSession(request, env);
    return Response.json(session ? {ok:true, email:session.email} : {ok:false}, {
      status:session ? 200 : 401,
      headers:{'cache-control':'no-store', 'referrer-policy':'no-referrer'}
    });
  }
  if (url.pathname === '/auth/logout' && request.method === 'POST') {
    const response = new Response(null, {status:303, headers:{location:'/auth/login', 'cache-control':'no-store'}});
    response.headers.append('Set-Cookie', `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`);
    return response;
  }
  return null;
}

export async function hasSession(request, env) {
  return Boolean(await readSession(request, env));
}
