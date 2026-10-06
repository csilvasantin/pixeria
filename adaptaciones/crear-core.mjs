// Crear (formatos extremos) · encargo de Carlos, 6-oct-2026.
// Cuando el formato de destino es muy distinto del contenido (un 16:9 en un banner 3840×540, un
// rascacielos 160×600 o un videowall 13x1), adaptar es deformar o recortar destrozando la pieza.
// Ahí la tarjeta pasa a «Crear»: un formato nuevo con el mismo contenido, con tres recetas locales
// y gratuitas que se calculan en el navegador:
//   · tira    — Tira de momentos: 3–5 piezas en secuencia a lo largo del formato, en cascada.
//   · barrido — Barrido: el contenido llena el formato sin deformar y un paneo suave lo recorre.
//   · rotulo  — Rótulo en movimiento (ticker): claim + miniatura o logo sobre fondo sólido o desenfocado.
// Módulo puro (sin DOM): lo usan la vista previa en canvas, el plan FFmpeg (WASM y nativo) y los tests.
// La vista previa y el MP4 salen de las MISMAS funciones: geometría, trayectoria y desplazamiento
// se calculan aquí y el filtro FFmpeg repite las mismas operaciones con los mismos números.
import {cropWindow, STILL, STILL_PREP, animPrep} from './adapter-core.mjs';

// Umbral de desproporción: r = max(a_src/a_dst, a_dst/a_src), a = ancho/alto. Con r ≥ UMBRAL_CREAR la
// tarjeta pasa a «Crear» (salvo que el usuario o la ficha del proyecto fuercen «Adaptar»).
// Ojo: 16:9 ↔ 9:16 da r ≈ 3,16 y también cruza el umbral. Ver docs/adaptador.md · «Crear».
export const UMBRAL_CREAR = 2.5;
export const FPS = 25;
export const RECETAS = ['tira', 'barrido', 'rotulo'];
export const RECETA_DEFECTO = 'barrido';
export const ACCIONES = ['auto', 'adaptar', 'crear'];
export const TIRA = {min: 3, max: 5, zoomMin: 1, zoomMax: 3, zoomDefecto: 1.6};
export const ROTULO = {maxTexto: 140, velMin: .5, velMax: 6, velDefecto: 2};
export const BARRIDO = {segMax: 600};
// Etiqueta del Stock por receta (crear-tira, crear-barrido, crear-rotulo).
export const recetaTag = receta => RECETAS.includes(receta) ? `crear-${receta}` : null;

const r6 = v => +(+v).toFixed(6);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const even = v => 2 * Math.round(v / 2);
const evenCeil = v => 2 * Math.ceil(v / 2);
const num = v => String(r6(v));

// ── Detección ────────────────────────────────────────────────────────────────
export function desproporcion(src, dst) {
  const a = src?.ancho / src?.alto, b = dst?.ancho / dst?.alto;
  if (!(a > 0 && b > 0) || !Number.isFinite(a) || !Number.isFinite(b)) return 1;
  return Math.max(a / b, b / a);
}
export const accionAuto = (src, dst, umbral = UMBRAL_CREAR) => desproporcion(src, dst) >= umbral ? 'crear' : 'adaptar';
// cfg.accion: 'auto' decide por el umbral; 'crear' y 'adaptar' son la elección forzada del usuario.
export function accionEfectiva(cfg, src, dst) {
  if (cfg?.accion === 'crear' || cfg?.accion === 'adaptar') return cfg.accion;
  return src?.ancho ? accionAuto(src, dst) : 'adaptar';
}

