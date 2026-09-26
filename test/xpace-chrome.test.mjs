import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {UI_KEYS, LEVELS, loadUi, levelNote, executeCommand, viewerShell, cafeTitle} from '../assets/xpaces/chrome.mjs';

const mem = (seed={}) => ({
  getItem: key => Object.prototype.hasOwnProperty.call(seed, key) ? seed[key] : null,
  setItem: (key, value) => { seed[key] = String(value); },
});

test('al cargar sin memoria los tres paneles están cerrados y el nivel es el que ya existe', () => {
  const ui = loadUi(mem());
  assert.deepEqual(ui, {left:false, right:false, bottom:false, nivel:'16'});
  assert.equal(LEVELS.filter(level => level.ready).map(level => level.id).join(','), '16');
  assert.equal(levelNote('16'), '');
  assert.match(levelNote('8'), /próximamente/);
  assert.match(levelNote('64'), /Matrix/);
});

test('el estado de los carriles y del nivel se lee de sus claves', () => {
  const ui = loadUi(mem({[UI_KEYS.left]:'1', [UI_KEYS.right]:'0', [UI_KEYS.bottom]:'1', [UI_KEYS.nivel]:'8'}));
  assert.equal(ui.left, true);
  assert.equal(ui.right, false);
  assert.equal(ui.bottom, true);
  assert.equal(ui.nivel, '8');
});

test('los comandos reutilizan ver, ficha, vista, luz, zoom, filtros, export, enlace, estado y nivel', () => {
  const calls = [];
  const api = new Proxy({}, {get:(_, key) => (...args) => { calls.push([key, ...args]); return key === 'mostrar' ? 1 : key === 'estado' ? '81/81 visibles' : ''; }});
  assert.equal(executeCommand('ver pizarra-2', api), 'ver pizarra-2');
  assert.equal(executeCommand('ficha S1', api), 'ficha S1');
  assert.equal(executeCommand('vista isométrica', api), 'vista isométrica');
  assert.equal(executeCommand('luz día', api), 'luz día');
  assert.equal(executeCommand('zoom +', api), 'zoom +');
  assert.equal(executeCommand('mostrar Mobiliario', api), 'mostrar Mobiliario');
  assert.equal(executeCommand('ocultar no-existe', {...api, mostrar:() => 0}), 'no está en el inventario');
  assert.equal(executeCommand('todo', api), 'todo');
  assert.equal(executeCommand('export csv', api), 'export csv');
  assert.equal(executeCommand('enlace', api), 'enlace');
  assert.equal(executeCommand('estado', api), '81/81 visibles');
  assert.equal(executeCommand('nivel 32', api), levelNote('32'));
  assert.equal(executeCommand('nivel 16', api), 'nivel 16');
  assert.match(executeCommand('ayuda', api), /vista iso\|planta\|frontal/);
  assert.match(executeCommand('inventa', api), /ayuda/);
  assert.deepEqual(calls[0], ['ver', 'pizarra-2']);
  assert.deepEqual(calls[2], ['vista', 'home']);
  assert.deepEqual(calls[3], ['luz', 'day']);
  assert.deepEqual(calls[4], ['zoom', '+']);
});

test('la barra y los carriles usan clases xpace- y nacen cerrados', () => {
  const html = viewerShell({title:cafeTitle({id:'1790375438696-1ladz7'}), stamp:'Pixeria v.26.09.2026.r12.17:18'});
  assert.match(html, /Cafebrería · Alsea/);
  assert.match(html, /data-xpace-toggle="left"/);
  assert.match(html, /data-xpace-toggle="right"/);
  assert.match(html, /data-xpace-toggle="bottom"/);
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /data-nivel="16"/);
  assert.match(html, /data-preset="home"/);
  assert.match(html, /data-all="yes"/);
  assert.equal(html.includes('quad-'), false);
  assert.equal(html.includes('is-open'), false);
  const viewer = fs.readFileSync(new URL('../assets/xpaces/viewer.mjs', import.meta.url), 'utf8');
  const inventory = fs.readFileSync(new URL('../assets/xpaces/inventory.mjs', import.meta.url), 'utf8');
  const css = fs.readFileSync(new URL('../assets/xpaces/viewer.css', import.meta.url), 'utf8');
  assert.match(viewer, /viewerShell\(/);
  assert.equal(viewer.includes('quad-'), false);
  assert.match(inventory, /data-ci-back/);
  assert.match(inventory, /xpaceChrome\?\.open\('right'\)/);
  assert.match(css, /max-width:600px[\s\S]*\.xpace-rail\{position:absolute/);
});
