import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {handleAuth, safeReturnTo, verifyApiToken} from '../functions/_auth.js';
import {onRequest} from '../functions/_middleware.js';

const state = 'capsule-state-1792740008';
const origin = 'https://www.ainimation.studio';
const bridgePath = '/auth/bridge?' + new URLSearchParams({origin, state});
const bindings = () => ({PIXERIA_SIGNING_KEY:'fixture-signing-key-bridge-only', ADMIRA_AGENT_LOGIN_TOKEN:'fixture-agent-token-bridge-1234567890'});
async function agentCookie(env) {
  const response = await handleAuth(new Request('https://www.pixeria.com/auth/agente', {
    method:'POST', headers:{Authorization:'Bearer ' + env.ADMIRA_AGENT_LOGIN_TOKEN, 'X-Agente':'fixture-bridge'}
  }), env);
  assert.equal(response.status, 200);
  return response.headers.get('set-cookie').split(';')[0];
}

test('bridge return only accepts the two exact trusted editor origins and a bound state', () => {
  for (const target of ['https://ainimation.studio', origin]) {
    const path = '/auth/bridge?' + new URLSearchParams({origin:target, state});
    assert.equal(safeReturnTo(path), path);
  }
  for (const path of [
    '/auth/login', '/auth/callback', '/auth/bridge', '/auth/bridge?origin=' + origin,
    '/auth/bridge?' + new URLSearchParams({origin:'https://www.ainimation.studio.evil.example', state}),
    '/auth/bridge?' + new URLSearchParams({origin:'https://www.ainimation.studio:444', state}),
    '/auth/bridge?' + new URLSearchParams({origin:'http://localhost:9134', state}),
    bridgePath + '&origin=https://evil.example', bridgePath + '&return_to=https://evil.example', bridgePath + '#fragment',
    '/auth/bridge?' + new URLSearchParams({origin, state:'bad<script>'})
  ]) assert.equal(safeReturnTo(path), '/', path);
});

test('bridge rejects untrusted destinations before reading a session or issuing a token', async () => {
  for (const path of ['/auth/bridge', '/auth/bridge?' + new URLSearchParams({origin:'https://evil.example', state}), bridgePath + '&state=duplicate']) {
    const result = await handleAuth(new Request('https://www.pixeria.com' + path), {});
    assert.equal(result.status, 400);
    assert.doesNotMatch(await result.text(), /token|postMessage/);
  }
  const post = await handleAuth(new Request('https://www.pixeria.com' + bridgePath, {method:'POST'}), {});
  assert.equal(post.status, 405);
});

test('bridge uses the existing Google challenge and preserves a strictly local return', async () => {
  const challenges = [];
  const env = {...bindings(), AUTH_DB:{prepare(sql) {
    return {bind(...args){this.args = args; return this;}, async run(){if(sql.startsWith('INSERT INTO pixeria_login_challenges'))challenges.push(this.args); return {success:true};}};
  }}};
  const response = await onRequest({request:new Request('https://www.pixeria.com' + bridgePath), env, next:() => {throw Error('bridge passed through');}});
  assert.equal(response.status, 401);
  assert.match(await response.text(), /Acceso con Google/);
  assert.equal(challenges.length, 1);
  assert.equal(challenges[0][1], bridgePath);
  assert.match(response.headers.get('set-cookie'), /__Host-pixeria_login_nonce=/);
});

test('valid session sends a short-lived API token only to the exact opener origin', async () => {
  const env = bindings();
  const cookie = await agentCookie(env);
  const response = await onRequest({request:new Request('https://www.pixeria.com' + bridgePath, {headers:{Cookie:cookie}}), env, next:() => {throw Error('bridge passed through');}});
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  const html = await response.text();
  const [, nonce, script] = /<script nonce="([^"]+)">([\s\S]*?)<\/script>/.exec(html);
  assert.match(response.headers.get('content-security-policy'), new RegExp("script-src 'nonce-" + nonce + "'"));
  assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  const messages = [];
  let closed = false;
  vm.runInNewContext(script, {window:{opener:{postMessage:(payload, target) => messages.push({payload, target})}, close:() => {closed = true;}}, document:{getElementById:() => ({textContent:''})}});
  assert.equal(messages.length, 1);
  assert.equal(messages[0].target, origin);
  const payload = messages[0].payload;
  assert.equal(payload.type, 'ainimation:auth');
  assert.equal(payload.state, state);
  assert.ok(closed);
  const verified = await verifyApiToken(payload.token, env);
  assert.equal(verified.email, 'agentes@silicio.admiranext.com');
  assert.equal(payload.expiresAt, verified.exp * 1000);
  assert.ok(payload.expiresAt > Date.now() && payload.expiresAt <= Date.now() + 900000);
  vm.runInNewContext(script, {window:{opener:null}, document:{getElementById:() => ({textContent:''})}});
  assert.doesNotMatch(script, /localStorage|sessionStorage|location\.|document\.cookie/);
});

test('bridge canonicalizes the alias before using a host-only login cookie', async () => {
  const response = await handleAuth(new Request('https://pixeria.com' + bridgePath), {});
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), 'https://www.pixeria.com' + bridgePath);
  assert.equal(response.headers.get('set-cookie'), null);
});
