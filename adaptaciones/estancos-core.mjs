// Estancos y circuito (Carlos, 6-oct-2026): con un contenido elegido, el Adaptador prepara de golpe
// el lote de cada estanco del proyecto (o de todos) con los formatos exactos de sus pantallas, lo
// empaqueta en ZIP con un manifiesto y, si se pide, lo publica en el Stock con etiquetas del proyecto.
// Módulo puro: lo usan el navegador y los tests (sin DOM ni red).
//
// Datos: la ficha del proyecto apunta a un JSON de estancos ({archivo}), relativo a la ficha. Cada
// estanco lleva sus pantallas y cada pantalla el id de un formato propio de la ficha (cliente-NN,
// cliente-esp-N…). Ver adaptaciones/proyectos/estancos/altadis-estancos-bcn.json y docs/adaptador.md.

export const ESTANCOS_VERSION = 1;
// ZIP en el navegador: fflate fijado en jsDelivr, comprobado por SHA-256 antes de ejecutarlo.
export const FFLATE = {
  version: '0.8.2', licencia: 'MIT', bytes: 89198,
  url: 'https://cdn.jsdelivr.net/npm/fflate@0.8.2/esm/browser.js',
  sha256: '8cc1f687e0159e977addb6b85e274dbd11e622cf151f4fcb7b85d49622ea43e7'
};
// Límites del Stock (pixer-worker · cleanTag/STOCK_TAGS_MAX): 10 etiquetas de 30 caracteres como
// máximo, en minúsculas. El worker añade la de calidad («good») y la de orientación: quedan 8.
export const STOCK_TAG_MAX = 30, STOCK_TAGS_OWN = 8;
export const MANIFEST = 'manifest.json';

const ID_RE = /^[a-z0-9][a-z0-9-]{0,79}$/;
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,99}$/;
const isText = v => typeof v === 'string' && v.trim().length > 0;
const posInt = v => Number.isInteger(v) && v > 0;

// Medidas de un formato propio tal como se exporta: formatos planos (custom) o videowall (entrega).
export const formatSize = f => f?.layout?.entrega || f?.entrega || f?.custom || null;

// Valida el JSON de estancos frente a los formatos de la ficha. `formats` = lista de formatos
// propios ({id, custom|entrega}); devuelve una lista de errores (vacía si todo cuadra).
export function validateEstancos(doc, {formats = [], proyecto = null} = {}) {
  const errors = [], e = m => errors.push(m);
  if (!doc || typeof doc !== 'object') return ['el JSON de estancos no es un objeto'];
  if (doc.version !== ESTANCOS_VERSION) e(`version debe ser ${ESTANCOS_VERSION}`);
  if (proyecto && doc.proyecto !== proyecto) e(`proyecto «${doc.proyecto}» no es el de la ficha (${proyecto})`);
  if (!isText(doc.circuito)) e('circuito obligatorio');
  if (!doc.fuente || !isText(doc.fuente.titulo)) e('fuente.titulo obligatorio (de dónde salen los estancos)');
  if (!doc.mapa || !isText(doc.mapa.estado) || !isText(doc.mapa.criterio) || !isText(doc.mapa.criterioEn)) e('mapa.estado, mapa.criterio y mapa.criterioEn obligatorios (cómo se asigna formato a cada pantalla)');
  const byId = new Map(formats.map(f => [f.id, f]));
  const list = Array.isArray(doc.estancos) ? doc.estancos : null;
  if (!list || !list.length) { e('estancos debe ser una lista con al menos un estanco'); return errors; }
  const ids = new Set(), slugs = new Set(), screens = new Set();
  list.forEach((est, i) => {
    const w = `estancos[${i}]`;
    if (!ID_RE.test(est?.id || '')) e(`${w}: id no válido`);
    else if (ids.has(est.id)) e(`${w}: id «${est.id}» repetido`);
    ids.add(est?.id);
    if (!isText(est?.nombre)) e(`${w}: nombre obligatorio`);
    if (!isText(est?.direccion)) e(`${w}: direccion obligatoria`);
    if (!SLUG_RE.test(est?.slug || '') || !String(est.slug).startsWith(`${est.id}-`)) e(`${w}: slug debe empezar por el id y ser minúsculas, cifras y guiones`);
    else if (slugs.has(est.slug)) e(`${w}: slug repetido`);
    slugs.add(est?.slug);
    if (est?.expendeduria != null && (!isText(est.expendeduria.numero) || !isText(est.expendeduria.fuente))) e(`${w}: expendeduria necesita numero y fuente (o null)`);
    const pantallas = Array.isArray(est?.pantallas) ? est.pantallas : [];
    if (!pantallas.length) { e(`${w}: cada estanco necesita al menos una pantalla`); return; }
    const local = new Set();
    pantallas.forEach((p, j) => {
      const pw = `${w}.pantallas[${j}]`;
      if (!ID_RE.test(p?.id || '')) e(`${pw}: id no válido`);
      else if (local.has(p.id)) e(`${pw}: id «${p.id}» repetido en el estanco`);
      local.add(p?.id);
      if (p?.screen !== `${est.id}-${p?.id}`) e(`${pw}: screen debe ser «${est.id}-${p?.id}»`);
      else if (screens.has(p.screen)) e(`${pw}: screen repetida`);
      screens.add(p?.screen);
      if (!isText(p?.nombre) || !isText(p?.nameEn)) e(`${pw}: nombre y nameEn obligatorios (ES/EN)`);
      if (!posInt(p?.ancho) || !posInt(p?.alto)) e(`${pw}: ancho y alto en píxeles`);
      const f = byId.get(p?.formato);
      if (!f) { e(`${pw}: el formato «${p?.formato}» no existe en la ficha`); return; }
      const size = formatSize(f);
      if (size && (size[0] !== p.ancho || size[1] !== p.alto)) e(`${pw}: ${p.ancho}×${p.alto} no es la medida de ${f.id} (${size[0]}×${size[1]})`);
    });
  });
  return errors;
}

