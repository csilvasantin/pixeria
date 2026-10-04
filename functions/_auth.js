const CLIENT_ID = '861856772040-e1ri6kpu6maagtb6crdfbb923hsaalgb.apps.googleusercontent.com';
const CALLBACK_URI = 'https://www.pixeria.com/auth/callback';
// dominio propio: LaLiga bloquea workers.dev en horas de fútbol, FLT-1633
const WHITELIST_URL = 'https://whitelist.admira.store/list';
// Desde FLT-100603 el GET anónimo a /list devuelve 401: sin token la verja caía
// siempre en OWNER_FALLBACK y solo entraban los dos owners. Ahora se pregunta
// como los perímetros de xpaceos.com/admira.store: /access?site=pixeria con
// WHITELIST_SITE_TOKEN (solo lectura). Entra quien tenga la casilla «pixeria»
// en admira-whitelist o sea superuser de AdmiraNeXT. admira.studio es el gemelo
// generado por sync.sh y comparte la misma casilla (el slug en minúscula no se
// sustituye).
const WHITELIST_ACCESS_URL = 'https://whitelist.admira.store/access';
const WHITELIST_SITE = 'pixeria';
const ACCESS_CACHE_MS = 60 * 1000;
const ACCESS_CACHE = new Map();
const SESSION_COOKIE = '__Host-pixeria_session';
const CHALLENGE_COOKIE = '__Host-pixeria_login_nonce';
const SESSION_TTL_SECONDS = 24 * 60 * 60;
// Entrada de servicio para los agentes de silicio (Carlos, 3-oct-2026). No tienen
// cuenta de Google: entran en /auth/agente con ADMIRA_AGENT_LOGIN_TOKEN, el mismo
// secret que admira.store, xpaceos y admira.biz. La cookie lleva la huella del
// token, así que cambiar el secret corta también las sesiones ya abiertas.
const AGENT_EMAIL = 'agentes@silicio.admiranext.com';
const AGENT_TOKEN_MIN = 32;
const API_TOKEN_TTL_SECONDS = 15 * 60;
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
  if (!candidate.startsWith('/') || candidate.startsWith('//') || candidate.length > 1024 || /[\\\u0000-\u001f\u007f]/.test(candidate)) return '/';
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

