// Estancos y circuito (Carlos, 6-oct-2026): paquete por estanco y publicación al circuito.
// Esquema del JSON de estancos, selección → formatos exactos, nombres y manifiesto, ZIP (con fflate
// 0.8.2: FFLATE=/ruta/fflate/esm/index.mjs, o se salta) y payload del Stock sin duplicados.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, mkdtempSync, existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {validateEstancos, formatsFor, packagePlan, groupByEstanco, entryPath, manifest, zipEntries, buildZip, zipName, sourceKey, stockRef, publishPlan, publishTags, packagePayload, publishPieces, FFLATE, MANIFEST, STOCK_TAG_MAX, STOCK_TAGS_OWN, programPieces, loteKey, PROGRAMAR_MAX} from '../adaptaciones/estancos-core.mjs';
import {formatRef, resolveRef, projectFormats, validateFicha} from '../adaptaciones/proyectos-core.mjs';
import {stockPayload} from '../adaptaciones/stock-publish.mjs';

const ROOT = new URL('../', import.meta.url);
const json = rel => JSON.parse(readFileSync(new URL(rel, ROOT)));
const DIR = 'adaptaciones/proyectos/';
const ficha = json(DIR + 'altadis-estancos-bcn.json');
const lists = Object.fromEntries(['estandar', 'especiales'].map(k => { const ref = formatRef(ficha.formatos[k]); return [k, json(resolveRef(DIR + 'x.json', ref.archivo))[ref.clave]]; }));
const formats = projectFormats(ficha, lists);
const doc = json(resolveRef(DIR + 'altadis-estancos-bcn.json', ficha.estancos.archivo));
const ALL = doc.estancos.map(e => e.id);
const FFLATE_PATH = process.env.FFLATE || '/Users/csilvasantin/Claudito/admira-signage-mvp/node_modules/.pnpm/fflate@0.8.2/node_modules/fflate/esm/index.mjs';

test('esquema: la ficha Altadis apunta a sus estancos y el JSON es válido contra sus formatos', () => {
  assert.deepEqual(validateFicha(ficha, {lists}), []);
  assert.deepEqual(validateEstancos(doc, {formats, proyecto: ficha.id}), []);
  assert.equal(doc.estancos.length, 9);
  for (const e of doc.estancos) {
    assert.ok(e.pantallas.length >= 1, `${e.id} sin pantallas`);
    for (const p of e.pantallas) assert.ok(formats.some(f => f.id === p.formato), `${p.screen}: ${p.formato} no está en la ficha`);
  }
  // El mapa es derivado (resolución + uso), no confirmado por Altadis: el JSON lo dice.
  assert.equal(doc.mapa.estado, 'derivado');
});

test('esquema: detecta formato inexistente, medida que no cuadra, estanco sin pantallas y ids repetidos', () => {
  const bad = structuredClone(doc);
  bad.estancos[0].pantallas[0].formato = 'cliente-99';
  bad.estancos[1].pantallas[1].ancho = 1280;
  bad.estancos[2].pantallas = [];
  bad.estancos[3].id = bad.estancos[4].id;
  const errors = validateEstancos(bad, {formats, proyecto: ficha.id});
  assert.ok(errors.some(e => /cliente-99.*no existe/.test(e)), errors.join('\n'));
  assert.ok(errors.some(e => /1280×1080 no es la medida de cliente-02/.test(e)));
  assert.ok(errors.some(e => /al menos una pantalla/.test(e)));
  assert.ok(errors.some(e => /repetido/.test(e)));
  assert.ok(validateEstancos({...doc, proyecto: 'otro'}, {formats, proyecto: ficha.id}).some(e => /no es el de la ficha/.test(e)));
  assert.ok(validateFicha({...ficha, estancos: {archivo: '../../fuera.json'}}, {lists}).some(e => /dentro de adaptaciones/.test(e)));
});