// ── Ajustes (persistidos por formato) ────────────────────────────────────────
const hex = v => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : null;
const text = (v, max) => typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, ' ').slice(0, max) : '';
export function crearDefaults(receta = RECETA_DEFECTO, accion = 'auto') {
  return {
    accion: ACCIONES.includes(accion) ? accion : 'auto',
    receta: RECETAS.includes(receta) ? receta : RECETA_DEFECTO,
    tira: {n: 0, sep: true, bucle: false, zoom: TIRA.zoomDefecto},
    barrido: {recorrido: 'ida', sentido: 1, seg: 0},
    rotulo: {texto: '', textoEn: '', velocidad: ROTULO.velDefecto, color: '#ffffff', fondo: 'desenfocado', fondoColor: '#021006', icono: 'miniatura'},
  };
}
// Valor de la ficha del proyecto ("recetas": {"<formato>": "barrido" | "tira" | "rotulo" | "adaptar"}).
export function defaultsFicha(valor) {
  if (valor === 'adaptar') return crearDefaults(RECETA_DEFECTO, 'adaptar');
  return crearDefaults(RECETAS.includes(valor) ? valor : RECETA_DEFECTO);
}
export function crearSettings(raw, base = crearDefaults()) {
  const d = JSON.parse(JSON.stringify(base));
  if (!raw || typeof raw !== 'object') return d;
  const t = raw.tira || {}, b = raw.barrido || {}, r = raw.rotulo || {};
  const n = Number(t.n);
  return {
    accion: ACCIONES.includes(raw.accion) ? raw.accion : d.accion,
    receta: RECETAS.includes(raw.receta) ? raw.receta : d.receta,
    tira: {n: Number.isInteger(n) && n >= TIRA.min && n <= TIRA.max ? n : 0,
      sep: typeof t.sep === 'boolean' ? t.sep : d.tira.sep, bucle: typeof t.bucle === 'boolean' ? t.bucle : d.tira.bucle,
      zoom: Number.isFinite(+t.zoom) ? r6(clamp(+t.zoom, TIRA.zoomMin, TIRA.zoomMax)) : d.tira.zoom},
    barrido: {recorrido: b.recorrido === 'vuelta' ? 'vuelta' : 'ida', sentido: +b.sentido === -1 ? -1 : 1,
      seg: Number.isFinite(+b.seg) && +b.seg > 0 ? r6(Math.min(BARRIDO.segMax, +b.seg)) : 0},
    rotulo: {texto: text(r.texto, ROTULO.maxTexto), textoEn: text(r.textoEn, ROTULO.maxTexto),
      velocidad: Number.isFinite(+r.velocidad) ? r6(clamp(+r.velocidad, ROTULO.velMin, ROTULO.velMax)) : d.rotulo.velocidad,
      color: hex(r.color) || d.rotulo.color, fondo: r.fondo === 'solido' ? 'solido' : 'desenfocado',
      fondoColor: hex(r.fondoColor) || d.rotulo.fondoColor, icono: ['ninguno', 'miniatura', 'logo'].includes(r.icono) ? r.icono : d.rotulo.icono},
  };
}

// ── Duración y cascada ───────────────────────────────────────────────────────
// seconds: duración del clip (vídeo), la elegida (imagen fija) o un bucle (GIF animado).
// La tira con «tramos en bucle» dura un tramo (D/N): cada celda reproduce el suyo y el player repite.
export function frames(seconds) { return Math.max(1, Math.round(seconds * FPS)); }
export function tramo(seconds, n) { return Math.max(1, Math.floor(seconds * FPS / n)) / FPS; }
// src/dst: para el número automático de piezas de la tira.
export function duracionReceta(cfg, {kind, seconds, src = null, dst = null}) {
  if (cfg.receta === 'tira' && cfg.tira.bucle && kind === 'video') return tramo(seconds, src && dst ? tiraN(src, dst, cfg.tira.n) : cfg.tira.n || TIRA.min);
  return seconds;
}
// Las piezas de la tira aparecen una tras otra con un fundido corto.
export function cascada(dur, n) {
  return {paso: r6(Math.min(.3, dur / (3 * n))), fundido: r6(Math.max(.04, Math.min(.3, dur / 6)))};
}
export function alphaCelda(t, i, c) {
  const st = i * c.paso;
  return t < st ? 0 : t >= st + c.fundido ? 1 : (t - st) / c.fundido;
}

