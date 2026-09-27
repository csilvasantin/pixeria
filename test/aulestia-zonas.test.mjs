import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const data = JSON.parse(fs.readFileSync(new URL('../assets/xpaces/aulestia/zonas.json', import.meta.url), 'utf8'));
const page = fs.readFileSync(new URL('../xpacios/aulestia-i-pijoan/index.html', import.meta.url), 'utf8');
const gate = fs.readFileSync(new URL('../functions/_middleware.js', import.meta.url), 'utf8');

test('la planta baja de Aulestia tiene 4 zonas y el edificio 7, sin inventar titulares', () => {
  assert.equal(data.sala, 'planta-baja');
  assert.equal(data.salaZonas.length, 4);
  assert.equal(data.zonas.length, 7);
  assert.equal(data.edificio.localesPlantaBaja, 4);
  assert.equal(data.zonas.filter(z => z.sala).length, 1);
  for (const zone of data.salaZonas) {
    assert.equal(zone.titular, 'pendiente');
    assert.equal(zone.pantallas, 'pendiente');
    assert.equal(zone.uso, 'comercial');
  }
  for (const zone of data.zonas) assert.equal(zone.titular, 'pendiente');
  assert.match(data.direccion, /Aulèstia i Pijoan 4-6/);
  assert.equal(JSON.stringify(data).includes('marca'), false);
});

test('la página cuenta las zonas desde el JSON y la ruta abre sin sesión', () => {
  assert.match(page, /zonas\.json\?v=4457/);
  assert.match(page, /salaZonas\.length/);
  assert.match(page, /zonas\.length/);
  assert.match(gate, /\/xpacios\/aulestia-i-pijoan/);
});
