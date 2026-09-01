// Pruebas del catálogo y las reglas de la batería de signage.
// Son puras a propósito: no arrancan ffmpeg, así que corren en cualquier máquina
// de la flota y en cualquier CI, aunque no haya binarios de vídeo instalados.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  PERFILES, PERFILES_POR_ID, aspecto, recortePerdido,
  bitrateObjetivo, planificar, verificar
} from '../assets/signage-perfiles.js';

const FHD = PERFILES_POR_ID.get('fhd-landscape');
const UHD = PERFILES_POR_ID.get('uhd-4k-landscape');
const LEGACY = PERFILES_POR_ID.get('hd-legacy');
const BARRA = PERFILES_POR_ID.get('barra-lg-88bh7d');
const VERTICAL = PERFILES_POR_ID.get('fhd-portrait');

const origenFHD = {ancho: 1920, alto: 1080, bitrateKbps: 12000, fps: 30, duracion: 10, audio: true};

test('la sección vive en /tester y no se añade al menú superior', () => {
  const pagina = readFileSync(new URL('../tester/index.html', import.meta.url), 'utf8');
  const menu = readFileSync(new URL('../assets/site-nav.js', import.meta.url), 'utf8');
  assert.match(pagina, /<link rel="canonical" href="https:\/\/www\.pixeria\.com\/tester">/);
  assert.match(pagina, /PIXERIA \/\/ TESTER DE DIGITAL SIGNAGE/);
  assert.doesNotMatch(menu, /['"]\/tester\/?['"]/,
    'Tester debe seguir fuera del menú superior hasta que Carlos lo pida');
});

test('el censo de perfiles está completo y sin ids repetidos', () => {
  assert.ok(PERFILES.length >= 10, 'el parque real no cabe en menos de 10 perfiles');
  const ids = PERFILES.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length, 'hay ids duplicados');
  for (const p of PERFILES) {
    assert.ok(p.ancho > 0 && p.alto > 0, `${p.id} sin resolución`);
    assert.ok(p.familias.length > 0, `${p.id} no dice en qué pantalla existe`);
    assert.ok(p.sueloKbps < p.techoKbps, `${p.id}: el suelo no puede pisar el techo`);
    assert.match(p.h264, /^(baseline|main|high)@\d\.\d$/, `${p.id}: perfil@nivel H.264 mal escrito`);
  }
  // Las cuatro marcas que pidió Carlos tienen que estar nombradas en el censo.
  const familias = PERFILES.flatMap((p) => p.familias).join(' ').toLowerCase();
  for (const marca of ['samsung', 'philips', 'lg', 'tcl']) {
    assert.ok(familias.includes(marca), `el censo no cubre ${marca}`);
  }
});

test('el bitrate baja con los píxeles pero nunca se infla', () => {
  // 1920x1080 a 12 Mbps bajado a 1366x768 = 50% de píxeles → ~6 Mbps,
  // pero el techo de esa gama vieja son 4 Mbps y manda el techo.
  const bajada = bitrateObjetivo(origenFHD, LEGACY);
  assert.ok(bajada.kbps <= LEGACY.techoKbps, 'se pasó del techo de la gama vieja');

  // Escalar 1080p a 4K NO puede subir el bitrate por encima del original:
  // no hay detalle nuevo que codificar.
  const subida = bitrateObjetivo(origenFHD, UHD);
  assert.ok(subida.kbps <= origenFHD.bitrateKbps,
    `se infló a ${subida.kbps} kbps desde un original de ${origenFHD.bitrateKbps}`);

  // Un original ya modesto no se re-infla al techo del perfil.
  const modesto = bitrateObjetivo({ancho: 1920, alto: 1080, bitrateKbps: 3000}, FHD);
  assert.ok(modesto.kbps <= 3000, 'se re-infló un original que ya cabía');

  // Sin bitrate de origen medible, el techo del perfil es la respuesta honesta.
  assert.equal(bitrateObjetivo({ancho: 1920, alto: 1080}, FHD).kbps, FHD.techoKbps);
});

test('el bitrate nunca cae por debajo del suelo de calidad', () => {
  // Un 4K a 20 Mbps reducido a una barra de 3840x600 son pocos píxeles: el
  // proporcional se iría a menos de 1 Mbps y la barra se vería a bloques.
  const plan = bitrateObjetivo({ancho: 3840, alto: 2160, bitrateKbps: 20000}, BARRA);
  assert.ok(plan.kbps >= BARRA.sueloKbps, `${plan.kbps} kbps cae bajo el suelo de ${BARRA.sueloKbps}`);
});

test('mismo encuadre no se recorta ni se rellena', () => {
  const plan = planificar(origenFHD, FHD);
  assert.equal(plan.encaje, 'exacto');
  assert.equal(plan.avisos.length, 0, `no debería avisar de nada: ${plan.avisos}`);
});

test('1366x768 se trata como 16:9 y no como un reencuadre', () => {
  // 1.7786 contra 1.7778: son la misma imagen. Recortar aquí sería inventarse
  // un problema y ensuciar el informe con un "ajustado" falso.
  const plan = planificar(origenFHD, LEGACY);
  assert.equal(plan.encaje, 'exacto');
});