test('selección por estanco → formatos exactos de sus pantallas', () => {
  assert.deepEqual(formatsFor(doc, ['altadis-bcn-003']), ['cliente-01', 'cliente-02']);
  assert.deepEqual(formatsFor(doc, ALL), ['cliente-01', 'cliente-02']);
  assert.deepEqual(formatsFor(doc, []), []);
  assert.deepEqual(formatsFor(doc, ['no-existe']), []);
  // Un estanco con una sola pantalla pide solo su formato.
  const one = structuredClone(doc); one.estancos[0].pantallas = [one.estancos[0].pantallas[1]];
  assert.deepEqual(formatsFor(one, ['altadis-bcn-001']), ['cliente-02']);
  const plan = packagePlan(doc, ['altadis-bcn-001', 'altadis-bcn-009'], formats);
  assert.equal(plan.length, 4);
  assert.deepEqual(groupByEstanco(plan).map(g => [g.estanco, g.rows.length]), [['altadis-bcn-001', 2], ['altadis-bcn-009', 2]]);
});

test('nombres: <estanco>/<pantalla>-<formato>-<ancho>x<alto>.mp4', () => {
  const plan = packagePlan(doc, ['altadis-bcn-003'], formats);
  assert.deepEqual(plan.map(r => r.archivo), [
    'altadis-bcn-003-n275-torrent-de-l-olla/p1-vertical-cliente-01-1080x1920.mp4',
    'altadis-bcn-003-n275-torrent-de-l-olla/p2-horizontal-cliente-02-1920x1080.mp4'
  ]);
  for (const r of packagePlan(doc, ALL, formats)) assert.match(r.archivo, /^altadis-bcn-00\d-[a-z0-9-]+\/p\d-[a-z]+-cliente-\d\d-\d+x\d+\.mp4$/);
  assert.equal(entryPath({slug: 'a-b'}, {id: 'p1'}, 'cliente-esp-1', 1280, 1080, 'mp4'), 'a-b/p1-cliente-esp-1-1280x1080.mp4');
  assert.equal(zipName(doc), 'altadis-estancos-bcn-todos.zip');
  assert.equal(zipName(doc, doc.estancos[2]), 'altadis-estancos-bcn-altadis-bcn-003-n275-torrent-de-l-olla.zip');
});

const fakeFiles = () => {
  const files = new Map();
  for (const [id, n] of [['cliente-01', 3], ['cliente-02', 5]]) {
    const data = new Uint8Array(n * 1000).map((_, i) => (i * n) & 255);
    files.set(id, {data, bytes: data.length, duracion: 12.345, sha256: createHash('sha256').update(data).digest('hex')});
  }
  return files;
};
const fuente = {id: '1783975679206-g3u9ej', titulo: 'Paisaje · reserva neutra', url: 'https://stock.admira.store/stock/1783975679206-g3u9ej/asset.mp4', clave: sourceKey({stockId: '1783975679206-g3u9ej'})};

test('manifiesto: estanco, pantalla, formato, archivo, duración, hash y fuente por pieza', () => {
  const plan = packagePlan(doc, ALL, formats), files = fakeFiles();
  const m = manifest({doc, plan, files, fuente, generado: '2026-10-06T10:00:00Z'});
  assert.equal(m.proyecto, 'altadis-estancos-bcn'); assert.equal(m.circuito, 'altadis_bcn');
  assert.equal(m.piezas.length, 18);
  const p = m.piezas.find(x => x.screen === 'altadis-bcn-005-p2-horizontal');
  assert.deepEqual(Object.keys(p).sort(), ['alto', 'ancho', 'archivo', 'bytes', 'duracion', 'estanco', 'estancoNombre', 'formato', 'fuente', 'pantalla', 'screen', 'sha256'].sort());
  assert.equal(p.formato, 'cliente-02'); assert.equal(p.duracion, 12.35); assert.equal(p.sha256, files.get('cliente-02').sha256);
  assert.equal(p.fuente, 'stock-1783975679206-g3u9ej'); assert.equal(m.fuente.url, fuente.url);
  const scoped = manifest({doc, plan, files, fuente, generado: 'x', scope: ['altadis-bcn-002']});
  assert.deepEqual(scoped.piezas.map(x => x.screen), ['altadis-bcn-002-p1-vertical', 'altadis-bcn-002-p2-horizontal']);
});

