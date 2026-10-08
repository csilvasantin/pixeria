// Proyectos del Adaptador (Carlos, 5-oct-2026): cada proyecto de Yokup tiene los ajustes
// generales (la biblioteca de 42 tamaños, sin cliente) más los suyos propios, que viven en
// una ficha JSON versionada: adaptaciones/proyectos/<id-yokup>.json. Sin ficha, el proyecto
// usa solo la biblioteca general. Módulo puro: lo usan el navegador, los tests y el generador.
import {settings} from './adapter-core.mjs?v=adapter-detail-1';
import {RECETAS} from './crear-core.mjs?v=adapter-detail-1';

export const GENERAL = 'general';
export const YOKUP_URL = 'https://api.yokup.com/projects';
export const PROJECT_KEY = 'pixeria.adapter.proyecto';           // último proyecto elegido
export const projectStorageKey = (base, id) => id && id !== GENERAL ? `${base}.proyecto.${id}` : base;
// Antes de las fichas, Altadis era el único «perfil de cliente» y sus preferencias vivían en la
// clave general. Esa ficha las hereda una sola vez (migrateStorage).
export const LEGACY_PROJECT = 'altadis-estancos-bcn';
const LEGACY_PROFILES = ['cliente', 'altadis', 'especiales', 'proyecto'];

const ID_RE = /^[a-z0-9][a-z0-9-]{0,79}$/;
const FORMAT_ID_RE = /^[a-z0-9][a-z0-9:-]{0,79}$/;
const MODES = ['auto', 'cover', 'contain', 'blur'];
const COMPAT = ['universal', 'fhd', 'uhd'];
const FAMILIES = ['standard', 'proyecto', 'especiales'];
const INCLUDES = ['todos', 'estandar', 'especiales', 'myblu'];
const isText = v => typeof v === 'string' && v.trim().length > 0;
const isSize = v => Array.isArray(v) && v.length === 2 && v.every(n => Number.isInteger(n) && n > 0 && n <= 16384);
const posInt = v => Number.isInteger(v) && v > 0;

// Una ficha puede llevar sus formatos dentro (lista) o apuntar a un JSON de transcripción
// ({archivo, clave}), relativo a la propia ficha y siempre dentro de adaptaciones/.
export function formatRef(entry) {
  if (entry == null) return null;
  if (Array.isArray(entry)) return {inline: entry};
  return {archivo: entry.archivo, clave: entry.clave};
}
export function resolveRef(fichaPath, archivo) {
  const parts = fichaPath.split('/').slice(0, -1);
  for (const p of String(archivo).split('/')) { if (p === '..') parts.pop(); else if (p && p !== '.') parts.push(p); }
  return parts.join('/');
}

