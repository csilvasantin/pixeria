// ============================================================================
// BATERÍA DE PRUEBAS DE DIGITAL SIGNAGE — catálogo de pantallas y reglas.
//
// POR QUÉ EXISTE: un mismo vídeo que se ve perfecto en el portátil se queda
// negro en un tótem Philips, se corta en una barra Samsung y tira 20 Mbps
// contra un reproductor Android que no pasa de 8. Hasta ahora eso se descubría
// EN LA TIENDA, con el cliente delante. Aquí se descubre antes: se declara el
// parque real de pantallas del mercado y se comprueba el mismo contenido
// contra todas ellas.
//
// Este fichero es la FUENTE ÚNICA. Lo importan las dos mitades:
//   · scripts/signage-bateria.mjs  (el motor, con ffmpeg, en node)
//   · signage-bateria.html         (el cuadro de mando, en el navegador)
// Por eso es ESM puro y no toca ni `fs` ni `document`: si un día divergen el
// motor y la página, el catálogo deja de ser una verdad y pasa a ser dos.
// ============================================================================

// ─── PERFILES ───────────────────────────────────────────────────────────────
// Cada perfil es una pantalla que EXISTE y se vende, no una resolución bonita.
// `familias` lista los modelos concretos donde lo hemos visto, porque cuando
// una prueba falla lo primero que pregunta el cliente es «¿en cuál?».
//
// `techoKbps` no es un capricho: es lo que el DECODIFICADOR de esa gama sostiene
// sin tirones. Los SoC Android de las gamas de entrada (TCL, Philips D-Line)
// son los que marcan los techos bajos, no el panel.
//
// `h264` (perfil@nivel) es el otro muro silencioso: un H.264 High@5.1 se ve en
// un Samsung QM de 2023 y da pantalla negra en un LG SM3C de 2017. Cuando la
// gama es vieja se baja a Main@3.1 aunque el fichero pese más.
export const PERFILES = [
  {
    id: 'uhd-4k-landscape',
    nombre: 'UHD 4K apaisada',
    ancho: 3840, alto: 2160, orientacion: 'apaisada',
    familias: ['Samsung QMx/QBx', 'LG UM5N / UL3J', 'Philips Q-Line', 'TCL 4K'],
    techoKbps: 20000, sueloKbps: 6000, h264: 'high@5.1', fps: 60
  },
  {
    id: 'fhd-landscape',
    nombre: 'Full HD apaisada',
    ancho: 1920, alto: 1080, orientacion: 'apaisada',
    familias: ['Samsung QMR/QBR', 'LG UL3G / SM5KE', 'Philips D-Line', 'TCL FHD'],
    techoKbps: 8000, sueloKbps: 2500, h264: 'high@4.0', fps: 60
  },
  {
    id: 'fhd-portrait',
    nombre: 'Full HD vertical (tótem)',
    ancho: 1080, alto: 1920, orientacion: 'vertical',
    familias: ['Samsung KM24C', 'Philips tótem 10BDL', 'LG 55EW5PG'],
    techoKbps: 8000, sueloKbps: 2500, h264: 'high@4.0', fps: 60
  },
  {
    id: 'uhd-portrait',
    nombre: 'UHD 4K vertical',
    ancho: 2160, alto: 3840, orientacion: 'vertical',
    familias: ['Samsung QBx girada', 'LG UM5N girada'],
    techoKbps: 20000, sueloKbps: 6000, h264: 'high@5.1', fps: 60
  },
  {
    id: 'qhd-landscape',
    nombre: 'QHD apaisada',
    ancho: 2560, alto: 1440, orientacion: 'apaisada',
    familias: ['Philips B-Line', 'TCL gama media'],
    techoKbps: 12000, sueloKbps: 4000, h264: 'high@4.2', fps: 60
  },
  {
    id: 'hd-legacy',
    nombre: 'HD heredada (parque viejo)',
    ancho: 1366, alto: 768, orientacion: 'apaisada',
    familias: ['LG SM3C', 'Samsung DB-E', 'Philips BDL4051D'],
    // Main@3.1 a propósito: estas gamas NO decodifican High. Pantalla negra sin
    // ningún error en el log del reproductor — el fallo más caro de diagnosticar.
    techoKbps: 4000, sueloKbps: 1200, h264: 'main@3.1', fps: 30
  },
  {
    id: 'hd-720-android',
    nombre: 'HD 720 (reproductor Android de entrada)',
    ancho: 1280, alto: 720, orientacion: 'apaisada',
    familias: ['TCL entrada', 'Philips D-Line SoC', 'palos Android genéricos'],
    techoKbps: 3000, sueloKbps: 900, h264: 'main@3.1', fps: 30
  },
  {
    id: 'barra-samsung-ohn',
    nombre: 'Barra estirada Samsung',
    ancho: 1920, alto: 540, orientacion: 'barra',
    familias: ['Samsung OHN-D', 'Samsung OMN-D stretch'],
    techoKbps: 4000, sueloKbps: 1200, h264: 'high@4.0', fps: 60
  },
  {
    id: 'barra-lg-88bh7d',
    nombre: 'Barra estirada LG 88"',
    ancho: 3840, alto: 600, orientacion: 'barra',
    familias: ['LG 88BH7D', 'LG 86BH5F'],
    techoKbps: 8000, sueloKbps: 2500, h264: 'high@4.2', fps: 60
  },
  {
    id: 'videowall-tile-fhd',
    nombre: 'Baldosa de videowall Full HD',
    ancho: 1920, alto: 1080, orientacion: 'apaisada',
    familias: ['Samsung VMx-E', 'LG VH7J', 'mosaico 2x2 y 3x3'],
    // Keyframe corto y forzado: en un mosaico cada baldosa arranca por su cuenta
    // y sin GOP corto se ve el "peldaño" entre paneles al entrar en bucle.
    techoKbps: 8000, sueloKbps: 2500, h264: 'high@4.0', fps: 60, gopSegundos: 1
  }
];

