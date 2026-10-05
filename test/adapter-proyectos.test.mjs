// Proyectos del Adaptador (Carlos, 5-oct-2026): ajustes generales + los propios de cada proyecto
// de Yokup, en fichas JSON versionadas (adaptaciones/proyectos/<id-yokup>.json).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {createCatalog, CAMPAIGNS, applyCampaign, isLibrarySize, LIBRARY_SIZE_COUNT, matchingFormats, formatFamily} from '../adaptaciones/format-catalog.mjs';
import {restore, snapshot, defaults, STORAGE_KEY} from '../adaptaciones/adapter-core.mjs';
import {GENERAL, LEGACY_PROJECT, projectStorageKey, formatRef, resolveRef, validateFicha, projectFormats, projectLibrary, projectCampaigns, parseYokup, mergeProjects, resolveProject, initialProject, migrateStorage} from '../adaptaciones/proyectos-core.mjs';

const ROOT = new URL('../', import.meta.url);
const raw = rel => readFileSync(new URL(rel, ROOT));
const json = rel => JSON.parse(raw(rel));
const DIR = 'adaptaciones/proyectos/';
const fichaFiles = readdirSync(new URL(DIR, ROOT)).filter(n => n.endsWith('.json') && !n.startsWith('_') && !['index.json', 'yokup.json'].includes(n)).sort();
const yokup = json(DIR + 'yokup.json'), index = json(DIR + 'index.json');
const yokupIds = parseYokup(yokup).map(p => p.id);
const generalIds = createCatalog().map(f => f.id);
const listsOf = (file, ficha) => Object.fromEntries(['estandar', 'especiales'].map(k => {
  const ref = formatRef(ficha.formatos?.[k]);
  return [k, !ref ? [] : ref.inline ? ref.inline : json(resolveRef(DIR + file, ref.archivo))[ref.clave]];
}));
const altadisFile = `${LEGACY_PROJECT}.json`, altadis = json(DIR + altadisFile), altadisLists = listsOf(altadisFile, altadis);

class MemoryStore { constructor(o = {}) { this.m = new Map(Object.entries(o)); } getItem(k) { return this.m.has(k) ? this.m.get(k) : null; } setItem(k, v) { this.m.set(k, String(v)); } }

test('esquema: cada ficha es válida, se llama como su id y ese id existe en la lista de Yokup', () => {
  assert.ok(fichaFiles.length >= 1);
  for (const file of fichaFiles) {
    const ficha = json(DIR + file);
    assert.deepEqual(validateFicha(ficha, {lists: listsOf(file, ficha), yokupIds, generalIds, file}), [], file);
  }
  // La plantilla tiene la forma correcta; solo su id es de mentira.
  const plantilla = json(DIR + '_plantilla.json');
  assert.deepEqual(validateFicha(plantilla, {lists: listsOf('_plantilla.json', plantilla), generalIds}), []);
  assert.match(validateFicha(plantilla, {lists: listsOf('_plantilla.json', plantilla), yokupIds}).join(), /no existe en la lista de proyectos de Yokup/);
});

test('esquema: detecta fichas rotas', () => {
  const bad = {...altadis, id: 'altadis', hereda: 'nada', ajustes: {...altadis.ajustes, codec: 'hevc', fps: 30}, campanas: [{id: 'social', es: 'x', en: 'x', descripcionEs: 'x', descripcionEn: 'x', incluye: ['no-existe']}]};
  const wall = {...altadisLists.especiales[0], pantallas: 4};
  const errors = validateFicha(bad, {lists: {estandar: [...altadisLists.estandar, {id: '9:16', nombre: 'x', custom: [2, 2], uso: 'x', useEn: 'x'}], especiales: [wall]}, yokupIds, generalIds, file: altadisFile}).join('\n');
  for (const re of [/no existe en la lista de proyectos de Yokup/, /archivo debe llamarse altadis\.json/, /hereda debe ser "general"/, /solo exporta h264/, /pisa un tamaño de la biblioteca general/, /pantallas no cuadra/, /25 fps/, /es una campaña general/, /incluye debe ser/])
    assert.match(errors, re);
  assert.ok(validateFicha({...altadis, formatos: {estandar: {archivo: '../../../etc/passwd.json', clave: 'x'}}}, {}).some(e => /dentro de adaptaciones/.test(e)));
});