test('ZIP: rutas por estanco + manifest.json, contenido íntegro (fflate 0.8.2)', async t => {
  if (!existsSync(FFLATE_PATH)) { t.skip('sin fflate local (FFLATE=/ruta/fflate/esm/index.mjs)'); return; }
  const {zipSync, unzipSync} = await import(FFLATE_PATH);
  const plan = packagePlan(doc, ALL, formats), files = fakeFiles();
  const m = manifest({doc, plan, files, fuente, generado: '2026-10-06T10:00:00Z'});
  const zip = buildZip(zipEntries({plan, files, manifestJSON: m}), zipSync);
  const back = unzipSync(zip);
  assert.equal(Object.keys(back).length, 19);
  assert.ok(back[MANIFEST]);
  assert.deepEqual(JSON.parse(new TextDecoder().decode(back[MANIFEST])), m);
  for (const r of plan) assert.equal(createHash('sha256').update(back[r.archivo]).digest('hex'), files.get(r.formato).sha256);
  // Mismo lote → mismo ZIP (fecha fija, sin deflate).
  assert.deepEqual(buildZip(zipEntries({plan, files, manifestJSON: m}), zipSync), zip);
  // ZIP por estanco: solo sus carpetas.
  const one = unzipSync(buildZip(zipEntries({plan, files, manifestJSON: m, scope: ['altadis-bcn-007']}), zipSync));
  assert.deepEqual(Object.keys(one).sort(), [MANIFEST, 'altadis-bcn-007-n359-tabacs-m-angels/p1-vertical-cliente-01-1080x1920.mp4', 'altadis-bcn-007-n359-tabacs-m-angels/p2-horizontal-cliente-02-1920x1080.mp4'].sort());
  // Lo lee también unzip del sistema (si existe).
  const dir = mkdtempSync(join(tmpdir(), 'estancos-')), path = join(dir, 'lote.zip'); writeFileSync(path, zip);
  const u = spawnSync('unzip', ['-l', path], {encoding: 'utf8'});
  if (u.status === 0) assert.match(u.stdout, /altadis-bcn-001-gran-de-gracia-61\/p1-vertical-cliente-01-1080x1920\.mp4/);
  // La versión fijada es la del módulo local.
  assert.equal(createHash('sha256').update(readFileSync(FFLATE_PATH.replace(/index\.mjs$/, 'browser.js'))).digest('hex'), FFLATE.sha256);
});

test('Stock: tags de Altadis, externalRef estable y sin duplicados al repetir', async () => {
  const plan = packagePlan(doc, ['altadis-bcn-001'], formats);
  const pieces = publishPlan({doc, plan, formatos: formatsFor(doc, ['altadis-bcn-001']), fuente});
  assert.deepEqual(pieces.map(p => p.externalRef), ['pixeria:altadis-estancos-bcn:stock-1783975679206-g3u9ej:cliente-01', 'pixeria:altadis-estancos-bcn:stock-1783975679206-g3u9ej:cliente-02']);
  assert.deepEqual(pieces[0].tags, ['altadis', 'adaptación', 'cliente-01', 'pantalla-p1-vertical', 'estanco-altadis-bcn-001']);
  assert.match(pieces[1].comment, /estanco altadis-bcn-001 · pantalla altadis-bcn-001-p2-horizontal/);
  // Mismo origen y formato → misma referencia; otra fuente → otra.
  assert.equal(stockRef('altadis-estancos-bcn', fuente.clave, 'cliente-01'), pieces[0].externalRef);
  const local = sourceKey({sha256: 'a'.repeat(64)});
  assert.equal(local, 'sha256-aaaaaaaaaaaaaaaa');
  assert.notEqual(stockRef('altadis-estancos-bcn', local, 'cliente-01'), pieces[0].externalRef);
  // Payload interceptado: el de las adaptaciones con las etiquetas y la referencia del lote.
  const posted = [], known = new Map();
  const upload = async piece => { const body = packagePayload(stockPayload({base64: 'AA==', size: 1, title: 't', originId: fuente.id, client: null, format: piece.formato, width: 1080, height: 1920, duration: 10}), piece); posted.push(body); return {ok: true, id: `id-${posted.length}`, num: 9000 + posted.length}; };
  const log1 = await publishPieces(pieces, {upload, known});
  assert.deepEqual(log1.map(l => l.estado), ['publicada', 'publicada']);
  assert.equal(posted.length, 2);
  assert.deepEqual(posted[0].tags, pieces[0].tags); assert.equal(posted[0].externalRef, pieces[0].externalRef); assert.equal(posted[0].motor, 'adaptador');
  // Segunda vez: nada se sube; la tercera, con el lote de todos, tampoco (misma fuente y formato).
  const log2 = await publishPieces(publishPlan({doc, plan, formatos: ['cliente-01', 'cliente-02'], fuente, known}), {upload, known});
  assert.deepEqual(log2.map(l => [l.estado, l.id]), [['ya-estaba', 'id-1'], ['ya-estaba', 'id-2']]);
  const all = publishPlan({doc, plan: packagePlan(doc, ALL, formats), formatos: formatsFor(doc, ALL), fuente, known});
  assert.ok(all.every(p => p.skip));
  await publishPieces(all, {upload, known});
  assert.equal(posted.length, 2);
  // El Stock reutiliza por contenido (reused): cuenta como hecha y no se repite.
  const k2 = new Map(); const log3 = await publishPieces([pieces[0]], {upload: async () => ({ok: true, id: 'old', reused: true}), known: k2});
  assert.equal(log3[0].estado, 'reutilizada'); assert.equal(k2.get(pieces[0].externalRef).id, 'old');
  // Un fallo queda en el registro y no se marca como publicado.
  const k3 = new Map(); const log4 = await publishPieces([pieces[0]], {upload: async () => ({ok: false, error: 'HTTP 500'}), known: k3});
  assert.equal(log4[0].estado, 'error'); assert.equal(k3.size, 0);
});

