// Vista por cliente (Carlos, 7-oct-2026): la cuenta asignada a un cliente por la identidad central de AdmiraNeXT
// ve lo de ese cliente y lo genérico, y no puede salir de ahí.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const fuente = fs.readFileSync(new URL('../assets/cliente-activo.js', import.meta.url), 'utf8');
const mapeo = JSON.parse(fs.readFileSync(new URL('../data/clientes-mapeo.json', import.meta.url), 'utf8'));
const CLIENTES = [
  {id:'admira', nombre:'Admira', patas:['studio'], global:true, por_defecto:true},
  {id:'starbucks', nombre:'Starbucks', patas:['studio'], global:true},
  {id:'starbucks-mexico', nombre:'Starbucks México', patas:['todas'], global:false},
  {id:'altadis', nombre:'Altadis', patas:['studio'], global:true}
];
function almacen(inicial = {}) { const m = new Map(Object.entries(inicial)); return {getItem:k => (m.has(k) ? m.get(k) : null), setItem:(k, v) => m.set(k, String(v)), removeItem:k => m.delete(k)}; }
function nodo() {
  const n = {style:{}, children:[], isConnected:false, value:'', innerHTML:'', textContent:'', className:'',
    appendChild(c) { n.children.push(c); return c; }, setAttribute() {}, addEventListener() {}, remove() { n.isConnected = false; },
    insertAdjacentElement(_, c) { c.isConnected = true; return c; }, querySelector() { return nodo(); }, closest() { return null; }};
  return n;
}
async function mundo({sesion, search = '', guardado = null, recordado = null} = {}) {
  const eventos = [], local = almacen(guardado ? {'pixeria:cliente:v2':JSON.stringify(guardado)} : {}), tab = almacen(recordado ? {'pixeria:cliente-fijo':JSON.stringify(recordado)} : {});
  const document = {documentElement:{lang:'es'}, head:nodo(), body:nodo(), createElement:nodo, querySelector:() => nodo(),
    addEventListener() {}, dispatchEvent(e) { eventos.push(e.detail); }};
  const window = {};
  const fetch = async url => {
    url = String(url);
    const cuerpo = url.includes('/auth/session') ? sesion : url.includes('/api/clientes') ? CLIENTES : url.includes('clientes-mapeo') ? mapeo : null;
    return {ok:cuerpo != null, status:cuerpo != null ? 200 : 401, json:async () => cuerpo};
  };
  const ctx = vm.createContext({window, document, fetch, localStorage:local, sessionStorage:tab, location:{search, href:'https://www.pixeria.com/stock.html' + search},
    history:{state:null, replaceState() {}}, URL, URLSearchParams, setTimeout:() => 0, MutationObserver:class { observe() {} }, CustomEvent:class { constructor(_, o) { this.detail = o && o.detail; } }, Promise, Array, JSON, String, Object, RegExp, Error});
  vm.runInContext(fuente, ctx);
  const antes = window.PixeriaCliente.visible({id:'z', tags:['altadis']});
  for (let i = 0; i < 30 && !window.PixeriaCliente.listo(); i++) await new Promise(r => setImmediate(r));
  return {PC:window.PixeriaCliente, eventos, local, tab, antes};
}
const pieza = (id, tags, extra = {}) => ({id, tags, ...extra});
const STOCK = [pieza('s1', ['starbucks', 'bebidas']), pieza('s2', ['starbucks_paseodegracia_103_pantalla1']), pieza('s3', ['StarbucksMexico_AvJuarez_1102_Pantalla_1'.toLowerCase()]),
  pieza('a1', ['altadis']), pieza('g1', ['música']), pieza('g2', ['admira']), pieza('x1', ['starbucks', 'altadis'])];

test('sin restricción todo sigue igual: Admira lo ve todo y el superusuario puede cambiar de cliente', async () => {
  const {PC} = await mundo({sesion:{ok:true, email:'c@x', superusuario:true, clientes:null}});
  assert.equal(PC.restringido(), false); assert.equal(PC.permitidos(), null); assert.equal(PC.esAdmin(), true);
  assert.equal(PC.actual().id, 'admira'); assert.equal(PC.filtrar(STOCK).length, STOCK.length);
  assert.equal(PC.fijar('starbucks'), true);
  assert.deepEqual(PC.filtrar(STOCK).map(i => i.id), ['s1', 's2', 'g1', 'g2'], 'lo de Starbucks y lo genérico; lo ambiguo no');
});

test('la cuenta asignada a Starbucks ve lo de Starbucks y lo genérico, y no puede salir de ahí', async () => {
  const {PC, tab, antes} = await mundo({sesion:{ok:true, email:'ana@x', superusuario:false, clientes:['starbucks']}, search:'?cliente=altadis', guardado:{id:'altadis', nombre:'Altadis'}});
  assert.equal(antes, true, 'la primera vez aún no se sabe que está asignada');
  assert.equal(PC.restringido(), true); assert.deepEqual(PC.permitidos(), ['starbucks']);
  assert.equal(PC.actual().id, 'starbucks', 'ni ?cliente= ni lo guardado la llevan a otro cliente');
  assert.deepEqual(PC.lista().map(c => c.id), ['starbucks']);
  assert.deepEqual(PC.filtrar(STOCK).map(i => i.id), ['s1', 's2', 'g1', 'g2']);
  assert.equal(PC.visible(pieza('p', ['starbucks_paseodegracia_103_pantalla1'])), true, 'el hashtag de pantalla es de su cliente');
  assert.equal(PC.visible(pieza('p', ['altadis_carrergrandegracia_61_pantalla_1'])), false, 'y el de la pantalla de otro cliente no se ve');
  for (const intento of ['', 'admira', 'todas', 'off', 'altadis', 'starbucks-mexico']) assert.equal(PC.fijar(intento), false, 'fijar(' + intento + ')');
  assert.equal(PC.actual().id, 'starbucks'); assert.equal(PC.esAdmin(), false);
  assert.equal(tab.getItem('pixeria:cliente-fijo'), '["starbucks"]', 'se recuerda en la pestaña');
});