test('index.json está al día con las fichas (como scripts/adaptador-proyectos.py --check)', () => {
  const expected = fichaFiles.map(file => {
    const ficha = json(DIR + file), lists = listsOf(file, ficha);
    return {id: ficha.id, nombre: ficha.nombre, alias: ficha.alias || [], archivo: file,
      formatos: {estandar: lists.estandar.length, especiales: lists.especiales.length, myblu: lists.estandar.filter(f => f.myblu).length},
      campanas: (ficha.campanas || []).map(c => c.id)};
  });
  assert.deepEqual(index.proyectos, expected);
  const py = spawnSync('python3', ['scripts/adaptador-proyectos.py', '--check'], {cwd: new URL('.', ROOT).pathname, encoding: 'utf8'});
  if (!py.error) assert.equal(py.status, 0, py.stdout + py.stderr);
});

// Copia literal del cargador que tenía adaptaciones.js antes de las fichas (main, 5-oct-2026).
function legacyAltadis(EN) {
  const out = [], data = json('adaptaciones/perfil-cliente-18.json'), esp = json('adaptaciones/perfil-cliente-especiales.json');
  for (const f of data.formats) { f.on = true; f.category = 'digital'; if (EN) f.uso = f.useEn; out.push(f); }
  esp.layouts.forEach((layout) => { out.push({id: layout.id, nombre: layout.nombre, nameEn: layout.nombre, uso: EN ? layout.useEn : layout.uso, custom: layout.entrega, category: 'digital', especial: true, cliente: true, layout, fps: 25, on: false}); });
  return out;
}
const family = ({cliente, proyecto, ...rest}) => rest;

test('Altadis idéntico a hoy: 18 estándar + 6 MyBlu + 5 ESPECIAL, mismos datos, campaña y textos', () => {
  // Las transcripciones no cambian ni un byte respecto a main.
  const sha = rel => createHash('sha256').update(raw(rel)).digest('hex');
  assert.equal(sha('adaptaciones/perfil-cliente-18.json'), 'c5447f56e724e3ddbbb460201c5ed46a3acc04b5e66044e3182b462b5eb37901');
  assert.equal(sha('adaptaciones/perfil-cliente-especiales.json'), '2d5f255fbdbe7d623ad731f65613d2e6e562502c13814043df8c46a6a0eb3faf');
  for (const en of [false, true]) {
    const now = projectFormats(altadis, altadisLists, en), before = legacyAltadis(en);
    assert.deepEqual(now.map(family), before.map(family), en ? 'EN' : 'ES');
    assert.ok(now.every(f => f.proyecto === LEGACY_PROJECT));
  }
  const f = projectFormats(altadis, altadisLists);
  assert.equal(f.filter(x => !x.especial && !x.myblu).length, 18);
  assert.equal(f.filter(x => x.myblu).length, 6);
  assert.equal(f.filter(x => x.especial).length, 5);
  assert.deepEqual(f.filter(x => !x.especial).map(x => `${x.nombre} ${x.custom.join('x')}`).slice(0, 3), ['VERTICAL 1080x1920', 'HORIZONTAL 1920x1080', 'VIDEOWALL 2X1 H 1920x540']);
  assert.equal(altadis.fuente.sha256, json('adaptaciones/perfil-cliente-18.json').source.sha256);
  assert.deepEqual(altadis.ajustes, {metodo: 'auto', compatibilidad: 'uhd', fps: 25, codec: 'h264', familia: 'proyecto'});
  // Campaña Altadis: la de main (id, textos y 29 formatos), ahora desde la ficha.
  const [c] = projectCampaigns(altadis);
  assert.deepEqual([c.id, c.es, c.en, c.descriptionEs, c.descriptionEn, c.profile], ['altadis', 'Altadis', 'Altadis', 'Estándar + ESPECIAL + MyBlu · MP4 H.264 · 25 fps', 'Standard + ESPECIAL + MyBlu · MP4 H.264 · 25 fps', 'proyecto']);
  const all = projectLibrary(createCatalog(), altadis, altadisLists);
  assert.equal(applyCampaign(all, 'altadis', [...projectCampaigns(altadis), ...CAMPAIGNS]), 29);
  assert.equal(all.filter(x => x.proyecto && x.on).length, 29, 'como en main, la campaña no toca la biblioteca');
  // Etiquetas del selector «Perfil de formatos» de main.
  assert.equal(altadis.familias.proyecto.es, 'Altadis · estándar + ESPECIAL + MyBlu');
  assert.equal(altadis.familias.especiales.en, 'Altadis · segmented video walls (ESPECIAL)');
});

