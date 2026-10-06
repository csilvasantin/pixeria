// Crear (formatos extremos) · Carlos, 6-oct-2026: detección, geometría de la tira, trayectoria del
// barrido, posiciones del rótulo, planes FFmpeg y, con ADAPTER_FFMPEG_TEST=1, FFmpeg nativo
// (un 16:9 de 2 s → 3840×540 con cada receta, ffprobe; fotogramas del barrido y del rótulo idénticos
// a la ventana que calcula la vista previa).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync, rmSync, readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {UMBRAL_CREAR, RECETAS, TIRA, desproporcion, accionAuto, accionEfectiva, crearDefaults, defaultsFicha, crearSettings, tiraN, tiraGeometria,
  tiraMomentos, tiraTramos, tiraZonas, cascada, alphaCelda, barridoPlan, barridoP, barridoVentana, barridoFiltro, rotuloLayout, rotuloVelocidad,
  rotuloDesplazamiento, crearGrafo, crearJob, crearPared, duracionReceta, tiempoRepresentativo, recetaTag, FPS, motivoAccion, frames,
  relojPrevio, relojT, relojPlay, relojPausa, relojSeek, relojDuracion, relojEnMarcha, previoN, previoFotograma, fmtTiempo, etiquetaTiempo} from '../adaptaciones/crear-core.mjs';
import {atlasJob, segmentsJob, geometry} from '../adaptaciones/especiales-core.mjs';
import {validateFicha, projectFormats} from '../adaptaciones/proyectos-core.mjs';
import {stockPayload} from '../adaptaciones/stock-publish.mjs';
import {publishPlan, publishTags} from '../adaptaciones/estancos-core.mjs';