// Valida una ficha. `lists` = {estandar, especiales} ya resueltos; `yokupIds` = ids de Yokup;
// `generalIds` = ids de la biblioteca general (los formatos propios no pueden pisarlos).
export function validateFicha(ficha, {lists = {}, yokupIds = null, generalIds = [], file = ''} = {}) {
  const errors = [], e = m => errors.push(m);
  if (!ficha || typeof ficha !== 'object') return ['la ficha no es un objeto JSON'];
  if (ficha.version !== 1) e('version debe ser 1');
  if (!ID_RE.test(ficha.id || '')) e('id debe ser el slug de Yokup (minúsculas, cifras y guiones)');
  if (file && ficha.id && file !== `${ficha.id}.json`) e(`el archivo debe llamarse ${ficha.id}.json`);
  if (yokupIds && ficha.id && !yokupIds.includes(ficha.id)) e(`el id «${ficha.id}» no existe en la lista de proyectos de Yokup`);
  if (!isText(ficha.nombre)) e('nombre obligatorio');
  if (ficha.alias != null && (!Array.isArray(ficha.alias) || !ficha.alias.every(a => ID_RE.test(a)))) e('alias debe ser una lista de slugs');
  if (ficha.hereda !== GENERAL) e('hereda debe ser "general": toda ficha suma sus formatos a la biblioteca general');
  if (!ficha.fuente || !isText(ficha.fuente.titulo)) e('fuente.titulo obligatorio (de dónde salen los formatos)');
  if (ficha.fuente?.sha256 != null && !/^[0-9a-f]{64}$/.test(ficha.fuente.sha256)) e('fuente.sha256 debe ser hex de 64');
  const a = ficha.ajustes || {};
  if (!ficha.ajustes || typeof ficha.ajustes !== 'object') e('ajustes obligatorio');
  if (!MODES.includes(a.metodo)) e(`ajustes.metodo debe ser ${MODES.join('|')}`);
  if (!COMPAT.includes(a.compatibilidad)) e(`ajustes.compatibilidad debe ser ${COMPAT.join('|')}`);
  if (!Number.isInteger(a.fps) || a.fps < 1 || a.fps > 60) e('ajustes.fps debe ser un entero 1–60');
  if (a.codec !== 'h264') e('ajustes.codec: el Adaptador solo exporta h264');
  if (!FAMILIES.includes(a.familia)) e(`ajustes.familia debe ser ${FAMILIES.join('|')}`);
  const f = ficha.formatos || {};
  if (!ficha.formatos || typeof ficha.formatos !== 'object') e('formatos obligatorio (puede tener listas vacías)');
  for (const k of Object.keys(f)) if (!['estandar', 'especiales'].includes(k)) e(`formatos.${k} no se reconoce`);
  for (const k of ['estandar', 'especiales']) {
    const ref = formatRef(f[k]);
    if (ref && !ref.inline && (!isText(ref.archivo) || !/\.json$/.test(ref.archivo) || !isText(ref.clave))) e(`formatos.${k} debe ser una lista o {archivo, clave}`);
    if (ref && !ref.inline && isText(ref.archivo) && !resolveRef('adaptaciones/proyectos/x.json', ref.archivo).startsWith('adaptaciones/')) e(`formatos.${k}.archivo debe quedar dentro de adaptaciones/`);
  }
  const estandar = lists.estandar || [], especiales = lists.especiales || [];
  if (!Array.isArray(estandar) || !Array.isArray(especiales)) { e('las listas de formatos deben ser arrays'); return errors; }
  const ids = new Set();
  const uniq = (id, where) => {
    if (!FORMAT_ID_RE.test(id || '')) e(`${where}: id «${id}» no válido`);
    else if (ids.has(id)) e(`${where}: id «${id}» repetido`);
    else if (generalIds.includes(id)) e(`${where}: id «${id}» pisa un tamaño de la biblioteca general`);
    ids.add(id);
  };
  estandar.forEach((x, i) => {
    const w = `estandar[${i}]`; uniq(x?.id, w);
    if (!isText(x?.nombre)) e(`${w}: nombre obligatorio`);
    if (!isSize(x?.custom)) e(`${w}: custom debe ser [ancho, alto] en píxeles`);
    if (!isText(x?.uso) || !isText(x?.useEn)) e(`${w}: uso y useEn obligatorios (ES/EN)`);
    if (x?.fps != null && x.fps !== a.fps) e(`${w}: fps distinto del de la ficha`);
  });
  especiales.forEach((l, i) => {
    const w = `especiales[${i}]`; uniq(l?.id, w);
    if (!isText(l?.nombre) || !/^[a-z0-9-]+$/.test(l?.slug || '')) e(`${w}: nombre y slug obligatorios`);
    if (!isSize(l?.entrega) || !isSize(l?.celda)) { e(`${w}: entrega y celda deben ser [ancho, alto]`); return; }
    const r = l.rejilla || {}, p = l.pared || {};
    if (!posInt(r.columnas) || !posInt(r.filas) || !posInt(p.columnas) || !posInt(p.filas)) { e(`${w}: rejilla y pared necesitan columnas y filas`); return; }
    if (l.celda[0] * r.columnas !== l.entrega[0] || l.celda[1] * r.filas !== l.entrega[1]) e(`${w}: celda × rejilla no da la entrega`);
    const unused = Array.isArray(l.celdasSinUso) ? l.celdasSinUso : null;
    if (!unused || !unused.every(n => posInt(n) && n <= r.columnas * r.filas)) e(`${w}: celdasSinUso debe listar celdas de la rejilla`);
    else if (l.pantallas !== r.columnas * r.filas - unused.length) e(`${w}: pantallas no cuadra con la rejilla y las celdas sin uso`);
    if (p.columnas * p.filas !== l.pantallas) e(`${w}: la pared no tiene ${l.pantallas} pantallas`);
    if (!isText(l.uso) || !isText(l.useEn)) e(`${w}: uso y useEn obligatorios (ES/EN)`);
    if (!Array.isArray(l.ambiguedades)) e(`${w}: ambiguedades debe ser una lista (vacía si no hay)`);
  });
  if (especiales.length && a.fps !== 25) e('los videowalls segmentados se exportan a 25 fps: ajustes.fps debe ser 25');
  const fam = ficha.familias || {};
  for (const k of ['proyecto', 'especiales']) if (fam[k] != null && (!isText(fam[k].es) || !isText(fam[k].en))) e(`familias.${k} necesita es y en`);
  if (a.familia === 'proyecto' && !estandar.length && !especiales.length) e('ajustes.familia «proyecto» sin formatos propios');
  if (a.familia === 'especiales' && !especiales.length) e('ajustes.familia «especiales» sin videowalls segmentados');
  if (ficha.campanas != null && !Array.isArray(ficha.campanas)) e('campanas debe ser una lista');
  for (const [i, c] of (Array.isArray(ficha.campanas) ? ficha.campanas : []).entries()) {
    const w = `campanas[${i}]`;
    if (!ID_RE.test(c?.id || '')) e(`${w}: id no válido`);
    if (['social', 'display', 'mobile'].includes(c?.id)) e(`${w}: id «${c.id}» es una campaña general`);
    for (const k of ['es', 'en', 'descripcionEs', 'descripcionEn']) if (!isText(c?.[k])) e(`${w}: ${k} obligatorio`);
    const inc = c?.incluye;
    if (!(INCLUDES.includes(inc) || (Array.isArray(inc) && inc.length && inc.every(id => ids.has(id))))) e(`${w}: incluye debe ser ${INCLUDES.join('|')} o una lista de ids propios`);
  }
  if (ficha.notas != null && (!isText(ficha.notas.es) || !isText(ficha.notas.en))) e('notas necesita es y en');
  // Crear (6-oct-2026): receta por defecto por formato propio, para crear sin preguntar cuando la
  // tarjeta pasa a «Crear» (o "adaptar" para forzar el reencuadre de siempre en ese formato).
  if (ficha.recetas != null) {
    const r = ficha.recetas, validas = [...RECETAS, 'adaptar'];
    if (!r || typeof r !== 'object' || Array.isArray(r)) e(`recetas debe ser un objeto {"<formato>": "${validas.join('|')}"}`);
    else for (const [id, v] of Object.entries(r)) {
      if (!ids.has(id)) e(`recetas: «${id}» no es un formato propio de la ficha`);
      if (!validas.includes(v)) e(`recetas.${id} debe ser ${validas.join('|')}`);
    }
  }
  // Estancos y circuito (6-oct-2026): JSON aparte con los puntos de venta y el formato de cada pantalla.
  if (ficha.estancos != null) {
    const est = ficha.estancos;
    if (!est || typeof est !== 'object' || !isText(est.archivo) || !/\.json$/.test(est.archivo)) e('estancos debe ser {archivo: "<ruta>.json"}');
    else if (!resolveRef('adaptaciones/proyectos/x.json', est.archivo).startsWith('adaptaciones/')) e('estancos.archivo debe quedar dentro de adaptaciones/');
  }
  return errors;
}