// ── Tira de momentos ────────────────────────────────────────────────────────
// Número de piezas: automático según la desproporción (redondeada, entre 3 y 5) o el elegido.
export function tiraN(src, dst, n = 0) {
  if (Number.isInteger(n) && n >= TIRA.min && n <= TIRA.max) return n;
  return clamp(Math.round(desproporcion(src, dst)), TIRA.min, TIRA.max);
}
// Celdas a lo largo del lado largo del formato, sin solapes, con separación fina opcional.
// Medidas y posiciones pares (vídeo 4:2:0); el resto de píxeles se reparte de 2 en 2 desde la primera.
export function tiraGeometria(W, H, n, sep = false) {
  const eje = W >= H ? 'x' : 'y', L = eje === 'x' ? W : H, S = eje === 'x' ? H : W;
  const gap = sep ? Math.max(2, even(S * .012)) : 0;
  const util = L - gap * (n - 1);
  const base = Math.max(2, 2 * Math.floor(util / n / 2));
  let resto = util - base * n, pos = 0;
  const celdas = [];
  for (let i = 0; i < n; i++) {
    let len = base;
    if (i === n - 1) len = L - pos; else if (resto >= 2) { len += 2; resto -= 2; }
    celdas.push(eje === 'x' ? {x: pos, y: 0, w: len, h: H} : {x: 0, y: pos, w: W, h: len});
    pos += len + gap;
  }
  return {eje, gap, celdas};
}
// Vídeo: un fotograma por pieza en el centro de su tramo, alineado a la rejilla de 25 fps.
export function tiraMomentos(seconds, n) {
  const total = frames(seconds);
  return Array.from({length: n}, (_, i) => Math.min(total - 1, Math.floor((i + .5) * total / n)) / FPS);
}
// Vídeo con «tramos en bucle»: cada pieza reproduce su tramo [inicio, inicio + L).
export function tiraTramos(seconds, n) {
  const L = tramo(seconds, n);
  return {L, inicios: Array.from({length: n}, (_, i) => r6(i * L))};
}
// Imagen: recortes de zonas distintas (con zoom) repartidos a lo largo del lado largo del contenido.
const ALT = [.5, .3, .7];
export function tiraZonas(src, celdas, zoom = TIRA.zoomDefecto) {
  const n = celdas.length, ancha = src.ancho >= src.alto;
  return celdas.map((c, i) => {
    const a = n === 1 ? .5 : i / (n - 1), b = ALT[i % ALT.length];
    return cropWindow(src, c.w, c.h, {zoom, fx: ancha ? a : b, fy: ancha ? b : a});
  });
}
// Lo que muestra cada celda: recorte en el espacio del contenido.
export function tiraRecortes(src, celdas, kind, s, cfg) {
  return kind === 'video' ? celdas.map(c => cropWindow(src, c.w, c.h, s)) : tiraZonas(src, celdas, cfg.tira.zoom);
}