const SRC = {ancho: 1920, alto: 1080}, BANNER = {ancho: 3840, alto: 540}, SKY = {ancho: 160, alto: 600};
const S = {fx: .5, fy: .5, zoom: 1};
const cfgOf = (receta, extra = {}) => crearSettings({...crearDefaults(receta), ...extra});
const medir = (t, px) => t.length * px * .6;
// Evalúa una expresión de FFmpeg (min, max, floor, cos, abs, mod, PI, n) como lo hace libavutil/eval.
function evalExpr(expr, n) {
  const js = expr.replace(/mod\(/g, 'MOD(').replace(/\bPI\b/g, 'Math.PI').replace(/\b(min|max|floor|cos|abs)\(/g, 'Math.$1(');
  return Function('n', 'MOD', `return ${js};`)(n, (a, b) => a - b * Math.floor(a / b));
}
const exprs = filter => [...filter.matchAll(/(x|y)='([^']+)'/g)].map(m => m[2]);

test('desproporción y umbral: 16:9 → 3840×540 y rascacielos pasan a Crear; 1:1 y 4:5 siguen en Adaptar', () => {
  assert.equal(UMBRAL_CREAR, 3.5);
  assert(Math.abs(desproporcion(SRC, BANNER) - 4) < .01);
  assert(Math.abs(desproporcion(SRC, SKY) - 6.667) < .01);
  assert.equal(desproporcion(SRC, BANNER), desproporcion(BANNER, SRC), 'simétrica');
  assert.equal(accionAuto(SRC, BANNER), 'crear'); assert.equal(accionAuto(SRC, SKY), 'crear');
  assert.equal(accionAuto(SRC, {ancho: 1080, alto: 1080}), 'adaptar'); assert.equal(accionAuto(SRC, {ancho: 1080, alto: 1350}), 'adaptar');
  assert.equal(accionAuto({ancho: 1000, alto: 1000}, {ancho: 3500, alto: 1000}), 'crear', 'r = 3,5 exacto ya es Crear');
  // Carlos (6-oct-2026): 16:9 → 9:16 (r ≈ 3,16) sigue en «Adaptar».
  assert.equal(accionAuto({ancho: 1920, alto: 1080}, {ancho: 1080, alto: 1920}), 'adaptar');
  assert.equal(accionAuto({ancho: 1000, alto: 1000}, {ancho: 2490, alto: 1000}), 'adaptar');
  assert.equal(accionAuto(SRC, {ancho: 1080, alto: 1920}), 'adaptar', '16:9 → 9:16 (r ≈ 3,16) no llega al umbral');
  assert.equal(accionAuto({ancho: 1000, alto: 1000}, {ancho: 3490, alto: 1000}), 'adaptar');
  assert.equal(accionEfectiva({accion: 'adaptar'}, SRC, BANNER), 'adaptar', 'forzar Adaptar');
  assert.equal(accionEfectiva({accion: 'crear'}, SRC, SRC), 'crear', 'forzar Crear');
  assert.equal(accionEfectiva({accion: 'auto'}, {ancho: 0, alto: 0}, BANNER), 'adaptar', 'sin contenido no hay receta');
  assert.equal(desproporcion({ancho: 0, alto: 0}, BANNER), 1);
});

test('ajustes de Crear: saneado, valores por defecto y receta de la ficha', () => {
  const d = crearDefaults();
  assert.deepEqual([d.accion, d.receta], ['auto', 'barrido']);
  const s = crearSettings({accion: 'x', receta: 'ia', tira: {n: 9, sep: 'si', zoom: 99}, barrido: {recorrido: 'loco', sentido: -1, seg: -3}, rotulo: {texto: 'a\u0007b'.repeat(80), color: 'red', fondo: 'solido', velocidad: 99, icono: 'gif'}});
  assert.equal(s.accion, 'auto'); assert.equal(s.receta, 'barrido'); assert.equal(s.tira.n, 0); assert.equal(s.tira.sep, true); assert.equal(s.tira.zoom, TIRA.zoomMax);
  assert.deepEqual(s.barrido, {recorrido: 'ida', sentido: -1, seg: 0});
  assert.equal(s.rotulo.texto.length, 140); assert(!/\u0007/.test(s.rotulo.texto)); assert.equal(s.rotulo.color, '#ffffff'); assert.equal(s.rotulo.fondo, 'solido'); assert.equal(s.rotulo.velocidad, 6); assert.equal(s.rotulo.icono, 'miniatura');
  assert.deepEqual(crearSettings(JSON.parse(JSON.stringify(s))), s, 'idempotente');
  assert.equal(defaultsFicha('tira').receta, 'tira'); assert.equal(defaultsFicha('tira').accion, 'auto');
  assert.equal(defaultsFicha('adaptar').accion, 'adaptar'); assert.equal(defaultsFicha(undefined).receta, 'barrido');
  assert.deepEqual(RECETAS.map(recetaTag), ['crear-tira', 'crear-barrido', 'crear-rotulo']);
});

test('tira: celdas sin solapes ni huecos indebidos, pares y número según la proporción', () => {
  assert.equal(tiraN(SRC, BANNER), 4); assert.equal(tiraN(SRC, SKY), 5); assert.equal(tiraN(SRC, {ancho: 2700, alto: 1000}), 3);
  assert.equal(tiraN(SRC, {ancho: 7920, alto: 540}), 5, 'paredes largas: máximo 5'); assert.equal(tiraN(SRC, BANNER, 3), 3, 'ajustable');
  for (const [W, H] of [[3840, 540], [160, 600], [7920, 540], [2160, 3840], [1536, 192], [728, 90]]) for (const n of [3, 4, 5]) for (const sep of [false, true]) {
    const g = tiraGeometria(W, H, n, sep), L = g.eje === 'x' ? W : H;
    assert.equal(g.celdas.length, n);
    const along = g.celdas.map(c => g.eje === 'x' ? [c.x, c.x + c.w] : [c.y, c.y + c.h]);
    assert.equal(along[0][0], 0); assert.equal(along.at(-1)[1], L, 'la última celda llega al final');
    for (let i = 1; i < n; i++) { assert(along[i][0] >= along[i - 1][1], 'sin solapes'); assert.equal(along[i][0] - along[i - 1][1], g.gap); }
    for (const c of g.celdas) { assert(c.w > 0 && c.h > 0 && c.x + c.w <= W && c.y + c.h <= H); if (g.eje === 'x') assert.equal(c.h, H); else assert.equal(c.w, W); assert.equal(c.x % 2 + c.y % 2, 0, 'posiciones pares'); }
    assert(sep ? g.gap >= 2 && g.gap % 2 === 0 : g.gap === 0);
    const lens = along.map(([a, b]) => b - a); assert(Math.max(...lens) - Math.min(...lens) <= 4, `celdas parejas ${lens}`);
  }
  const m = tiraMomentos(2, 4);
  assert.deepEqual(m, [.24, .72, 1.24, 1.72]); assert(m.every(t => Math.abs(t * FPS - Math.round(t * FPS)) < 1e-9), 'alineados a 25 fps');
  assert.deepEqual(tiraTramos(2, 4), {L: .48, inicios: [0, .48, .96, 1.44]});
  const celdas = tiraGeometria(3840, 540, 4, true).celdas, z = tiraZonas(SRC, celdas, 1.6);
  for (const c of z) assert(c.x >= 0 && c.y >= 0 && c.x + c.w <= SRC.ancho && c.y + c.h <= SRC.alto, 'zona dentro del contenido');
  assert.equal(new Set(z.map(c => `${c.x},${c.y}`)).size, 4, 'zonas distintas');
  const c = cascada(2, 4);
  assert.equal(alphaCelda(0, 0, c), 0); assert.equal(alphaCelda(2, 3, c), 1); assert(alphaCelda(c.paso, 1, c) === 0 && Math.abs(alphaCelda(c.paso + c.fundido / 2, 1, c) - .5) < 1e-9);
  assert.equal(duracionReceta(cfgOf('tira', {tira: {bucle: true}}), {kind: 'video', seconds: 2, src: SRC, dst: BANNER}), .48, 'con tramos en bucle dura un tramo');
  assert.equal(duracionReceta(cfgOf('tira', {tira: {bucle: true}}), {kind: 'still', seconds: 7}), 7);
});

test('barrido: empieza y acaba en los extremos, nunca sale del contenido y la expresión FFmpeg coincide con la vista previa', () => {
  for (const [dst, eje] of [[BANNER, 'y'], [SKY, 'x'], [{ancho: 14400, alto: 540}, 'y'], [{ancho: 1080, alto: 1920}, 'x']]) for (const recorrido of ['ida', 'vuelta']) for (const sentido of [1, -1]) for (const zoom of [1, 1.5]) {
    const cfg = cfgOf('barrido', {barrido: {recorrido, sentido, seg: 0}}), p = barridoPlan(SRC, dst.ancho, dst.alto, {fx: .3, fy: .7, zoom}, cfg, 2);
    if (zoom === 1) assert.equal(p.eje, eje);
    const total = 50, rects = [];
    const [xe, ye] = exprs(barridoFiltro(p, 'src', 'out'));
    const [x2e, y2e] = exprs(barridoFiltro(p, 'src', 'out')).slice(2);
    for (let n = 0; n < total; n++) {
      const w = barridoVentana(n, p), r = w.rect; rects.push(r);
      assert(r.x >= -1e-6 && r.y >= -1e-6 && r.x + r.w <= SRC.ancho + 1e-6 && r.y + r.h <= SRC.alto + 1e-6, `dentro del contenido n=${n}`);
      assert(w.x1 >= 0 && w.x1 + p.cw1 <= SRC.ancho && w.y1 >= 0 && w.y1 + p.ch1 <= SRC.alto, 'primer recorte dentro');
      assert.equal(w.x1 % 2 + w.y1 % 2 + w.x2 % 2 + w.y2 % 2, 0, 'recortes pares');
      assert.deepEqual([evalExpr(xe, n), evalExpr(ye, n), evalExpr(x2e, n), evalExpr(y2e, n)], [w.x1, w.y1, w.x2, w.y2], 'FFmpeg = vista previa');
    }
    const pos = r => p.eje === 'x' ? r.x / (SRC.ancho - r.w) : r.y / (SRC.alto - r.h);
    const first = pos(rects[0]), last = pos(rects.at(-1)), mid = pos(rects[recorrido === 'vuelta' ? 24 : 49]);
    const start = sentido === 1 ? 0 : 1, end = 1 - start;
    assert(Math.abs(first - start) < .02, `empieza en un extremo (${first})`);
    if (recorrido === 'ida') assert(Math.abs(last - end) < .02, `acaba en el otro (${last})`);
    else { assert(Math.abs(mid - end) < .03, `vuelta: a mitad en el otro extremo (${mid})`); assert(Math.abs(last - start) < .1, 'y regresa'); }
    if (recorrido === 'ida') for (let i = 1; i < total; i++) assert((pos(rects[i]) - pos(rects[i - 1])) * sentido >= -1e-3, 'monótono');
  }
  const p = barridoPlan(SRC, 3840, 540, S, cfgOf('barrido'), 2);
  assert.equal(barridoP(0, p), 0); assert.equal(barridoP(p.N1, p), 1); assert(Math.abs(barridoP(p.N1 / 2, p) - .5) < 1e-9, 'suave (coseno)');
  assert(barridoP(1, p) < 1 / p.N1, 'arranca lento');
  assert.equal(barridoPlan(SRC, 3840, 540, S, cfgOf('barrido', {barrido: {seg: .5}}), 2).N1, 12, 'paneo de 0,5 s: más rápido');
  assert.equal(tiempoRepresentativo(cfgOf('barrido'), 2, p), Math.round(p.N1 / 2) / FPS);
});

test('rótulo: layout por periodo, desplazamiento por tiempo y tira que cubre el formato', () => {
  const cfg = cfgOf('rotulo', {rotulo: {velocidad: 2}}), v = rotuloVelocidad(cfg, 3840, 540);
  assert.equal(v, 1080);
  const L = rotuloLayout({W: 3840, H: 540, textos: ['Nuevo sabor', 'New flavour'], icono: {ancho: 1920, alto: 1080}, medir});
  assert.equal(L.eje, 'x'); assert.equal(L.P % 2, 0); assert(L.largo >= 3840 + L.P); assert.equal(L.alto, 540);
  assert.deepEqual(L.ops.map(o => o.tipo), ['icono', 'texto', 'sep', 'icono', 'texto', 'sep']);
  for (const o of L.ops) assert(o.x >= 0 && o.x + (o.w || 0) <= L.P + 1 && (o.y ?? 0) >= 0, 'dentro del periodo');
  for (let n = 0; n < 200; n++) {
    const d = rotuloDesplazamiento(n, v, L.P);
    assert(d >= 0 && d < L.P && d % 2 === 0); assert(d + 3840 <= L.largo, 'la tira cubre el formato');
    assert(Math.abs(d - ((v * n / FPS) % L.P)) <= 2, 'posición = velocidad × tiempo (mód. periodo)');
  }
  assert.equal(rotuloDesplazamiento(25, v, L.P), 2 * Math.floor((1080 % L.P) / 2), 'a 1 s: 1080 px');
  const g = crearGrafo({kind: 'video', src: SRC, W: 3840, H: 540, s: S, cfg, seconds: 2, rotulo: L});
  const xe = g.graph.match(/x='([^']+)'/)[1];
  for (const n of [0, 1, 7, 33, 49]) assert.equal(evalExpr(xe, n), -rotuloDesplazamiento(n, v, L.P), 'FFmpeg = vista previa');
  const V = rotuloLayout({W: 160, H: 600, textos: ['Un claim bastante largo que hay que partir'], icono: null, medir});
  assert.equal(V.eje, 'y'); assert.equal(V.ancho, 160); assert(V.ops.filter(o => o.tipo === 'texto').length > 1, 'parte en líneas');
  assert(V.ops.every(o => o.tipo !== 'texto' || o.w <= 160 - 2 * V.medidas.pad || !o.texto.includes(' ')));
  assert.match(crearGrafo({kind: 'still', src: SRC, W: 160, H: 600, s: S, cfg, seconds: 3, rotulo: V}).graph, /overlay=x=0:y='-2\*floor/);
});

test('planes FFmpeg: entradas, filtros, audio y duración de cada receta y fuente', () => {
  const profile = {ancho: 3840, alto: 540, h264: 'high@5.1', techoKbps: 20000}, tech = {bitrateKbps: 12000, gopSegundos: 2};
  const L = rotuloLayout({W: 3840, H: 540, textos: ['Claim'], icono: null, medir});
  const job = (receta, kind, extra = {}) => crearJob({src: SRC, profile, technical: tech, kind, s: S, cfg: cfgOf(receta, extra), seconds: kind === 'still' ? 6 : 2, name: 'clip.mp4', id: 'custom-3840x540', input: kind === 'video' ? 'input' : kind === 'anim' ? 'input.gif' : 'input.png', rotulo: L});
  for (const receta of RECETAS) for (const kind of ['video', 'still', 'anim']) {
    const j = job(receta, kind), a = j.args, at = k => a[a.indexOf(k) + 1];
    assert.equal(j.W, 3840); assert.equal(j.H, 540); assert.equal(at('-r'), '25'); assert.equal(at('-b:v'), '12000k'); assert.equal(at('-g'), '50');
    assert.equal(j.filename, `clip-custom-3840x540-crear-${receta}-3840x540.mp4`); assert.equal(j.crear, receta);
    assert.match(at('-filter_complex'), /\[out\]$/);
    const audio = kind === 'video' && receta !== 'tira';
    assert.equal(a.includes('0:a?'), audio); assert.equal(a.includes('-an'), !audio); assert.equal(a.includes('aac'), audio);
    assert.equal(a.includes('-color_range'), kind !== 'video', 'rango limitado para imágenes');
    if (kind === 'still') { assert.deepEqual(a.slice(0, 7), ['-loop', '1', '-framerate', '25', '-t', '6', '-i']); assert.equal(j.duration, 6); assert.equal(j.input, 'input.png'); }
    if (kind === 'anim') { assert.deepEqual(a.slice(0, 3), ['-ignore_loop', '1', '-i']); assert.match(at('-filter_complex'), /trim=end_frame=50/); }
    if (receta === 'rotulo') { assert.deepEqual(j.extras, ['rotulo.png']); assert(a.includes('rotulo.png')); } else assert.deepEqual(j.extras, []);
  }
  const tira = job('tira', 'video');
  assert.equal(tira.args.filter(x => x === '-ss').length, 4, 'un -ss por momento'); assert.equal(tira.args.filter(x => x === 'input').length, 4);
  assert.match(tira.args[tira.args.indexOf('-filter_complex') + 1], /tpad=stop_mode=clone:stop=-1/);
  assert.match(tira.args[tira.args.indexOf('-filter_complex') + 1], /fade=t=in:st=0:d=0\.3:alpha=1/);
  const bucle = job('tira', 'video', {tira: {bucle: true}});
  assert.equal(bucle.duration, .48); assert.deepEqual(bucle.args.slice(0, 6), ['-ss', '0', '-t', '0.48', '-i', 'input']);
  assert.match(job('tira', 'still').args.join(' '), /split=4\[z0\]\[z1\]\[z2\]\[z3\]/);
  assert.match(job('barrido', 'video').args.join(' '), /\[0:v\]fps=25\[src\];\[src\]crop=w=\d+:h=\d+:x='[^']+':y='[^']+',scale=\d+:\d+,crop=w=3840:h=540/);
  assert.match(job('rotulo', 'video', {rotulo: {fondo: 'solido', fondoColor: '#102030'}}).args.join(' '), /color=c=0x102030:s=3840x540:r=25:d=2/);
  assert.match(job('rotulo', 'video').args.join(' '), /gblur=sigma=/);
});

test('videowalls: la receta compone la pared física y se corta por pantalla como siempre', () => {
  const layout = JSON.parse(readFileSync(new URL('../adaptaciones/perfil-cliente-especiales.json', import.meta.url))).layouts.find(l => l.id === 'cliente-esp-5');
  const g = geometry(layout), tech = {bitrateKbps: 20000, h264Perfil: 'high', h264Nivel: '5.1', segmentPerfil: 'high', segmentNivel: '4.0'};
  assert(desproporcion(SRC, g.pared) > UMBRAL_CREAR, '13x1 V es extremo');
  for (const receta of RECETAS) for (const kind of ['video', 'still']) {
    const r = crearPared({kind, src: SRC, pared: g.pared, s: S, cfg: cfgOf(receta), seconds: 2, input: kind === 'video' ? 'input' : 'input.png', rotulo: rotuloLayout({W: g.pared.ancho, H: g.pared.alto, textos: ['x'], medir})});
    assert.match(r.graph, new RegExp(`(s=${g.pared.ancho}x${g.pared.alto}|crop=w=${g.pared.ancho}:h=${g.pared.alto}|\\[wall\\])`));
    assert.match(r.graph, /\[wall\]$/);
    const atlas = atlasJob(SRC, layout, 'cover', S, tech, r), seg = segmentsJob(SRC, layout, 'cover', S, tech, r);
    for (const j of [atlas, seg]) { const f = j.args[j.args.indexOf('-filter_complex') + 1]; assert(f.startsWith(r.graph), 'el maestro es la receta'); assert.match(f, new RegExp(`split=${g.segments.length}`)); }
    assert.deepEqual(atlas.args.slice(0, r.inputs.length), r.inputs);
    assert.equal(atlas.args.includes('0:a?'), r.audio); assert.equal(seg.outputs.length, 13);
    assert.equal(atlas.args.includes('-color_range'), kind !== 'video');
  }
  const plain = atlasJob(SRC, layout, 'cover', S, tech);
  assert.deepEqual(plain.args.slice(0, 2), ['-i', 'input'], 'sin receta, igual que antes'); assert(plain.args.includes('0:a?'));
});

test('ficha: recetas por formato validadas y aplicadas; Stock con la etiqueta de la receta', () => {
  const base = JSON.parse(readFileSync(new URL('../adaptaciones/proyectos/_plantilla.json', import.meta.url)));
  const lists = {estandar: base.formatos.estandar, especiales: []};
  assert.deepEqual(validateFicha(base, {lists}), []);
  assert.match(validateFicha({...base, recetas: {'no-existe': 'barrido'}}, {lists}).join(), /no es un formato propio/);
  assert.match(validateFicha({...base, recetas: {[base.formatos.estandar[0].id]: 'ia'}}, {lists}).join(), /tira\|barrido\|rotulo\|adaptar/);
  assert.match(validateFicha({...base, recetas: ['barrido']}, {lists}).join(), /recetas debe ser un objeto/);
  assert.deepEqual(validateFicha({...base, recetas: {[base.formatos.estandar[0].id]: 'adaptar'}}, {lists}), []);
  const fmts = projectFormats({...base, recetas: {[base.formatos.estandar[0].id]: 'tira'}}, lists);
  assert.equal(fmts[0].receta, 'tira'); assert.equal(projectFormats({...base, recetas: undefined}, lists)[0].receta, undefined);
  const p = stockPayload({base64: '', size: 1, title: 't', originId: 'o', client: null, format: 'Banner', width: 3840, height: 540, duration: 2, still: false, receta: 'barrido'});
  assert(p.tags.includes('crear-barrido')); assert.match(p.prompt, /crear · receta barrido/);
  assert(!stockPayload({base64: '', size: 1, title: 't', format: '9:16', width: 1, height: 1, duration: 1}).tags.some(t => t.startsWith('crear-')));
  assert.deepEqual(publishTags({formato: 'cliente-esp-5', rows: [{pantalla: 'p1', estanco: 'e1'}], totalEstancos: 9, receta: 'barrido'}).slice(0, 4), ['altadis', 'adaptación', 'cliente-esp-5', 'crear-barrido']);
  const doc = {proyecto: 'altadis-estancos-bcn', circuito: 'c', estancos: [{id: 'e1'}]}, plan = [{formato: 'cliente-01', pantalla: 'p1', estanco: 'e1', screen: 's', archivo: 'a'}];
  const [con] = publishPlan({doc, plan, formatos: ['cliente-01'], fuente: {clave: 'stock-1'}, recetas: {'cliente-01': 'tira'}});
  const [sin] = publishPlan({doc, plan, formatos: ['cliente-01'], fuente: {clave: 'stock-1'}});
  assert.equal(sin.externalRef, 'pixeria:altadis-estancos-bcn:stock-1:cliente-01', 'sin receta, el externalRef de siempre');
  assert.equal(con.externalRef, 'pixeria:altadis-estancos-bcn:stock-1:cliente-01:crear-tira'); assert(con.tags.includes('crear-tira'));
});

// ── Recetas de la ficha de Altadis (Carlos, 6-oct-2026) ─────────────────────
const json = rel => JSON.parse(readFileSync(new URL(`../adaptaciones/${rel}`, import.meta.url)));
const ALTADIS = {
  barrido: ['cliente-06', 'cliente-10', 'cliente-14', 'cliente-esp-2', 'cliente-esp-3', 'cliente-esp-5'],
  tira: ['cliente-12', 'cliente-15', 'cliente-21', 'cliente-esp-1'],
  rotulo: ['cliente-09', 'cliente-18', 'cliente-19', 'cliente-esp-4'],
};
// Tamaño con el que se mide r: la resolución nativa o, en los videowalls segmentados, la pared física.
function altadisDestinos() {
  const out = {};
  for (const f of json('perfil-cliente-18.json').formats) out[f.id] = {ancho: f.custom[0], alto: f.custom[1], nombre: f.nombre};
  for (const l of json('perfil-cliente-especiales.json').layouts) { const g = geometry(l); out[l.id] = {ancho: g.pared.ancho, alto: g.pared.alto, nombre: l.nombre}; }
  return out;
}

test('Altadis: recetas de la ficha con ids existentes y recetas permitidas; validateFicha limpia', () => {
  const ficha = json('proyectos/altadis-estancos-bcn.json'), dst = altadisDestinos();
  const lists = {estandar: json('perfil-cliente-18.json').formats, especiales: json('perfil-cliente-especiales.json').layouts};
  assert.deepEqual(validateFicha(ficha, {lists, file: 'altadis-estancos-bcn.json'}), []);
  const esperado = Object.fromEntries(Object.entries(ALTADIS).flatMap(([r, ids]) => ids.map(id => [id, r])));
  assert.deepEqual(ficha.recetas, esperado, 'las 14 recetas aprobadas, sin más');
  for (const [id, r] of Object.entries(ficha.recetas)) { assert(dst[id], `${id} existe en los perfiles`); assert(RECETAS.includes(r), `${id}: ${r} es una receta`); }
  // Nombres que la propuesta citaba: Shuttle 1920×158, CORDOBA-098, Sincro (cliente-06).
  assert.deepEqual([dst['cliente-18'].nombre, dst['cliente-18'].ancho, dst['cliente-18'].alto], ['SHUTTLE STRETCH', 1920, 158]);
  assert.equal(dst['cliente-esp-4'].nombre, 'CORDOBA-098'); assert.match(dst['cliente-06'].nombre, /SINCRO/);
  // Sin receta: cliente-01, los que quedan por debajo del umbral y cliente-17 (la propuesta lo daba por «Sincro»
  // y en el PDF es VIDEOWALL 8X1 H, 2880×640: no cuadra, se deja fuera).
  for (const id of ['cliente-01', 'cliente-03', 'cliente-05', 'cliente-08', 'cliente-16', 'cliente-20', 'cliente-24', 'cliente-17']) assert(!(id in ficha.recetas), `${id} sin receta`);
  assert.doesNotMatch(dst['cliente-17'].nombre, /SINCRO/i);
  for (const id of ['cliente-03', 'cliente-05', 'cliente-08', 'cliente-16', 'cliente-20', 'cliente-24', 'cliente-01']) assert(desproporcion(SRC, dst[id]) < UMBRAL_CREAR, `${id}: por debajo del umbral`);
  // Con receta y por debajo del umbral frente a un 16:9: solo cliente-14 (2880×540, r = 3).
  const bajo = Object.keys(ficha.recetas).filter(id => desproporcion(SRC, dst[id]) < UMBRAL_CREAR);
  assert.deepEqual(bajo, ['cliente-14']); assert.equal(desproporcion(SRC, dst['cliente-14']), 3);
  // projectFormats lleva la receta a cada formato (también a los videowalls).
  const fmts = projectFormats(ficha, lists);
  for (const [id, r] of Object.entries(ficha.recetas)) assert.equal(fmts.find(f => f.id === id).receta, r);
  assert.equal(fmts.filter(f => f.receta).length, 14);
});

test('receta de la ficha + umbral + forzado manual: la ficha crea aunque r < umbral; «Adaptar» en la tarjeta manda', () => {
  const dst = altadisDestinos(), c14 = dst['cliente-14'], auto = defaultsFicha('barrido');
  assert.equal(accionAuto(SRC, c14), 'adaptar', 'por r sola, cliente-14 adaptaría');
  assert.equal(accionEfectiva(auto, SRC, c14), 'adaptar', 'sin ficha: el umbral');
  assert.equal(accionEfectiva(auto, SRC, c14, 'barrido'), 'crear', 'con receta en la ficha: Crear');
  assert.deepEqual(motivoAccion(auto, SRC, c14, 'barrido'), {accion: 'crear', motivo: 'ficha', r: 3});
  assert.equal(motivoAccion(auto, SRC, c14).motivo, 'umbral');
  // El usuario fuerza «Adaptar» en la tarjeta: gana a la ficha, y se guarda (difiere de la base de la ficha).
  const forzado = crearSettings({...auto, accion: 'adaptar'}, auto);
  assert.equal(accionEfectiva(forzado, SRC, c14, 'barrido'), 'adaptar'); assert.equal(motivoAccion(forzado, SRC, c14, 'barrido').motivo, 'forzado');
  assert.notDeepEqual(forzado, auto, 'el forzado se persiste');
  assert.equal(accionEfectiva({...auto, accion: 'crear'}, SRC, {ancho: 1920, alto: 1080}, null), 'crear', 'forzar Crear sin ficha');
  // Valor "adaptar" en la ficha: el reencuadre de siempre aunque r ≥ umbral.
  assert.equal(accionEfectiva(defaultsFicha('adaptar'), SRC, BANNER, 'adaptar'), 'adaptar');
  assert.equal(accionEfectiva(auto, SRC, BANNER, 'adaptar'), 'crear', '"adaptar" no es receta: decide el umbral');
  assert.equal(accionEfectiva(auto, {ancho: 0, alto: 0}, c14, 'barrido'), 'adaptar', 'sin contenido no hay receta');
  // Paquete por estanco: con estas recetas, cada formato con receta crea sin preguntar, sea cual sea el contenido.
  const ficha = json('proyectos/altadis-estancos-bcn.json');
  for (const src of [SRC, {ancho: 1080, alto: 1920}, {ancho: 1080, alto: 1080}, {ancho: 3840, alto: 540}]) for (const [id, r] of Object.entries(ficha.recetas)) {
    const cfg = defaultsFicha(r);
    assert.equal(cfg.receta, r); assert.equal(accionEfectiva(cfg, src, dst[id], r), 'crear', `${id} con ${src.ancho}×${src.alto}`);
  }
  for (const id of ['cliente-01', 'cliente-03', 'cliente-17', 'cliente-24']) assert.equal(accionEfectiva(defaultsFicha(undefined), SRC, dst[id], null), 'adaptar', `${id} adapta`);
  const doc = {proyecto: 'altadis-estancos-bcn', circuito: 'c', estancos: [{id: 'e1'}]};
  const plan = ['cliente-14', 'cliente-01'].map((formato, i) => ({formato, pantalla: `p${i}`, estanco: 'e1', screen: `s${i}`, archivo: 'a'}));
  const [p14, p01] = publishPlan({doc, plan, formatos: ['cliente-14', 'cliente-01'], fuente: {clave: 'stock-1'}, recetas: {'cliente-14': ficha.recetas['cliente-14']}});
  assert.match(p14.externalRef, /:cliente-14:crear-barrido$/); assert(p14.tags.includes('crear-barrido'));
  assert.match(p01.externalRef, /:cliente-01$/, 'sin receta, el externalRef de siempre');
});

// ── Previo animado (Carlos, 6-oct-2026) ─────────────────────────────────────
test('reloj del previo: bucle, duración, posición, pausa y seek', () => {
  const r = relojPrevio({duracion: 10, ahora: 1000});
  assert.equal(relojEnMarcha(r), false); assert.equal(relojT(r, 99999), 0, 'en pausa no avanza');
  relojPlay(r, 1000);
  assert.equal(relojT(r, 1000), 0); assert(Math.abs(relojT(r, 5000) - 4) < 1e-9, 'avanza en tiempo real');
  assert(Math.abs(relojT(r, 13500) - 2.5) < 1e-9, 'bucle: vuelve a empezar al llegar a la duración');
  relojPausa(r, 5000); assert(Math.abs(relojT(r, 60000) - 4) < 1e-9, 'pausado se queda en el instante');
  relojPlay(r, 60000); assert(Math.abs(relojT(r, 61000) - 5) < 1e-9, 'reanuda desde donde estaba');
  relojSeek(r, 8, 62000); assert(Math.abs(relojT(r, 62000) - 8) < 1e-9); assert(Math.abs(relojT(r, 63000) - 9) < 1e-9, 'seek en marcha sigue corriendo');
  relojPausa(r, 63000); relojSeek(r, 7.5, 63000); assert.equal(relojT(r, 70000), 7.5, 'seek en pausa');
  relojSeek(r, -3, 0); assert.equal(relojT(r, 0), 0); relojSeek(r, 99, 0); assert(relojT(r, 0) < 10 && relojT(r, 0) > 9.99, 'el final muestra el último fotograma');
  assert.equal(previoN(relojT(r, 0), 10), 249);
  // Cambiar la duración (otra receta, otros segundos) conserva la posición módulo la nueva duración.
  const q = relojPrevio({duracion: 10, t: 7, ahora: 0}); relojDuracion(q, 4, 0); assert.equal(q.duracion, 4); assert(Math.abs(relojT(q, 0) - 3) < 1e-9);
  relojDuracion(q, 0, 0); assert.equal(q.duracion, 1 / FPS, 'duración nula: un fotograma');
  assert.equal(relojPrevio({duracion: 2, enMarcha: true, ahora: 50}).desde, 50);
  // Fotograma: el mismo n que FFmpeg, dentro de la pieza.
  assert.equal(previoN(0, 2), 0); assert.equal(previoN(.04, 2), 1); assert.equal(previoN(.0399, 2), 0); assert.equal(previoN(1.999, 2), 49); assert.equal(previoN(5, 2), 49); assert.equal(previoN(-1, 2), 0);
  // En marcha, un bucle completo recorre todos los fotogramas de la pieza, en orden, y vuelve a 0.
  const b = relojPrevio({duracion: 2, enMarcha: true, ahora: 0}), vistos = [];
  for (let ms = 0; ms < 2000; ms += 8) vistos.push(previoN(relojT(b, ms), 2));
  assert.deepEqual([...new Set(vistos)], Array.from({length: frames(2)}, (_, i) => i)); assert.equal(previoN(relojT(b, 2000), 2), 0);
  // «0:04 / 0:10»; decimas si la pieza dura menos de 3 s.
  assert.equal(etiquetaTiempo(4.2, 10), '0:04 / 0:10'); assert.equal(etiquetaTiempo(65.3, 125.6), '1:05 / 2:06');
  assert.equal(etiquetaTiempo(.4, .48), '0:00.4 / 0:00.5'); assert.equal(fmtTiempo(9.999), '0:09');
});

test('previo = plan FFmpeg: el fotograma del reloj en t es el del MP4 en n, para cada receta y fuente', () => {
  const L = rotuloLayout({W: 3840, H: 540, textos: ['Nuevo sabor', 'New flavour'], icono: {ancho: 1920, alto: 1080}, medir});
  const fade = graph => [...graph.matchAll(/fade=t=in:st=([\d.]+):d=([\d.]+):alpha=1\[c(\d+)\]/g)].map(m => ({st: +m[1], d: +m[2]}));
  const alfaFF = (n, {st, d}) => { const T = n / FPS; return T < st ? 0 : T >= st + d ? 1 : (T - st) / d; };
  let casos = 0;
  for (const [dst, sk] of [[BANNER, S], [SKY, {fx: .2, fy: .8, zoom: 1.3}], [{ancho: 7020, alto: 960}, S]]) for (const kind of ['video', 'still', 'anim']) for (const [receta, extra] of [['barrido', {}], ['barrido', {barrido: {recorrido: 'vuelta', sentido: -1, seg: 0}}], ['barrido', {barrido: {seg: .6}}], ['rotulo', {}], ['tira', {}], ['tira', {tira: {bucle: true, sep: true}}]]) {
    const cfg = cfgOf(receta, extra), seconds = kind === 'anim' ? 1.2 : 2;
    const rot = receta === 'rotulo' ? rotuloLayout({W: dst.ancho, H: dst.alto, textos: ['Claim'], icono: null, medir}) : L;
    const g = crearGrafo({kind, src: SRC, W: dst.ancho, H: dst.alto, s: sk, cfg, seconds, rotulo: rot}), dur = g.duracion;
    // El reloj del previo corre sobre la duración de la receta.
    const reloj = relojPrevio({duracion: duracionReceta(cfg, {kind, seconds, src: SRC, dst}), enMarcha: true, ahora: 0});
    assert.equal(reloj.duracion, dur);
    const [xe, ye, x2e, y2e] = receta === 'barrido' ? exprs(g.graph) : [];
    const xr = receta === 'rotulo' ? g.graph.match(/[xy]='([^']+)'/)[1] : null, fades = receta === 'tira' ? fade(g.graph) : null;
    for (let ms = 0; ms <= dur * 1000 * 1.5; ms += 37) {
      const t = relojT(reloj, ms), n = previoN(t, dur), fr = previoFotograma(g, n);
      assert(n >= 0 && n < frames(dur));
      if (receta === 'barrido') assert.deepEqual([fr.ventana.x1, fr.ventana.y1, fr.ventana.x2, fr.ventana.y2], [xe, ye, x2e, y2e].map(e => evalExpr(e, n)), `barrido ${kind} n=${n}`);
      else if (receta === 'rotulo') assert.equal(-fr.desplazamiento, evalExpr(xr, n), `rótulo ${kind} n=${n}`);
      else {
        assert.equal(fades.length, g.n); fr.alfas.forEach((a, i) => assert(Math.abs(a - alfaFF(n, fades[i])) < 1e-9, `tira ${kind} pieza ${i} n=${n}`));
        if (kind === 'video' && cfg.tira.bucle) fr.origen.forEach((o, i) => assert(Math.abs(o - (g.tramos.inicios[i] + n / FPS)) < 1e-6, 'cada pieza en su tramo'));
        if (kind === 'video' && !cfg.tira.bucle) assert.deepEqual(fr.origen, g.momentos, 'momentos de -ss');
      }
      casos++;
    }
  }
  assert(casos > 1000, `${casos} instantes comparados`);
  // El fotograma representativo (PNG/JPG y pausa) es un instante del mismo reloj.
  const g = crearGrafo({kind: 'still', src: SRC, W: 3840, H: 540, s: S, cfg: cfgOf('barrido'), seconds: 2});
  assert.equal(previoN(tiempoRepresentativo(cfgOf('barrido'), 2, g.barrido), 2), Math.round(g.barrido.N1 / 2));
  assert.equal(previoN(tiempoRepresentativo(cfgOf('tira'), 2), 2), 49, 'tira: último fotograma, todas las piezas');
});

// ── FFmpeg nativo ────────────────────────────────────────────────────────────
test('FFmpeg nativo: 16:9 de 2 s → 3840×540 con cada receta (ffprobe) y fotogramas idénticos a la vista previa', {skip: !process.env.ADAPTER_FFMPEG_TEST}, () => {
  const dir = mkdtempSync(tmpdir() + '/adapter-crear-');
  const run = args => { const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], {encoding: 'utf8', maxBuffer: 1 << 28}); assert.equal(r.status, 0, r.stderr); return r; };
  const probe = file => { const p = JSON.parse(spawnSync('ffprobe', ['-v', 'error', '-count_frames', '-show_streams', '-show_format', '-of', 'json', file], {encoding: 'utf8'}).stdout); const v = p.streams.find(s => s.codec_type === 'video'); return {w: v.width, h: v.height, rate: v.r_frame_rate, frames: +v.nb_read_frames, dur: +p.format.duration, codec: v.codec_name, audio: p.streams.some(s => s.codec_type === 'audio')}; };
  // Fotograma como RGB crudo: `vf` es el filtro completo (debe incluir la selección del fotograma).
  const rawVf = (file, vf) => spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', file, '-vf', `${vf},format=rgb24`, '-frames:v', '1', '-f', 'rawvideo', '-'], {maxBuffer: 1 << 28}).stdout;
  const rawBuf = (file, _, n) => rawVf(file, `select=eq(n\\,${n})`);
  const mad = (a, b) => { assert.equal(a.length, b.length); let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]); return s / a.length; };
  try {
    // Patrón 2D denso que se mueve (un desplazamiento de 2 px en cualquier eje se nota) + audio.
    run(['-f', 'lavfi', '-i', 'nullsrc=size=1920x1080:rate=30', '-f', 'lavfi', '-i', 'sine=frequency=880:sample_rate=48000', '-t', '2', '-vf', "geq=lum='128+90*sin(X/6+T*2)*cos(Y/5)':cb=128:cr='128+60*sin((X+Y)/17)'", '-c:v', 'libx264', '-crf', '10', '-pix_fmt', 'yuv420p', '-c:a', 'aac', `${dir}/src.mp4`]);
    run(['-f', 'lavfi', '-i', 'testsrc2=size=1920x1080', '-frames:v', '1', `${dir}/src.png`]);
    const profile = {ancho: 3840, alto: 540, h264: 'high@5.1', techoKbps: 20000}, tech = {bitrateKbps: 30000};
    const L = rotuloLayout({W: 3840, H: 540, textos: ['Nuevo sabor'], icono: null, medir});
    // Tira del rótulo: rectángulos opacos en un PNG con alfa del tamaño exacto del layout.
    run(['-f', 'lavfi', '-i', `color=c=black@0.0:s=${L.ancho}x${L.alto},format=rgba,drawbox=x=40:y=100:w=600:h=300:c=white@1:t=fill,drawbox=x=${L.P - 300}:y=200:w=200:h=140:c=red@1:t=fill`, '-frames:v', '1', `${dir}/rotulo.png`]);
    const files = {};
    for (const receta of RECETAS) for (const [kind, input, seconds] of [['video', 'src.mp4', 2], ['still', 'src.png', 3]]) {
      const cfg = cfgOf(receta, receta === 'rotulo' ? {rotulo: {fondo: kind === 'video' ? 'desenfocado' : 'solido'}} : {});
      const j = crearJob({src: SRC, profile, technical: tech, kind, s: S, cfg, seconds, name: 'clip', id: 'banner', input, rotulo: L});
      const out = `${dir}/${receta}-${kind}.mp4`;
      run(j.args.map(a => a === input ? `${dir}/${input}` : a === 'rotulo.png' ? `${dir}/rotulo.png` : a === 'output.mp4' ? out : a));
      const p = probe(out);
      assert.deepEqual([p.codec, p.w, p.h, p.rate, p.frames], ['h264', 3840, 540, '25/1', seconds * 25], `${receta}/${kind}`);
      assert(Math.abs(p.dur - seconds) < .05, `${receta}/${kind} dura ${p.dur}`);
      assert.equal(p.audio, kind === 'video' && receta !== 'tira');
      files[`${receta}-${kind}`] = {out, j};
    }
    // Tira con tramos en bucle: dura un tramo.
    const jb = crearJob({src: SRC, profile, technical: tech, kind: 'video', s: S, cfg: cfgOf('tira', {tira: {bucle: true}}), seconds: 2, name: 'clip', id: 'banner', input: 'src.mp4'});
    run(jb.args.map(a => a === 'src.mp4' ? `${dir}/src.mp4` : a === 'output.mp4' ? `${dir}/bucle.mp4` : a));
    const pb = probe(`${dir}/bucle.mp4`); assert.equal(pb.frames, 12); assert(Math.abs(pb.dur - .48) < .05);
    // Barrido: el fotograma n del MP4 es la ventana que pinta la vista previa (recortes estáticos de JS sobre el
    // fotograma n del origen): la ventana exacta se parece más que cualquier ventana desplazada ±2/±4 px.
    const {j} = files['barrido-video'], p = j.grafo.barrido;
    for (const n of [0, 17, 30, 49]) {
      const w = barridoVentana(n, p), got = rawBuf(files['barrido-video'].out, '', n);
      const err = d => { const y2 = Math.max(0, Math.min(p.S2h - p.H, w.y2 + d)); return y2 !== w.y2 + d ? Infinity : mad(rawVf(`${dir}/src.mp4`, `fps=25,select=eq(n\\,${n}),crop=${p.cw1}:${p.ch1}:${w.x1}:${w.y1},scale=${p.S2w}:${p.S2h},crop=${p.W}:${p.H}:${w.x2}:${y2}`), got); };
      const e0 = err(0), others = [-4, -2, 2, 4].map(err);
      assert(others.every(e => e > e0), `barrido n=${n}: la ventana exacta (${e0.toFixed(2)}) gana a las desplazadas (${others.map(e => e.toFixed(2))})`);
      assert(e0 < 8, `barrido n=${n}: diferencia media ${e0.toFixed(2)} (solo compresión)`);
    }
    // Rótulo (fondo sólido, imagen): el fotograma n = el PNG pegado en -desplazamiento.
    const ps = files['rotulo-still'].j.grafo.rotulo;
    for (const n of [0, 30, 74]) {
      const d = rotuloDesplazamiento(n, ps.v, ps.P);
      const ref = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', `color=c=0x021006:s=3840x540`, '-i', `${dir}/rotulo.png`, '-filter_complex', `[0:v][1:v]overlay=x=${-d}:y=0,format=rgb24`, '-frames:v', '1', '-f', 'rawvideo', '-'], {maxBuffer: 1 << 28}).stdout;
      const e = mad(ref, rawBuf(files['rotulo-still'].out, '', n)); assert(e < 3, `rótulo n=${n}: diferencia media ${e.toFixed(2)}`);
    }
    // Pared 13x1 V con barrido: 13 pantallas de 540×960, 50 fotogramas cada una.
    const layout = JSON.parse(readFileSync(new URL('../adaptaciones/perfil-cliente-especiales.json', import.meta.url))).layouts.find(l => l.id === 'cliente-esp-5');
    const r = crearPared({kind: 'video', src: SRC, pared: geometry(layout).pared, s: S, cfg: cfgOf('barrido'), seconds: 2, input: 'input'});
    const seg = segmentsJob(SRC, layout, 'cover', S, {bitrateKbps: 20000, h264Perfil: 'high', h264Nivel: '5.1', segmentPerfil: 'high', segmentNivel: '4.0'}, r);
    const segArgs = seg.args.map(a => a === 'input' ? `${dir}/src.mp4` : /^seg\d+\.mp4$/.test(a) ? `${dir}/${a}` : a);
    run(segArgs);
    for (const o of [seg.outputs[0], seg.outputs[12]]) { const q = probe(`${dir}/${o.file}`); assert.deepEqual([q.w, q.h, q.rate, q.frames], [540, 960, '25/1', 50]); }
  } finally { rmSync(dir, {recursive: true, force: true}); }
});