// Formatos propios con la misma forma que el Adaptador usaba para Altadis antes de las fichas.
// Cada uno lleva `proyecto: <id>` (antes, `cliente: true`).
export function projectFormats(ficha, {estandar = [], especiales = []} = {}, en = false) {
  const fps = ficha.ajustes?.fps || 25;
  const flat = estandar.map(src => {
    const f = JSON.parse(JSON.stringify(src));
    f.on = true; f.category = 'digital'; f.proyecto = ficha.id;
    if (f.fps == null) f.fps = fps;
    if (en) f.uso = f.useEn;
    return f;
  });
  const walls = especiales.map(src => {
    const layout = JSON.parse(JSON.stringify(src));
    return {id: layout.id, nombre: layout.nombre, nameEn: layout.nombre, uso: en ? layout.useEn : layout.uso, custom: layout.entrega, category: 'digital', especial: true, proyecto: ficha.id, layout, fps: 25, on: false};
  });
  // Receta por defecto de la ficha (Crear): viaja con el formato.
  const recetas = ficha.recetas && typeof ficha.recetas === 'object' ? ficha.recetas : {};
  for (const f of [...flat, ...walls]) if (recetas[f.id]) f.receta = recetas[f.id];
  return [...flat, ...walls];
}

// Lo que ve un proyecto: la biblioteca general (heredada siempre) más sus formatos propios.
// Sin ficha, solo la general.
export function projectLibrary(general, ficha = null, lists = {}, en = false) {
  return ficha ? [...general, ...projectFormats(ficha, lists, en)] : [...general];
}

