import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SCHEMA, PENDIENTE, fichaDe, accion, semaforoEstado, semaforoGarantia } from '../assets/xpaces/ci.mjs';

const manifest = JSON.parse(fs.readFileSync(new URL('../assets/xpaces/inventory/alsea-4380.json', import.meta.url)));

test('cada unidad tiene ficha propia y no inventa marca ni serie', () => {
  const fichas = manifest.items.map(fichaDe);
  assert.equal(new Set(fichas.map(f => f.id)).size, fichas.length);
  for (const f of fichas) {
    assert.equal(f.schema, SCHEMA);
    assert.equal(f.fabricante, PENDIENTE);
    assert.equal(f.serie, PENDIENTE);
    assert.equal(f.garantia.inicio, PENDIENTE);
    assert.equal(f.garantia.fin, PENDIENTE);
    assert.equal(semaforoGarantia(f), 'ambar');
  }
  assert.equal(semaforoEstado('pendiente'), 'ambar');
  assert.equal(semaforoEstado('averia'), 'rojo');
});

test('el botón cambia: garantía, equipo conectado o incidencia', () => {
  const ahora = Date.parse('2026-09-26T00:00:00Z');
  const base = fichaDe(manifest.items[0]);
  assert.equal(accion(base, ahora).etiqueta, 'Incidencia en Yokup');
  const iot = fichaDe(manifest.items.find(e => e.categoria === 'IoT'));
  assert.equal(accion(iot, ahora).etiqueta, 'Portal IoT');
  assert.equal(accion(iot, ahora).provisional, true);
  const cubierta = fichaDe({ id: 'demo', nombre: 'x', categoria: 'Mobiliario', garantiaFin: '2027-01-01' });
  assert.equal(accion(cubierta, ahora).etiqueta, 'Reclamar al fabricante');
});

test('una pizarra del mostrador es vertical y siguen la de recogida y las otras dos', () => {
  const p = Object.fromEntries(manifest.items.filter(e => e.tipo === 'screen').map(e => [e.id, e]));
  assert.equal(p['pizarra-2'].orientacion, 'vertical');
  assert.ok(p['pizarra-2'].medidas.alto > p['pizarra-2'].medidas.ancho);
  assert.ok(p['pizarra-1'].medidas.ancho > p['pizarra-1'].medidas.alto);
  assert.ok(p['pizarra-3'].medidas.ancho > p['pizarra-3'].medidas.alto);
  assert.equal(p['pantalla-recogida'].nombre.includes('43'), true);
  for (const id of ['router-1', 'switch-1', 'sai-1', 'camara-1', 'alarma-1', 'molinillo-1', 'datafono-1', 'impresora-tickets-1', 'lavavajillas-1', 'horno-1', 'frio-barra-1', 'climatizacion-1', 'amplificador-hilo-1']) {
    const row = manifest.items.find(e => e.id === id);
    assert.ok(row, id);
    assert.equal(row.sinGeometria, true);
    assert.equal(row.node, undefined);
  }
});

test('el inventario apunta al modelo de los seis libros y a la estantería', () => {
  assert.ok([].concat(manifest.glbSha256).includes('d8e9d1422ecdec63ddde0ed66c3c4fd9fc588319639d5e4258b88269a05be5d9'));
  assert.equal(manifest.modelo3d, '1790375438696-1ladz7');
  const shelf = manifest.items.find(e => e.id === 'estanteria-libros');
  assert.equal(shelf.runtime.builder, 'estanteria-libros');
  assert.equal(shelf.modelo3d, '1790375438696-1ladz7');
});