// Estancos elegidos en el orden del JSON (ids desconocidos se ignoran).
export function pickEstancos(doc, ids) {
  const want = new Set(ids || []);
  return (doc?.estancos || []).filter(e => want.has(e.id));
}

// Formatos exactos de las pantallas de esos estancos, sin repetir y en orden de aparición.
export function formatsFor(doc, ids) {
  const out = [];
  for (const est of pickEstancos(doc, ids)) for (const p of est.pantallas) if (!out.includes(p.formato)) out.push(p.formato);
  return out;
}

// Ruta dentro del ZIP: <estanco>/<pantalla>-<formato>-<ancho>x<alto>.<ext>
export const entryPath = (est, pantalla, formato, w, h, ext) => `${est.slug}/${pantalla.id}-${formato}-${w}x${h}.${ext}`;
export const extOf = f => f?.output === 'png' ? 'png' : 'mp4';

// Una línea por estanco × pantalla: qué formato recibe y dónde va dentro del ZIP.
export function packagePlan(doc, ids, formats) {
  const byId = new Map(formats.map(f => [f.id, f]));
  const plan = [];
  for (const est of pickEstancos(doc, ids)) for (const p of est.pantallas) {
    const f = byId.get(p.formato); if (!f) continue;
    const [w, h] = formatSize(f), ext = extOf(f);
    plan.push({estanco: est.id, slug: est.slug, nombre: est.nombre, pantalla: p.id, screen: p.screen, pantallaNombre: p.nombre, pantallaNameEn: p.nameEn, formato: f.id, formatoNombre: f.nombre, ancho: w, alto: h, ext, archivo: entryPath(est, p, f.id, w, h, ext)});
  }
  return plan;
}

// Agrupa el plan por estanco (para pintar el resultado y los ZIP por estanco).
export function groupByEstanco(plan) {
  const groups = [];
  for (const row of plan) {
    let g = groups.find(x => x.estanco === row.estanco);
    if (!g) groups.push(g = {estanco: row.estanco, slug: row.slug, nombre: row.nombre, rows: []});
    g.rows.push(row);
  }
  return groups;
}

// Fuente estable para externalRef y el manifiesto: un vídeo del Stock por su id; un archivo
// local por el SHA-256 de sus bytes (los 16 primeros caracteres bastan para distinguirlos).
export function sourceKey({stockId = null, sha256 = null} = {}) {
  if (stockId) return `stock-${String(stockId).replace(/[^A-Za-z0-9_-]/g, '')}`;
  if (sha256 && /^[0-9a-f]{64}$/.test(sha256)) return `sha256-${sha256.slice(0, 16)}`;
  return null;
}
// externalRef estable de una pieza: misma fuente y mismo formato → misma referencia.
export const stockRef = (proyecto, source, formato) => source ? `pixeria:${proyecto}:${source}:${formato}`.slice(0, 160) : null;