// ── Barrido ─────────────────────────────────────────────────────────────────
// El contenido se escala lo justo para llenar el formato sin deformar (× zoom) y una ventana del
// tamaño del formato recorre el sobrante de extremo a extremo con un paneo suave (coseno).
// El otro eje queda en el foco. Dos recortes: uno par en el espacio del contenido (sin intermedios
// gigantes en paredes de 14 400 px) y otro, tras escalar, con precisión de 2 px en la salida.
export function barridoPlan(src, W, H, s, cfg, dur) {
  const sw = src.ancho, sh = src.alto, k = Math.max(W / sw, H / sh) * (s?.zoom || 1);
  const ww = W / k, wh = H / k;
  const ox = r6(Math.max(0, sw - ww)), oy = r6(Math.max(0, sh - wh));
  const eje = ox * k >= oy * k ? 'x' : 'y';
  const b = cfg.barrido, vuelta = b.recorrido === 'vuelta';
  const pan = b.seg > 0 ? Math.min(b.seg, dur) : vuelta ? dur / 2 : dur;
  const N1 = Math.max(1, frames(pan) - 1);
  const cw1 = Math.min(sw, evenCeil(ww) + 4), ch1 = Math.min(sh, evenCeil(wh) + 4);
  const S2w = Math.max(W, even(cw1 * k)), S2h = Math.max(H, even(ch1 * k));
  return {W, H, sw, sh, eje, ox, oy, fx: r6(s?.fx ?? .5), fy: r6(s?.fy ?? .5), N1, vuelta, sentido: b.sentido === -1 ? -1 : 1,
    cw1, ch1, S2w, S2h, k2x: r6(S2w / cw1), k2y: r6(S2h / ch1)};
}
// Posición del paneo en el fotograma n: 0 = un extremo, 1 = el otro.
export function barridoP(n, p) {
  const u = p.vuelta ? 1 - Math.abs(1 - (n % (2 * p.N1)) / p.N1) : Math.min(1, n / p.N1);
  const e = (1 - Math.cos(Math.PI * u)) / 2;
  return p.sentido === -1 ? 1 - e : e;
}
function pExpr(p) {
  const u = p.vuelta ? `(1-abs(1-mod(n,${2 * p.N1})/${p.N1}))` : `min(1,n/${p.N1})`;
  const e = `(1-cos(PI*${u}))/2`;
  return p.sentido === -1 ? `(1-(${e}))` : `(${e})`;
}
// Ventana del fotograma n: recortes 1 y 2 y el rectángulo efectivo en el espacio del contenido.
export function barridoVentana(n, p) {
  const P = barridoP(n, p);
  // The fixed axis uses the same 6-decimal constant the FFmpeg expression prints.
  const px = p.eje === 'x' ? P * p.ox : r6(p.fx * p.ox), py = p.eje === 'y' ? P * p.oy : r6(p.fy * p.oy);
  const x1 = Math.min(2 * Math.floor(px / 2), p.sw - p.cw1), y1 = Math.min(2 * Math.floor(py / 2), p.sh - p.ch1);
  const x2 = Math.max(0, Math.min(p.S2w - p.W, 2 * Math.floor((px - x1) * p.k2x / 2)));
  const y2 = Math.max(0, Math.min(p.S2h - p.H, 2 * Math.floor((py - y1) * p.k2y / 2)));
  return {x1, y1, x2, y2, rect: {x: x1 + x2 / p.k2x, y: y1 + y2 / p.k2y, w: p.W / p.k2x, h: p.H / p.k2y}};
}
export function barridoFiltro(p, input, label) {
  const P = pExpr(p);
  const PX = p.eje === 'x' ? `${P}*${num(p.ox)}` : num(p.fx * p.ox), PY = p.eje === 'y' ? `${P}*${num(p.oy)}` : num(p.fy * p.oy);
  const X1 = `min(2*floor((${PX})/2),${p.sw - p.cw1})`, Y1 = `min(2*floor((${PY})/2),${p.sh - p.ch1})`;
  const X2 = `max(0,min(${p.S2w - p.W},2*floor(((${PX})-(${X1}))*${num(p.k2x)}/2)))`;
  const Y2 = `max(0,min(${p.S2h - p.H},2*floor(((${PY})-(${Y1}))*${num(p.k2y)}/2)))`;
  return `[${input}]crop=w=${p.cw1}:h=${p.ch1}:x='${X1}':y='${Y1}',scale=${p.S2w}:${p.S2h},crop=w=${p.W}:h=${p.H}:x='${X2}':y='${Y2}',setsar=1[${label}]`;
}

