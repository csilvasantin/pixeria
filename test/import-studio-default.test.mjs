import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const importar = fs.readFileSync(new URL('../adaptaciones/importar.js', import.meta.url), 'utf8');
const STUDIO = 'https://macstudio.tail48b61c.ts.net/admira/tube';
const MINI = 'https://macmini.tail48b61c.ts.net/admira/tube';

test('Stock importer: Mac Studio first, Mac Mini second, no MacBook Pro 16', () => {
  const fn = app.slice(app.indexOf('function importEndpoints()'), app.indexOf('function bindImportModal()'));
  assert.ok(fn.length > 200);
  const bases = [...fn.matchAll(/jobBase: '([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(bases, [STUDIO, MINI]);
  for (const base of bases) {
    assert.ok(fn.includes(`url: '${base}/download'`));
    assert.ok(fn.includes(`healthUrl: '${base}/health'`));
  }
  assert.match(fn, /return isLocalOrigin \? \[sunoLocal, admiraTubeStudio, admiraTube\] : \[admiraTubeStudio, admiraTube\];/);
  assert.doesNotMatch(app, /macbook-pro-16|admira-tube-backup/);
});

test('Adaptaciones importer: same order as the Stock (Studio, then Mini)', () => {
  const list = importar.slice(importar.indexOf('var TUBES = ['), importar.indexOf('];', importar.indexOf('var TUBES = [')));
  const bases = [...list.matchAll(/base: '([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(bases, [STUDIO, MINI]);
  assert.doesNotMatch(importar, /macbook-pro-16|admira-tube-backup/);
});

test('importer health check keeps a short per-host timeout (first healthy host wins)', () => {
  assert.match(app, /async function importHealthOk\(ep, ms = 4500\)/);
  assert.match(app, /if \(await importHealthOk\(ep\)\) return ep;/);
});