test('Stock: con todos los estancos las etiquetas caben en el límite del worker', () => {
  const plan = packagePlan(doc, ALL, formats);
  for (const p of publishPlan({doc, plan, formatos: formatsFor(doc, ALL), fuente})) {
    assert.ok(p.tags.length <= STOCK_TAGS_OWN); assert.ok(p.tags.every(t => t.length <= STOCK_TAG_MAX && t === t.toLowerCase()));
    assert.ok(p.tags.includes('estancos-todos'));
    assert.equal(p.comment.split('\n').length, 10); // cabecera + 9 estancos
  }
  const three = packagePlan(doc, ALL.slice(0, 3), formats);
  assert.deepEqual(publishTags({formato: 'cliente-01', rows: three.filter(r => r.formato === 'cliente-01'), totalEstancos: 9}), ['altadis', 'adaptación', 'cliente-01', 'pantalla-p1-vertical', 'estanco-altadis-bcn-001', 'estanco-altadis-bcn-002', 'estanco-altadis-bcn-003']);
  const five = packagePlan(doc, ALL.slice(0, 5), formats);
  assert.ok(publishTags({formato: 'cliente-01', rows: five.filter(r => r.formato === 'cliente-01'), totalEstancos: 9}).includes('estancos-5'));
});

test('programación de players: piezas del lote para /players-programar', () => {
  const plan = packagePlan(doc, ['altadis-bcn-003', 'altadis-bcn-007'], formats);
  const files = new Map([['cliente-01', {duracion: 10.004}], ['cliente-02', {duracion: 1}]]);
  // Solo cliente-01 está en el Stock: cliente-02 falta y no se programa.
  const half = programPieces({plan, stock: new Map([['cliente-01', {id: 'abc-1'}]]), files});
  assert.deepEqual(half.faltan, ['cliente-02']);
  assert.equal(half.piezas.length, 2); assert.equal(half.estancos, 2);
  assert.deepEqual(half.piezas[0], {estanco: 'altadis-bcn-003', pantalla: 'p1-vertical', screenId: 'altadis-bcn-003-p1-vertical', stockId: 'abc-1', url: 'https://stock.admira.store/stock/abc-1/asset.mp4', formato: 'cliente-01', duracion: 10});
  const all = programPieces({plan, stock: new Map([['cliente-01', {id: 'abc-1'}], ['cliente-02', {id: 'abc-2'}]]), files});
  assert.equal(all.piezas.length, 4); assert.deepEqual(all.faltan, []);
  assert.equal(all.piezas.find(p => p.formato === 'cliente-02').duracion, 2, 'admira.tv no admite menos de 2 s');
  assert.ok(all.piezas.length <= PROGRAMAR_MAX && doc.estancos.reduce((n, e) => n + e.pantallas.length, 0) <= PROGRAMAR_MAX, 'el circuito entero cabe en una llamada');
  assert.notEqual(loteKey(half.piezas), loteKey(all.piezas));
  assert.equal(loteKey(all.piezas), loteKey(programPieces({plan, stock: new Map([['cliente-01', {id: 'abc-1'}], ['cliente-02', {id: 'abc-2'}]]), files}).piezas));
});
