import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const data = JSON.parse(fs.readFileSync(new URL('../assets/xpaces/aulestia/zonas.json', import.meta.url), 'utf8'));
const page = fs.readFileSync(new URL('../xpacios/aulestia-i-pijoan/index.html', import.meta.url), 'utf8');
const gate = fs.readFileSync(new URL('../functions/_middleware.js', import.meta.url), 'utf8');

function peliculas(id) {
  return data.plantas.find(p => p.id === id).zonas.map(z => z.pelicula);
}

test('cada planta lleva solo las películas que fijó Carlos', () => {
  assert.equal(data.acceso, 'friends and family');
  assert.deepEqual(data.plantas.map(p => p.id), ['planta-baja', 'planta-arriba', 'planta-abajo']);
  assert.deepEqual(peliculas('planta-baja'), ['Toy Story', 'Monstruos, S.A.', 'Ratatouille']);
  assert.equal(data.plantas[0].zonas[0].etiqueta, 'Habitación de Andy');
  assert.equal(data.plantas[1].pelicula, 'Up');
  assert.deepEqual(peliculas('planta-arriba'), ['Up', 'por asignar', 'por asignar']);
  assert.deepEqual(peliculas('planta-abajo'), ['WALL·E', 'Soul', 'Los Increíbles']);
  assert.equal(data.plantas[2].zonas[1].etiqueta, 'Estudio de música con IA');
  assert.match(data.plantas[2].zonas[2].etiqueta, /8 sillas/);
  assert.equal(data.plantas.reduce((n, p) => n + p.zonas.length, 0), 9);
  const texto = JSON.stringify(data);
  assert.equal(texto.includes('Local '), false);
  assert.equal(texto.includes('comercial'), false);
});

test('la página pinta las plantas desde el JSON y sigue abriendo sin sesión', () => {
  assert.match(page, /zonas\.json\?v=4471/);
  assert.match(page, /data\.plantas/);
  assert.match(page, /friends and family/);
  assert.match(gate, /\/xpacios\/aulestia-i-pijoan/);
});
