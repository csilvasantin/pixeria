// Selección por grupos del panel ☰ (Carlos, 6-oct-2026): un clic marca el grupo entero y otro
// lo desmarca; tri-estado; con filtro solo lo visible; igual en General y en un proyecto (Altadis).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createCatalog, customFormat, matchingFormats, sizeGroups, selectionState, toggleSelection, selectionAction, inFamily} from '../adaptaciones/format-catalog.mjs';
import {restore, snapshot, defaults} from '../adaptaciones/adapter-core.mjs';
import {projectLibrary} from '../adaptaciones/proyectos-core.mjs';

const json = rel => JSON.parse(readFileSync(new URL(`../${rel}`, import.meta.url)));
const altadis = json('adaptaciones/proyectos/altadis-estancos-bcn.json');
const altadisLists = {estandar: json('adaptaciones/perfil-cliente-18.json').formats, especiales: json('adaptaciones/perfil-cliente-especiales.json').layouts};
const project = () => projectLibrary(createCatalog(), altadis, altadisLists);
const group = (formats, profile, id) => sizeGroups(formats, profile).find(g => g.id === id).members;
const ids = formats => formats.filter(f => f.on).map(f => f.id);

test('tri-estado: ninguno, algunos y todos (aria-checked false / mixed / true)', () => {
  const social = group(createCatalog(), 'standard', 'social');
  assert.deepEqual(selectionState(social), {total: 8, on: 0, all: false, none: true, partial: false, checked: 'false'});
  social[0].on = true; social[3].on = true;
  assert.deepEqual(selectionState(social), {total: 8, on: 2, all: false, none: false, partial: true, checked: 'mixed'});
  social.forEach(f => f.on = true);
  assert.equal(selectionState(social).checked, 'true');
  assert.deepEqual(selectionState([]), {total: 0, on: 0, all: false, none: true, partial: false, checked: 'false'});
});

test('General: un clic marca el grupo entero, otro lo desmarca; desde parcial marca todo', () => {
  const f = createCatalog(), before = ids(f);
  assert.deepEqual(sizeGroups(f, 'standard').map(g => `${g.id}:${g.members.length}`), ['social:8', 'digital:6', 'display:23', 'print:5']);
  const display = group(f, 'standard', 'display');
  assert.equal(toggleSelection(display), true);
  assert.equal(selectionState(display).on, 23);
  assert.equal(toggleSelection(display), false);
  assert.equal(selectionState(display).on, 0);
  // Digital empieza parcial (los cuatro ratios): el clic completa el grupo, el siguiente lo vacía.
  const digital = group(f, 'standard', 'digital');
  assert.equal(selectionState(digital).checked, 'mixed');
  toggleSelection(digital); assert.equal(selectionState(digital).checked, 'true');
  toggleSelection(digital); assert.equal(selectionState(digital).checked, 'false');
  // No toca otros grupos.
  assert.deepEqual(ids(f).filter(id => !digital.some(x => x.id === id)), before.filter(id => !digital.some(x => x.id === id)));
});

test('General: los tamaños propios cuentan en Digital y «Todos los tamaños» alterna toda la familia', () => {
  const f = [...createCatalog(), customFormat(500, 500)];
  assert.ok(group(f, 'standard', 'digital').some(x => x.id === 'custom-500x500'));
  const all = matchingFormats(f, {profile: 'standard'});
  assert.equal(all.length, 43);
  toggleSelection(all); assert.equal(ids(f).length, 43);
  toggleSelection(all); assert.equal(ids(f).length, 0);
});

test('con filtro: actúa solo sobre lo visible y el rótulo lo dice', () => {
  const f = createCatalog();
  const display = group(f, 'standard', 'display');
  display.forEach(x => x.on = true);
  const visible = matchingFormats(f, {query: '300', profile: 'standard'});
  const shown = display.filter(x => visible.includes(x));
  assert.equal(shown.length, 5);
  // Todo el grupo estaba marcado: con filtro, desmarca solo los 5 visibles.
  assert.equal(selectionAction(selectionState(shown), {filtered: true}), 'Desmarcar 5 visibles');
  toggleSelection(shown);
  assert.equal(selectionState(display).on, 18);
  assert.equal(selectionAction(selectionState(shown), {filtered: true}), 'Marcar 5 visibles');
  assert.equal(selectionAction(selectionState(shown), {filtered: true, en: true}), 'Select 5 visible');
  toggleSelection(shown);
  assert.equal(selectionState(display).on, 23);
  // Orientación: los cuadrados de redes.
  const square = group(f, 'standard', 'social').filter(x => matchingFormats(f, {orientation: 'square', profile: 'standard'}).includes(x));
  assert.deepEqual(square.map(x => x.id), ['social-instagram', 'social-facebook']);
  toggleSelection(square);
  assert.deepEqual(ids(group(f, 'standard', 'social')), ['social-instagram', 'social-facebook']);
});