test('un 16:9 contra una barra 32:9 se contiene y avisa, no se decapita', () => {
  const plan = planificar(origenFHD, BARRA);
  assert.equal(plan.encaje, 'contener');
  assert.ok(plan.recortePerdido > 0.25);
  assert.ok(plan.avisos.some((a) => a.includes('reencuadre')), 'no avisó del reencuadre');
});

test('apaisado a vertical llena el tótem mediante recorte centrado', () => {
  const plan = planificar(origenFHD, VERTICAL);
  assert.equal(plan.encaje, 'recortar');
  assert.ok(plan.recortePerdido > 0.6, 'el plan debe declarar la pérdida lateral real');
  assert.ok(plan.avisos.some((a) => a.includes('adaptación vertical automática')),
    'la adaptación automática debe quedar explicada');
});

test('la gama vieja fuerza Main@3.1 aunque el original venga en High', () => {
  const plan = planificar(origenFHD, LEGACY);
  assert.equal(plan.h264Perfil, 'main');
  assert.equal(plan.h264Nivel, '3.1');
  assert.ok(plan.fps <= LEGACY.fps, 'no limitó los fotogramas de la gama vieja');
});

test('la baldosa de videowall pide GOP corto para que el mosaico no escalone', () => {
  const plan = planificar(origenFHD, PERFILES_POR_ID.get('videowall-tile-fhd'));
  assert.equal(plan.gopSegundos, 1);
});

test('verificar da ok cuando la salida es exactamente lo pedido', () => {
  const plan = planificar(origenFHD, FHD);
  const r = verificar(plan, {
    ancho: 1920, alto: 1080, codec: 'h264', h264Perfil: 'high', h264Nivel: '4.0',
    bitrateKbps: plan.bitrateKbps, duracion: 10, audio: true
  }, origenFHD);
  assert.equal(r.veredicto, 'ok', `fallos: ${r.fallos} · notas: ${r.notas}`);
});

test('verificar caza la resolución equivocada', () => {
  const plan = planificar(origenFHD, FHD);
  const r = verificar(plan, {ancho: 1918, alto: 1080, codec: 'h264', bitrateKbps: 3000}, origenFHD);
  assert.equal(r.veredicto, 'fallo');
  assert.ok(r.fallos.some((f) => f.includes('resolución')));
});

test('verificar caza el nivel H.264 que deja negra la gama vieja', () => {
  const plan = planificar(origenFHD, LEGACY);
  const r = verificar(plan, {
    ancho: 1366, alto: 768, codec: 'h264', h264Perfil: 'high', h264Nivel: '5.1', bitrateKbps: 2000
  }, origenFHD);
  assert.equal(r.veredicto, 'fallo');
  assert.ok(r.fallos.some((f) => f.includes('perfil H.264')), 'no cazó el perfil');
  assert.ok(r.fallos.some((f) => f.includes('nivel H.264')), 'no cazó el nivel');
});

test('el overshoot normal del encoder no se cuenta como fallo', () => {
  const plan = planificar(origenFHD, FHD);
  const sonda = {
    ancho: 1920, alto: 1080, codec: 'h264', h264Perfil: 'high', h264Nivel: '4.0',
    bitrateKbps: plan.bitrateKbps * 1.1, duracion: 10, audio: true
  };
  assert.equal(verificar(plan, sonda, origenFHD).veredicto, 'ok');
  // El desbordamiento de verdad sí:
  sonda.bitrateKbps = plan.bitrateKbps * 1.8;
  assert.equal(verificar(plan, sonda, origenFHD).veredicto, 'fallo');
});

test('perder el audio es nota, no fallo: la pantalla sigue reproduciendo', () => {
  const plan = planificar(origenFHD, FHD);
  const r = verificar(plan, {
    ancho: 1920, alto: 1080, codec: 'h264', h264Perfil: 'high', h264Nivel: '4.0',
    bitrateKbps: plan.bitrateKbps, duracion: 10, audio: false
  }, origenFHD);
  assert.equal(r.veredicto, 'ajustado');
  assert.ok(r.notas.some((n) => n.includes('muda')));
});

test('un códec que no es h264 rompe el contrato de la batería', () => {
  const plan = planificar(origenFHD, FHD);
  const r = verificar(plan, {ancho: 1920, alto: 1080, codec: 'hevc', bitrateKbps: 3000}, origenFHD);
  assert.equal(r.veredicto, 'fallo');
});

test('todos los perfiles del censo producen un plan válido desde un mismo original', () => {
  for (const p of PERFILES) {
    const plan = planificar(origenFHD, p);
    assert.equal(plan.ancho, p.ancho, `${p.id}: ancho mal planificado`);
    assert.ok(plan.bitrateKbps > 0, `${p.id}: bitrate cero`);
    assert.ok(plan.bitrateKbps <= p.techoKbps, `${p.id}: se pasa del techo`);
    assert.ok(['exacto', 'contener', 'recortar'].includes(plan.encaje), `${p.id}: encaje raro`);
  }
});
