#!/usr/bin/env node
// ============================================================================
// BATERÍA DE PRUEBAS DE DIGITAL SIGNAGE — el motor.
//
//   node scripts/signage-bateria.mjs <original> [opciones]
//
//   --salida <dir>      dónde dejar las variantes   (por defecto signage/variantes)
//   --informe <fich>    dónde dejar el veredicto    (por defecto signage/bateria-informe.json)
//   --perfiles a,b,c    solo estos perfiles          (por defecto, el censo entero)
//   --limpiar           borra las variantes previas antes de empezar
//
// QUÉ HACE: coge UN original y lo pasa por todas las pantallas del censo. Por
// cada una calcula qué hay que cambiarle (resolución, encuadre, bitrate, perfil
// H.264, fotogramas), lo transcodifica y DESPUÉS vuelve a leer el fichero
// resultante con ffprobe para comprobar que salió lo que se pidió.
//
// La comprobación final no es un detalle: ffmpeg devuelve 0 y deja un fichero
// que no cumple más veces de las que parece —un `-level` que el encoder ignora
// en silencio, un bitrate que se dispara en escenas con movimiento—. Si nos
// fiáramos del código de salida, la batería diría "todo verde" y la pantalla
// del cliente seguiría en negro. Por eso el veredicto sale de leer el fichero,
// no de que el comando no fallara.
//
// Las reglas NO viven aquí: viven en assets/signage-perfiles.js, que es lo
// mismo que lee la página. Este fichero solo sabe hablar con ffmpeg.
// ============================================================================
import {spawn} from 'node:child_process';
import {mkdir, rm, writeFile, stat} from 'node:fs/promises';
import path from 'node:path';
import {PERFILES, PERFILES_POR_ID, planificar, verificar} from '../assets/signage-perfiles.js';

const IMAGENES = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);

function ejecutar(cmd, args) {
  return new Promise((resolve) => {
    const p = spawn(cmd, args);
    let out = '', err = '';
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { err += d; });
    p.on('error', (e) => resolve({codigo: -1, out, err: String(e)}));
    p.on('close', (codigo) => resolve({codigo, out, err}));
  });
}

// ffprobe da el nivel H.264 como entero (40, 31, 51). Traducirlo aquí y no en
// el módulo de reglas mantiene el módulo libre de rarezas de herramienta.
function nivelDesdeEntero(n) {
  const v = Number(n);
  if (!v || v < 0) return '';
  return `${Math.floor(v / 10)}.${v % 10}`;
}

function fpsDesdeFraccion(txt) {
  const [a, b] = String(txt || '').split('/').map(Number);
  if (!a || !b) return 0;
  return Math.round((a / b) * 100) / 100;
}

async function sondar(fichero) {
  const r = await ejecutar('ffprobe', [
    '-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', fichero
  ]);
  if (r.codigo !== 0) throw new Error(`ffprobe no pudo leer ${fichero}: ${r.err.trim()}`);
  const datos = JSON.parse(r.out);
  const video = (datos.streams || []).find((s) => s.codec_type === 'video');
  if (!video) throw new Error(`${fichero} no tiene pista de vídeo ni imagen legible`);
  const audio = (datos.streams || []).find((s) => s.codec_type === 'audio');
  const formato = datos.format || {};

  // El bitrate del contenedor incluye el audio; para decidir vídeo usamos el de
  // la pista cuando está, y solo caemos al del contenedor si falta.
  const bitrateBits = Number(video.bit_rate) || Number(formato.bit_rate) || 0;
  const duracion = Number(video.duration) || Number(formato.duration) || 0;

  return {
    ancho: Number(video.width) || 0,
    alto: Number(video.height) || 0,
    codec: String(video.codec_name || '').toLowerCase(),
    h264Perfil: String(video.profile || '').toLowerCase(),
    h264Nivel: nivelDesdeEntero(video.level),
    bitrateKbps: bitrateBits ? Math.round(bitrateBits / 1000) : 0,
    fps: fpsDesdeFraccion(video.r_frame_rate),
    duracion,
    audio: !!audio
  };
}

// El filtro de escalado es donde se decide si el mensaje se ve entero o se
// decapita. `setsar=1` va siempre: sin él, una pantalla con píxel no cuadrado
// —las barras estiradas lo son— reproduce la variante deformada aunque la
// resolución sea la correcta.
function filtro(plan) {
  const {ancho: w, alto: h, encaje} = plan;
  if (encaje === 'recortar') {
    return `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setsar=1`;
  }
  if (encaje === 'contener') {
    return `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:black,setsar=1`;
  }
  return `scale=${w}:${h},setsar=1`;
}

function argumentosVideo(origen, plan, entrada, salida) {
  const gop = Math.max(1, Math.round(plan.fps * plan.gopSegundos));
  return [
    '-y', '-i', entrada,
    '-vf', filtro(plan),
    '-r', String(plan.fps),
    '-c:v', 'libx264',
    '-profile:v', plan.h264Perfil,
    '-level:v', plan.h264Nivel,
    '-b:v', `${plan.bitrateKbps}k`,
    // maxrate+bufsize son los que de verdad sujetan el pico. Sin ellos el
    // -b:v es una media y el reproductor barato se atraganta en el pico.
    '-maxrate', `${plan.bitrateKbps}k`,
    '-bufsize', `${plan.bitrateKbps * 2}k`,
    '-g', String(gop), '-keyint_min', String(gop), '-sc_threshold', '0',
    '-pix_fmt', 'yuv420p',
    ...(origen.audio ? ['-c:a', 'aac', '-b:a', '128k'] : ['-an']),
    '-movflags', '+faststart',
    salida
  ];
}