export const PERFILES_POR_ID = new Map(PERFILES.map((p) => [p.id, p]));

// ─── REGLAS DE ADAPTACIÓN ───────────────────────────────────────────────────

// Tolerancia de relación de aspecto por debajo de la cual dos formatos se
// consideran el mismo encuadre. 16:9 (1.7778) contra 1366x768 (1.7786) es la
// misma imagen: recortar ahí sería inventarse un problema.
const TOLERANCIA_ASPECTO = 0.01;

// A partir de aquí el reencuadre deja de ser cosmético: meter un 16:9 en una
// barra 32:9 recortando se come el 70% de la altura y decapita cualquier
// mensaje. Se avisa en vez de decidir por el diseñador.
const RECORTE_MAXIMO_ACEPTABLE = 0.25;

export function aspecto(ancho, alto) {
  return alto > 0 ? ancho / alto : 0;
}

// Cuánta imagen se pierde si RELLENAMOS el perfil recortando (cover).
export function recortePerdido(origen, perfil) {
  const a = aspecto(origen.ancho, origen.alto);
  const b = aspecto(perfil.ancho, perfil.alto);
  if (!a || !b) return 1;
  return a > b ? 1 - (b / a) : 1 - (a / b);
}

// El bitrate no se hereda: se recalcula.
//
// Dos errores que esta función existe para no volver a cometer:
//  1. Subir el bitrate al escalar hacia arriba. Un 720p estirado a 4K no tiene
//     más detalle que contar; gastar 20 Mbps en él solo sirve para que el
//     reproductor barato se atragante. Nunca pasamos del bitrate del original.
//  2. Bajar la resolución y dejar el bitrate del original. Se malgasta ancho de
//     banda del circuito entero para nada.
// Al reducir píxeles el bitrate baja con ellos, pero con SUELO: por debajo del
// suelo el bloque se ve antes que el contenido, y una pantalla de tienda con
// bloques es peor que una pantalla apagada.
export function bitrateObjetivo(origen, perfil) {
  const techo = perfil.techoKbps;
  const suelo = perfil.sueloKbps;
  const fuente = Number(origen.bitrateKbps) || 0;
  if (!fuente) return { kbps: techo, motivo: 'sin bitrate de origen: se aplica el techo del perfil' };

  const pixelesOrigen = origen.ancho * origen.alto;
  const pixelesPerfil = perfil.ancho * perfil.alto;
  const razon = pixelesOrigen > 0 ? pixelesPerfil / pixelesOrigen : 1;

  // Solo escalamos hacia ABAJO con los píxeles. Si el perfil es mayor que el
  // origen, la razón sería >1 y estaríamos inflando: se corta en 1.
  const escalado = fuente * Math.min(razon, 1);
  const conSuelo = Math.max(escalado, suelo);
  const kbps = Math.round(Math.min(conSuelo, techo, Math.max(fuente, suelo)));

  let motivo;
  if (kbps >= techo) motivo = `el origen (${Math.round(fuente)} kbps) supera el techo del perfil`;
  else if (conSuelo > escalado) motivo = 'el proporcional caía bajo el suelo de calidad del perfil';
  else if (razon < 1) motivo = `menos píxeles (${Math.round(razon * 100)}% del original): baja proporcional`;
  else motivo = 'el origen ya cabe: no se re-infla';
  return { kbps, motivo };
}