async function emailAllowed(email, env = {}, fetchImpl = fetch) {
  const normalized = normalEmail(email);
  if (!normalized) return false;
  const siteToken = String((env && env.WHITELIST_SITE_TOKEN) || '').trim();
  const machineToken = String((env && env.WHITELIST_MACHINE_TOKEN) || '').trim();
  try {
    if (siteToken) {
      const cached = ACCESS_CACHE.get(normalized);
      if (cached && cached.until > Date.now()) return cached.allowed;
      const query = `?site=${encodeURIComponent(WHITELIST_SITE)}&email=${encodeURIComponent(normalized)}`;
      const response = await fetchImpl(WHITELIST_ACCESS_URL + query, {
        headers:{Accept:'application/json', 'X-Whitelist-Token':siteToken},
        cache:'no-store'
      });
      if (!response.ok) throw new Error('whitelist_unavailable');
      const payload = await response.json();
      const allowed = payload.ok === true && (payload.allowed === true || payload.superuser === true);
      ACCESS_CACHE.set(normalized, {allowed, until:Date.now() + ACCESS_CACHE_MS});
      return allowed;
    }
    const headers = {Accept:'application/json'};
    if (machineToken) headers['X-Whitelist-Token'] = machineToken;
    const response = await fetchImpl(WHITELIST_URL, machineToken ? {headers, cache:'no-store'} : {
      headers,
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

export async function createApiToken(env, email, now = Math.floor(Date.now() / 1000)) {
  if (!env.PIXERIA_SIGNING_KEY) throw new Error('PIXERIA_SIGNING_KEY no configurado');
  const payload = base64url(encoder.encode(JSON.stringify({
    v:1, aud:'api.admira.store', email, iat:now, exp:now + API_TOKEN_TTL_SECONDS,
  })));
  return { token:`${payload}.${await hmac(env.PIXERIA_SIGNING_KEY, `api:${payload}`)}`, exp:now + API_TOKEN_TTL_SECONDS };
}

export async function verifyApiToken(token, env, now = Math.floor(Date.now() / 1000)) {
  try {
    if (!env.PIXERIA_SIGNING_KEY || !token || String(token).length > 4096) return null;
    const separator = String(token).lastIndexOf('.');
    if (separator < 1) return null;
    const payloadPart = String(token).slice(0, separator);
    const signature = String(token).slice(separator + 1);
    if (!sameValue(signature, await hmac(env.PIXERIA_SIGNING_KEY, `api:${payloadPart}`))) return null;
    const payload = JSON.parse(new TextDecoder().decode(decodeBase64url(payloadPart)));
    if (payload.aud !== 'api.admira.store' || payload.v !== 1) return null;
    if (Number(payload.exp) <= now || Number(payload.iat) > now + 60) return null;
    const email = normalEmail(payload.email);
    if (!email) return null;
    return { email, exp:Number(payload.exp) };
  } catch (_) {
    return null;
  }
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
    // Sesión de agente: no pasa por la lista ni por la tabla de usuarios de Google.
    // Vale mientras el token con el que se abrió siga siendo el vigente.
    if (payload.agent || email === AGENT_EMAIL) {
      const fingerprint = await agentFingerprint(env);
      return email === AGENT_EMAIL && fingerprint && sameValue(String(payload.agent || ''), fingerprint)
        ? {email, agent:true, payload} : null;
    }
    if (!email || !(await emailAllowed(email, env))) return null;
    await ensureSchema(env);
    const user = await env.AUTH_DB.prepare('SELECT * FROM pixeria_users WHERE email=? AND google_sub=?').bind(email, String(payload.sub || '')).first();
    if (!user || user.status !== 'active' || Number(user.session_version) !== Number(payload.sv)) return null;
    return {email:user.email, payload};
  } catch (_) {
    return null;
  }
}

// Upgrade a still-valid 12 h session once, without making the expiry slide on
// every visit. Signature, allowlist, suspension and session version were checked
// by readSession; the new deadline remains 24 h after the original Google login.
async function withSessionRenewal(response, session, env) {
  const expiresAt = Number(session.payload.iat) + SESSION_TTL_SECONDS;
  if (Number(session.payload.exp) < expiresAt) {
    const payload = base64url(encoder.encode(JSON.stringify({...session.payload, exp:expiresAt})));
    const token = `${payload}.${await hmac(env.PIXERIA_SIGNING_KEY, `px:${payload}`)}`;
    const maxAge = expiresAt - Math.floor(Date.now() / 1000);
    response.headers.append('Set-Cookie', `${SESSION_COOKIE}=${token}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`);
  }
  return response;
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
    'content-security-policy':"default-src 'none'; script-src https://accounts.google.com/gsi/client; frame-src https://accounts.google.com/gsi/; style-src 'unsafe-inline' https://accounts.google.com/gsi/style; img-src data: https://*.googleusercontent.com; connect-src https://accounts.google.com/gsi/; form-action 'self' https://accounts.google.com; frame-ancestors 'none'; base-uri 'none'"
  };
}

function loginPage(nonce, error = '') {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pixeria · Acceso</title><style>
  :root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at 50% 35%,#18240e,#070a04 68%);color:#f4e2b0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.box{width:100%;max-width:430px;min-width:0;padding:36px 30px;border:1px solid #b5651d;border-radius:16px;background:#120d06;box-shadow:0 25px 80px #000b;text-align:center}.mark{color:#e8c25a;font:700 12px ui-monospace,monospace;letter-spacing:.24em;text-transform:uppercase}h1{margin:16px 0 8px;font-size:28px}p{margin:0 0 24px;color:#baaa86;line-height:1.55}.picker{display:flex;justify-content:center;min-height:44px;max-width:100%;overflow:hidden}@media (max-width:430px){body{padding:14px}.box{padding:28px 18px}}.error{margin-top:18px;color:#ff8f7a;font:600 13px ui-monospace,monospace}.foot{margin-top:24px;color:#74684f;font:11px ui-monospace,monospace}</style></head><body><main class="box"><div class="mark">Pixeria · Google</div><h1>Acceso con Google</h1><p>Entra una vez con tu cuenta autorizada de Google. Tu sesión se conserva durante 24 horas en las pestañas y ventanas de este navegador y perfil.</p><div id="g_id_onload" data-client_id="${CLIENT_ID}" data-login_uri="${CALLBACK_URI}" data-nonce="${escapeHtml(nonce)}" data-ux_mode="redirect" data-auto_prompt="false"></div><div class="picker"><div class="g_id_signin" data-type="standard" data-shape="rectangular" data-theme="outline" data-text="continue_with" data-size="large" data-ux_mode="redirect"></div></div>${error ? `<div class="error">${escapeHtml(error)}</div>` : ''}<div class="foot">csilva@admira.com · csilvasantin@gmail.com</div></main><script src="https://accounts.google.com/gsi/client" async defer></script></body></html>`;
}

async function loginResponse(env, returnTo = '/', error = '', status = 401) {
  const challenge = await createChallenge(env, returnTo);
  const response = new Response(loginPage(challenge.nonce, error), {status, headers:{...secureHeaders(), 'referrer-policy':'strict-origin-when-cross-origin'}});
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

function agentToken(env) {
  const token = String(env.ADMIRA_AGENT_LOGIN_TOKEN || '');
  return token.length >= AGENT_TOKEN_MIN ? token : '';
}

async function agentFingerprint(env) {
  const token = agentToken(env);
  return token && env.PIXERIA_SIGNING_KEY
    ? (await hmac(env.PIXERIA_SIGNING_KEY, `agente:${token}`)).slice(0, 22) : '';
}

async function createAgentSessionToken(env, who) {
  const now = Math.floor(Date.now() / 1000);
  const payload = base64url(encoder.encode(JSON.stringify({
    v:1, aud:'pixeria.com', email:AGENT_EMAIL, sub:`agente:${who}`,
    sv:1, iat:now, exp:now + SESSION_TTL_SECONDS, sid:randomId(),
    agent:await agentFingerprint(env)
  })));
  return `${payload}.${await hmac(env.PIXERIA_SIGNING_KEY, `px:${payload}`)}`;
}

function agentSessionCookie(token) {
  return `${SESSION_COOKIE}=${token}; Path=/; Max-Age=${SESSION_TTL_SECONDS}; HttpOnly; Secure; SameSite=Lax`;
}

function logAgentUse(env, entry, waitUntil) {
  console.log(JSON.stringify({evento:'perimetro_agente', ...entry}));
  if (!env.WHITELIST_SITE_TOKEN || !waitUntil) return;
  const sent = Promise.resolve().then(() => fetch('https://whitelist.admira.store/agent-log', {
    method:'POST',
    headers:{'X-Whitelist-Token':env.WHITELIST_SITE_TOKEN, 'Content-Type':'application/json'},
    body:JSON.stringify(entry)
  })).catch(() => null);
  try { waitUntil(sent); } catch (_) {}
}

function agentPage(returnTo, error) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Pixeria · Entrada de agentes</title><style>
  :root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:#070a04;color:#f4e2b0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.box{width:100%;max-width:430px;padding:32px 26px;border:1px solid #b5651d;border-radius:16px;background:#120d06}.mark{color:#e8c25a;font:700 12px ui-monospace,monospace;letter-spacing:.2em;text-transform:uppercase}h1{margin:14px 0 8px;font-size:22px}p{margin:0 0 18px;color:#baaa86;line-height:1.5;font-size:14px}a{color:#e8c25a}label{display:block;margin:0 0 6px;font:600 12px ui-monospace,monospace;color:#baaa86}input{width:100%;padding:10px;border-radius:8px;border:1px solid #ffffff2a;background:#0008;color:#fff;font-size:14px;margin-bottom:14px}button{width:100%;padding:11px;border-radius:8px;border:1px solid #e8c25a;background:transparent;color:#e8c25a;font:700 13px ui-monospace,monospace;cursor:pointer}.error{margin-top:14px;color:#ff8f7a;font:600 13px ui-monospace,monospace}</style></head><body><main class="box"><div class="mark">Pixeria · perímetro de seguridad</div><h1>Entrada de agentes</h1><p>Para los agentes de silicio de AdmiraNeXT. El token está en la bóveda (ADMIRA_AGENT_LOGIN_TOKEN) y cada entrada queda registrada. Las personas entran con Google en <a href="/auth/login">/auth/login</a>.</p><form method="post" action="/auth/agente" autocomplete="off"><input type="hidden" name="return_to" value="${escapeHtml(returnTo)}"><label for="agente">Agente y máquina</label><input id="agente" name="agente" maxlength="80" placeholder="NeoMBP14" required><label for="token">Token</label><input id="token" name="token" type="password" required><button>Entrar</button></form>${error ? `<div class="error">${escapeHtml(error)}</div>` : ''}</main></body></html>`;
}

function agentHeaders() {
  return {
    'content-type':'text/html; charset=utf-8',
    'cache-control':'no-store',
    'x-robots-tag':'noindex, nofollow',
    'referrer-policy':'no-referrer',
    'content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"
  };
}

// /auth/agente: GET pinta el formulario. POST comprueba el token (Authorization:
// Bearer o campo del formulario — nunca en la URL). Bearer bueno → 200 JSON y
// cookie. Formulario bueno → 303 con la misma cookie. Token malo → 401.
async function agente(request, env, waitUntil) {
  const url = new URL(request.url);
  if (!agentToken(env) || !env.PIXERIA_SIGNING_KEY) {
    return new Response('Not found', {status:404, headers:{'cache-control':'no-store'}});
  }
  if (request.method === 'GET') {
    const canonical = new URL(CALLBACK_URI);
    if (url.hostname.replace(/^www\./, '') === canonical.hostname.replace(/^www\./, '') && url.origin !== canonical.origin) {
      return new Response(null, {status:302, headers:{
        location:canonical.origin + url.pathname + url.search,
        'cache-control':'no-store', 'referrer-policy':'no-referrer'
      }});
    }
    return new Response(agentPage(safeReturnTo(url.searchParams.get('return_to') || '/'), ''), {status:200, headers:agentHeaders()});
  }
  if (request.method !== 'POST') {
    return new Response('Method not allowed', {status:405, headers:{'cache-control':'no-store', allow:'GET, POST'}});
  }
  const origin = request.headers.get('Origin');
  if (origin && origin !== 'null' && origin !== url.origin) {
    return new Response('Origen no válido', {status:403, headers:{'cache-control':'no-store'}});
  }
  const bearer = (request.headers.get('Authorization') || '').match(/^Bearer\s+(\S+)$/i);
  let formToken = '';
  let formAgent = '';
  let formReturn = '';
  if (!bearer) {
    const type = String(request.headers.get('content-type') || '').split(';', 1)[0].trim().toLowerCase();
    if (type === 'application/json') {
      let body = {};
      try { body = await request.json(); } catch (_) {}
      formToken = String(body.token || '');
      formAgent = String(body.agente || '');
      formReturn = String(body.return_to || '');
    } else {
      let form = new FormData();
      try { form = await request.formData(); } catch (_) {}
      formToken = String(form.get('token') || '');
      formAgent = String(form.get('agente') || '');
      formReturn = String(form.get('return_to') || '');
    }
  }
  const given = bearer ? bearer[1] : formToken;
  const who = String(request.headers.get('X-Agente') || formAgent || '').replace(/[^\p{L}\p{N} ._·@-]/gu, '').slice(0, 80) || 'sin nombre';
  const returnTo = safeReturnTo(request.headers.get('X-Return-To') || formReturn || '/');
  const key = env.PIXERIA_SIGNING_KEY;
  const ok = given.length > 0 && given.length <= 512 &&
    sameValue(await hmac(key, `agente-login:${given}`), await hmac(key, `agente-login:${agentToken(env)}`));
  logAgentUse(env, {
    site:'pixeria', host:url.hostname, agente:who, ok, at:new Date().toISOString(),
    ip:request.headers.get('CF-Connecting-IP') || '', ua:(request.headers.get('User-Agent') || '').slice(0, 160)
  }, waitUntil);
  if (!ok) {
    return bearer
      ? Response.json({ok:false, error:'token no válido'}, {status:401, headers:{'cache-control':'no-store'}})
      : new Response(agentPage(returnTo, 'Token no válido.'), {status:401, headers:agentHeaders()});
  }
  const token = await createAgentSessionToken(env, who);
  if (bearer) {
    return Response.json({ok:true, email:AGENT_EMAIL, name:who, agent:true}, {
      status:200,
      headers:{'cache-control':'no-store', 'referrer-policy':'no-referrer', 'set-cookie':agentSessionCookie(token)}
    });
  }
  return new Response(null, {status:303, headers:{
    location:returnTo, 'cache-control':'no-store', 'referrer-policy':'no-referrer',
    'set-cookie':agentSessionCookie(token)
  }});
}

export async function handleAuth(request, env, waitUntil = null) {
  const url = new URL(request.url);
  if (url.pathname === '/auth/agente') return agente(request, env, waitUntil);
  if (url.pathname === '/auth/login' && request.method === 'GET') {
    // The __Host- nonce must be issued on the host receiving Google's POST.
    // Canonicalize the public alias before creating a challenge or setting cookies.
    const canonical = new URL(CALLBACK_URI);
    if (url.hostname.replace(/^www\./, '') === canonical.hostname.replace(/^www\./, '') && url.origin !== canonical.origin) {
      return new Response(null, {status:302, headers:{
        location:canonical.origin + url.pathname + url.search,
        'cache-control':'no-store', 'referrer-policy':'no-referrer'
      }});
    }
    const returnTo = safeReturnTo(url.searchParams.get('return_to') || '/');
    const session = await readSession(request, env);
    if (session) {
      return withSessionRenewal(new Response(null, {status:302, headers:{
        location:returnTo, 'cache-control':'no-store', 'referrer-policy':'no-referrer'
      }}), session, env);
    }
    return loginResponse(env, returnTo);
  }
  if (url.pathname === '/auth/callback' && request.method === 'POST') {
    const form = await request.formData();
    const identity = await verifyGoogleCredential(String(form.get('credential') || ''));
    const ownNonce = cookieJar(request)[CHALLENGE_COOKIE] || '';
    if (!identity || !loginCsrfValid(request, form.get('g_csrf_token')) || !sameValue(identity.nonce, ownNonce)) {
      return loginResponse(env, '/', 'No se pudo verificar el acceso.', 401);
    }
    const returnTo = await consumeChallenge(env, identity.nonce);
    if (!returnTo || !(await emailAllowed(identity.email, env))) {
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
  if (url.pathname === '/auth/api-token' && request.method === 'GET') {
    const session = await readSession(request, env);
    if (!session) return Response.json({ok:false}, {status:401, headers:{'cache-control':'no-store'}});
    const minted = await createApiToken(env, session.email);
    return withSessionRenewal(Response.json({ok:true, token:minted.token, exp:minted.exp, email:session.email}, {
      headers:{'cache-control':'no-store', 'referrer-policy':'no-referrer'}
    }), session, env);
  }
  if (url.pathname === '/auth/verify' && request.method === 'POST') {
    let body = {};
    try { body = await request.json(); } catch (_) {}
    const session = await verifyApiToken(String(body.token || ''), env);
    return Response.json(session ? {ok:true, email:session.email, exp:session.exp} : {ok:false}, {
      status:session ? 200 : 401,
      headers:{'cache-control':'no-store'}
    });
  }
  if (url.pathname === '/auth/session' && request.method === 'GET') {
    const session = await readSession(request, env);
    const response = Response.json(session ? {ok:true, email:session.email} : {ok:false}, {
      status:session ? 200 : 401,
      headers:{'cache-control':'no-store', 'referrer-policy':'no-referrer'}
    });
    return session ? withSessionRenewal(response, session, env) : response;
  }
  if (url.pathname === '/auth/logout' && (request.method === 'GET' || request.method === 'POST')) {
    const response = new Response(null, {status:303, headers:{location:'/auth/login', 'cache-control':'no-store'}});
    response.headers.append('Set-Cookie', `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`);
    return response;
  }
  return null;
}

export async function hasSession(request, env) {
  return Boolean(await readSession(request, env));
}