test('rótulos sin filtro: Marcar los N / Desmarcar los N, singular y en inglés', () => {
  assert.equal(selectionAction({total: 8, all: false}), 'Marcar los 8');
  assert.equal(selectionAction({total: 8, all: true}), 'Desmarcar los 8');
  assert.equal(selectionAction({total: 1, all: true}), 'Desmarcar 1');
  assert.equal(selectionAction({total: 1, all: false}, {filtered: true}), 'Marcar 1 visible');
  assert.equal(selectionAction({total: 23, all: true}, {en: true}), 'Clear all 23');
});

test('proyecto Altadis: grupos estándar, MyBlu y especiales, que alternan sus propios formatos', () => {
  const f = project();
  f.forEach(x => x.on = x.proyecto ? !x.especial : ['9:16', '16:9', '1:1', '4:5'].includes(x.id));
  assert.deepEqual(sizeGroups(f, 'proyecto').map(g => `${g.id}:${g.members.length}`), ['estandar:18', 'myblu:6', 'especiales:5']);
  assert.ok(sizeGroups(f, 'proyecto').every(g => g.members.every(x => x.proyecto === altadis.id)));
  const estandar = group(f, 'proyecto', 'estandar'), walls = group(f, 'proyecto', 'especiales');
  assert.equal(selectionState(estandar).checked, 'true');
  toggleSelection(estandar);
  assert.equal(selectionState(estandar).on, 0);
  assert.equal(selectionState(group(f, 'proyecto', 'myblu')).on, 6, 'MyBlu no cambia');
  toggleSelection(estandar);
  assert.equal(selectionState(estandar).on, 18);
  toggleSelection(walls); assert.equal(selectionState(walls).checked, 'true');
  toggleSelection(walls); assert.equal(selectionState(walls).checked, 'false');
  // La biblioteca general no se toca desde los grupos del proyecto.
  assert.deepEqual(ids(f).filter(id => !f.find(x => x.id === id).proyecto), ['9:16', '16:9', '1:1', '4:5']);
  // Familia «especiales»: solo los videowalls.
  assert.deepEqual(sizeGroups(f, 'especiales').map(g => `${g.id}:${g.members.length}`), ['especiales:5']);
  // «Todos los tamaños» en el proyecto: los 29 propios.
  const all = matchingFormats(f, {profile: 'proyecto'});
  assert.equal(all.length, 29); assert.ok(all.every(x => inFamily(x, 'proyecto')));
  toggleSelection(all); assert.equal(selectionState(all).on, 29);
  toggleSelection(all); assert.equal(selectionState(all).on, 0);
});

test('proyecto con filtro: solo lo visible del grupo', () => {
  const f = project();
  const estandar = group(f, 'proyecto', 'estandar');
  estandar.forEach(x => x.on = false);
  const visible = matchingFormats(f, {orientation: 'portrait', profile: 'proyecto'});
  const shown = estandar.filter(x => visible.includes(x));
  assert.ok(shown.length > 0 && shown.length < estandar.length);
  toggleSelection(shown);
  assert.equal(selectionState(estandar).on, shown.length);
  assert.equal(selectionState(estandar).checked, 'mixed');
});

test('persistencia: la selección por grupos sobrevive a snapshot/restore como el resto', () => {
  const f = createCatalog();
  toggleSelection(group(f, 'standard', 'print'));
  const state = {profile: 'standard', compat: 'fhd', modoGlobal: 'auto', fmt: Object.fromEntries(f.map(x => [x.id, defaults()]))};
  const saved = JSON.parse(JSON.stringify(snapshot(state, f)));
  const back = restore(saved, createCatalog());
  assert.deepEqual(back.selected.filter(id => id.startsWith('print-')), ['print-a4', 'print-a3', 'print-a5', 'print-card', 'print-poster']);
});
