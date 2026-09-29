import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {EMISION, pickFeedItem, bedVolume, pushBody, signageURL, screenSpeaks} from '../assets/xpaces/emision-map.mjs';
import {demoScreenIds, rewritePush, proxyDemoSignage} from '../functions/demo-signage.js';
import {onRequest} from '../functions/_middleware.js';

const manifest = JSON.parse(fs.readFileSync(new URL('../assets/xpaces/inventory/alsea-4380.json', import.meta.url)));
const viewer = fs.readFileSync(new URL('../assets/xpaces/viewer.mjs', import.meta.url), 'utf8');
const emision = fs.readFileSync(new URL('../assets/xpaces/emision.mjs', import.meta.url), 'utf8');
const renderer = fs.readFileSync(new URL('../assets/xpaces/engine/life-renderer.mjs', import.meta.url), 'utf8');
const demo = fs.readFileSync(new URL('../xpacios/cafebreria/demo/demo.js', import.meta.url), 'utf8');

test('las cuatro pizarras apuntan al material real y hilo y tele no inventan malla', () => {
  assert.deepEqual(demoScreenIds(), EMISION.map(row => row.id));
  const screens = Object.fromEntries(manifest.items.filter(row => row.tipo === 'screen').map(row => [row.id, row.pantalla]));
  for (const row of EMISION.filter(item => item.kind === 'video')) {
    assert.equal(screens[row.inventory], row.material);
    assert.equal(row.material, 'PANTALLA_' + row.inventory);
  }
  assert.equal(EMISION.find(row => row.id === 'cafebreria-hilo').material, null);
  assert.equal(EMISION.find(row => row.id === 'cafebreria-tele').material, null);
  assert.equal(manifest.items.some(row => row.pantalla === 'PANTALLA_cafebreria-tele'), false);
});

test('el feed ignora el broadcast y se queda con el envío de esa pantalla', () => {
  const chosen = pickFeedItem({items:[
    {id:'viejo', ts:1, target:'cafebreria-pizarra-2', src:'https://api.admira.store/stock/asset/a'},
    {id:'broadcast', ts:9, src:'https://api.admira.store/stock/asset/todas'},
    {id:'otra', ts:8, target:'cafebreria-pizarra-1', src:'https://api.admira.store/stock/asset/b'},
    {id:'nuevo', ts:4, target:'cafebreria-pizarra-2', src:'https://api.admira.store/stock/asset/c'},
  ]}, 'cafebreria-pizarra-2');
  assert.equal(chosen.id, 'nuevo');
  assert.equal(pickFeedItem({items:[{id:'x', ts:1, target:'cafebreria-pizarra-2', src:'http://inseguro/a'}]}, 'cafebreria-pizarra-2'), null);
});

test('el hilo baja solo cuando otra pantalla habla', () => {
  const video = {kind:'video', mime:'video/mp4', src:'https://api.admira.store/stock/asset/v'};
  const audio = {kind:'audio', mime:'audio/mpeg', src:'https://api.admira.store/stock/asset/a'};
  assert.equal(bedVolume({'cafebreria-pizarra-1': video}), 1);
  assert.equal(screenSpeaks('cafebreria-pizarra-1', video), false);
  assert.equal(bedVolume({'cafebreria-tele': video}), 0.15);
  assert.equal(bedVolume({'cafebreria-pizarra-3': audio}), 0.15);
  assert.equal(bedVolume({'cafebreria-hilo': audio}), 1);
});

test('Tu pausa sale sin interrupt y el proxy no abre el canal a otras pantallas', async () => {
  const body = pushBody('cafebreria-pizarra-1');
  assert.equal(body.interrupt, false);
  assert.equal(body.source, 'demo-cafebreria');
  assert.equal(body.src.endsWith('/1790609061411-86drpb'), true);
  assert.equal(pushBody('cafebreria-hilo').kind, 'audio');
  assert.equal(pushBody('XT-GRACIA-P1'), null);
  const poisoned = rewritePush({...body, interrupt:true, loc:'plaza', locName:'Gracia', machine:'mac', target:'cafebreria-pizarra-1'});
  assert.equal(poisoned.payload.interrupt, false);
  assert.equal('loc' in poisoned.payload, false);
  assert.equal(rewritePush({...body, target:''}).error, 'pantalla-fuera-de-la-demo');
  assert.equal(rewritePush({...body, src:'https://example.test/a.mp4'}).error, 'asset-fuera-de-stock');

  const calls = [];
  const request = new Request('https://smith.pixeria.pages.dev/api/demo-signage/push', {
    method:'POST',
    headers:{'content-type':'application/json'},
    body: JSON.stringify({...body, interrupt:true, loc:'no'}),
  });
  const response = await proxyDemoSignage(request, new URL(request.url), async (url, init) => {
    calls.push({url, body: JSON.parse(init.body)});
    return new Response('{"ok":true,"id":"abc"}', {status:200, headers:{'content-type':'application/json'}});
  });
  assert.equal(response.status, 200);
  assert.equal(calls[0].url, 'https://api.admira.store/signage/push');
  assert.equal(calls[0].body.interrupt, false);
  assert.equal(calls[0].body.target, 'cafebreria-pizarra-1');

  const blocked = await proxyDemoSignage(
    new Request('https://smith.pixeria.pages.dev/api/demo-signage/feed?screen=XT-GRACIA-P1'),
    new URL('https://smith.pixeria.pages.dev/api/demo-signage/feed?screen=XT-GRACIA-P1'),
    async () => { throw new Error('no debía salir'); }
  );
  assert.equal(blocked.status, 400);

  const beat = await proxyDemoSignage(
    new Request('https://smith.pixeria.pages.dev/api/demo-signage/heartbeat', {
      method:'POST', headers:{'content-type':'application/json'},
      body: JSON.stringify({screen:'cafebreria-tele'}),
    }),
    new URL('https://smith.pixeria.pages.dev/api/demo-signage/heartbeat'),
    async (url, init) => new Response(init.body, {status:400, headers:{'content-type':'application/json'}})
  );
  assert.equal(JSON.parse(await beat.text()).screen, 'cafebreria-tele');
});

test('la demo abre sin sesión y el visor enchufa la emisión', async () => {
  assert.equal(signageURL('feed?screen=cafebreria-pizarra-2', 'smith-cafebreria-emision-4742.pixeria.pages.dev'), '/api/demo-signage/feed?screen=cafebreria-pizarra-2');
  assert.match(signageURL('feed?screen=cafebreria-pizarra-2', 'www.pixeria.com'), /^https:\/\/api\.admira\.store\/signage\/feed/);
  const response = await onRequest({
    request: new Request('https://www.pixeria.com/xpacios/cafebreria/demo/'),
    env: {},
    next: async () => new Response('publico', {status:200}),
  });
  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'publico');
  assert.match(viewer, /emision\.mjs/);
  assert.match(emision, /EN ANTENA/);
  assert.match(renderer, /setDetail/);
  assert.equal(demo.includes('suno'), false);
  assert.equal(emision.toLowerCase().includes('suno'), false);
});
