// Avatar digital compartido: la verja inyecta el cargador de admiranext.com solo en páginas HTML.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {wantsAvatar, AVATAR_LOADER} from '../functions/_avatar-loader.js';

const html = (status = 200) => new Response('<html><head></head></html>', {status, headers: {'content-type': 'text/html; charset=utf-8'}});

test('solo páginas HTML servidas, nunca la verja ni el login', () => {
  assert.equal(wantsAvatar(html(), new URL('https://www.pixeria.com/')), true);
  assert.equal(wantsAvatar(html(), new URL('https://www.pixeria.com/auth/login')), false);
  assert.equal(wantsAvatar(html(302), new URL('https://www.pixeria.com/')), false);
  assert.equal(wantsAvatar(new Response('{}', {headers: {'content-type': 'application/json'}}), new URL('https://www.pixeria.com/avatar-ask')), false);
  assert.equal(AVATAR_LOADER, 'https://www.admiranext.com/assets/avatar.js?v=20261007-demo-ack-1');
});

test('el CLI conoce /avatar, /avatarON, /avatarOFF y los alias antiguos', () => {
  const src = readFileSync(new URL('../assets/expert-cli.js', import.meta.url), 'utf8');
  for (const v of ['avatar', 'avataron', 'avataroff', 'avatardigital', 'digitalavatar']) assert.match(src, new RegExp("case '" + v + "'"));
  assert.match(src, /window\.AdmiraAvatar/);
});

test('avatar-digital.js ya no enciende solo: delega en el cargador', () => {
  const src = readFileSync(new URL('../assets/avatar-digital.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /digitalavatar\.ai\/embed\.js/);
  assert.doesNotMatch(src, /if \(storedOn\(\)\) show\(\)/);
  assert.match(src, /admiranext\.com\/assets\/avatar\.js/);
  assert.ok(src.includes(AVATAR_LOADER), 'legacy CLI fallback loads the same confirmed-demo avatar version');
});
