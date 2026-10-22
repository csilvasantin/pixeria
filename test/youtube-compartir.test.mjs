import test from 'node:test';
import assert from 'node:assert/strict';
import {metadatosYoutube, esVideoCompartible, youtubeConectado} from '../functions/_youtube.js';
import {onRequestPost, onRequestGet} from '../functions/api/youtube/upload.js';

const IT = {id: 'abc-1', type: 'video', mime: 'video/mp4', url: 'https://stock.admira.store/stock/abc-1.mp4', title: 'Cápsula X', comment: 'Resumen', tags: ['capsula', 'formacion', 'capsula']};
const ENV = {YOUTUBE_CLIENT_ID: 'id', YOUTUBE_CLIENT_SECRET: 's', YOUTUBE_REFRESH_TOKEN: 'r'};
const req = (body, origin = 'https://www.pixeria.com') => new Request('https://www.pixeria.com/api/youtube/upload', {method: 'POST', headers: {Origin: origin, 'Content-Type': 'application/json'}, body: JSON.stringify(body)});
const superU = async () => ({email: 'csilva@admira.com', agent: false});

test('metadatos: fuente en descripción, tags únicos, unlisted por defecto', () => {
  const m = metadatosYoutube(IT);
  assert.equal(m.snippet.title, 'Cápsula X');
  assert.match(m.snippet.description, /Fuente: https:\/\/stock\.admira\.store\/stock\/abc-1\.mp4$/);
  assert.deepEqual(m.snippet.tags, ['capsula', 'formacion']);
  assert.equal(m.status.privacyStatus, 'unlisted');
  assert.equal(metadatosYoutube(IT, {privacyStatus: 'private'}).status.privacyStatus, 'private');
  assert.equal(metadatosYoutube(IT, {privacyStatus: 'raro'}).status.privacyStatus, 'unlisted');
});

test('solo vídeos del Stock', () => {
  assert.equal(esVideoCompartible(IT), true);
  assert.equal(esVideoCompartible({...IT, url: 'https://evil.example/x.mp4'}), false);
  assert.equal(esVideoCompartible({...IT, type: 'image', mime: 'image/png', url: 'https://stock.admira.store/a.png'}), false);
});

test('sin secretos: 503 YouTube no conectado', async () => {
  assert.equal(youtubeConectado({}), false);
  const r = await onRequestPost({request: req({id: 'abc-1'}), env: {}, data: {sessionInfo: superU}});
  assert.equal(r.status, 503);
  assert.equal((await r.json()).mensaje, 'YouTube no conectado');
  assert.deepEqual(await (await onRequestGet({env: {}})).json(), {ok: true, conectado: false});
});

test('sin sesión 401, no superusuario 403, otro origen 403', async () => {
  assert.equal((await onRequestPost({request: req({id: 'abc-1'}), env: ENV, data: {sessionInfo: async () => null}})).status, 401);
  assert.equal((await onRequestPost({request: req({id: 'abc-1'}), env: ENV, data: {sessionInfo: async () => ({email: 'x@y.com'})}})).status, 403);
  assert.equal((await onRequestPost({request: req({id: 'abc-1'}, 'https://evil.example'), env: ENV, data: {sessionInfo: superU}})).status, 403);
});

test('flujo completo: token → índice → sesión reanudable → PUT en streaming', async () => {
  const llamadas = [];
  const fetchImpl = async (url, init = {}) => {
    llamadas.push([String(url), init.method || 'GET']);
    if (String(url).startsWith('https://oauth2')) return Response.json({access_token: 'tok'});
    if (String(url).endsWith('/stock/index.json')) return Response.json([IT]);
    if (url === IT.url) return new Response('0123456789', {headers: {'content-length': '10', 'content-type': 'video/mp4'}});
    if (String(url).includes('uploadType=resumable')) {
      const meta = JSON.parse(init.body);
      assert.equal(init.headers.Authorization, 'Bearer tok');
      assert.equal(init.headers['X-Upload-Content-Length'], '10');
      assert.equal(meta.status.privacyStatus, 'private');
      return new Response(null, {status: 200, headers: {location: 'https://upload.example/sesion'}});
    }
    if (url === 'https://upload.example/sesion') return Response.json({id: 'VID123', status: {privacyStatus: 'private'}});
    throw new Error('inesperado ' + url);
  };
  const r = await onRequestPost({request: req({id: 'abc-1', privacyStatus: 'private'}), env: ENV, data: {sessionInfo: superU, fetchImpl}});
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), {ok: true, id: 'VID123', url: 'https://youtu.be/VID123', privacyStatus: 'private'});
  assert.deepEqual(llamadas.map(x => x[1]), ['GET', 'POST', 'GET', 'POST', 'PUT']);
});

test('cuota agotada → 429 youtube-cuota', async () => {
  const fetchImpl = async (url) => {
    if (String(url).startsWith('https://oauth2')) return Response.json({access_token: 'tok'});
    if (String(url).endsWith('/stock/index.json')) return Response.json({items: [IT]});
    if (url === IT.url) return new Response('01', {headers: {'content-length': '2'}});
    return Response.json({error: {errors: [{reason: 'quotaExceeded'}]}}, {status: 403});
  };
  const r = await onRequestPost({request: req({id: 'abc-1'}), env: ENV, data: {sessionInfo: superU, fetchImpl}});
  assert.equal(r.status, 429);
  assert.equal((await r.json()).error, 'youtube-cuota');
});