// ── Rótulo en movimiento (ticker) ───────────────────────────────────────────
// Banners apaisados: la tira corre de derecha a izquierda. Formatos verticales: sube, con el texto
// partido en líneas. La tira se pinta una vez en el navegador (canvas, tipografía del sitio o de la
// marca blanca) y es la misma imagen la que ve la vista previa y la que FFmpeg superpone.
export function rotuloMedidas(W, H) {
  const eje = W >= H ? 'x' : 'y', corto = eje === 'x' ? H : W;
  return {eje, corto, fuente: Math.max(10, Math.round(corto * (eje === 'x' ? .42 : .14))), pad: Math.max(4, even(corto * .1)), icono: even(corto * (eje === 'x' ? .74 : .8))};
}
// Píxeles por segundo en la salida: velocidad × lado corto.
export const rotuloVelocidad = (cfg, W, H) => r6(cfg.rotulo.velocidad * rotuloMedidas(W, H).corto);
// Partición de texto en líneas de ancho máximo (medir: (texto, px) → ancho).
export function partir(texto, max, px, medir) {
  const lineas = [];
  let actual = '';
  for (const palabra of String(texto).split(/\s+/).filter(Boolean)) {
    const prueba = actual ? `${actual} ${palabra}` : palabra;
    if (actual && medir(prueba, px) > max) { lineas.push(actual); actual = palabra; } else actual = prueba;
  }
  if (actual) lineas.push(actual);
  return lineas;
}
// Un periodo de la tira: por cada texto, [icono] texto · separador. P (largo del periodo) es par.
// largo = P × repeticiones, con repeticiones suficientes para cubrir el formato en cualquier desplazamiento.
export function rotuloLayout({W, H, textos, icono = null, medir}) {
  const m = rotuloMedidas(W, H), ops = [];
  const items = (textos || []).map(t => String(t || '').trim()).filter(Boolean);
  if (!items.length) items.push('·');
  let pos = 0;
  if (m.eje === 'x') {
    for (const t of items) {
      if (icono) {
        const h = m.icono, w = Math.max(2, even(h * icono.ancho / icono.alto));
        ops.push({tipo: 'icono', x: pos + m.pad, y: (H - h) / 2, w, h}); pos += m.pad + w;
      }
      const tw = Math.ceil(medir(t, m.fuente));
      ops.push({tipo: 'texto', x: pos + m.pad, y: H / 2, texto: t, px: m.fuente, w: tw}); pos += m.pad + tw;
      const d = Math.max(4, even(m.fuente * .22));
      ops.push({tipo: 'sep', x: pos + m.pad * 1.5, y: H / 2 - d / 2, w: d, h: d}); pos += m.pad * 3 + d;
    }
  } else {
    const ancho = W - 2 * m.pad, alto = Math.round(m.fuente * 1.25);
    for (const t of items) {
      pos += m.pad;
      if (icono) {
        const w = Math.min(ancho, m.icono), h = Math.max(2, even(w * icono.alto / icono.ancho));
        ops.push({tipo: 'icono', x: (W - w) / 2, y: pos, w, h}); pos += h + m.pad;
      }
      for (const linea of partir(t, ancho, m.fuente, medir)) { ops.push({tipo: 'texto', x: W / 2, y: pos + alto / 2, texto: linea, px: m.fuente, w: Math.ceil(medir(linea, m.fuente)), centrado: true}); pos += alto; }
      const d = Math.max(4, even(m.fuente * .3));
      ops.push({tipo: 'sep', x: (W - d) / 2, y: pos + m.pad, w: d, h: d}); pos += m.pad * 2 + d;
    }
  }
  const P = evenCeil(Math.max(pos, 2));
  const L = m.eje === 'x' ? W : H, reps = Math.ceil(L / P) + 1;
  return {eje: m.eje, P, reps, largo: P * reps, ancho: m.eje === 'x' ? P * reps : W, alto: m.eje === 'x' ? H : P * reps, ops, medidas: m};
}
// Desplazamiento (px, par, ≥ 0) del fotograma n: la tira se pinta en -desplazamiento.
export const rotuloDesplazamiento = (n, v, P) => 2 * Math.floor(((v * n / FPS) % P) / 2);
const rotuloExpr = (v, P) => `-2*floor(mod(${num(v)}*n/${FPS},${P})/2)`;