// Campañas propias: salen en «Campañas completas» delante de las generales.
export function projectCampaigns(ficha) {
  return (ficha?.campanas || []).map(c => {
    const inc = c.incluye;
    const matches = Array.isArray(inc) ? f => inc.includes(f.id)
      : inc === 'estandar' ? f => f.proyecto === ficha.id && !f.especial
      : inc === 'especiales' ? f => f.proyecto === ficha.id && !!f.especial
      : inc === 'myblu' ? f => f.proyecto === ficha.id && !!f.myblu
      : f => f.proyecto === ficha.id;
    return {id: c.id, es: c.es, en: c.en, descriptionEs: c.descripcionEs, descriptionEn: c.descripcionEn, matches, profile: 'proyecto', proyecto: ficha.id};
  });
}

// Lista de Yokup: GET https://api.yokup.com/projects (público, CORS *). Solo id, nombre y estado.
export function parseYokup(json) {
  const list = Array.isArray(json?.projects) ? json.projects : Array.isArray(json?.proyectos) ? json.proyectos : [];
  const seen = new Set();
  return list.flatMap(p => {
    const id = String(p?.id || '').trim(), nombre = String(p?.name ?? p?.nombre ?? '').trim() || id;
    if (!ID_RE.test(id) || seen.has(id)) return [];
    seen.add(id);
    return [{id, nombre, estado: String(p?.status ?? p?.estado ?? 'activo')}];
  });
}

// Opciones del selector: General, luego los proyectos con ficha (marcados) y el resto de Yokup
// activos. Un proyecto con ficha aparece aunque Yokup no responda.
export function mergeProjects(yokup = [], index = []) {
  const byId = new Map(yokup.map(p => [p.id, p]));
  const own = index.map(x => ({id: x.id, nombre: byId.get(x.id)?.nombre || x.nombre, ficha: x, propios: true}));
  const ownIds = new Set(own.map(p => p.id));
  const rest = yokup.filter(p => !ownIds.has(p.id) && p.estado === 'activo').map(p => ({id: p.id, nombre: p.nombre, ficha: null, propios: false}));
  const sort = (a, b) => a.nombre.localeCompare(b.nombre, 'es', {sensitivity: 'base'});
  return [...own.sort(sort), ...rest.sort(sort)];
}

// ?proyecto=<id|alias>: devuelve el id canónico, GENERAL o null si no se conoce.
export function resolveProject(query, projects, index = []) {
  if (query == null) return null;
  const q = String(query).trim().toLowerCase();
  if (!q || q === GENERAL || q === 'ninguno' || q === 'none') return GENERAL;
  if (projects.some(p => p.id === q)) return q;
  const viaAlias = index.find(x => (x.alias || []).includes(q));
  return viaAlias ? viaAlias.id : null;
}

// Migración única: las preferencias guardadas con Altadis en la clave general (perfil
// cliente/altadis/especiales y formatos cliente-*/altadis-*) pasan a la clave de su proyecto.
// No borra nada de la clave general. Devuelve el proyecto al que conviene volver, o null.
export function migrateStorage(store, base) {
  let raw = null;
  try { raw = JSON.parse(store.getItem(base)); } catch (_) { return null; }
  if (!raw || typeof raw !== 'object' || raw.version !== 1) return null;
  const target = projectStorageKey(base, LEGACY_PROJECT);
  if (store.getItem(target) != null) return null;
  const legacyId = id => /^(cliente|altadis)-/.test(String(id));
  const hasData = LEGACY_PROFILES.includes(raw.profile)
    || (Array.isArray(raw.selected) && raw.selected.some(legacyId))
    || (raw.fmt && typeof raw.fmt === 'object' && Object.keys(raw.fmt).some(legacyId));
  if (!hasData) return null;
  const copy = {...raw, version: 1, proyecto: LEGACY_PROJECT, migradoDe: base};
  if (raw.fmt && typeof raw.fmt === 'object') copy.fmt = Object.fromEntries(Object.entries(raw.fmt).map(([k, v]) => [k, settings(v)]));
  try { store.setItem(target, JSON.stringify(copy)); } catch (_) { return null; }
  return LEGACY_PROFILES.includes(raw.profile) ? LEGACY_PROJECT : null;
}

// Proyecto inicial: ?proyecto= manda; si no, el último elegido; si no, General.
export function initialProject({query = null, saved = null, projects = [], index = []} = {}) {
  const fromQuery = resolveProject(query, projects, index);
  if (fromQuery) return {id: fromQuery, unknown: null};
  const fromSaved = resolveProject(saved, projects, index);
  return {id: fromSaved || GENERAL, unknown: query != null && String(query).trim() ? String(query).trim() : null};
}