test('el flag local de administrador no saca de su cliente a una cuenta asignada', async () => {
  const m = await mundo({sesion:{ok:true, email:'ana@x', superusuario:false, clientes:['starbucks']}});
  m.local.setItem('pixeria:admin', '1');
  assert.equal(m.PC.esAdmin(), false); assert.equal(m.PC.fijar('altadis'), false);
});

test('en las siguientes páginas no asoma nada ajeno mientras llega la sesión', async () => {
  const {PC, antes} = await mundo({sesion:{ok:true, email:'ana@x', superusuario:false, clientes:['starbucks']}, recordado:['starbucks']});
  assert.equal(antes, false, 'cuenta que se sabe asignada: nada visible hasta estar listo');
  assert.equal(PC.visible(pieza('a', ['altadis'])), false); assert.equal(PC.visible(pieza('s', ['starbucks'])), true);
});

test('con varios clientes elige entre los suyos; sin ninguno sólo ve lo genérico', async () => {
  const dos = await mundo({sesion:{ok:true, email:'d@x', superusuario:false, clientes:['starbucks', 'starbucks-mexico']}, search:'?cliente=starbucks-mexico'});
  assert.equal(dos.PC.actual().id, 'starbucks-mexico'); assert.deepEqual(dos.PC.filtrar(STOCK).map(i => i.id), ['s3', 'g1', 'g2']);
  assert.equal(dos.PC.fijar('starbucks'), true); assert.equal(dos.PC.fijar('altadis'), false); assert.equal(dos.PC.fijar('todas'), false);
  const nada = await mundo({sesion:{ok:true, email:'i@x', superusuario:false, clientes:[]}});
  assert.equal(nada.PC.actual().id, 'sin-cliente'); assert.deepEqual(nada.PC.filtrar(STOCK).map(i => i.id), ['g1', 'g2']);
});

test('si la sesión deja de estar restringida, se olvida lo recordado', async () => {
  const {PC, tab} = await mundo({sesion:{ok:true, email:'c@x', superusuario:true, clientes:null}, recordado:['starbucks']});
  assert.equal(PC.restringido(), false); assert.equal(tab.getItem('pixeria:cliente-fijo'), null); assert.equal(PC.filtrar(STOCK).length, STOCK.length);
});

// «Alsea es la propietaria de la marca Starbucks en España y México: son lo mismo» (Carlos, 7-oct-2026).
const ALSEA = [pieza('al1', ['alsea', 'pdg103']), pieza('al2', ['starbucks', 'alsea']), pieza('al3', ['música'], {title:'Hilo musical Alsea otoño'}),
  pieza('al4', ['alsea_paseodegracia_103_pantalla_1']), pieza('al5', ['alsea', 'altadis']), pieza('al6', ['x'], {catalogo:{cliente:'alsea'}}), pieza('al7', ['starbucks-mexico', 'alsea'])];
test('Alsea no es un cliente aparte: lo marcado con Alsea lo ven las cuentas de Starbucks y de Starbucks México', async () => {
  assert.equal(mapeo.clientes.alsea, undefined); assert.deepEqual(mapeo.grupos.alsea.miembros, ['starbucks', 'starbucks-mexico']);
  const sbux = await mundo({sesion:{ok:true, email:'a@x', superusuario:false, clientes:['starbucks']}});
  assert.deepEqual(sbux.PC.filtrar(ALSEA).map(i => i.id), ['al1', 'al2', 'al3', 'al4', 'al6'], 'lo de Alsea y lo de Starbucks+Alsea; no lo que además es de Altadis ni lo de México');
  assert.deepEqual([...sbux.PC.clientesDe(ALSEA[1])], ['starbucks'], 'Starbucks + Alsea ya no es ambiguo');
  assert.deepEqual([...sbux.PC.gruposDe(ALSEA[0])], ['alsea']); assert.equal(sbux.PC.clienteDe(ALSEA[0]), 'starbucks');
  assert.deepEqual(JSON.parse(JSON.stringify(sbux.PC.grupo('alsea'))), {id:'alsea', nombre:'Alsea', miembros:['starbucks', 'starbucks-mexico']});
  const mx = await mundo({sesion:{ok:true, email:'m@x', superusuario:false, clientes:['starbucks-mexico']}});
  assert.deepEqual(mx.PC.filtrar(ALSEA).map(i => i.id), ['al1', 'al3', 'al4', 'al6', 'al7'], 'México ve lo de Alsea y lo suyo, no lo marcado como Starbucks España');
  const otro = await mundo({sesion:{ok:true, email:'o@x', superusuario:false, clientes:['altadis']}});
  assert.deepEqual(otro.PC.filtrar(ALSEA).map(i => i.id), ['al5'], 'otro cliente no ve nada de Alsea (al5 lleva su etiqueta)');
  const todo = await mundo({sesion:{ok:true, email:'c@x', superusuario:true, clientes:null}});
  assert.equal(todo.PC.filtrar(ALSEA).length, ALSEA.length);
});