function argumentosImagen(plan, entrada, salida) {
  return ['-y', '-i', entrada, '-vf', filtro(plan), '-frames:v', '1', salida];
}

function parsear(argv) {
  const o = {origen: '', salida: 'signage/variantes', informe: 'signage/bateria-informe.json', perfiles: null, limpiar: false};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--salida') o.salida = argv[++i];
    else if (a === '--informe') o.informe = argv[++i];
    else if (a === '--perfiles') o.perfiles = String(argv[++i]).split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--limpiar') o.limpiar = true;
    else if (!a.startsWith('--') && !o.origen) o.origen = a;
  }
  return o;
}

async function main() {
  const op = parsear(process.argv.slice(2));
  if (!op.origen) {
    console.error('uso: node scripts/signage-bateria.mjs <original> [--salida dir] [--informe f] [--perfiles a,b] [--limpiar]');
    process.exit(2);
  }
  if ((await ejecutar('ffmpeg', ['-version'])).codigo !== 0) {
    console.error('✖ falta ffmpeg en el PATH — la batería no puede transcodificar');
    process.exit(3);
  }

  const perfiles = op.perfiles
    ? op.perfiles.map((id) => {
        const p = PERFILES_POR_ID.get(id);
        if (!p) { console.error(`✖ perfil desconocido: ${id}`); process.exit(2); }
        return p;
      })
    : PERFILES;

  const esImagen = IMAGENES.has(path.extname(op.origen).toLowerCase());
  const origen = await sondar(op.origen);
  origen.fichero = path.basename(op.origen);
  origen.tipo = esImagen ? 'imagen' : 'video';

  if (op.limpiar) await rm(op.salida, {recursive: true, force: true});
  await mkdir(op.salida, {recursive: true});

  console.error(`▸ original: ${origen.fichero} · ${origen.ancho}x${origen.alto} · ${origen.bitrateKbps || '?'} kbps · ${origen.tipo}`);
  console.error(`▸ ${perfiles.length} pantallas del censo\n`);

  const pruebas = [];
  for (const perfil of perfiles) {
    const plan = planificar(origen, perfil);
    const ext = esImagen ? '.jpg' : '.mp4';
    const nombre = `${path.parse(origen.fichero).name}--${perfil.id}${ext}`;
    const destino = path.join(op.salida, nombre);
    const arranque = Date.now();

    const args = esImagen
      ? argumentosImagen(plan, op.origen, destino)
      : argumentosVideo(origen, plan, op.origen, destino);
    const r = await ejecutar('ffmpeg', args);

    let sonda = null, resultado;
    if (r.codigo !== 0) {
      // ffmpeg falló de verdad: no hay fichero que sondear, y el motivo real
      // está en las últimas líneas de su stderr, no en el código de salida.
      resultado = {
        veredicto: 'fallo',
        fallos: [`ffmpeg terminó con código ${r.codigo}: ${r.err.trim().split('\n').slice(-2).join(' · ')}`],
        notas: []
      };
    } else {
      sonda = await sondar(destino);
      resultado = esImagen
        ? verificar({...plan, h264Perfil: '', h264Nivel: ''},
                    {ancho: sonda.ancho, alto: sonda.alto}, {})
        : verificar(plan, sonda, origen);
    }

    const bytes = r.codigo === 0 ? (await stat(destino)).size : 0;
    pruebas.push({
      perfil: {
        id: perfil.id, nombre: perfil.nombre, familias: perfil.familias,
        ancho: perfil.ancho, alto: perfil.alto, orientacion: perfil.orientacion,
        techoKbps: perfil.techoKbps, h264: perfil.h264
      },
      plan, sonda, ...resultado,
      variante: path.posix.join(op.salida.replace(/^\.?\/?/, ''), nombre),
      bytes,
      segundos: Math.round((Date.now() - arranque) / 100) / 10
    });

    const icono = resultado.veredicto === 'ok' ? '✓' : resultado.veredicto === 'ajustado' ? '~' : '✖';
    const detalle = resultado.veredicto === 'fallo'
      ? resultado.fallos[0]
      : `${plan.bitrateKbps} kbps · ${plan.encaje}${resultado.notas.length ? ` · ${resultado.notas.length} nota(s)` : ''}`;
    console.error(`${icono} ${perfil.id.padEnd(22)} ${String(perfil.ancho + 'x' + perfil.alto).padEnd(11)} ${detalle}`);
  }

  const resumen = {
    ok: pruebas.filter((p) => p.veredicto === 'ok').length,
    ajustado: pruebas.filter((p) => p.veredicto === 'ajustado').length,
    fallo: pruebas.filter((p) => p.veredicto === 'fallo').length,
    total: pruebas.length,
    bytesTotales: pruebas.reduce((a, p) => a + p.bytes, 0)
  };

  const informe = {
    generadoEn: new Date().toISOString(),
    herramienta: 'pixeria/signage-bateria',
    origen, resumen, pruebas
  };
  await mkdir(path.dirname(op.informe), {recursive: true});
  await writeFile(op.informe, JSON.stringify(informe, null, 2) + '\n');

  console.error(`\n▸ ${resumen.ok} ok · ${resumen.ajustado} ajustadas · ${resumen.fallo} fallos`);
  console.error(`▸ informe: ${op.informe}`);
  // Solo un fallo real tumba el proceso. "Ajustado" es información, no error:
  // una barra estirada SIEMPRE sale ajustada y no queremos un CI en rojo eterno.
  process.exit(resumen.fallo > 0 ? 1 : 0);
}

main().catch((e) => { console.error('✖', e.message); process.exit(1); });