// Manifiesto del ZIP: una entrada por estanco × pantalla con su archivo, duración y hash.
// `files` = Map(formatoId → {sha256, bytes, duracion}); `scope` = ids de estancos que entran.
export function manifest({doc, plan, files, fuente, generado, scope = null, stock = null}) {
  const rows = scope ? plan.filter(r => scope.includes(r.estanco)) : plan;
  return {
    version: 1,
    proyecto: doc.proyecto, circuito: doc.circuito, generado,
    fuente: {id: fuente?.id || null, titulo: fuente?.titulo || '', url: fuente?.url || null, clave: fuente?.clave || null},
    mapa: doc.mapa?.estado || null,
    piezas: rows.map(r => {
      const f = files.get(r.formato) || {};
      const out = {estanco: r.estanco, estancoNombre: r.nombre, pantalla: r.pantalla, screen: r.screen, formato: r.formato, ancho: r.ancho, alto: r.alto, archivo: r.archivo,
        duracion: Number.isFinite(f.duracion) ? Math.round(f.duracion * 100) / 100 : null, bytes: f.bytes ?? null, sha256: f.sha256 || null, fuente: fuente?.clave || fuente?.id || null};
      const s = stock?.get?.(r.formato);
      if (s) out.stock = {id: s.id, num: s.num ?? null, externalRef: s.externalRef, reutilizado: !!s.reused};
      return out;
    })
  };
}

// Contenido del ZIP: las rutas del plan (el mismo archivo de formato se copia en cada estanco que
// lo usa) y manifest.json en la raíz. `files` = Map(formatoId → {data: Uint8Array, …}).
export function zipEntries({plan, files, manifestJSON, scope = null}) {
  const out = {};
  for (const r of plan) {
    if (scope && !scope.includes(r.estanco)) continue;
    const f = files.get(r.formato);
    if (f?.data) out[r.archivo] = f.data;
  }
  out[MANIFEST] = new TextEncoder().encode(JSON.stringify(manifestJSON, null, 1) + '\n');
  return out;
}
// MP4 y PNG ya van comprimidos: se guardan sin deflate (level 0), con fecha fija para que el mismo
// lote dé el mismo ZIP. `zipSync` es el de fflate (inyectado: el navegador lo baja de jsDelivr).
export const ZIP_MTIME = new Date('2026-01-01T00:00:00Z');
export function buildZip(entries, zipSync) {
  const tree = {};
  for (const [path, data] of Object.entries(entries)) tree[path] = [data, {level: 0, mtime: ZIP_MTIME}];
  return zipSync(tree, {level: 0, mtime: ZIP_MTIME});
}
export const zipName = (doc, est = null) => `${doc.proyecto}${est ? `-${est.slug}` : '-todos'}.zip`;