test('herencia: un proyecto con ficha ve la biblioteca general entera más lo suyo', () => {
  const general = createCatalog(), all = projectLibrary(general, altadis, altadisLists);
  assert.equal(all.length, general.length + 29);
  assert.deepEqual(all.slice(0, general.length).map(f => f.id), general.map(f => f.id));
  assert.equal(all.filter(isLibrarySize).length, LIBRARY_SIZE_COUNT);
  assert.equal(new Set(all.map(f => f.id)).size, all.length);
  assert.deepEqual(['standard', 'proyecto', 'especiales'].map(p => matchingFormats(all, {profile: p}).length), [general.length, 29, 5]);
  assert.equal(formatFamily(all.find(f => f.id === 'cliente-01')), 'proyecto');
  // Las campañas generales siguen funcionando dentro del proyecto y no tocan sus formatos.
  const campaigns = [...projectCampaigns(altadis), ...CAMPAIGNS];
  assert.deepEqual(campaigns.map(c => c.id), ['altadis', 'social', 'display', 'mobile']);
  assert.equal(applyCampaign(all, 'social', campaigns), 8);
  assert.equal(all.filter(f => f.proyecto && f.on).length, 24, 'los formatos propios conservan su selección');
});

test('proyecto de Yokup sin ficha = solo la biblioteca general', () => {
  const projects = mergeProjects(parseYokup(yokup), index.proyectos);
  const alsea = projects.find(p => p.id === 'pixeria-alsea');
  assert.ok(alsea, 'pixeria-alsea está en la lista de Yokup');
  assert.equal(alsea.ficha, null); assert.equal(alsea.propios, false);
  const general = createCatalog();
  assert.deepEqual(projectLibrary(general, null), general);
  assert.deepEqual(projectCampaigns(null), []);
  assert.equal(restore({version: 1, profile: 'proyecto', selected: ['9:16']}, general).profile, 'standard');
});

test('lista de Yokup: parseo, ficha primero, pausados fuera y la ficha sobrevive sin Yokup', () => {
  const api = {ok: true, projects: [{id: 'zeta', name: 'Zeta', status: 'activo'}, {id: 'altadis-estancos-bcn', name: 'Altadis · Estancos Barcelona 9', status: 'activo'}, {id: 'zeta', name: 'dup'}, {id: 'Mal Id', name: 'x'}, {id: 'pausa', name: 'Pausa', status: 'pausado'}, {id: 'alfa', name: 'Alfa', status: 'activo'}]};
  const list = parseYokup(api);
  assert.deepEqual(list.map(p => p.id), ['zeta', 'altadis-estancos-bcn', 'pausa', 'alfa']);
  assert.deepEqual(parseYokup(yokup).length, yokup.proyectos.length);
  const merged = mergeProjects(list, index.proyectos);
  assert.deepEqual(merged.map(p => [p.id, p.propios]), [['altadis-estancos-bcn', true], ['alfa', false], ['zeta', false]]);
  assert.equal(merged[0].nombre, 'Altadis · Estancos Barcelona 9');
  assert.deepEqual(mergeProjects([], index.proyectos).map(p => [p.id, p.nombre]), [['altadis-estancos-bcn', 'Altadis']]);
  assert.deepEqual(parseYokup(null), []);
});

test('?proyecto=: id exacto, alias, mayúsculas, general y desconocido', () => {
  const projects = mergeProjects(parseYokup(yokup), index.proyectos);
  assert.equal(resolveProject('altadis-estancos-bcn', projects, index.proyectos), 'altadis-estancos-bcn');
  assert.equal(resolveProject('altadis', projects, index.proyectos), 'altadis-estancos-bcn');
  assert.equal(resolveProject(' Pixeria-Alsea ', projects, index.proyectos), 'pixeria-alsea');
  assert.equal(resolveProject('general', projects, index.proyectos), GENERAL);
  assert.equal(resolveProject('', projects, index.proyectos), GENERAL);
  assert.equal(resolveProject('no-existe', projects, index.proyectos), null);
  // La URL manda sobre el último proyecto guardado; sin URL, se vuelve al último; sin nada, General.
  assert.deepEqual(initialProject({query: 'altadis', saved: 'pixeria-alsea', projects, index: index.proyectos}), {id: 'altadis-estancos-bcn', unknown: null});
  assert.deepEqual(initialProject({query: null, saved: 'pixeria-alsea', projects, index: index.proyectos}), {id: 'pixeria-alsea', unknown: null});
  assert.deepEqual(initialProject({query: 'no-existe', saved: 'pixeria-alsea', projects, index: index.proyectos}), {id: 'pixeria-alsea', unknown: 'no-existe'});
  assert.deepEqual(initialProject({projects, index: index.proyectos}), {id: GENERAL, unknown: null});
});