// ── Entradas y grafo ────────────────────────────────────────────────────────
// kind: 'video' (input), 'still' (imagen fija: -loop 1, 25 fps, N s) o 'anim' (GIF animado, un bucle).
function entrada(kind, name, seconds) {
  if (kind === 'still') return ['-loop', '1', '-framerate', String(STILL.fps), '-t', String(seconds), '-i', name];
  if (kind === 'anim') return ['-ignore_loop', '1', '-i', name];
  return ['-i', name];
}
function prep(kind, seconds) {
  return kind === 'still' ? STILL_PREP : kind === 'anim' ? animPrep(seconds) : `fps=${FPS}`;
}
const crop = c => `crop=${c.w}:${c.h}:${c.x}:${c.y}`;
export const ROTULO_PNG = 'rotulo.png';
// Grafo de una receta a W×H con la salida en [label]. Devuelve también las entradas, si conserva el
// audio del original (solo barrido y rótulo con vídeo), la duración y los archivos extra que FFmpeg
// necesita (la tira del rótulo en PNG). `s` = foco y zoom de la tarjeta; `rotulo` = layout del ticker.
export function crearGrafo({kind, src, W, H, s, cfg, seconds, input = 'input', label = 'out', rotulo = null}) {
  const dur = duracionReceta(cfg, {kind, seconds, src, dst: {ancho: W, alto: H}});
  const out = {kind, receta: cfg.receta, W, H, duracion: dur, audio: false, extras: [], picture: kind !== 'video'};
  if (cfg.receta === 'barrido') {
    const p = barridoPlan(src, W, H, s, cfg, dur);
    out.inputs = entrada(kind, input, seconds);
    out.graph = `[0:v]${prep(kind, seconds)}[src];${barridoFiltro(p, 'src', label)}`;
    out.audio = kind === 'video'; out.barrido = p;
    return out;
  }
  if (cfg.receta === 'rotulo') {
    if (!rotulo) throw new Error('rotulo-layout');
    const v = rotuloVelocidad(cfg, W, H);
    out.inputs = [...entrada(kind, input, seconds), '-loop', '1', '-framerate', String(FPS), '-i', ROTULO_PNG];
    const bg = cfg.rotulo.fondo === 'solido'
      ? `color=c=0x${cfg.rotulo.fondoColor.slice(1)}:s=${W}x${H}:r=${FPS}:d=${num(dur)},format=yuv420p[bg]`
      : (() => { const b = cropWindow(src, W, H, {fx: .5, fy: .5, zoom: 1.1}); return `[0:v]${prep(kind, seconds)},${crop(b)},scale=${W}:${H},gblur=sigma=${(14 * Math.max(W, H) / 384).toFixed(3)},lutrgb=r=val*0.85:g=val*0.85:b=val*0.85,setsar=1[bg]`; })();
    const pos = rotuloExpr(v, rotulo.P);
    const xy = rotulo.eje === 'x' ? `x='${pos}':y=0` : `x=0:y='${pos}'`;
    out.graph = `${bg};[1:v]format=rgba[st];[bg][st]overlay=${xy}:format=auto:shortest=1,setsar=1[${label}]`;
    out.audio = kind === 'video'; out.extras = [ROTULO_PNG]; out.rotulo = {v, P: rotulo.P, eje: rotulo.eje};
    return out;
  }
  // Tira de momentos.
  const n = tiraN(src, {ancho: W, alto: H}, cfg.tira.n), g = tiraGeometria(W, H, n, cfg.tira.sep), c = cascada(dur, n);
  const recortes = tiraRecortes(src, g.celdas, kind, s, cfg);
  const parts = [`color=c=black:s=${W}x${H}:r=${FPS}:d=${num(dur)},format=yuv420p[b0]`];
  const cell = (i, head) => `${head},${crop(recortes[i])},scale=${g.celdas[i].w}:${g.celdas[i].h},setsar=1,format=yuva420p,fade=t=in:st=${num(i * c.paso)}:d=${num(c.fundido)}:alpha=1[c${i}]`;
  if (kind === 'video') {
    const inputs = [];
    if (cfg.tira.bucle) {
      const t = tiraTramos(seconds, n);
      t.inicios.forEach(st => inputs.push('-ss', num(st), '-t', num(t.L), '-i', input));
      g.celdas.forEach((_, i) => parts.push(cell(i, `[${i}:v]fps=${FPS}`)));
      out.tramos = t;
    } else {
      const m = tiraMomentos(seconds, n);
      m.forEach(t => inputs.push('-ss', num(t), '-i', input));
      g.celdas.forEach((_, i) => parts.push(cell(i, `[${i}:v]trim=end_frame=1,setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop=-1,fps=${FPS}`)));
      out.momentos = m;
    }
    out.inputs = inputs;
  } else {
    out.inputs = entrada(kind, input, seconds);
    parts.push(`[0:v]${prep(kind, seconds)},split=${n}${g.celdas.map((_, i) => `[z${i}]`).join('')}`);
    g.celdas.forEach((_, i) => parts.push(cell(i, `[z${i}]null`)));
  }
  g.celdas.forEach((ce, i) => parts.push(`[b${i}][c${i}]overlay=x=${ce.x}:y=${ce.y}:format=auto:shortest=1${i === n - 1 ? `,setsar=1[${label}]` : `[b${i + 1}]`}`));
  out.graph = parts.join(';');
  Object.assign(out, {tira: g, n, cascada: c, recortes});
  return out;
}
// Trabajo FFmpeg de un formato en modo Crear: mismas reglas de codificación que exportJob
// (H.264 del perfil, bitrate del plan, GOP, -fs), siempre a 25 fps; audio AAC solo si se conserva.
export function crearJob({src, profile, technical = {}, kind, s, cfg, seconds, name, id, input = 'input', rotulo = null}) {
  const W = profile.ancho, H = profile.alto, g = crearGrafo({kind, src, W, H, s, cfg, seconds, input, rotulo});
  const rate = technical.bitrateKbps || profile.techoKbps;
  const base = (name || 'video').replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80);
  const filename = `${base}-${String(id).replace(/[^a-zA-Z0-9_-]/g, 'x')}-crear-${cfg.receta}-${W}x${H}.mp4`;
  const args = [...g.inputs, '-filter_complex', g.graph, '-map', '[out]', ...(g.audio ? ['-map', '0:a?'] : ['-an']),
    '-c:v', 'libx264', '-preset', 'ultrafast', '-threads', '1', '-profile:v', technical.h264Perfil || profile.h264.split('@')[0],
    '-level:v', technical.h264Nivel || profile.h264.split('@')[1], '-pix_fmt', 'yuv420p', ...(g.picture ? ['-color_range', 'tv'] : []), '-r', String(FPS),
    '-b:v', `${rate}k`, '-maxrate', `${rate}k`, '-bufsize', `${rate * 2}k`, '-g', String(Math.round(FPS * (technical.gopSegundos || 2))),
    ...(g.audio ? ['-c:a', 'aac', '-b:a', '128k'] : []), '-movflags', '+faststart', '-fs', String(128 * 1048576), 'output.mp4'];
  return {filename, W, H, bitrateKbps: rate, args, input: kind === 'video' ? undefined : input, extras: g.extras, duration: g.duracion, crear: cfg.receta, grafo: g};
}
// Videowalls segmentados: la receta compone la pared física en [wall] y luego se corta por pantalla
// como siempre (especiales-core: atlasJob / segmentsJob con `receta`).
export function crearPared({kind, src, pared, s, cfg, seconds, input = 'input', rotulo = null}) {
  return crearGrafo({kind, src, W: pared.ancho, H: pared.alto, s, cfg, seconds, input, label: 'wall', rotulo});
}
// Instante representativo para PNG/JPG (display e impresión) y miniaturas:
// tira con todas las piezas visibles, barrido a mitad de recorrido y rótulo al arrancar.
export function tiempoRepresentativo(cfg, dur, plan = null) {
  if (cfg.receta === 'tira') return Math.max(0, dur - 1 / FPS);
  if (cfg.receta === 'barrido' && plan) return Math.round(plan.N1 / 2) / FPS;
  return 0;
}