// El plan de una prueba: qué hay que hacerle a ESTE original para que ESTA
// pantalla lo reproduzca. Es lo único que el motor traduce a ffmpeg, y lo único
// que la página necesita para explicar por qué una prueba salió "ajustada".
export function planificar(origen, perfil) {
  const perdido = recortePerdido(origen, perfil);
  const mismoEncuadre = Math.abs(aspecto(origen.ancho, origen.alto) - aspecto(perfil.ancho, perfil.alto)) <= TOLERANCIA_ASPECTO;

  // Un vídeo apaisado dentro de un tótem no está adaptado si se limita a
  // conservar el 16:9 con dos bandas negras enormes. En ese caso concreto la
  // promesa de Pixeria es entregar una pieza 9:16 que LLENE la pantalla: se
  // hace un recorte centrado automático y se deja a la vista cuánto material
  // lateral se pierde, para que el diseñador pueda reencuadrar si el sujeto no
  // está en el centro. Las barras ultrapanorámicas siguen siendo conservadoras:
  // recortarlas automáticamente sí puede borrar todo el mensaje.
  const adaptacionVertical = perfil.orientacion === 'vertical' &&
    origen.ancho > origen.alto && perfil.alto > perfil.ancho;

  // `contener` mete la imagen entera y rellena con negro; `recortar` llena la
  // pantalla y sacrifica bordes. Por defecto contenemos cuando la pérdida es
  // grande, salvo en la adaptación apaisado→vertical descrita arriba.
  const encaje = mismoEncuadre
    ? 'exacto'
    : (adaptacionVertical ? 'recortar' : (perdido > RECORTE_MAXIMO_ACEPTABLE ? 'contener' : 'recortar'));

  const bitrate = bitrateObjetivo(origen, perfil);
  const [h264Perfil, h264Nivel] = String(perfil.h264).split('@');

  const avisos = [];
  if (encaje === 'contener') {
    avisos.push(`reencuadre humano recomendado: recortar perdería el ${Math.round(perdido * 100)}% de la imagen`);
  }
  if (adaptacionVertical) {
    avisos.push(`adaptación vertical automática: recorte centrado del ${Math.round(perdido * 100)}% de los laterales`);
  }
  if (perfil.ancho > origen.ancho || perfil.alto > origen.alto) {
    avisos.push('el perfil es mayor que el original: se escala hacia arriba, no hay detalle nuevo');
  }
  if (origen.fps && perfil.fps && origen.fps > perfil.fps) {
    avisos.push(`fotogramas de ${origen.fps} a ${perfil.fps}: la gama no sostiene más`);
  }

  return {
    perfilId: perfil.id,
    ancho: perfil.ancho,
    alto: perfil.alto,
    encaje,
    recortePerdido: Number(perdido.toFixed(4)),
    bitrateKbps: bitrate.kbps,
    bitrateMotivo: bitrate.motivo,
    h264Perfil,
    h264Nivel,
    fps: Math.min(origen.fps || perfil.fps, perfil.fps),
    gopSegundos: perfil.gopSegundos || 2,
    avisos
  };
}