test('persistencia separada por proyecto y formato', () => {
  assert.equal(projectStorageKey(STORAGE_KEY, GENERAL), 'pixeria.adapter.v1');
  assert.equal(projectStorageKey(STORAGE_KEY, 'pixeria-alsea'), 'pixeria.adapter.v1.proyecto.pixeria-alsea');
  const all = projectLibrary(createCatalog(), altadis, altadisLists);
  const fmt = Object.fromEntries(all.map(f => [f.id, defaults()]));
  fmt['9:16'] = {modo: 'cover', fx: .1, fy: .9, zoom: 1.5}; fmt['cliente-19'] = {modo: 'blur', fx: .3, fy: .4, zoom: 1.2};
  all.forEach(f => (f.on = ['9:16', 'cliente-19', 'cliente-esp-3'].includes(f.id)));
  const saved = JSON.parse(JSON.stringify(snapshot({profile: 'especiales', compat: 'uhd', modoGlobal: 'blur', fmt}, all)));
  const back = restore(saved, projectLibrary(createCatalog(), altadis, altadisLists));
  assert.deepEqual([back.profile, back.compat, back.modoGlobal], ['especiales', 'uhd', 'blur']);
  assert.deepEqual(back.selected, ['9:16', 'cliente-19', 'cliente-esp-3']);
  assert.deepEqual(back.fmt['cliente-19'], fmt['cliente-19']); assert.deepEqual(back.fmt['9:16'], fmt['9:16']);
  // El mismo registro leído en General no inventa familias ni formatos del proyecto.
  const inGeneral = restore(saved, createCatalog());
  assert.equal(inGeneral.profile, 'standard'); assert.deepEqual(inGeneral.selected, ['9:16']);
});

test('migración: las preferencias de Altadis guardadas en la clave general pasan a su proyecto sin perder nada', () => {
  const old = {version: 1, profile: 'cliente', compat: 'uhd', modoGlobal: 'cover', custom: [[500, 500]],
    selected: ['16:9', 'cliente-01', 'altadis-02', 'cliente-esp-2'],
    fmt: {'16:9': {modo: 'contain', fx: .2, fy: .2, zoom: 1.1}, 'cliente-01': {modo: 'blur', fx: .25, fy: .75, zoom: 1.4}, 'altadis-02': {modo: 'cover', fx: 0, fy: 1, zoom: 2}}};
  const store = new MemoryStore({[STORAGE_KEY]: JSON.stringify(old)});
  assert.equal(migrateStorage(store, STORAGE_KEY), LEGACY_PROJECT, 'vuelve a Altadis quien estaba en Altadis');
  assert.equal(store.getItem(STORAGE_KEY), JSON.stringify(old), 'la clave general no se toca');
  const moved = JSON.parse(store.getItem(projectStorageKey(STORAGE_KEY, LEGACY_PROJECT)));
  const back = restore(moved, projectLibrary(createCatalog(), altadis, altadisLists));
  assert.equal(back.profile, 'proyecto'); assert.equal(back.compat, 'uhd'); assert.equal(back.modoGlobal, 'cover');
  assert.deepEqual(back.selected, ['16:9', 'cliente-01', 'cliente-02', 'cliente-esp-2']);
  assert.deepEqual(back.fmt['cliente-01'], {modo: 'blur', fx: .25, fy: .75, zoom: 1.4});
  assert.deepEqual(back.fmt['cliente-02'], {modo: 'cover', fx: 0, fy: 1, zoom: 2});
  assert.deepEqual(back.fmt['16:9'], {modo: 'contain', fx: .2, fy: .2, zoom: 1.1});
  // Una sola vez: no pisa lo que el usuario haga después en el proyecto.
  store.setItem(projectStorageKey(STORAGE_KEY, LEGACY_PROJECT), '{"version":1,"profile":"standard"}');
  assert.equal(migrateStorage(store, STORAGE_KEY), null);
  assert.equal(store.getItem(projectStorageKey(STORAGE_KEY, LEGACY_PROJECT)), '{"version":1,"profile":"standard"}');
  // Quien estaba en la biblioteca con ajustes de Altadis también los conserva, pero se queda en General.
  const lib = new MemoryStore({[STORAGE_KEY]: JSON.stringify({...old, profile: 'standard'})});
  assert.equal(migrateStorage(lib, STORAGE_KEY), null);
  assert.ok(lib.getItem(projectStorageKey(STORAGE_KEY, LEGACY_PROJECT)));
  // Sin rastro de Altadis, corrupto o vacío: nada que migrar.
  for (const value of [JSON.stringify({version: 1, profile: 'standard', selected: ['9:16'], fmt: {'9:16': defaults()}}), '{roto', null]) {
    const s = new MemoryStore(value == null ? {} : {[STORAGE_KEY]: value});
    assert.equal(migrateStorage(s, STORAGE_KEY), null);
    assert.equal(s.getItem(projectStorageKey(STORAGE_KEY, LEGACY_PROJECT)), null);
  }
});
