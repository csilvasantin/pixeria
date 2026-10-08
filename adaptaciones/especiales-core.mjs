// Client-profile segmented videowall layouts (PDF page 3, structure on pages 5–6). The delivery is
// ONE file at the table resolution: a grid of cells, one per screen, read left
// to right and top to bottom, where each row continues the next. The continuous
// picture is the physical wall: every screen side by side. We compose that wall
// once and cut every cell from the same master, so the image flows across screens.
import {composeFilter, EXPORT_PRESET} from './adapter-core.mjs?v=adapter-detail-1';

export const FPS = 25;
// Mosaics loop each tile on its own player: a short forced GOP avoids the visible
// "step" between panels on restart (same rule as the video wall profile in signage-perfiles).
export const GOP_SECONDS = 1;

export function geometry(layout) {
  const [cw, ch] = layout.celda, {columnas, filas} = layout.rejilla;
  const unused = new Set(layout.celdasSinUso);
  const cells = [];
  for (let r = 0; r < filas; r++) for (let c = 0; c < columnas; c++) {
    const index = r * columnas + c + 1;
    cells.push({index, x: c * cw, y: r * ch, w: cw, h: ch, unused: unused.has(index)});
  }
  const active = cells.filter(c => !c.unused), wall = layout.pared;
  const segments = active.map((cell, i) => ({
    n: i + 1, N: active.length, cell: cell.index,
    atlas: {x: cell.x, y: cell.y, w: cw, h: ch},
    wall: {x: (i % wall.columnas) * cw, y: Math.floor(i / wall.columnas) * ch, w: cw, h: ch},
  }));
  return {
    entrega: {ancho: layout.entrega[0], alto: layout.entrega[1]},
    pared: {ancho: wall.columnas * cw, alto: wall.filas * ch},
    segments, unused: cells.filter(c => c.unused),
  };
}

export const segmentFilename = (layout, n) => {
  const g = geometry(layout), s = g.segments[n - 1];
  return `${layout.slug}-${n}de${s.N}-${s.wall.w}x${s.wall.h}.mp4`;
};
export const atlasFilename = layout => `${layout.slug}-entrega-${layout.entrega[0]}x${layout.entrega[1]}.mp4`;

// Every screen gets its pixel share of the delivery bitrate: the per-screen batch
// never weighs more than the single delivery file.
export function segmentKbps(layout, atlasKbps) {
  const [W, H] = layout.entrega, [w, h] = layout.celda;
  return Math.max(500, Math.round(atlasKbps * w * h / (W * H)));
}

const encode = (rate, perfil, nivel) => ['-c:v', 'libx264', '-preset', EXPORT_PRESET, '-threads', '1',
  '-profile:v', perfil, '-level:v', nivel, '-pix_fmt', 'yuv420p', '-r', String(FPS),
  '-b:v', `${rate}k`, '-maxrate', `${rate}k`, '-bufsize', `${rate * 2}k`, '-g', String(FPS * GOP_SECONDS)];
const crop = r => `crop=${r.w}:${r.h}:${r.x}:${r.y},setsar=1`;
// Resample once, before composing: every screen then has exactly the same frames
// (an output-only -r can append duplicated frames at the end).
const master = (source, g, mode, s) => `[0:v]fps=${FPS}[src];${composeFilter(source, g.pared.ancho, g.pared.alto, mode, s, 'wall', 'src')}`;
const split = (N, prefix) => `[wall]split=${N}${Array.from({length: N}, (_, i) => `[${prefix}${i + 1}]`).join('')}`;

// Crear (6-oct-2026): `receta` (crear-core: crearPared) replaces the reframed master with a recipe
// composed on the physical wall in [wall]: its own inputs, its own graph and, for pictures, -color_range tv.
const range = receta => receta?.picture ? ['-color_range', 'tv'] : [];
// One pass: compose the wall, split it and encode one silent MP4 per screen.
// Same input, same graph and the same output rate give the same frame count.
export function segmentsJob(source, layout, mode, s, tech, receta = null) {
  const g = geometry(layout), N = g.segments.length;
  const rate = segmentKbps(layout, tech.bitrateKbps);
  const filter = [receta ? receta.graph : master(source, g, mode, s), split(N, 'w'),
    ...g.segments.map(seg => `[w${seg.n}]${crop(seg.wall)}[s${seg.n}]`)].join(';');
  const args = [...(receta ? receta.inputs : ['-i', 'input']), '-filter_complex', filter];
  const outputs = g.segments.map(seg => {
    const file = `seg${seg.n}.mp4`;
    const enc = encode(rate, tech.segmentPerfil, tech.segmentNivel), at = enc.indexOf('yuv420p') + 1;
    enc.splice(at, 0, ...range(receta));
    args.push('-map', `[s${seg.n}]`, '-an', ...enc,
      '-movflags', '+faststart', '-fs', String(128 * 1048576), file);
    return {file, filename: segmentFilename(layout, seg.n), W: seg.wall.w, H: seg.wall.h, n: seg.n, N};
  });
  return {kind: 'segments', W: g.pared.ancho, H: g.pared.alto, bitrateKbps: rate * N, args, outputs};
}

// The delivery file the PDF specifies: cells packed in reading order on the table
// resolution, unused cells left black. Audio is kept when the source has it.
export function atlasJob(source, layout, mode, s, tech, receta = null) {
  const g = geometry(layout), [W, H] = layout.entrega, N = g.segments.length;
  const parts = [receta ? receta.graph : master(source, g, mode, s), split(N, 'w'),
    ...g.segments.map(seg => `[w${seg.n}]${crop(seg.wall)}[c${seg.n}]`),
    `[c1]pad=${W}:${H}:${g.segments[0].atlas.x}:${g.segments[0].atlas.y}:color=black[t1]`,
    ...g.segments.slice(1).map(seg => `[t${seg.n - 1}][c${seg.n}]overlay=x=${seg.atlas.x}:y=${seg.atlas.y}:format=auto${seg.n === N ? ',setsar=1[out]' : `[t${seg.n}]`}`)];
  const rate = tech.bitrateKbps, audio = !receta || receta.audio;
  const enc = encode(rate, tech.h264Perfil, tech.h264Nivel);
  enc.splice(enc.indexOf('yuv420p') + 1, 0, ...range(receta));
  return {kind: 'atlas', filename: atlasFilename(layout), W, H, bitrateKbps: rate,
    args: [...(receta ? receta.inputs : ['-i', 'input']), '-filter_complex', parts.join(';'), '-map', '[out]', ...(audio ? ['-map', '0:a?'] : ['-an']),
      ...enc, ...(audio ? ['-c:a', 'aac', '-b:a', '128k'] : []),
      '-movflags', '+faststart', '-fs', String(128 * 1048576), 'output.mp4']};
}