// ── Stock ──────────────────────────────────────────────────────────────────
// Una pieza por fuente y formato: el mismo MP4 sirve a la misma pantalla de todos los estancos del
// lote, y el Stock ya deduplica por contenido (SHA-256). El reparto exacto estanco × pantalla va en
// `comment` (lo busca /stock/list?q=) y en el manifiesto.
const cleanTag = t => String(t || '').toLowerCase().replace(/[#·.]/g, '').trim().slice(0, STOCK_TAG_MAX);
export function publishTags({proyectoTag = 'altadis', formato, rows, totalEstancos}) {
  const base = [proyectoTag, 'adaptación', formato, ...new Set(rows.map(r => `pantalla-${r.pantalla}`))].map(cleanTag);
  const estancos = [...new Set(rows.map(r => r.estanco))];
  const own = estancos.map(id => cleanTag(`estanco-${id}`));
  const tags = base.length + own.length <= STOCK_TAGS_OWN ? [...base, ...own]
    : [...base, cleanTag(estancos.length === totalEstancos ? 'estancos-todos' : `estancos-${estancos.length}`)];
  return [...new Set(tags)].slice(0, STOCK_TAGS_OWN);
}
export function publishComment({doc, rows}) {
  return [`${doc.proyecto} · circuito ${doc.circuito}`, ...rows.map(r => `estanco ${r.estanco} · pantalla ${r.screen} · ${r.archivo}`)].join('\n').slice(0, 2000);
}
// Qué piezas faltan en el Stock: `known` = Map(externalRef → {id, num}) con lo ya publicado (índice
// del Stock y registro local). Las que ya están no se vuelven a subir.
export function publishPlan({doc, plan, formatos, fuente, known = new Map(), totalEstancos = doc.estancos.length, proyectoTag = 'altadis'}) {
  return formatos.map(formato => {
    const rows = plan.filter(r => r.formato === formato);
    const externalRef = stockRef(doc.proyecto, fuente?.clave, formato);
    const prev = externalRef ? known.get(externalRef) : null;
    return {formato, rows, externalRef, tags: publishTags({proyectoTag, formato, rows, totalEstancos}), comment: publishComment({doc, rows}), skip: !!prev, prev: prev || null};
  });
}
// Payload final: el de las adaptaciones (stockPayload) con las etiquetas del proyecto, el
// externalRef estable y el reparto en comment.
export function packagePayload(base, piece) {
  return {...base, tags: piece.tags, externalRef: piece.externalRef, comment: piece.comment};
}

// Publica las piezas que faltan, una a una. `upload(piece)` sube y devuelve {ok, id, num, reused};
// `known` se actualiza con cada éxito, así que repetir la publicación no sube nada dos veces.
// Devuelve una línea de registro por pieza: publicada, reutilizada (ya estaba) o error.
export async function publishPieces(pieces, {upload, known, onStep = () => {}}) {
  const log = [];
  for (const piece of pieces) {
    const prev = piece.externalRef ? known.get(piece.externalRef) : null;
    if (prev) { log.push({formato: piece.formato, externalRef: piece.externalRef, estado: 'ya-estaba', id: prev.id, num: prev.num ?? null}); onStep(log); continue; }
    let r;
    try { r = await upload(piece); } catch (_) { r = {ok: false, error: 'network'}; }
    if (r?.ok) {
      const rec = {id: r.id, num: r.num ?? null, externalRef: piece.externalRef, reused: !!r.reused};
      if (piece.externalRef) known.set(piece.externalRef, rec);
      log.push({formato: piece.formato, externalRef: piece.externalRef, estado: r.reused ? 'reutilizada' : 'publicada', id: r.id, num: r.num ?? null});
    } else log.push({formato: piece.formato, externalRef: piece.externalRef, estado: 'error', error: r?.error || 'error'});
    onStep(log);
  }
  return log;
}

// ── Programación de players ────────────────────────────────────────────────
// La programa el servidor: POST /players-programar (functions/players-programar.js) con la sesión de
// Pixeria. El secreto de admira.tv (STOCK_NOTIFY_KEY) vive solo en el proyecto Pages; aquí no se pide.
// Primero modo «prueba» (plan exacto, sin escribir), luego modo «real» con la firma de esa prueba.
// Ver docs/adaptador.md · «Programación de players».
export const PROGRAMAR_URL = '/players-programar';
export const PROGRAMAR_MAX = 50;
// URL pública de un vídeo del Stock publicado por el Adaptador (siempre MP4: stock/<id>/asset.mp4).
export const stockAssetURL = id => `https://stock.admira.store/stock/${encodeURIComponent(id)}/asset.mp4`;
// Piezas del lote para /players-programar: una por estanco × pantalla cuya pieza ya está en el Stock.
// `stock` = Map(formato → {id}); `files` = Map(formato → {duracion}). Los formatos sin pieza en el
// Stock (PNG o sin publicar) van en `faltan` y no se programan.
export function programPieces({plan, stock, files}) {
  const piezas = [], faltan = [];
  for (const r of plan) {
    const s = stock?.get?.(r.formato), f = files?.get?.(r.formato);
    if (!s?.id) { if (!faltan.includes(r.formato)) faltan.push(r.formato); continue; }
    const d = Number(f?.duracion);
    const duracion = Number.isFinite(d) ? Math.max(2, Math.min(600, Math.round(d * 100) / 100)) : 10;
    piezas.push({estanco: r.estanco, pantalla: r.pantalla, screenId: r.screen, stockId: String(s.id), url: stockAssetURL(s.id), formato: r.formato, duracion});
  }
  return {piezas, faltan, estancos: new Set(piezas.map(p => p.estanco)).size};
}
// Identidad del lote: si cambia cualquier pieza, la prueba anterior deja de valer.
export const loteKey = piezas => JSON.stringify(piezas.map(p => [p.screenId, p.stockId, p.url, p.duracion]));
