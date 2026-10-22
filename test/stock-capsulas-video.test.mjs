import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const src = fs.readFileSync(new URL('../stock.html', import.meta.url), 'utf8');
// Extrae matchesType(it,t) y sus dependencias mínimas del propio stock.html.
const body = src.slice(src.indexOf('function matchesType('), src.indexOf('return displayType(it) === t;') + 'return displayType(it) === t;\n    }'.length);
const isCapsule = it => it && (it.type === 'capsula' || it.type === 'guion');
const matchesType = new Function('isCapsule', 'isXpace', 'isFurni', 'displayType', 'isFailedImport', body + '\nreturn matchesType;')(
  isCapsule, () => false, () => false, it => (isCapsule(it) ? 'capsula' : it.type), () => false);
test('filtro Cápsulas: texto y vídeo etiquetado capsula; el resto de vídeos no', () => {
  assert.equal(matchesType({ type: 'capsula', tags: ['blinkist'] }, 'capsula'), true);
  assert.equal(matchesType({ type: 'guion', tags: [] }, 'capsula'), true);
  assert.equal(matchesType({ type: 'video', tags: ['capsula', 'sabiasque'] }, 'capsula'), true);
  assert.equal(matchesType({ type: 'video', tags: ['Capsula'] }, 'capsula'), true);
  assert.equal(matchesType({ type: 'video', tags: ['sabiasque'] }, 'capsula'), false);
  assert.equal(matchesType({ type: 'image', tags: ['capsula'] }, 'capsula'), false);
  // y los vídeos-cápsula siguen saliendo en «Vídeo»
  assert.equal(matchesType({ type: 'video', tags: ['capsula'] }, 'video'), true);
});