// ─── VERIFICACIÓN ───────────────────────────────────────────────────────────

// El encoder overshootea: pedir 8000 kbps y obtener 8200 es normal y no es un
// fallo. Pedir 8000 y obtener 14000 sí lo es — ahí el reproductor se atraganta.
const TOLERANCIA_BITRATE = 0.15;

const NIVELES = ['3.0', '3.1', '3.2', '4.0', '4.1', '4.2', '5.0', '5.1', '5.2'];
const ORDEN_PERFIL_H264 = ['baseline', 'main', 'high'];

function nivelExcede(obtenido, maximo) {
  const a = NIVELES.indexOf(String(obtenido));
  const b = NIVELES.indexOf(String(maximo));
  if (a < 0 || b < 0) return false;   // nivel desconocido: no inventamos un fallo
  return a > b;
}

function perfilExcede(obtenido, maximo) {
  const a = ORDEN_PERFIL_H264.indexOf(String(obtenido).toLowerCase());
  const b = ORDEN_PERFIL_H264.indexOf(String(maximo).toLowerCase());
  if (a < 0 || b < 0) return false;
  return a > b;
}

// Compara lo que PEDIMOS con lo que el fichero resultante DICE que es.
// No se fía del encoder: ffprobe lee el fichero de salida y esto lo juzga.
// Veredictos: 'ok' (salió tal cual), 'ajustado' (salió, con concesiones que hay
// que saber) y 'fallo' (esa pantalla no lo reproduce).
export function verificar(plan, sonda, origen = {}) {
  const fallos = [];
  const notas = [];

  if (sonda.ancho !== plan.ancho || sonda.alto !== plan.alto) {
    fallos.push(`resolución ${sonda.ancho}x${sonda.alto}, se pidió ${plan.ancho}x${plan.alto}`);
  }
  if (sonda.codec && String(sonda.codec).toLowerCase() !== 'h264') {
    fallos.push(`códec ${sonda.codec}: fuera del contrato de la batería (h264)`);
  }
  if (sonda.h264Perfil && perfilExcede(sonda.h264Perfil, plan.h264Perfil)) {
    fallos.push(`perfil H.264 ${sonda.h264Perfil} por encima de ${plan.h264Perfil}: pantalla negra en esa gama`);
  }
  if (sonda.h264Nivel && nivelExcede(sonda.h264Nivel, plan.h264Nivel)) {
    fallos.push(`nivel H.264 ${sonda.h264Nivel} por encima de ${plan.h264Nivel}: el decodificador lo rechaza`);
  }
  const limite = plan.bitrateKbps * (1 + TOLERANCIA_BITRATE);
  if (sonda.bitrateKbps && sonda.bitrateKbps > limite) {
    fallos.push(`bitrate ${Math.round(sonda.bitrateKbps)} kbps sobre el límite de ${Math.round(limite)}`);
  }
  if (origen.duracion && sonda.duracion && Math.abs(sonda.duracion - origen.duracion) > 0.5) {
    fallos.push(`duración ${sonda.duracion.toFixed(2)}s frente a ${origen.duracion.toFixed(2)}s del original`);
  }
  // El audio perdido no rompe la pantalla, pero en un circuito con megafonía sí
  // rompe la campaña. Es nota, no fallo.
  if (origen.audio && !sonda.audio) notas.push('el original traía audio y la variante salió muda');

  for (const aviso of plan.avisos || []) notas.push(aviso);
  if (plan.encaje === 'contener') notas.push('sale con bandas negras: la imagen entera cabe, pero no llena');
  if (plan.encaje === 'recortar') notas.push(`llena la pantalla recortando el ${Math.round(plan.recortePerdido * 100)}% de los bordes`);

  const veredicto = fallos.length ? 'fallo' : (notas.length ? 'ajustado' : 'ok');
  return { veredicto, fallos, notas };
}
