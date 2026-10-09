// Campo de etiquetas al importar y al crear (Carlos, 7-oct-2026).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const trozo = app.slice(app.indexOf('[ETIQUETAS-INICIO]'), app.indexOf('// [ETIQUETAS-FIN]'));
function cargar(PixeriaCliente) {
  const ctx = vm.createContext({window:{PixeriaCliente}});
  vm.runInContext(trozo.slice(trozo.indexOf('\n')) + '\nthis.parseEtiquetas = parseEtiquetas; this.etiquetasSugeridas = etiquetasSugeridas;', ctx);
  return ctx;
}
const {parseEtiquetas} = cargar(null);
const lista = texto => [...parseEtiquetas(texto)];

test('las etiquetas se separan con comas, con espacios o con #, y nunca se repiten', () => {
  assert.deepEqual(lista('#starbucks #starbucks_paseodegracia_103_pantalla1'), ['starbucks', 'starbucks_paseodegracia_103_pantalla1']);
  assert.deepEqual(lista('starbucks otoño  promo'), ['starbucks', 'otoño', 'promo'], 'sin comas, los espacios separan');
  assert.deepEqual(lista('starbucks, hilo musical, #otoño'), ['starbucks', 'hilo musical', 'otoño'], 'con comas, una etiqueta puede llevar espacios');
  assert.deepEqual(lista('#starbucks#alsea\n#Starbucks; café'), ['starbucks', 'alsea', 'café']);
  assert.deepEqual(lista('  '), []); assert.deepEqual(lista(null), []); assert.deepEqual(lista('#, ·, .'), []);
  assert.equal(lista(Array.from({length:30}, (_, i) => 'e' + i).join(' ')).length, 10, 'como mucho diez, las que admite el Stock');
  assert.equal(lista('x'.repeat(200))[0].length, 80);
});

test('con un cliente activo su etiqueta va por delante; sin cliente, el campo nace vacío', () => {
  const PC = id => ({listo:() => true, esDefecto:() => id === 'admira', actual:() => ({id, nombre:id})});
  assert.equal(cargar(PC('starbucks')).etiquetasSugeridas(), '#starbucks ');
  assert.equal(cargar(PC('admira')).etiquetasSugeridas(), '');
  assert.equal(cargar(PC('sin-cliente')).etiquetasSugeridas(), '');
  assert.equal(cargar(null).etiquetasSugeridas(), '');
  assert.equal(cargar({listo:() => false}).etiquetasSugeridas(), '');
});

test('el campo existe al importar y junto a «Publicar en Stock», y sus etiquetas viajan al Stock', () => {
  assert.match(app, /id="import-tags"/, 'campo de la ventana de importar');
  assert.equal((app.match(/tags: etiquetasImport\(\),/g) || []).length, 2, 'fichero local (base64 o por partes, un solo camino desde el 9-oct-2026) e importación por URL');
  assert.match(app, /return pubTagsHTML\(\) \+ `<button type="button" class="btn publish-btn"/, 'todo lo creado lleva el campo junto al botón');
  assert.equal((app.match(/\+ pubTagsHTML\(true\)\n/g) || []).length, 2, 'también los comparadores de imagen y de vídeo');
  assert.match(app, /if \(escritas\.length\) meta = Object\.assign\(\{\}, meta, \{ tags: \[\.\.\.escritas,/, 'lo escrito va delante de lo que la pieza ya trajera');
  assert.match(app, /if \(dlg\.open\) \{ const etq = campoEtiquetasImport\(\); if \(etq\) etq\.value = etiquetasSugeridas\(\); \}/, 'cada vez que se abre la ventana, la abra quien la abra, no se arrastran etiquetas de la importación anterior');
  assert.doesNotMatch(trozo + app.slice(app.indexOf('const ETIQ_EN'), app.indexOf('function publishBtnHTML')), /Pixeria[A-Z](?!liente)/, 'sin identificadores nuevos que el espejo de admira.studio rompería');
});
