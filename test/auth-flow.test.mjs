import test from 'node:test';
import assert from 'node:assert/strict';
import {handleAuth, hasSession, safeReturnTo} from '../functions/_auth.js';
import {onRequest} from '../functions/_middleware.js';
import {readFile} from 'node:fs/promises';

function fakeDatabase() {
  const challenges = new Map();
  return {
    prepare(sql) {
      let values = [];
      return {
        bind(...next) { values = next; return this; },
        async run() {
          if (sql.startsWith('INSERT INTO pixeria_login_challenges')) {
            challenges.set(values[0], {return_to:values[1], expires_at:values[3], used_at:null});
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
  assert.equal(safeReturnTo('/auth/callback'), '/');
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

test('los clientes ya no usan popup, FedCM, JWT ni almacenamiento local', async () => {
  const gate = await readFile(new URL('../auth-gate.js', import.meta.url), 'utf8');
  const backoffice = await readFile(new URL('../backoffice/backoffice-auth.js', import.meta.url), 'utf8');
  for (const source of [gate, backoffice]) {
    const executable = source.replace(/\/\*[\s\S]*?\*\//g, '');
    assert.doesNotMatch(executable, /google\.accounts|FedCM|localStorage|parseJwt|response\.credential/);
    assert.match(source, /\/auth\/session/);
  }
});
