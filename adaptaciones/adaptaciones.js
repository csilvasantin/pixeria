import {canEnterPortrait,portraitEntryPlan,selectPortraitEntry} from './portrait-entry.mjs?v=20261009-portrait-entry-1';
import {mountAdvertisement} from './anuncio-studio.mjs?v=semantic-ad-13';
import {mountCampaign} from './campaign-studio.mjs?v=creator-full-3';
let campaignWorkshop=null;
import {mountTwin} from './gemelo-digital.mjs?v=installation-20261009';
import {aiJob} from './ia-core.mjs?v=adapter-detail-1';
import {APPLICATION_KEY,restoreApplications,applyApplications} from './aplicaciones-core.mjs';
import {mountStudio} from './studio-adaptaciones.mjs';
let studio = null, twin = null, advertisement = null;
// Pixeria · Adaptaciones (FLT-101349, 2-oct-2026): un vídeo → todas las pantallas.
// Render en vivo en canvas; las reglas son las del motor de signage de Pixeria.
// Reutiliza el motor de reglas real de Pixeria: assets/signage-perfiles.js
import { perfilDeSalida, planificar } from '/assets/signage-perfiles.js';
import { STORAGE_KEY, defaults, restore, snapshot, rect, cropWindow, exportBudget, exportJob, STILL, stillSeconds, stillJob, animJob, animPreviewJob } from './adapter-core.mjs?v=adapter-detail-1';
import { createEngine, MAX_SOURCE_BYTES } from './adapter-export.js?v=installation-20261009';
import { createExportQueue } from './export-queue.js';
import { publishAdaptation, shortFormat, adaptationTitle, MAX_STOCK_BYTES } from './stock-publish.mjs';
import { createCatalog, CATEGORIES, CAMPAIGNS, matchingFormats, customFormat, restoreCustomFormats, formatFamily, isProjectFormat, isLibrarySize, applyCampaign, setGroupSelected, groupSelection, selectAllSizes } from './format-catalog.mjs';
import { GENERAL, YOKUP_URL, PROJECT_KEY, projectStorageKey, formatRef, resolveRef, projectLibrary, projectCampaigns, parseYokup, mergeProjects, migrateStorage, initialProject } from './proyectos-core.mjs';
import { geometry, segmentsJob, atlasJob, atlasFilename, segmentFilename, segmentKbps } from './especiales-core.mjs?v=adapter-detail-1';
import { sizeGroups, selectionState, toggleSelection, selectionAction } from './format-catalog.mjs';
import { pngDensity } from './png-density.mjs';
import { validateEstancos, formatsFor, packagePlan, groupByEstanco, manifest as packageManifest, zipEntries, buildZip, zipName, sourceKey, publishPlan, publishPieces, FFLATE, PROGRAMAR_URL, PROGRAMAR_MAX, programPieces, loteKey } from './estancos-core.mjs?v=altadis-ia-20261007';
import { gifPlayer, hasImageDecoder, decodeHEIC, LIBHEIF, rasterSVG, svgCache } from './fuentes-especiales.mjs';
import { UMBRAL_CREAR, RECETAS, TIRA, ROTULO, crearDefaults, defaultsFicha, crearSettings, desproporcion, accionAuto, accionEfectiva, tiraN, tiraGeometria, tiraMomentos, tiraTramos, tiraRecortes, cascada, alphaCelda, barridoPlan, barridoVentana, rotuloLayout, rotuloVelocidad, rotuloDesplazamiento, crearJob, crearPared, duracionReceta, tiempoRepresentativo, ROTULO_PNG, motivoAccion, relojPrevio, relojT, relojPlay, relojPausa, relojSeek, relojDuracion, relojEnMarcha, previoN, previoFotograma, etiquetaTiempo } from './crear-core.mjs?v=adapter-detail-1';

const EN = document.documentElement.lang === 'en';
const t = (es, en) => EN ? en : es;
const $ = (s) => document.querySelector(s);
const FORMATOS = createCatalog(EN);
const MODOS = { auto: t('Auto (regla Pixeria)', 'Auto (Pixeria rule)'), cover: t('Recorte', 'Crop'), blur: t('Expandir · fondo desenfocado', 'Expand · blurred background'), contain: t('Contener · negro', 'Contain · black') };
const picker = {query:'',orientation:'all',open:new Set()};
const state = { sel: '', proyecto: GENERAL, profile: 'standard', compat: 'fhd', modoGlobal: 'auto', fmt: {}, crear: {}, src: { ancho: 0, alto: 0, fps: 25, bitrateKbps: 0 }, srcName: '', origin: { id: null, title: '' } };
FORMATOS.forEach((f) => (state.fmt[f.id] = { modo: 'auto', fx: 0.5, fy: 0.5, zoom: 1 }));
// Crear (formatos extremos, 6-oct-2026): acción y receta por formato (crear-core.mjs). Por defecto, la
// receta de la ficha del proyecto o «barrido»; la acción «auto» pasa a Crear con r ≥ UMBRAL_CREAR.
const crearBase = f => defaultsFicha(f.receta);
const crearCfg = f => state.crear[f.id] || (state.crear[f.id] = crearBase(f));
// Previo animado (6-oct-2026): reloj por tarjeta, lo último pintado, tarjetas visibles y movimiento reducido.
const previos = new Map(); // id → {reloj, manual, reanudar, arrastre}
const ultimaInfo = new Map(); // id → {t, dur, modo, corre}
const visibles = new Set(); let io = null, previoTodas = null;
const reduceMQ = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : null;
let movimientoReducido = !!reduceMQ?.matches;
reduceMQ?.addEventListener?.('change', e => { movimientoReducido = e.matches; drawDirty = true; });
// Proyecto activo (Carlos, 5-oct-2026): biblioteca general + la ficha del proyecto de Yokup, si la tiene.
let FICHA = null, INDEX = [], PROJECTS = [], campaigns = CAMPAIGNS, yokupSource = 'none', yokupDate = '';

const video = $('#src');
// Imagen fija (Carlos, 5-oct-2026): la fuente puede ser un vídeo (#src) o una imagen (#src-img) JPG,
// PNG o WebP, del Stock o del equipo. El reencuadre es el mismo; display e impresión salen en PNG
// (o JPG) y el resto en MP4 H.264 a 25 fps de la duración elegida (1–60 s, 10 por defecto), sin audio.
const img = $('#src-img');
// Formatos de entrada (Carlos, 5-oct-2026): además GIF, SVG, HEIC y AVIF (formatos-entrada.js).
// Un GIF animado es srcKind 'anim': se reproduce en bucle (ImageDecoder en #src-anim o, sin WebCodecs,
// un MP4 intermedio en #src) y se exporta como vídeo de 25 fps leyendo el propio GIF.
const PF = window.PixeriaFormatos;
window.PixeriaAdaptador = window.PixeriaAdaptador || {fuente: null};
const animStage = $('#src-anim');
let srcKind = 'video';
let fuente = null; // {tipo, nombre, url (original), file, ext, formato, gif, svg, heic, ...}: lo lee ficha-tecnica.js
let anim = null, animSourceURL = null, animSeconds = 0;
let svgSrc = null, svgRasters = null; // {texto, medidas} del SVG activo y la caché de rásteres del previo
let derivedURL = null; // blob propio de la fuente (SVG preparado, PNG de un HEIC, MP4 intermedio del GIF)
const isImage = () => srcKind === 'image';
const isAnim = () => srcKind === 'anim';
const isPicture = () => srcKind !== 'video'; // imagen o GIF animado: sin audio, PNG/JPG del fotograma
const media = () => isAnim() ? (anim ? anim.canvas : video) : isImage() ? img : video;
const mediaReady = () => isAnim() ? (anim ? anim.ready : video.readyState >= 2) : isImage() ? !!(img.getAttribute('src') && img.complete && img.naturalWidth) : video.videoWidth > 0;
const STILL_KEY = 'pixeria.adapter.still';
let stillSec = STILL.default;
try { stillSec = stillSeconds(localStorage.getItem(STILL_KEY)); } catch (_) {}
let srcExt = 'png';
let initialized = false;
const selectedFormats = () => FORMATOS.filter(f => f.on && (state.profile === 'proyecto' ? isProjectFormat(f) : formatFamily(f) === state.profile));
// Biblioteca uses the compatibility selector; project formats keep native resolutions.
const syncCompat = () => { $('#compat').disabled = state.profile !== 'standard'; };
// Persistence is separated by project (and, inside, by format id): General keeps the historic key
// pixeria.adapter.v1; each project uses pixeria.adapter.v1.proyecto.<id>. Custom sizes belong to
// the general library, so they are shared and always live in the General record.
const keyFor = id => projectStorageKey(STORAGE_KEY, id);
const readJSON = key => { try { return JSON.parse(localStorage.getItem(key)); } catch (_) { return null; } };
const RATIOS = ['9:16', '16:9', '1:1', '4:5'];
function saveSettings() {
  if (!initialized) return;
  try {
    const snap = snapshot(state, FORMATOS);
    snap.crear = Object.fromEntries(FORMATOS.filter(f => state.crear[f.id] && JSON.stringify(state.crear[f.id]) !== JSON.stringify(crearBase(f))).map(f => [f.id, state.crear[f.id]]));
    localStorage.setItem(keyFor(state.proyecto), JSON.stringify(snap));
    if (state.proyecto !== GENERAL) {
      const general = readJSON(STORAGE_KEY);
      if (general && general.version === 1) { if (JSON.stringify(general.custom || []) !== JSON.stringify(snap.custom)) localStorage.setItem(STORAGE_KEY, JSON.stringify({...general, custom: snap.custom})); }
      else if (snap.custom.length) localStorage.setItem(STORAGE_KEY, JSON.stringify({version: 1, profile: 'standard', compat: 'fhd', modoGlobal: 'auto', custom: snap.custom, selected: RATIOS, fmt: {}}));
    }
    $('#settings-status').textContent = t('Ajustes guardados en este navegador. Al volver, elige de nuevo tu archivo local.', 'Settings saved in this browser. Select your local file again when returning.');
  }
  catch (_) { $('#settings-status').textContent = t('Este navegador no permite guardar los ajustes.', 'This browser does not allow saving settings.'); }
}
const hasFamily = fam => fam === 'standard' || FORMATOS.some(fam === 'proyecto' ? isProjectFormat : f => f.especial && fam === 'especiales');
const defaultFamily = () => FICHA && hasFamily(FICHA.ajustes?.familia) ? FICHA.ajustes.familia : 'standard';
// Fresh state of the active project: the four ratios of the library, the project's flat formats
// on (as the Altadis profile always loaded), segmented walls off, and the ficha's defaults.
function resetState() {
  Object.assign(state, {profile: defaultFamily(), compat: 'fhd', modoGlobal: FICHA?.ajustes?.metodo || 'auto'});
  FORMATOS.forEach(f => { f.on = f.proyecto ? !f.especial : RATIOS.includes(f.id); state.fmt[f.id] = defaults(); state.crear[f.id] = crearBase(f); });
}
function syncControls() {
  $('#format-profile').value = state.profile; $('#compat').value = state.compat; $('#modo-global').value = state.modoGlobal;
  syncCompat();
}
// General library + shared custom sizes + the project's own formats, then that project's settings.
function restoreSettings(lists) {
  initialized = false;
  const general = [...createCatalog(EN), ...restoreCustomFormats(readJSON(STORAGE_KEY)?.custom, EN)];
  FORMATOS.length = 0; FORMATOS.push(...projectLibrary(general, FICHA, lists, EN));
  resetState();
  try {
    const raw = readJSON(keyFor(state.proyecto)), saved = restore(raw, FORMATOS);
    if (saved) { Object.assign(state, {profile:saved.profile,compat:saved.compat,modoGlobal:saved.modoGlobal,fmt:saved.fmt}); FORMATOS.forEach(f=>f.on=saved.selected.includes(f.id)); }
    if (saved && raw.crear && typeof raw.crear === 'object') FORMATOS.forEach(f => { state.crear[f.id] = crearSettings(raw.crear[f.id], crearBase(f)); });
  } catch (_) { /* corrupt or unavailable storage: keep safe defaults */ }
  syncControls(); initialized = true;
}
// kinds applies to special layouts: the client delivery file, one MP4 per screen, or both.
// Crear: `receta` (crearPared) composes the recipe on the physical wall; the cuts are the same.
function especialJobs(f,kinds,src=state.src,receta=null) {
  const tech=especialTech(f),mode=studio?.background(f)?'blur':modoEfectivo(f),s=state.fmt[f.id],jobs=[];
  const tag=receta?{crear:receta.receta,duration:receta.duracion,input:receta.picture?crearInput.name:undefined,extras:receta.extras}:{};
  const rl=receta?` · ${RECETA_CORTA[receta.receta]}`:'';
  if(kinds!=='segments') jobs.push({...atlasJob(src,f.layout,mode,s,tech,receta),...tag,label:`${f.nombre} · ${t('entrega','delivery')}${rl}`});
  if(kinds!=='atlas') {
    const job=Object.assign(segmentsJob(src,f.layout,mode,s,tech,receta),tag);job.label=`${f.nombre} · ${job.outputs.length} ${t('pantallas','screens')}${rl}`;
    job.outputs.forEach(o=>o.label=`${f.nombre} · ${t('pantalla','screen')} ${o.n}/${o.N}`);jobs.push(job);
  }
  return jobs;
}
// Exports go to the background queue: each line freezes its job (settings, size and
// source) at click time, so the user can keep editing, switch video or go back to step 1.
// Every finished MP4 is also saved to the Stock as a new video: «<title> · <client> · <format>».
let savingToStock=0;
async function saveToStock(item,file) {
  if(item.campaign)return; // Workshop exports publish only via its explicit Stock control.
  if(item.paquete){onPackageFile(item,file);return;} // el paquete por estanco publica con sus propias etiquetas
  if(file.blob.type!=='video/mp4') return;
  savingToStock++;try {await saveOne(item,file);} finally {savingToStock--;}
}
async function saveOne(item,file) {
  const total=item.files.length,format=shortFormat(item.format,file.output);
  const title=adaptationTitle(item.origin.title,item.client,format);
  item.stock=item.stock||{ok:0,fail:0,ids:[]};
  queue.note(item,t('Guardando en el Stock…','Saving to Stock…'));
  let result;
  // Los MP4 grandes suben por partes: la nota de la cola enseña el porcentaje.
  const onProgress=(hecho,bytes)=>queue.note(item,`${t('Guardando en el Stock…','Saving to Stock…')} ${Math.floor(hecho/bytes*100)} %`);
  try {result=await publishAdaptation(file.blob,{title,originId:item.origin.id,client:item.client,format,width:file.output.W,height:file.output.H,duration:item.duration,still:!!item.still,receta:item.receta||null},null,{onProgress});}
  catch(_) {result={ok:false,error:'network'};}
  if(result.ok){item.stock.ok++;item.stock.ids.push(result.num?`#${result.num}`:result.id);}else item.stock.fail++;
  const done=item.stock.ok+item.stock.fail;
  if(done<total){queue.note(item,`${t('Guardando en el Stock…','Saving to Stock…')} ${done}/${total}`);return;}
  queue.note(item,item.stock.fail
    ?(result.error==='too-big'?t(`Supera ${MAX_STOCK_BYTES/1048576} MB: no se guardó en el Stock; descárgalo.`,`Over ${MAX_STOCK_BYTES/1048576} MB: not saved to Stock; download it.`):t('No se pudo guardar en el Stock; descárgalo.','Could not save to Stock; download it.'))
    :`${t('En el Stock','In Stock')} ${item.stock.ids.join(' ')}`.trim());
  item.stockTitle=title;
}
let batchIds = null, batchTotal = 0;
function paintBatch(rows) {
  if (!batchIds || !batchTotal) return;
  const finished = rows.filter(row => batchIds.has(row.id) && (row.state === 'done' || row.state === 'error' || row.state === 'cancelled')).length;
  const status = $('#export-status');
  if (status) status.textContent = `${finished}/${batchTotal}`;
}
const queue = createExportQueue({
  engine:createEngine(),t,onChange:rows=>{paintBatch(rows);paintPackageRows(rows);campaignWorkshop?.exportChanged();},
  onCreate(item){ if (batchIds) batchIds.add(item.id); if (item.paquete && pkg && item.paquete === pkg.id && item.format) pkg.items.set(item.id, item.format.id); },
  onComplete:saveToStock,
  onRelease:url=>{if(url!==sourceObjectURL&&url!==stillInput.url&&url!==derivedURL&&url.startsWith('blob:'))URL.revokeObjectURL(url);}
});
// What FFmpeg reads for a still image: the picture as the browser shows it (EXIF orientation
// applied, same pixels as the preview) re-encoded as PNG once per source. If the browser cannot
// rasterise it (canvas limits), the original file is used. Lines in the queue keep their own URL.
let stillInput = {key: '', url: null, input: 'input.png'};
function releaseStill() {
  const u = stillInput.url;
  if (u && u.startsWith('blob:') && u !== sourceObjectURL && !queue.uses(u)) URL.revokeObjectURL(u);
  stillInput = {key: '', url: null, input: 'input.png'};
}
async function stillSource() {
  const key = img.currentSrc || img.src;
  if (stillInput.key === key && stillInput.url) return stillInput;
  let url = null, input = 'input.png';
  try {
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext('2d').drawImage(img, 0, 0);
    const blob = await new Promise(resolve => c.toBlob(resolve, 'image/png')); c.width = c.height = 0;
    if (blob && blob.size <= MAX_SOURCE_BYTES) url = URL.createObjectURL(blob);
  } catch (_) {}
  if (!url) { url = key; input = `input.${srcExt}`; }
  releaseStill(); stillInput = {key, url, input};
  return stillInput;
}
// SVG (Carlos, 5-oct-2026): each output gets its own raster at the resolution its reframing needs
// (svgRaster), so a vector stays sharp from 300×250 to 4K. MP4 inputs are capped at 4096×4096 px.
const SVG_EXPORT={maxLado:8192,maxPx:4096*4096};
async function svgExportSource(output,mode,s) {
  const r=PF.svgRaster(svgSrc.medidas,output.ancho,output.alto,mode,s,SVG_EXPORT);
  const canvas=await rasterSVG(svgSrc.texto,r.ancho,r.alto);
  return {el:canvas,dims:{ancho:r.ancho,alto:r.alto,fps:25,bitrateKbps:0},raster:r};
}
const pngBlob=canvas=>new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
// kinds: 'both' | 'atlas' | 'segments' for special layouts; 'jpg' turns picture outputs into JPG.
// Crear (6-oct-2026): a card in «Crear» builds its recipe job (crear-core) instead of the reframe; the
// recipe already carries its picture inputs (no stillJob/animJob rewrite) and, for the ticker, the strip PNG.
async function exportFormats(formats,kinds='both',extra=null) {
  if(!state.src.ancho || !formats.length) return;
  const status=$('#export-status');status.textContent='';
  if(advertisement?.enabled()){if(await advertisement.prepare(formats))await exportAdvertisements(formats,kinds,extra);return;}
  const still=isImage(),animated=isAnim(),seconds=stillSec,duration=animated?animSeconds:still?seconds:video.duration;
  const pngFormats=formats.filter(f=>f.output==='png'),mp4Formats=formats.filter(f=>f.output!=='png');
  let sourceURL=video.currentSrc||video.src,input=null;
  if(animated) sourceURL=animSourceURL;
  else if(still&&mp4Formats.length&&!svgSrc){({url:sourceURL,input}=await stillSource());}
  crearInput.name=animated?'input.gif':still?(svgSrc?'input.png':input||'input.png'):'input';
  const build=(f,src)=>{
    const bg=studio?.background(f);
    if(bg){const out=destino(f),base=f.especial?especialJobs(f,kinds,src):[{...exportJob(src,perfil(f),plan(f), 'blur',state.fmt[f.id],state.srcName,f.id),label:f.nombre}];
      return base.map(job=>({job:{...aiJob(job,src,out,state.fmt[f.id],bg.url,{wall:!!f.especial}),label:`${job.label} · IA`},f}));}

    if(creando(f)){
      if(f.especial) return especialJobs(f,kinds,src,crearPared({...crearArgs(f,src),pared:geometry(f.layout).pared,rotulo:rotuloLayoutDe(f,wallOutput(f))})).map(job=>({job,f}));
      const p=perfil(f);
      return [{job:{...crearJob({...crearArgs(f,src),profile:p,technical:plan(f)||{},name:state.srcName,id:f.id,rotulo:rotuloLayoutDe(f,p)}),label:`${f.nombre} · ${RECETA_CORTA[crearCfg(f).receta]}`},f}];
    }
    return f.especial?especialJobs(f,kinds,src).map(job=>({job,f})):[{job:{...exportJob(src,perfil(f),plan(f),modoEfectivo(f),state.fmt[f.id],state.srcName,f.id),label:f.nombre},f}];
  };
  // Recipes need their frames (video), thumbnails and ticker strips before the job exists.
  for(const f of formats) if(creando(f)) {try{await prepararCrear(f,f.especial?wallOutput(f):perfil(f));}catch(_){}}
  let jobs;
  try{jobs=svgSrc?[]:mp4Formats.flatMap(f=>build(f,state.src));}catch(_){status.textContent=t('No se pudo preparar la receta para este contenido.','Could not prepare the recipe for this content.');return;}
  const budgetJobs=svgSrc?mp4Formats.flatMap(f=>build(f,state.src)):jobs;
  const longest=Math.max(duration||0,...budgetJobs.map(j=>j.job.duration||0));
  const budget=budgetJobs.length?exportBudget(longest,budgetJobs.map(j=>j.job)):null;
  if(budget) {status.textContent=budget==='batch-size'
    ?t('El lote supera el presupuesto local de memoria. Selecciona menos formatos y expórtalos por separado.','This batch exceeds the local memory budget. Select fewer formats and export them separately.')
    :still?t('Esta duración es demasiado larga para este perfil en el navegador. Baja los segundos del MP4 o usa un perfil de menor resolución.','This length is too long for this profile in the browser. Lower the MP4 seconds or use a lower resolution profile.')
    :t('Este vídeo es demasiado largo para exportarlo con este perfil en el navegador. Usa un clip más corto o un perfil de menor resolución.','This video is too long to export with this profile in the browser. Use a shorter clip or a lower resolution profile.');return;}
  const kind=animated?t('GIF animado','animated GIF'):svgSrc?t('SVG vectorial','vector SVG'):t('imagen fija','still image');
  const sub=isPicture()?`${state.srcName} · ${kind}`:state.srcName;
  // Frozen at click time: original content, active client (top bar selector) and duration.
  const ctx={origin:{...state.origin},client:window.PixeriaCliente?.actual?.()||null,duration,still,...(extra||{})};
  batchIds = new Set();
  batchTotal = pngFormats.length + budgetJobs.length;
  status.textContent = `0/${batchTotal}`;
  const jpg=kinds==='jpg';
  for(const f of pngFormats){
    const p=perfil(f),canvas=document.createElement('canvas');canvas.width=p.ancho;canvas.height=p.alto;
    let override=null;const crea=creando(f);
    if(svgSrc){try{override=await svgExportSource(p,crea?'cover':modoEfectivo(f),crea?crearZoom(f):state.fmt[f.id]);}catch(_){status.textContent=t('No se pudo rasterizar este SVG.','Could not rasterise this SVG.');continue;}}
    // A recipe on a still output: its representative frame (all the strip, the middle of the pan, the ticker start).
    if(crea) paintCrear(canvas,p,f,'rep',override); else drawInto(canvas,f,override);
    if(override)override.el.width=override.el.height=0;
    let blob=await new Promise(resolve=>jpg?canvas.toBlob(resolve,'image/jpeg',0.9):canvas.toBlob(resolve,'image/png'));
    canvas.width=canvas.height=0;
    if(!blob)continue;
    if(f.print&&!jpg)blob=new Blob([pngDensity(new Uint8Array(await blob.arrayBuffer()))],{type:'image/png'});
    const rec=crea?crearCfg(f).receta:null;
    queue.addReady({label:`${f.nombre} · ${jpg?'JPG':'PNG'}${rec?` · ${RECETA_CORTA[rec]}`:''}`,sub,sourceURL:null,format:f,...ctx,receta:rec},[{blob,filename:`${f.id}${rec?`-crear-${rec}`:''}-${p.ancho}x${p.alto}.${jpg?'jpg':'png'}`}]);
  }
  // Extra inputs of a recipe (ticker strip): one PNG per job, frozen at click time.
  const extrasOf=async(job,f)=>{
    if(!job.extras?.length) return [];
    const out=f.especial?wallOutput(f):perfil(f),st=rotuloStrip(f,out);
    const blob=await pngBlob(st.canvas);return blob?[{name:ROTULO_PNG,url:URL.createObjectURL(blob)}]:[];
  };
  const add=async(job,f,url,subline)=>{
    const crea=!!job.crear;
    queue.add({label:job.label,sub:subline,sourceURL:url,job:crea?{...job,extraFiles:await extrasOf(job,f)}:animated?animJob(job,animSeconds,'input.gif'):still?stillJob(job,seconds,svgSrc?'input.png':input):job,format:f,...ctx,duration:crea?job.duration:ctx.duration,receta:job.crear||null});
  };
  if(svgSrc){
    // One PNG per format at its own resolution; the job's geometry uses that raster as the source.
    for(const f of mp4Formats){
      const out=f.especial?wallOutput(f):perfil(f),crea=creando(f);let src;
      try{src=await svgExportSource(out,crea?'cover':modoEfectivo(f),crea?crearZoom(f):state.fmt[f.id]);}catch(_){status.textContent=t('No se pudo rasterizar este SVG.','Could not rasterise this SVG.');continue;}
      const blob=await pngBlob(src.el);src.el.width=src.el.height=0;if(!blob)continue;
      const url=URL.createObjectURL(blob);
      for(const {job} of build(f,src.dims)) await add(job,f,url,`${sub} · ${src.raster.ancho}×${src.raster.alto}`);
    }
    return;
  }
  for(const {job,f} of jobs) await add(job,f,sourceURL,sub);
}
$('#export-all').onclick=()=>exportFormats(selectedFormats());
// Back to the active project's defaults (General: the four ratios and the standard library).
$('#reset-settings').onclick=()=>{ resetState(); syncControls(); buildGrid(); };
// Closing the tab mid-export loses the work: the browser asks first.
window.addEventListener('beforeunload',event=>{if(!queue.busy()&&!savingToStock&&!advertisement?.busy())return;event.preventDefault();event.returnValue=t('Hay exportaciones en curso','Exports are in progress');return event.returnValue;});
window.addEventListener('pagehide',event=>{if(event.persisted)return;queue.cancelAll();queue.clear();if(sourceObjectURL)URL.revokeObjectURL(sourceObjectURL);if(derivedURL)URL.revokeObjectURL(derivedURL);});

// ── Perfil + plan (motor Pixeria) ───────────────────────────────────────────
function perfil(f) {
  if(f.output==='png')return {ancho:f.custom[0],alto:f.custom[1],orientacion:f.custom[0]>f.custom[1]?'apaisada':f.custom[0]<f.custom[1]?'vertical':'custom',fps:25,techoKbps:8000,sueloKbps:2500,h264:'high@4.0'};
  return f.custom
    ? perfilDeSalida({ formato: 'custom', ancho: f.custom[0], alto: f.custom[1], compatibilidad: f.proyecto ? (FICHA?.ajustes?.compatibilidad || 'uhd') : f.native ? (Math.max(...f.custom)>1920||f.custom[0]*f.custom[1]>1920*1080?'uhd':'fhd') : state.compat })
    : perfilDeSalida({ formato: f.id, compatibilidad: state.compat });
}
function plan(f) {
  if (!state.src.ancho) return null;
  try { const output = planificar(state.src, perfil(f)); if (f.proyecto) output.fps = f.especial ? 25 : (FICHA?.ajustes?.fps || 25); return output; } catch (e) { return { error: e.message }; }
}
// Special layouts reframe the physical wall (every screen side by side), not the
// packed delivery file: that is the picture people actually see across screens.
function wallOutput(f) {
  const g = geometry(f.layout); return { ...perfil(f), ancho: g.pared.ancho, alto: g.pared.alto, orientacion: g.pared.ancho > g.pared.alto ? 'apaisada' : 'vertical', reducida: false };
}
function wallPlan(f) {
  if (!state.src.ancho) return null;
  try { return planificar(state.src, wallOutput(f)); } catch (e) { return { error: e.message }; }
}
function especialTech(f) {
  const p = plan(f) || {}, cell = perfilDeSalida({ formato: 'custom', ancho: f.layout.celda[0], alto: f.layout.celda[1], compatibilidad: 'fhd' });
  const [segmentPerfil, segmentNivel] = cell.h264.split('@');
  return { bitrateKbps: p.bitrateKbps || perfil(f).techoKbps, h264Perfil: p.h264Perfil || 'high', h264Nivel: p.h264Nivel || '5.1', segmentPerfil, segmentNivel };
}
function modoEfectivo(f) {
  const m = state.fmt[f.id].modo !== 'auto' ? state.fmt[f.id].modo : state.modoGlobal;
  if (m !== 'auto') return m;
  const p = f.especial ? wallPlan(f) : plan(f); if (!p || p.error) return 'blur';
  // 'expandir' (laterales generativos con IA) existe en el motor, pero esta página
  // NO se usa IA de pago: se sustituye por fondo desenfocado del propio vídeo.
  return (p.encaje === 'recortar' || p.encaje === 'exacto') ? 'cover' : 'blur';
}

// ── Size library: searching never changes selection ────────────────────────
// Grupos (Carlos, 6-oct-2026): cada grupo de ☰ y «Todos los tamaños» tienen un control tri-estado.
// Un clic marca el grupo entero; si ya estaba entero, lo desmarca. Con búsqueda u orientación,
// actúa solo sobre lo visible y el rótulo lo dice. Los grupos siguen a la familia activa.
const pickerFiltered = () => !!picker.query.trim() || picker.orientation !== 'all';
// One tri-state checkbox: indeterminate when partial, the label says what the next click does,
// Enter works like Space, and focus comes back to it after the picker is rebuilt.
function selectionControl(members, name, key, filtered, input = document.createElement('input')) {
  const s = selectionState(members), action = selectionAction(s, {filtered, en: EN});
  input.type = 'checkbox'; input.dataset.selectKey = key;
  input.checked = s.all; input.indeterminate = s.partial;
  input.setAttribute('aria-label', `${name}: ${t(`${s.on} de ${s.total} marcados`, `${s.on} of ${s.total} selected`)}${filtered ? t(' (visibles)', ' (visible)') : ''}. ${action}`);
  input.onclick = event => event.stopPropagation();
  input.onkeydown = event => { if (event.key === 'Enter') { event.preventDefault(); input.click(); } };
  input.onchange = () => {
    toggleSelection(members); buildGrid();
    const after = selectionState(members);
    $('#group-status').textContent = `${name}: ${t(`${after.on} de ${after.total} marcados`, `${after.on} of ${after.total} selected`)}`;
  };
  return {state: s, action, input};
}
function buildPicker() {
  const visible=matchingFormats(FORMATOS,{query:picker.query,orientation:picker.orientation,profile:state.profile});
  const shown=new Set(visible),filtered=pickerFiltered();
  const focusKey=document.activeElement?.dataset?.selectKey||null;
  const container=$('#size-categories');container.replaceChildren();
  for(const group of sizeGroups(FORMATOS,state.profile)){
    const formats=group.members.filter(f=>shown.has(f));if(!formats.length)continue;
    const name=EN?group.en:group.es;
    const detail=document.createElement('details');detail.className='size-category';detail.dataset.group=group.id;detail.open=!!picker.query||picker.open.has(group.id)||state.profile!=='standard';
    const summary=document.createElement('summary');
    const title=document.createElement('span');title.className='group-title';
    const control=selectionControl(formats,name,`group:${group.id}`,filtered);
    const count=document.createElement('small');count.className='group-count';count.textContent=`${control.state.on}/${control.state.total}`;
    title.append(document.createTextNode(name),count);
    const groupLabel=document.createElement('label');groupLabel.className='group-toggle';
    groupLabel.addEventListener('click',event=>event.stopPropagation());
    const groupText=document.createElement('span');groupText.textContent=control.action;groupText.setAttribute('aria-hidden','true');
    groupLabel.append(control.input,groupText);summary.append(title,groupLabel);detail.append(summary);
    detail.ontoggle=()=>{if(detail.open)picker.open.add(group.id);else picker.open.delete(group.id);};
    for(const f of formats){
      const label=document.createElement('label');label.className='size-option';
      const input=document.createElement('input');input.type='checkbox';input.checked=f.on;input.dataset.selectKey=`size:${f.id}`;input.setAttribute('aria-label',`${t('Tamaño','Size')} ${f.nombre}`);
      input.onchange=()=>{f.on=input.checked;buildGrid();};
      const text=document.createElement('span');const name=document.createElement('strong');name.textContent=f.nombre;
      const dims=document.createElement('small');const p=perfil(f);dims.textContent=f.especial?`${p.ancho} × ${p.alto} px · ${f.layout.pantallas} ${t('pantallas','screens')} · MP4`:`${p.ancho} × ${p.alto} px · ${f.output==='png'?'PNG':'MP4'}${f.regional?t(' · Polonia',' · Poland'):''}`;
      text.append(name,dims);label.append(input,text);detail.append(label);
    }
    container.append(detail);
  }
  // «Todos los tamaños»: the same tri-state control over everything the panel shows.
  const all=selectionControl(visible,t('Todos los tamaños','All sizes'),'all',filtered,$('#all-sizes'));
  all.input.disabled=!visible.length;
  $('#all-sizes-action').textContent=visible.length?all.action:t('Sin tamaños visibles','No visible sizes');
  $('#all-sizes-count').textContent=`${all.state.on}/${all.state.total}`;
  if(focusKey){const back=document.querySelector(`[data-select-key="${CSS.escape(focusKey)}"]`);if(back)back.focus();}
  $('#search-status').textContent=t(`${visible.length} tamaños disponibles`,`${visible.length} sizes available`);
  $('#size-no-results').hidden=!!visible.length;
  $('#campaigns').querySelectorAll('[data-campaign]').forEach(button=>{
    const campaign=campaigns.find(c=>c.id===button.dataset.campaign);if(!campaign)return;const formats=FORMATOS.filter(campaign.matches);
    button.querySelector('.campaign-count').textContent=t(`${formats.length} tamaños`,`${formats.length} sizes`);
    button.setAttribute('aria-label',`${t('Seleccionar','Select')} ${EN?campaign.en:campaign.es}`);
  });
}
// The project's own campaigns (ficha) go first, then the general ones.
function renderCampaigns() {
  $('#campaigns').replaceChildren(...campaigns.map(c=>{
    const b=document.createElement('button');b.type='button';b.className='campaign';b.dataset.campaign=c.id;
    const heading=document.createElement('strong');heading.textContent=EN?c.en:c.es;
    const count=document.createElement('span');count.className='campaign-count';
    const description=document.createElement('small');description.textContent=EN?c.descriptionEn:c.descriptionEs;
    b.append(heading,count,description);
    b.onclick=()=>{const profile=c.profile||'standard';state.profile=profile;$('#format-profile').value=profile;syncCompat();applyCampaign(FORMATOS,c.id,campaigns);buildGrid();};return b;
  }));
}
$('#size-search').oninput=e=>{picker.query=e.target.value;buildPicker();};
$('#size-orientation').onchange=e=>{picker.orientation=e.target.value;buildPicker();};
$('#clear-formats').onclick=()=>{selectedFormats().forEach(f=>f.on=false);buildGrid();};
$('#custom-size-form').onsubmit=e=>{
  e.preventDefault();const f=customFormat($('#custom-width').value,$('#custom-height').value,EN);
  if(!f){$('#custom-status').textContent=t('Usa dimensiones pares de 64 a 3840 px, máximo 8,3 Mpx.','Use even dimensions from 64 to 3840 px, maximum 8.3 MP.');return;}
  const existing=FORMATOS.find(x=>x.id===f.id);
  if(!existing&&FORMATOS.filter(x=>x.user).length>=12){$('#custom-status').textContent=t('Máximo 12 tamaños personalizados guardados.','Maximum 12 saved custom sizes.');return;}
  if(existing)existing.on=true;else{f.on=true;FORMATOS.push(f);state.fmt[f.id]=defaults();state.crear[f.id]=crearBase(f);}
  state.profile='standard';$('#format-profile').value='standard';syncCompat();
  picker.query='';$('#size-search').value='';picker.orientation='all';$('#size-orientation').value='all';picker.open.add('digital');
  $('#custom-status').textContent=t('Tamaño añadido y guardado.','Size added and saved.');buildGrid();
};

// ── Tarjetas de formato ─────────────────────────────────────────────────────
function buildGrid() {
  const g = $('#grid'); g.innerHTML = '';
  buildPicker();
  const selected=selectedFormats();
  $('#selected-count').textContent=t(`${selected.length} tamaños seleccionados`,`${selected.length} sizes selected`);
  $('#empty-formats').hidden=!!selected.length;
  selectedFormats().forEach((f) => {
    if (f.especial) { g.appendChild(especialCard(f)); return; }
    // Extreme banners (≥ 4:1 or 1:4) take the whole row and a wider preview (Crear, 6-oct-2026).
    const p = perfil(f), extreme = Math.max(p.ancho / p.alto, p.alto / p.ancho) >= 4, base = extreme && p.ancho > p.alto ? 1152 : 384;
    const cw = p.ancho >= p.alto ? base : Math.round(384 * p.ancho / p.alto); const ch = Math.max(1, Math.round(cw * p.alto / p.ancho));
    const el = document.createElement('div'); el.className = `fmt${extreme ? ' fmt-extremo' : ''}`; el.dataset.f = f.id;
    el.innerHTML = `<div class="fmt-title"><h3>${f.nombre} <span class="accion-tag" hidden></span></h3><button class="remove-format" type="button" aria-label="${t('Quitar','Remove')} ${f.nombre}">×</button></div><div class="dims">${p.ancho}×${p.alto}</div>
      <div class="stage"><canvas width="${cw}" height="${ch}"></canvas></div>
      <button class="pill accent export-one" type="button"></button>`;
    el.querySelector('.stage').after(crearControls(f));
    el.querySelector('.remove-format').onclick=(e)=>{e.stopPropagation();f.on=false;buildGrid();};
    el.querySelector('.export-one').onclick=(e)=>{e.stopPropagation();exportFormats([f]);};
    // Display (no print) from a still image: JPG as well, lighter for ad networks.
    if(f.category==='display'&&f.output==='png'){const j=document.createElement('button');j.type='button';j.className='pill export-one export-jpg';j.textContent='JPG';j.hidden=!isPicture();j.title=t('JPG calidad 90, más ligero para redes de display','JPG quality 90, lighter for display networks');j.onclick=(e)=>{e.stopPropagation();exportFormats([f],'jpg');};el.querySelector('.export-one').after(j);}
    if(twin)el.append(twin.button(f));
    selectable(el, f);
    g.appendChild(el);
  });
  refreshOriginal(); observarTarjetas(g);
  if (!selected.some(f=>f.id===state.sel)) state.sel = selected[0]?.id || '';
  markSelected(); buildCardSettings(); refreshInfo();
}
// Tarjeta del vídeo ORIGINAL (Carlos, 4-oct-2026, 23:19): siempre la primera, en su formato y
// resolución nativos, sin relleno. No es un tamaño: no se quita, no cuenta en «N tamaños» y no
// tiene ajustes (sin data-f, así loop/markSelected/Avanzado no la tratan como formato).
const escHTML = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
function refreshOriginal() {
  const g = $('#grid'); if (!g) return;
  const prev = g.querySelector('.fmt-original'); if (prev) prev.remove();
  const W = state.src.ancho, H = state.src.alto; if (!W || !H) return;
  const cw = W >= H ? 384 : Math.round(384 * W / H), ch = Math.round(cw * H / W);
  const el = document.createElement('div'); el.className = 'fmt fmt-original'; el.dataset.original = '1';
  // The original as it was chosen: Stock URL (CORS mode), the local file, or what the stage shows.
  const url = fuente?.url ? corsURL(fuente.url) : isPicture() ? (sourceObjectURL || img.currentSrc || img.getAttribute('src') || '') : (video.currentSrc || video.getAttribute('src') || '');
  const kindNote = isAnim() ? ` · ${t('GIF animado','animated GIF')} · ${secLabel(animSeconds)} s` : svgSrc ? ` · ${t('SVG vectorial','vector SVG')}` : isImage() ? ` · ${t('imagen fija','still image')}` : '';
  el.innerHTML = `<div class="fmt-title"><h3>${isAnim() ? t('GIF original','Original GIF') : isImage() ? t('Imagen original','Original image') : t('Vídeo original','Original video')}<span class="orig-tag">${t('Original','Original')}</span></h3></div><div class="dims">${W}×${H} · ${t('nativo, sin relleno','native, no padding')}${kindNote}</div>
      <div class="stage"><canvas width="${cw}" height="${ch}" aria-label="${escHTML(state.origin.title || state.srcName)}"></canvas></div>
      ${url ? `<a class="pill export-one" href="${escHTML(url)}" download target="_blank" rel="noopener">${t('Descargar original','Download original')}</a>` : ''}`;
  g.prepend(el); drawDirty = true;
}
const controlsHTML = () => `<div class="ctl"><span>${t('Método','Method')}</span><select data-k="modo">${Object.entries(MODOS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
      <span>${t('Foco X','Focus X')}</span><input type="range" data-k="fx" min="0" max="1" step="0.01" value="0.5">
      <span>${t('Foco Y','Focus Y')}</span><input type="range" data-k="fy" min="0" max="1" step="0.01" value="0.5">
      <span>Zoom</span><input type="range" data-k="zoom" min="1" max="2" step="0.01" value="1"></div>`;
// Avanzado actúa sobre la tarjeta seleccionada: método, foco y zoom, aviso de recorte y dudas del PDF.
function selectable(el, f) {
  el.tabIndex = 0; el.setAttribute('role', 'button'); el.setAttribute('aria-pressed', 'false');
  const pick = () => { if (state.sel === f.id) return; state.sel = f.id; markSelected(); buildCardSettings(); refreshInfo(); syncCrearSettings(); };
  el.addEventListener('click', pick);
  el.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === el) { e.preventDefault(); pick(); } });
}
function markSelected() {
  document.querySelectorAll('#grid .fmt[data-f]').forEach(el => { const on = el.dataset.f === state.sel; el.classList.toggle('sel', on); el.setAttribute('aria-pressed', String(on)); });
}
function buildCardSettings() {
  const box = $('#card-settings'); if (!box) return;
  const f = FORMATOS.find(x => x.id === state.sel && x.on);
  if (!f) { box.innerHTML = `<p class="muted">${t('Elige una tarjeta para ajustar su método, foco y zoom.','Select a card to adjust its method, focus and zoom.')}</p>`; return; }
  if(advertisement?.enabled()){box.textContent=`${f.nombre} · ${advertisement.description(f)}`;return;}
  const L = f.layout, size = f.especial ? `${L.entrega[0]}×${L.entrega[1]}` : `${perfil(f).ancho}×${perfil(f).alto}`;
  box.innerHTML = `<div class="card-sel-hd">${t('Tarjeta seleccionada','Selected card')}: <b>${f.nombre}</b> · ${size}</div>${crearHTML()}${controlsHTML()}<div class="aviso"></div>`
    + (f.especial && L.ambiguedades.length ? `<ul class="esp-warn">${L.ambiguedades.map(a => `<li>${t('Ambigüedad en el PDF','PDF ambiguity')}: ${a}</li>`).join('')}</ul>` : '');
  bindControls(box, f); bindCrear(box, f); syncCrearSettings();
}
function bindControls(el, f) {
  el.querySelectorAll('[data-k]').forEach((inp) => { inp.value = state.fmt[f.id][inp.dataset.k]; inp.setAttribute('aria-label', `${t('Ajuste','Setting')} ${inp.dataset.k} · ${f.nombre}`); inp.oninput = () => { const k = inp.dataset.k; state.fmt[f.id][k] = k === 'modo' ? inp.value : +inp.value; refreshInfo(); }; });
}
// ── Videowalls segmentados (perfil de cliente): pared física con cortes + entrega con una celda por pantalla ──
// The wall fills the card width; long walls keep at least WALL_MIN_H px of height and scroll inside the card.
const WALL_CSS_H = 96, WALL_MIN_H = 64;
function especialCard(f) {
  const L = f.layout, g = geometry(L), [W, H] = L.entrega, [cw, ch] = L.celda;
  const aspect = g.pared.ancho / g.pared.alto, wallW = Math.round(WALL_CSS_H * aspect);
  const aw = W >= H ? 480 : Math.round(480 * W / H), ah = Math.round(aw * H / W);
  const el = document.createElement('div'); el.className = 'fmt fmt-especial'; el.dataset.f = f.id;
  el.innerHTML = `<div class="fmt-title"><h3>${f.nombre} <span class="accion-tag" hidden></span></h3><button class="remove-format" type="button" aria-label="${t('Quitar','Remove')} ${f.nombre}">×</button></div>
    <div class="dims">${W}×${H} · ${g.segments.length} ${t('pantallas','screens')}</div>
    <div class="esp-views">
      <figure class="esp-view esp-wall"><figcaption>${t('Pared física · el vídeo continúa de una pantalla a la siguiente','Physical wall · the video continues from one screen to the next')}</figcaption>
        <div class="wall-scroll" tabindex="0" aria-label="${t('Pared física con líneas de corte','Physical wall with cut lines')}"><canvas class="wall" width="${wallW * 2}" height="${WALL_CSS_H * 2}" style="width:max(100%,${Math.round(WALL_MIN_H * aspect)}px);height:auto"></canvas></div></figure>
      <figure class="esp-view esp-atlas"><figcaption>${t('Entrega · una celda por pantalla, en orden de lectura','Delivery · one cell per screen, in reading order')}</figcaption>
        <div class="stage"><canvas class="atlas" width="${aw}" height="${ah}"></canvas></div></figure>
    </div>
    <div class="esp-actions"><button class="pill accent export-one export-atlas" type="button"></button>
    <button class="pill export-one export-segments" type="button"></button></div>
`;
  el.querySelector('.remove-format').onclick = (e) => { e.stopPropagation(); f.on = false; buildGrid(); };
  el.querySelector('.export-atlas').onclick = (e) => { e.stopPropagation(); exportFormats([f], 'atlas'); };
  el.querySelector('.export-segments').onclick = (e) => { e.stopPropagation(); exportFormats([f], 'segments'); };
  el.querySelector('.esp-actions').before(crearControls(f));
  if(twin)el.append(twin.button(f));
  selectable(el, f);
  return el;
}
function especialInfo(f) {
  const L = f.layout, g = geometry(L), tech = especialTech(f), m = modoEfectivo(f), s = state.fmt[f.id];
  let lost = 0;
  if (state.src.ancho && m === 'cover') { const a = state.src.ancho / state.src.alto, b = g.pared.ancho / g.pared.alto; lost = 1 - Math.min(a / b, b / a) / s.zoom ** 2; }
  const aviso = state.src.ancho ? `${isImage() ? `MP4 ${stillSec} s · ${t('imagen fija','still image')} · ` : isAnim() ? `MP4 ${secLabel(animSeconds)} s · ${t('GIF animado','animated GIF')} · ` : ''}${MODOS[m]} · ${t('sobre la pared','on the wall')} ${g.pared.ancho}×${g.pared.alto}${m === 'cover' ? ` · ${Math.round(lost * 100)}% ${t('perdido','lost')}` : ''}${m === 'blur' ? t(' · fondo derivado, sin expansión IA', ' · derived background, no AI expansion') : ''}` : t('Elige un vídeo o una imagen para calcular el recorte.', 'Choose a video or an image to calculate cropping.');
  const rate = segmentKbps(L, tech.bitrateKbps);
  const stillNote = isImage() ? ` · ${t('imagen fija','still image')} ${stillSec} s` : isAnim() ? ` · ${t('GIF animado','animated GIF')} ${secLabel(animSeconds)} s` : '';
  const files = [`${t('Entrega','Delivery')}: ${atlasFilename(L)} · H.264 ${tech.h264Perfil}@${tech.h264Nivel} · ${tech.bitrateKbps} kbps · ${isPicture() ? t('sin audio','no audio') : t('audio si existe','audio if present')}${stillNote}`,
    `${t('Por pantalla','Per screen')}: H.264 ${tech.segmentPerfil}@${tech.segmentNivel} · ${rate} kbps · ${t('sin audio','no audio')} · GOP 1 s${stillNote}`,
    ...g.segments.map(seg => `  ${seg.n}/${seg.N} · ${t('celda','cell')} ${seg.cell} (${seg.atlas.x},${seg.atlas.y}) · ${t('pared','wall')} x=${seg.wall.x} · ${segmentFilename(L, seg.n)}`),
    ...(g.unused.length ? [`${t('Celdas sin uso (negro)','Unused cells (black)')}: ${g.unused.map(c => c.index).join(', ')}`] : []),
    t('Esta página no sincroniza players: la continuidad depende de que arranquen a la vez.','This page does not synchronise players: continuity depends on them starting together.')];
  if (state.src.ancho && creando(f)) {
    let cmd = '';
    try { const receta = crearPared({...crearArgs(f), pared: g.pared, rotulo: rotuloLayoutDe(f, wallOutput(f))}); cmd = `\n\nffmpeg ${atlasJob(state.src, L, m, s, tech, receta).args.map(a => JSON.stringify(a)).join(' ')}`; } catch (_) {}
    return { aviso: `${crearAviso(f)} · ${t('sobre la pared','on the wall')} ${g.pared.ancho}×${g.pared.alto}`, plan: files.join('\n') + cmd };
  }
  const rawAtlas=state.src.ancho?atlasJob(state.src,L,studio?.background(f)?'blur':m,s,tech):null;
  const atlas=rawAtlas&&studio?.background(f)?aiJob(rawAtlas,state.src,wallOutput(f),s,studio.background(f).url,{wall:true}):rawAtlas;
  return { aviso:studio?.background(f)?cardAviso(f):aviso, plan: files.join('\n') + (atlas ? `\n\nffmpeg ${pictureJob(atlas).args.map(a => JSON.stringify(a)).join(' ')}` : '') };
}
function cardAviso(f) {
  if(advertisement?.enabled())return advertisement.description(f);
  if(studio?.background(f))return t('Fondo IA estático + original conservado · composición sobre la pared completa','Static AI background + original preserved · full wall composition');
  if (f.especial) return especialInfo(f).aviso;
  if (creando(f)) return crearAviso(f);
  const p = plan(f), m = modoEfectivo(f), settings = state.fmt[f.id];
  const what = f.output === 'png' ? (isImage() ? t('PNG de la imagen','PNG of the image') : t('PNG del fotograma actual','PNG of the current frame'))
    : isImage() ? `MP4 ${stillSec} s · ${t('imagen fija, sin audio','still image, no audio')}` : isAnim() ? `MP4 ${secLabel(animSeconds)} s · ${t('GIF animado a 25 fps, sin audio','animated GIF at 25 fps, no audio')}` : '';
  let lost = 0;
  if (state.src.ancho) {
    const sourceRatio = state.src.ancho / state.src.alto, targetRatio = perfil(f).ancho / perfil(f).alto;
    if (m === 'cover') lost = 1 - Math.min(sourceRatio / targetRatio, targetRatio / sourceRatio) / settings.zoom ** 2;
    else if (settings.zoom > 1) {
      const k = Math.min(perfil(f).ancho / state.src.ancho, perfil(f).alto / state.src.alto) * settings.zoom;
      lost = 1 - Math.min(1, perfil(f).ancho / (state.src.ancho * k)) * Math.min(1, perfil(f).alto / (state.src.alto * k));
    }
  }
  return p && !p.error
    ? `${what ? what + ' · ' : ''}${MODOS[m]} · ${Math.round(lost * 100)}% ${t('perdido', 'lost')}${m === 'blur' ? t(' · fondo derivado, sin expansión IA', ' · derived background, no AI expansion') : ''}`
    : t('Elige un vídeo o una imagen para calcular el recorte.', 'Choose a video or an image to calculate cropping.');
}
function refreshInfo() {
  syncPortraitEntry();
  studio?.sync();twin?.sync();
  drawDirty=true;saveSettings();
  const chosen=selectedFormats().length;
  $('#export-all').textContent=t(`Adaptar · ${chosen}`,`Adapt · ${chosen}`);
  $('#export-all').disabled=!state.src.ancho || !chosen;
  syncEstancosButton();
  const allCount=FORMATOS.filter(isLibrarySize).length;
  const allLabel=$('#all-sizes .all-sizes-count');if(allLabel)allLabel.textContent=String(allCount);
  document.querySelectorAll('.export-one').forEach(el=>el.disabled=!state.src.ancho);
  labelExports(); syncCrearCards(); syncPrevioTodas();
  const selF = FORMATOS.find((x) => x.id === state.sel && x.on), selAviso = $('#card-settings .aviso');
  if (selF && selAviso) selAviso.textContent = cardAviso(selF);
  const rows = selectedFormats().map((f) => {
    if(advertisement?.enabled())return `<div class="fmt"><h3>${escHTML(f.nombre)}</h3><pre>${escHTML(JSON.stringify({state:advertisement.description(f),output:destino(f),copy:advertisement.entry(f)?.copy||[],approved:advertisement.ready(f),render:'native composition PNG → H264 still, no source crop'},null,2))}</pre></div>`;
    if (f.especial) return `<div class="fmt${f.id===state.sel?' sel':''}" data-plan="${f.id}" style="margin-bottom:8px"><h3>${f.nombre} · ${f.layout.entrega[0]}×${f.layout.entrega[1]}</h3><pre style="white-space:pre-wrap;font-size:11px;color:var(--link)">${especialInfo(f).plan.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c])}</pre></div>`;
    const p = plan(f); if(f.output==='png')return `<p>${f.nombre} · ${perfil(f).ancho}×${perfil(f).alto} · PNG${f.print?' · 150 ppp':''}${isPicture()&&f.category==='display'?' · JPG':''}${creando(f)?` · ${t('Crear','Create')} ${RECETA_NOMBRE[crearCfg(f).receta]} (${t('fotograma representativo','representative frame')})`:''}</p>`; if (!p || p.error) return `<p>${f.nombre}: ${p ? p.error : t('sin contenido','no content')}</p>`;
    if (creando(f)) return `<div class="fmt${f.id===state.sel?' sel':''}" data-plan="${f.id}" style="margin-bottom:8px"><h3>${f.nombre} · ${p.ancho}×${p.alto} · ${t('Crear','Create')} · ${RECETA_NOMBRE[crearCfg(f).receta]}</h3><div class="dims">H.264 ${p.h264Perfil}@${p.h264Nivel} · ${p.bitrateKbps} kbps · 25 fps · GOP ${p.gopSegundos}s</div><div class="aviso">${escHTML(crearAviso(f))}</div><pre style="white-space:pre-wrap;font-size:11px;color:var(--link)">${escHTML(crearCmd(f))}</pre></div>`;
    return `<div class="fmt${f.id===state.sel?' sel':''}" data-plan="${f.id}" style="margin-bottom:8px"><h3>${f.nombre} · ${p.ancho}×${p.alto}</h3>
      <div class="dims">encaje <b>${p.encaje}</b> · adaptación <b>${p.adaptacion}</b> · recorte ${Math.round(p.recortePerdido * 100)}%<br>
      H.264 ${p.h264Perfil}@${p.h264Nivel} · ${p.bitrateKbps} kbps (${p.bitrateMotivo}) · ${p.fps} fps · GOP ${p.gopSegundos}s${isImage() ? ` · ${t('imagen fija','still image')} ${stillSec} s · ${t('sin audio','no audio')}` : isAnim() ? ` · ${t('GIF animado','animated GIF')} ${secLabel(animSeconds)} s → 25 fps · ${t('sin audio','no audio')}` : ''}</div>
      <div class="aviso">${(p.avisos || []).map(a=>/generativ|imagina/i.test(a)?t('Fondo desenfocado derivado del original; sin expansión IA.','Blurred background derived from the original; no AI expansion.'):a).join(' · ')}</div><pre style="white-space:pre-wrap;font-size:11px;color:var(--link)">${ffmpegCmd(f)}</pre></div>`;
  });
  $('#plan-tecnico').innerHTML = rows.join('');
  advertisement?.sync();
}
// Every export button says what will come out: PNG/JPG, or MP4 (with its length for a still image).
function labelExports() {
  const sec = isImage() ? ` · ${stillSec} s` : isAnim() ? ` · ${secLabel(animSeconds)} s` : '';
  const mp4Title = isImage() ? t(`MP4 H.264 · 25 fps · ${stillSec} s · imagen fija, sin audio`,`MP4 H.264 · 25 fps · ${stillSec} s · still image, no audio`)
    : isAnim() ? t(`MP4 H.264 · 25 fps · ${secLabel(animSeconds)} s · GIF animado, sin audio`,`MP4 H.264 · 25 fps · ${secLabel(animSeconds)} s · animated GIF, no audio`)
    : t('MP4 H.264 con el audio del original, si existe','MP4 H.264 with the original audio, if any');
  document.querySelectorAll('#grid .fmt[data-f]').forEach(el => {
    const f = FORMATOS.find(x => x.id === el.dataset.f); if (!f) return;
    if (f.especial) {
      const g = geometry(f.layout), [W, H] = f.layout.entrega, [cw, ch] = f.layout.celda;
      const a = el.querySelector('.export-atlas'), s = el.querySelector('.export-segments');
      const crea = creando(f), rs = crea ? ` · ${secLabel(duracionReceta(crearCfg(f), {kind: srcKindCrear(), seconds: recetaSeconds(), src: state.src, dst: destino(f)}))} s` : sec, rt = crea ? ` · ${RECETA_NOMBRE[crearCfg(f).receta]}` : '';
      if (a) { a.textContent = `${t('Exportar entrega · 1 MP4','Export delivery · 1 MP4')} ${W}×${H}${rs}`; a.title = mp4Title + rt; }
      if (s) { s.textContent = `${t('Exportar por pantalla','Export per screen')} · ${g.segments.length} MP4 ${cw}×${ch}${rs}`; s.title = t('MP4 H.264 · 25 fps · sin audio','MP4 H.264 · 25 fps · no audio') + rs + rt; }
      return;
    }
    const b = el.querySelector('.export-one:not(.export-jpg)'); if (!b) return;
    const crea = creando(f), cfg = crearCfg(f);
    if (f.output === 'png') { b.textContent = t('Exportar PNG','Export PNG'); b.title = (f.print ? t('PNG RGB a 150 ppp','RGB PNG at 150 ppi') : 'PNG') + (crea ? ` · ${RECETA_NOMBRE[cfg.receta]} · ${t('fotograma representativo','representative frame')}` : ''); }
    else if (crea) { const d = duracionReceta(cfg, {kind: srcKindCrear(), seconds: recetaSeconds(), src: state.src, dst: destino(f)}); b.textContent = `${t('Crear MP4','Create MP4')} · ${secLabel(d)} s`; b.title = `${RECETA_NOMBRE[cfg.receta]} · MP4 H.264 · 25 fps · ${secLabel(d)} s`; }
    else { b.textContent = `${t('Exportar MP4','Export MP4')}${sec}`; b.title = mp4Title; }
    const j = el.querySelector('.export-jpg'); if (j) j.hidden = !isPicture();
  });
}
// The command the plan shows: the same rewrite the export applies (still image or animated GIF).
// For an SVG the real source is the raster of each format; the plan shows the base size.
function pictureJob(job) { return isAnim() ? animJob(job, animSeconds, 'input.gif') : isImage() ? stillJob(job, stillSec, svgSrc ? 'input.png' : stillInput.input) : job; }
const secLabel = v => (Math.round(v * 100) / 100).toLocaleString(EN ? 'en-US' : 'es-ES', {maximumFractionDigits: 2});
function ffmpegCmd(f) {
  if(!state.src.ancho) return '';
  if(creando(f)) return crearCmd(f);
  const base=exportJob(state.src,perfil(f),plan(f)||{},modoEfectivo(f),state.fmt[f.id],state.srcName,f.id);
  const job=pictureJob(studio?.background(f)?aiJob(base,state.src,perfil(f),state.fmt[f.id],studio.background(f).url):base);
  return 'ffmpeg ' + job.args.map(arg=>JSON.stringify(arg==='output.mp4'?job.filename:arg)).join(' ');
}

// ── Render en vivo (canvas) ─────────────────────────────────────────────────
function drawInto(cv, f, override) { if(advertisement?.draw(cv,f))return null; if (creando(f)) return paintCrear(cv, perfil(f), f, null, override); paint(cv, perfil(f), modoEfectivo(f), state.fmt[f.id], override,studio?.background(f)?.el); return null; }
// What the preview draws: the media element, or for an SVG a raster at this canvas' needed resolution
// (cached in √2 steps; the base image is used for the frame or two until it arrives).
const SVG_PREVIEW = {paso: true, maxLado: 4096, maxPx: 2048 * 2048};
function drawSource(W, H, mode, s) {
  if (!svgSrc || !svgRasters) return {el: media(), dims: state.src};
  const r = PF.svgRaster(svgSrc.medidas, W, H, mode, s, SVG_PREVIEW);
  const c = svgRasters.get(r.ancho, r.alto, () => { drawDirty = true; });
  return c ? {el: c, dims: {ancho: c.width, alto: c.height}} : {el: img, dims: state.src};
}
function paint(cv, output, m, s, override, background) {
  const ctx = cv.getContext('2d'), W = cv.width, H = cv.height;
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  if (!mediaReady()) return;
  const ratio=W/output.ancho;
  const {el: src, dims} = override || drawSource(W, H, m, s);
  const drawRect=(mode,settings)=>{const r=rect(dims,output.ancho,output.alto,mode,settings);return [r.x*ratio,r.y*ratio,r.w*ratio,r.h*ratio];};
  ctx.filter = 'none'; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  const drawCrop=settings=>{const c=cropWindow(dims,output.ancho,output.alto,settings);ctx.drawImage(src,c.x,c.y,c.w,c.h,0,0,W,H);};
  if (background) { ctx.drawImage(background,0,0,W,H);ctx.drawImage(src,...drawRect('contain',{...s,zoom:1}));return; }
  if (m === 'cover') { drawCrop(s); return; }
  if (m === 'blur') { ctx.filter = `blur(${14*Math.max(output.ancho,output.alto)/384*ratio}px) brightness(0.85)`; drawCrop({zoom:1.1,fx:.5,fy:.5}); ctx.filter = 'none'; }
  ctx.drawImage(src, ...drawRect('contain',s));
}
// Preview only: the wall is painted once, then every screen is copied into its
// delivery cell, exactly as the encoder cuts them. Cut lines and numbers are overlays.
function drawEspecial(el, f) {
  const wall = el.querySelector('canvas.wall'), atlas = el.querySelector('canvas.atlas'); if (!wall || !mediaReady()) return null;
  // Crear: the recipe is painted on the physical wall and the delivery copies its cuts, so both animate.
  const g = geometry(f.layout); let info = null; if(advertisement?.draw(wall,f)){} else if (creando(f)) info = paintCrear(wall, wallOutput(f), f); else paint(wall, wallOutput(f), modoEfectivo(f), state.fmt[f.id],null,studio?.background(f)?.el);
  const k = wall.width / g.pared.ancho, a = atlas.width / g.entrega.ancho, ctx = atlas.getContext('2d');
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, atlas.width, atlas.height);
  for (const seg of g.segments) ctx.drawImage(wall, seg.wall.x * k, seg.wall.y * k, seg.wall.w * k, seg.wall.h * k, seg.atlas.x * a, seg.atlas.y * a, seg.atlas.w * a, seg.atlas.h * a);
  const label = (c, x, y, text, size) => { c.font = `700 ${size}px ui-monospace,monospace`; const w = c.measureText(text).width + size * .8; c.fillStyle = 'rgba(6,13,20,.82)'; c.fillRect(x + 3, y + 3, w, size * 1.5); c.fillStyle = '#71f4dc'; c.fillText(text, x + 3 + size * .4, y + 3 + size * 1.13); };
  const wc = wall.getContext('2d'); wc.strokeStyle = '#71f4dc'; wc.lineWidth = 2; wc.setLineDash([8, 6]);
  for (const seg of g.segments) { if (seg.n > 1) { wc.beginPath(); wc.moveTo(seg.wall.x * k, 0); wc.lineTo(seg.wall.x * k, wall.height); wc.stroke(); } label(wc, seg.wall.x * k, seg.wall.y * k, String(seg.n), Math.round(Math.min(wall.height * .17, seg.wall.w * k / 3))); }
  ctx.strokeStyle = '#71f4dc'; ctx.lineWidth = 1; ctx.setLineDash([5, 4]);
  for (const seg of g.segments) { ctx.strokeRect(seg.atlas.x * a + .5, seg.atlas.y * a + .5, seg.atlas.w * a - 1, seg.atlas.h * a - 1); label(ctx, seg.atlas.x * a, seg.atlas.y * a, String(seg.n), Math.max(10, Math.min(18, seg.atlas.w * a / 6))); }
  ctx.setLineDash([]); ctx.strokeStyle = '#ff6a3d';
  for (const c of g.unused) { const [x, y, w, h] = [c.x * a, c.y * a, c.w * a, c.h * a]; ctx.fillStyle = '#111'; ctx.fillRect(x, y, w, h); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y + h); ctx.moveTo(x + w, y); ctx.lineTo(x, y + h); ctx.stroke(); }
  return info;
}
// ── Crear (formatos extremos, 6-oct-2026) ───────────────────────────────────
// Con r = max(a_src/a_dst, a_dst/a_src) ≥ UMBRAL_CREAR la tarjeta pasa de «Adaptar» a «Crear» y ofrece
// tres recetas (crear-core.mjs): tira de momentos, barrido y rótulo en movimiento. La vista previa
// pinta con las mismas funciones que generan el filtro FFmpeg (geometría, trayectoria y desplazamiento).
const RECETA_NOMBRE = {tira: t('Tira de momentos', 'Moments strip'), barrido: t('Barrido', 'Pan sweep'), rotulo: t('Rótulo en movimiento', 'Moving ticker')};
const RECETA_CORTA = {tira: t('Tira', 'Strip'), barrido: t('Barrido', 'Sweep'), rotulo: t('Rótulo', 'Ticker')};
const crearInput = {name: 'input'};
const srcKindCrear = () => isAnim() ? 'anim' : isImage() ? 'still' : 'video';
const recetaSeconds = () => isAnim() ? animSeconds : isImage() ? stillSec : (Number.isFinite(video.duration) ? video.duration : 0);
// Destination used for the disproportion: the output size, or the physical wall for segmented walls.
function destino(f) { if (f.especial) { const g = geometry(f.layout); return {ancho: g.pared.ancho, alto: g.pared.alto}; } const p = perfil(f); return {ancho: p.ancho, alto: p.alto}; }
// Receta explícita de la ficha (Altadis, 6-oct-2026): en «auto» fuerza «Crear» aunque r < umbral; la tarjeta
// puede forzar «Adaptar». Ver crear-core · motivoAccion y docs/adaptador.md.
const recetaFicha = f => RECETAS.includes(f.receta) ? f.receta : null;
const accionDe = f => accionEfectiva(crearCfg(f), state.src, destino(f), recetaFicha(f));
const creando = f => !advertisement?.enabled() && !studio?.background(f) && !!state.src.ancho && accionDe(f) === 'crear';
const crearZoom = f => { const c = crearCfg(f), s = state.fmt[f.id]; return {fx: .5, fy: .5, zoom: Math.max(s.zoom, c.receta === 'tira' ? c.tira.zoom : 1)}; };
function crearArgs(f, src = state.src) {
  const kind = srcKindCrear();
  return {kind, src, s: state.fmt[f.id], cfg: crearCfg(f), seconds: recetaSeconds(), input: crearInput.name !== 'input' || kind === 'video' ? crearInput.name : kind === 'anim' ? 'input.gif' : 'input.png'};
}
const fmtNum = (v, d = 1) => Number(v).toLocaleString(EN ? 'en-US' : 'es-ES', {maximumFractionDigits: d});
// ── Previo animado (Carlos, 6-oct-2026) ──
// Cada tarjeta en «Crear» tiene su reloj de previsualización (crear-core · relojPrevio): corre en bucle sobre
// la duración de la receta con imagen fija, SVG, GIF y con el vídeo en pausa. Mientras el vídeo se reproduce,
// la tarjeta sigue al vídeo como siempre, salvo que se pulse ▶ (entonces manda su reloj). ▶/⏸ y la barra de
// tiempo pasan la tarjeta a control manual; al volver a reproducir el vídeo, todas vuelven a seguirlo.
// prefers-reduced-motion: arranca en pausa en el fotograma representativo y lo indica. Solo se repintan
// cada fotograma las tarjetas visibles (IntersectionObserver).
function previoDe(f) {
  let p = previos.get(f.id);
  if (!p) previos.set(f.id, p = {reloj: relojPrevio({duracion: 1, ahora: performance.now()}), manual: false, reanudar: false, arrastre: false});
  return p;
}
// Instante que pinta la tarjeta: {t, modo: 'reloj' | 'video' | 'rep', corre}.
function tiempoPrevio(f, dur, rep) {
  const pv = previoDe(f), ahora = performance.now();
  relojDuracion(pv.reloj, dur, ahora);
  if (!pv.manual) {
    if (srcKind === 'video' && !video.paused) { const t = (video.currentTime || 0) % dur; relojSeek(pv.reloj, t, ahora); return {t, modo: 'video', corre: true}; }
    if (movimientoReducido) { relojPausa(pv.reloj, ahora); relojSeek(pv.reloj, rep, ahora); return {t: rep, modo: 'rep', corre: false}; }
    relojPlay(pv.reloj, ahora);
  }
  return {t: relojT(pv.reloj, ahora), modo: 'reloj', corre: relojEnMarcha(pv.reloj)};
}
// Fotogramas del vídeo para la tira (momentos) y la miniatura del rótulo: un <video> oculto con la misma
// URL que busca cada instante y lo copia a un canvas (máx. 1920 px de ancho).
let grab = null;
function grabber() {
  const url = srcKind === 'video' ? (video.currentSrc || video.getAttribute('src')) : null;
  if (!url) return null;
  if (grab && grab.url === url) return grab;
  dropGrabber();
  const v = document.createElement('video'); v.muted = true; v.preload = 'auto'; v.playsInline = true; v.crossOrigin = 'anonymous'; v.src = url;
  grab = {url, video: v, cache: new Map(), pend: new Map(), cola: Promise.resolve()};
  return grab;
}
function dropGrabber() { if (grab) { try { grab.video.removeAttribute('src'); grab.video.load(); } catch (_) {} grab = null; } }
const once = (el, ev, ms = 8000) => new Promise((resolve, reject) => { const tm = setTimeout(() => reject(new Error('timeout')), ms); el.addEventListener(ev, () => { clearTimeout(tm); resolve(); }, {once: true}); });
async function capturar(g, t) {
  const v = g.video;
  if (v.readyState < 1) await once(v, 'loadedmetadata');
  // Inside the frame that starts at t (FFmpeg -ss t takes that same frame).
  const target = Math.max(0, Math.min(t + .005, (v.duration || t + 1) - .001));
  if (Math.abs(v.currentTime - target) > 1e-4 || v.readyState < 2) { const p = once(v, 'seeked'); v.currentTime = target; await p; }
  const q = Math.min(1, 1920 / v.videoWidth), c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(v.videoWidth * q)); c.height = Math.max(1, Math.round(v.videoHeight * q));
  c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
  return c;
}
function fotogramaAsync(t) {
  const g = grabber(); if (!g) return Promise.resolve(null);
  const k = t.toFixed(3);
  if (g.cache.has(k)) return Promise.resolve(g.cache.get(k));
  if (!g.pend.has(k)) g.pend.set(k, g.cola = g.cola.catch(() => {}).then(() => capturar(g, t)).then(c => { if (grab === g) { g.cache.set(k, c); drawDirty = true; } return c; }).finally(() => g.pend.delete(k)));
  return g.pend.get(k);
}
function fotograma(t) { const g = grabber(); if (!g) return null; const c = g.cache.get(t.toFixed(3)); if (c) return c; fotogramaAsync(t).catch(() => {}); return null; }
// Tira con «tramos en bucle»: un <video> oculto por tramo que sigue al reloj del vídeo principal.
const tramoVids = new Map();
function tramoVideo(inicio) {
  const url = video.currentSrc || video.getAttribute('src'), k = `${url}|${inicio}`;
  let v = tramoVids.get(k);
  if (!v) { v = document.createElement('video'); v.muted = true; v.preload = 'auto'; v.playsInline = true; v.crossOrigin = 'anonymous'; v.src = url; v.currentTime = inicio; tramoVids.set(k, v); }
  return v;
}
function dropTramos() { tramoVids.forEach(v => { try { v.pause(); v.removeAttribute('src'); v.load(); } catch (_) {} }); tramoVids.clear(); }
// Rótulo: tipografía del sitio o la de la marca blanca activa (--mb-fuente-titulos).
function fuenteRotulo() {
  const cs = getComputedStyle(document.body), mb = cs.getPropertyValue('--mb-fuente-titulos').trim();
  return mb || cs.fontFamily || 'ui-monospace, monospace';
}
let logo = null; // {el, ancho, alto, key}: logo subido para el rótulo (solo en memoria)
function rotuloTextos(cfg) {
  const a = cfg.rotulo.texto.trim() || state.origin.title || state.srcName.replace(/\.[^.]+$/, '') || 'Pixeria', b = cfg.rotulo.textoEn.trim();
  return b ? [a, b] : [a];
}
function rotuloIcono(cfg) {
  if (cfg.rotulo.icono === 'logo') return logo;
  if (cfg.rotulo.icono !== 'miniatura' || !mediaReady()) return null;
  if (srcKind === 'video') {
    const tm = tiraMomentos(recetaSeconds() || 1, 1)[0], c = fotograma(tm);
    return c ? {el: c, ancho: c.width, alto: c.height, key: `v${tm}`} : null;
  }
  const {el, dims} = drawSource(Math.min(1280, state.src.ancho), Math.min(1280, state.src.alto), 'contain', defaults());
  return {el, ancho: dims.ancho, alto: dims.alto, key: `p${state.srcName}|${dims.ancho}`};
}
const stripCache = new Map(), measureCtx = document.createElement('canvas').getContext('2d');
function rotuloStrip(f, out) {
  const cfg = crearCfg(f), ic = rotuloIcono(cfg), textos = rotuloTextos(cfg), font = fuenteRotulo();
  const key = JSON.stringify([out.ancho, out.alto, textos, cfg.rotulo.color, ic ? ic.key : null, font]);
  if (stripCache.has(key)) return stripCache.get(key);
  const medir = (txt, px) => { measureCtx.font = `700 ${px}px ${font}`; return measureCtx.measureText(txt).width; };
  const layout = rotuloLayout({W: out.ancho, H: out.alto, textos, icono: ic ? {ancho: ic.ancho, alto: ic.alto} : null, medir});
  const canvas = document.createElement('canvas'); canvas.width = layout.ancho; canvas.height = layout.alto;
  const x = canvas.getContext('2d');
  x.textBaseline = 'middle'; x.fillStyle = cfg.rotulo.color;
  for (let r = 0; r < layout.reps; r++) {
    const dx = layout.eje === 'x' ? r * layout.P : 0, dy = layout.eje === 'y' ? r * layout.P : 0;
    for (const op of layout.ops) {
      if (op.tipo === 'icono') { x.shadowColor = 'transparent'; x.drawImage(ic.el, dx + op.x, dy + op.y, op.w, op.h); continue; }
      x.shadowColor = 'rgba(0,0,0,.55)'; x.shadowBlur = Math.round(layout.medidas.fuente * .12);
      if (op.tipo === 'sep') { x.fillRect(dx + op.x, dy + op.y, op.w, op.h); continue; }
      x.font = `700 ${op.px}px ${font}`; x.textAlign = op.centrado ? 'center' : 'left'; x.fillText(op.texto, dx + op.x, dy + op.y);
    }
  }
  const st = {canvas, layout};
  stripCache.set(key, st);
  if (stripCache.size > 8) stripCache.delete(stripCache.keys().next().value);
  return st;
}
const rotuloLayoutDe = (f, out) => crearCfg(f).receta === 'rotulo' ? rotuloStrip(f, out).layout : null;
// Before exporting: the frames of the strip and the ticker thumbnail must be captured.
async function prepararCrear(f, out) {
  const cfg = crearCfg(f), seconds = recetaSeconds();
  if (srcKind === 'video' && cfg.receta === 'tira' && !cfg.tira.bucle) await Promise.all(tiraMomentos(seconds, tiraN(state.src, out, cfg.tira.n)).map(fotogramaAsync));
  if (srcKind === 'video' && cfg.receta === 'rotulo' && cfg.rotulo.icono === 'miniatura') await fotogramaAsync(tiraMomentos(seconds || 1, 1)[0]);
  if (document.fonts?.ready) await document.fonts.ready;
}
// Paints a recipe at time t ('rep' = representative frame for PNG/JPG; a number = that instant; null = the
// card's preview clock). Every instant goes through previoN/previoFotograma: frame n of the MP4, the same
// window, offset and alphas the FFmpeg plan computes. Returns {t, dur, modo, corre} for the time bar.
function paintCrear(cv, output, f, tFixed = null, override = null) {
  const ctx = cv.getContext('2d'), W = cv.width, H = cv.height, ratio = W / output.ancho;
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.filter = 'none'; ctx.globalAlpha = 1; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  if (!mediaReady()) return null;
  const cfg = crearCfg(f), s = state.fmt[f.id], kind = srcKindCrear(), seconds = recetaSeconds() || 1, dur = duracionReceta(cfg, {kind, seconds, src: state.src, dst: output});
  const {el: src, dims} = override || drawSource(W, H, 'cover', crearZoom(f));
  const p = cfg.receta === 'barrido' ? barridoPlan(dims, output.ancho, output.alto, s, cfg, dur) : null;
  const rep = tiempoRepresentativo(cfg, dur, p);
  const info = tFixed === 'rep' ? {t: rep, modo: 'rep', corre: false} : tFixed != null ? {t: tFixed, modo: 'fijo', corre: false} : tiempoPrevio(f, dur, rep);
  info.dur = dur;
  const n = previoN(info.t, dur);
  if (cfg.receta === 'barrido') {
    const r = previoFotograma({receta: 'barrido', barrido: p}, n).ventana.rect;
    ctx.drawImage(src, r.x, r.y, r.w, r.h, 0, 0, W, H);
    return info;
  }
  if (cfg.receta === 'rotulo') {
    if (cfg.rotulo.fondo === 'solido') { ctx.fillStyle = cfg.rotulo.fondoColor; ctx.fillRect(0, 0, W, H); }
    else {
      const c = cropWindow(dims, output.ancho, output.alto, {zoom: 1.1, fx: .5, fy: .5});
      ctx.filter = `blur(${14 * Math.max(output.ancho, output.alto) / 384 * ratio}px) brightness(0.85)`; ctx.drawImage(src, c.x, c.y, c.w, c.h, 0, 0, W, H); ctx.filter = 'none';
    }
    const st = rotuloStrip(f, output), L = st.layout, off = previoFotograma({receta: 'rotulo', rotulo: {v: rotuloVelocidad(cfg, output.ancho, output.alto), P: L.P}}, n).desplazamiento;
    if (L.eje === 'x') ctx.drawImage(st.canvas, off, 0, output.ancho, output.alto, 0, 0, W, H);
    else ctx.drawImage(st.canvas, 0, off, output.ancho, output.alto, 0, 0, W, H);
    return info;
  }
  // Tira de momentos.
  const nP = tiraN(dims, output, cfg.tira.n), g = tiraGeometria(output.ancho, output.alto, nP, cfg.tira.sep), c = cascada(dur, nP);
  const rec = tiraRecortes(dims, g.celdas, kind, s, cfg);
  const momentos = kind === 'video' && !cfg.tira.bucle ? tiraMomentos(seconds, nP) : null, tramos = kind === 'video' && cfg.tira.bucle ? tiraTramos(seconds, nP) : null;
  const fr = previoFotograma({receta: 'tira', tira: g, cascada: c, tramos, momentos}, n);
  g.celdas.forEach((cell, i) => {
    const a = fr.alfas[i]; if (a <= 0) return;
    let el = src, q = 1;
    if (momentos) { el = fotograma(momentos[i]); if (!el) return; q = el.width / dims.ancho; }
    else if (tramos) {
      el = tramoVideo(tramos.inicios[i]);
      // Plays with the clock that drives the card (video or preview); paused or fixed, it seeks the exact frame.
      const target = fr.origen[i], corre = info.corre && tFixed == null;
      if (el.readyState >= 1 && Math.abs(el.currentTime - target) > (corre ? .3 : .02)) el.currentTime = target;
      if (!corre) { if (!el.paused) el.pause(); } else if (el.paused) el.play().catch(() => {});
      if (el.readyState < 2) return;
      q = el.videoWidth / dims.ancho;
    }
    const r = rec[i];
    ctx.globalAlpha = a; ctx.drawImage(el, r.x * q, r.y * q, r.w * q, r.h * q, cell.x * ratio, cell.y * ratio, cell.w * ratio, cell.h * ratio);
  });
  ctx.globalAlpha = 1;
  return info;
}
function resetCrearMedia() { dropGrabber(); dropTramos(); stripCache.clear(); }
if (document.fonts?.ready) document.fonts.ready.then(() => { stripCache.clear(); drawDirty = true; });
// Card controls: [Adaptar | Crear] and, in Crear, the three recipes. The visible «Crear» tag and the
// disproportion live in the title. Forcing either action is per card and persists.
function crearControls(f) {
  const box = document.createElement('div'); box.className = 'crear-ctl';
  box.innerHTML = `${previoHTML(f)}<div class="accion-seg" role="group" aria-label="${t('Adaptar o crear', 'Adapt or create')} · ${escHTML(f.nombre)}"><button type="button" class="accion-btn" data-accion="adaptar" aria-pressed="false">${t('Adaptar', 'Adapt')}</button><button type="button" class="accion-btn" data-accion="crear" aria-pressed="false">${t('Crear', 'Create')}</button></div>
    <div class="recetas" role="group" aria-label="${t('Receta', 'Recipe')} · ${escHTML(f.nombre)}" hidden>${RECETAS.map(r => `<button type="button" class="receta-btn" data-receta="${r}" aria-pressed="false" title="${RECETA_NOMBRE[r]}">${RECETA_CORTA[r]}</button>`).join('')}</div>`;
  box.querySelectorAll('.accion-btn').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); crearCfg(f).accion = b.dataset.accion; pickCard(f); refreshInfo(); syncCrearSettings(); }));
  box.querySelectorAll('.receta-btn').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); const c = crearCfg(f); c.receta = b.dataset.receta; if (c.accion === 'adaptar') c.accion = 'crear'; pickCard(f); refreshInfo(); syncCrearSettings(); }));
  bindPrevio(box, f);
  return box;
}
// Previo animado: ▶ Previsualizar animación / ⏸, barra fina (arrastrar o clic: cualquier instante) y «0:04 / 0:10».
const previoHTML = f => `<div class="previo" hidden><button type="button" class="previo-btn" aria-pressed="false">${t('▶ Previsualizar animación', '▶ Preview animation')}</button>
  <input type="range" class="previo-pos" min="0" max="1" step="0.04" value="0" aria-label="${t('Instante del previo', 'Preview instant')} · ${escHTML(f.nombre)}">
  <output class="previo-t" aria-live="off">0:00 / 0:00</output><span class="previo-nota" hidden></span></div>`;
const previoCorre = info => !!info && info.modo === 'reloj' && info.corre;
function bindPrevio(box, f) {
  const btn = box.querySelector('.previo-btn'), pos = box.querySelector('.previo-pos');
  btn.addEventListener('click', e => {
    e.stopPropagation();
    const pv = previoDe(f), info = ultimaInfo.get(f.id), ahora = performance.now();
    if (previoCorre(info)) relojPausa(pv.reloj, ahora);
    else { if (info) relojSeek(pv.reloj, info.t, ahora); relojPlay(pv.reloj, ahora); }
    pv.manual = true; drawDirty = true;
  });
  pos.addEventListener('click', e => e.stopPropagation());
  pos.addEventListener('pointerdown', () => { const pv = previoDe(f), ahora = performance.now(); pv.arrastre = true; pv.reanudar = previoCorre(ultimaInfo.get(f.id)); relojPausa(pv.reloj, ahora); pv.manual = true; });
  const soltar = () => { const pv = previoDe(f); if (!pv.arrastre) return; pv.arrastre = false; if (pv.reanudar) relojPlay(pv.reloj, performance.now()); pv.reanudar = false; drawDirty = true; };
  pos.addEventListener('pointerup', soltar); pos.addEventListener('pointercancel', soltar); pos.addEventListener('change', soltar);
  pos.addEventListener('input', () => { const pv = previoDe(f); pv.manual = true; relojSeek(pv.reloj, +pos.value, performance.now()); drawDirty = true; });
}
// Time bar of a card, after it is painted.
function syncPrevio(el, f, info) {
  const box = el.querySelector('.previo'); if (!box) return;
  const crea = !!info && creando(f);
  if (box.hidden === crea) box.hidden = !crea;
  if (!crea) { ultimaInfo.delete(f.id); return; }
  ultimaInfo.set(f.id, info);
  const pv = previoDe(f), corre = previoCorre(info), btn = box.querySelector('.previo-btn'), pos = box.querySelector('.previo-pos');
  const label = corre ? t('⏸ Pausar animación', '⏸ Pause animation') : t('▶ Previsualizar animación', '▶ Preview animation');
  if (btn.textContent !== label) btn.textContent = label;
  btn.setAttribute('aria-pressed', String(corre));
  btn.title = info.modo === 'video' ? t('Sigue al vídeo. Pulsa para verla con su propio reloj.', 'Following the video. Press to use its own clock.') : '';
  const max = String(+info.dur.toFixed(3));
  if (pos.max !== max) pos.max = max;
  if (!pv.arrastre) pos.value = String(info.t);
  const txt = etiquetaTiempo(info.t, info.dur), out = box.querySelector('.previo-t');
  if (out.textContent !== txt) out.textContent = txt;
  const nota = box.querySelector('.previo-nota'), reducido = info.modo === 'rep' && movimientoReducido;
  const nt = reducido ? t('Movimiento reducido: el previo arranca en pausa. Pulsa ▶ para verlo.', 'Reduced motion: the preview starts paused. Press ▶ to play it.') : info.modo === 'video' ? t('Sigue al vídeo', 'Following the video') : '';
  if (nota.textContent !== nt) nota.textContent = nt;
  nota.hidden = !nt;
}
function crearTag(f) {
  const r = state.src.ancho ? desproporcion(state.src, destino(f)) : 0, cfg = crearCfg(f), crea = creando(f);
  const forced = cfg.accion !== 'auto', ficha = !forced && !!recetaFicha(f);
  return {crea, r, forced, text: crea ? `${t('Crear', 'Create')} · ${RECETA_CORTA[cfg.receta]}` : '',
    title: r ? `${t('Desproporción', 'Disproportion')} r = ${fmtNum(r, 2)} · ${t('umbral', 'threshold')} ${fmtNum(UMBRAL_CREAR, 1)}${forced ? ` · ${t('forzado', 'forced')}` : ficha ? ` · ${t('receta de la ficha del proyecto', 'project ficha recipe')}` : ` · ${t('automático', 'automatic')}`}` : ''};
}
// Keeps every card's tag, toggle and recipe chips in step with the state (called by refreshInfo).
function syncCrearCards() {
  document.querySelectorAll('#grid .fmt[data-f]').forEach(el => {
    const f = FORMATOS.find(x => x.id === el.dataset.f); if (!f) return;
    const tg = crearTag(f), cfg = crearCfg(f), ef = state.src.ancho ? accionDe(f) : null;
    const tag = el.querySelector('.accion-tag');
    if (tag) { tag.hidden = !tg.crea; tag.textContent = tg.text; tag.title = tg.title; }
    el.classList.toggle('fmt-crear', tg.crea);
    el.querySelectorAll('.accion-btn').forEach(b => { b.setAttribute('aria-pressed', String(ef === b.dataset.accion)); b.disabled = !state.src.ancho; b.classList.toggle('auto', cfg.accion === 'auto' && ef === b.dataset.accion); b.title = cfg.accion !== 'auto' ? t('Forzado en esta tarjeta', 'Forced on this card') : recetaFicha(f) ? t(`Automático: la ficha del proyecto pide ${RECETA_NOMBRE[recetaFicha(f)]}`, `Automatic: the project ficha asks for ${RECETA_NOMBRE[recetaFicha(f)]}`) + (tg.r ? ` (r = ${fmtNum(tg.r, 2)})` : '') : t(`Automático: Crear con r ≥ ${fmtNum(UMBRAL_CREAR)}`, `Automatic: Create when r ≥ ${fmtNum(UMBRAL_CREAR)}`) + (tg.r ? ` (r = ${fmtNum(tg.r, 2)})` : ''); });
    const rec = el.querySelector('.recetas'); if (rec) rec.hidden = !tg.crea;
    el.querySelectorAll('.receta-btn').forEach(b => b.setAttribute('aria-pressed', String(cfg.receta === b.dataset.receta)));
  });
}
// Avanzado · recipe settings of the selected card.
const crearHTML = () => `<div class="crear-set">
  <label class="crear-row"><span>${t('Acción', 'Action')}</span><select data-c="accion"><option value="auto"></option><option value="adaptar">${t('Adaptar (forzado)', 'Adapt (forced)')}</option><option value="crear">${t('Crear (forzado)', 'Create (forced)')}</option></select></label>
  <label class="crear-row"><span>${t('Receta', 'Recipe')}</span><select data-c="receta">${RECETAS.map(r => `<option value="${r}">${RECETA_NOMBRE[r]}</option>`).join('')}</select></label>
  <div class="crear-receta" data-receta="tira">
    <label class="crear-row"><span>${t('Piezas', 'Pieces')}</span><select data-c="tira.n"><option value="0"></option>${[3, 4, 5].map(n => `<option value="${n}">${n}</option>`).join('')}</select></label>
    <label class="crear-chk"><input type="checkbox" data-c="tira.sep"> ${t('Separación fina entre piezas', 'Thin gap between pieces')}</label>
    <label class="crear-chk crear-solo-video"><input type="checkbox" data-c="tira.bucle"> ${t('Cada pieza reproduce su tramo en bucle (la pieza dura un tramo)', 'Each piece loops its own segment (the piece lasts one segment)')}</label>
    <label class="crear-row crear-solo-imagen"><span>${t('Zoom de las zonas', 'Zone zoom')}</span><input type="range" data-c="tira.zoom" min="${TIRA.zoomMin}" max="${TIRA.zoomMax}" step="0.05"></label>
  </div>
  <div class="crear-receta" data-receta="barrido">
    <label class="crear-row"><span>${t('Recorrido', 'Path')}</span><select data-c="barrido.recorrido"><option value="ida">${t('Ida', 'One way')}</option><option value="vuelta">${t('Ida y vuelta', 'There and back')}</option></select></label>
    <label class="crear-row"><span>${t('Sentido', 'Direction')}</span><select data-c="barrido.sentido"><option value="1">${t('Normal (← → / ↓)', 'Normal (← → / ↓)')}</option><option value="-1">${t('Inverso', 'Reverse')}</option></select></label>
    <label class="crear-row"><span>${t('Paneo (s)', 'Pan (s)')}</span><input type="number" data-c="barrido.seg" min="0" max="600" step="0.5" inputmode="decimal" title="${t('0 = toda la pieza; menos segundos = más rápido', '0 = the whole piece; fewer seconds = faster')}"></label>
  </div>
  <div class="crear-receta" data-receta="rotulo">
    <label class="crear-row"><span>Claim ES</span><input type="text" data-c="rotulo.texto" maxlength="${ROTULO.maxTexto}" placeholder="${t('Título del contenido', 'Content title')}"></label>
    <label class="crear-row"><span>Claim EN</span><input type="text" data-c="rotulo.textoEn" maxlength="${ROTULO.maxTexto}" placeholder="${t('Opcional: se alterna', 'Optional: alternates')}"></label>
    <label class="crear-row"><span>${t('Velocidad', 'Speed')}</span><input type="range" data-c="rotulo.velocidad" min="${ROTULO.velMin}" max="${ROTULO.velMax}" step="0.25"></label>
    <label class="crear-row"><span>${t('Texto', 'Text')}</span><input type="color" data-c="rotulo.color"></label>
    <label class="crear-row"><span>${t('Fondo', 'Background')}</span><select data-c="rotulo.fondo"><option value="desenfocado">${t('Desenfocado del contenido', 'Blurred content')}</option><option value="solido">${t('Sólido', 'Solid')}</option></select></label>
    <label class="crear-row"><span>${t('Color fondo', 'Bg colour')}</span><input type="color" data-c="rotulo.fondoColor"></label>
    <label class="crear-row"><span>${t('Icono', 'Icon')}</span><select data-c="rotulo.icono"><option value="miniatura">${t('Miniatura del contenido', 'Content thumbnail')}</option><option value="logo">${t('Logo', 'Logo')}</option><option value="ninguno">${t('Ninguno', 'None')}</option></select></label>
    <label class="crear-row crear-logo"><span>${t('Logo', 'Logo')}</span><input type="file" data-logo accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"></label>
  </div>
</div>`;
const getPath = (o, p) => p.split('.').reduce((a, k) => a?.[k], o);
function setPath(o, p, v) { const ks = p.split('.'), last = ks.pop(); ks.reduce((a, k) => a[k], o)[last] = v; }
function bindCrear(box, f) {
  box.querySelectorAll('[data-c]').forEach(inp => {
    const path = inp.dataset.c;
    inp.setAttribute('aria-label', `${inp.closest('label')?.querySelector('span')?.textContent || path} · ${f.nombre}`);
    const apply = () => {
      const c = crearCfg(f), cur = getPath(c, path);
      let v = inp.type === 'checkbox' ? inp.checked : inp.value;
      if (typeof cur === 'number') v = Number(v);
      setPath(c, path, v);
      state.crear[f.id] = crearSettings(c, crearBase(f));
      if (path.startsWith('rotulo.') || path === 'receta') stripCache.clear();
      refreshInfo(); syncCrearSettings(inp);
    };
    inp.addEventListener(inp.type === 'text' || inp.type === 'range' || inp.type === 'color' || inp.type === 'number' ? 'input' : 'change', apply);
  });
  const file = box.querySelector('[data-logo]');
  if (file) file.addEventListener('change', async () => {
    const fl = file.files?.[0]; if (!fl) return;
    const url = URL.createObjectURL(fl), im = new Image();
    try { im.src = url; await im.decode(); logo = {el: im, ancho: im.naturalWidth || 512, alto: im.naturalHeight || 512, key: `logo:${fl.name}:${fl.size}`}; crearCfg(f).rotulo.icono = 'logo'; stripCache.clear(); refreshInfo(); syncCrearSettings(); }
    catch (_) { URL.revokeObjectURL(url); const a = box.closest('#card-settings')?.querySelector('.aviso'); if (a) a.textContent = t('No se pudo leer el logo.', 'Could not read the logo.'); }
  });
}
// Values and visible fieldsets of the Avanzado recipe form (except the field being typed in).
function syncCrearSettings(skip = null) {
  const box = $('#card-settings .crear-set'); if (!box) return;
  const f = FORMATOS.find(x => x.id === state.sel && x.on); if (!f) return;
  const c = crearCfg(f), crea = creando(f), r = state.src.ancho ? desproporcion(state.src, destino(f)) : 0;
  const auto = box.querySelector('[data-c="accion"] option[value="auto"]');
  const mot = motivoAccion({accion: 'auto'}, state.src, destino(f), recetaFicha(f));
  auto.textContent = `${t('Auto', 'Auto')} · ${!state.src.ancho ? (recetaFicha(f) ? t('Crear (receta de la ficha)', 'Create (ficha recipe)') : `${t('Crear si r ≥', 'Create if r ≥')} ${fmtNum(UMBRAL_CREAR)}`)
    : mot.motivo === 'ficha' ? `${t('Crear', 'Create')} (${t('receta de la ficha', 'ficha recipe')}: ${RECETA_NOMBRE[recetaFicha(f)]}; r = ${fmtNum(r, 2)})`
    : `${mot.accion === 'crear' ? t('Crear', 'Create') : t('Adaptar', 'Adapt')} (r = ${fmtNum(r, 2)}; ${t('umbral', 'threshold')} ${fmtNum(UMBRAL_CREAR)})`}`;
  const autoN = box.querySelector('[data-c="tira.n"] option[value="0"]');
  autoN.textContent = `${t('Auto', 'Auto')}${state.src.ancho ? ` (${tiraN(state.src, destino(f), 0)})` : ''}`;
  box.querySelectorAll('[data-c]').forEach(inp => {
    if (inp === skip) return;
    const v = getPath(c, inp.dataset.c);
    if (inp.type === 'checkbox') inp.checked = !!v; else inp.value = String(v);
  });
  box.querySelectorAll('.crear-receta').forEach(el => { el.hidden = !crea || el.dataset.receta !== c.receta; });
  box.querySelector('[data-c="receta"]').closest('label').hidden = !crea;
  box.querySelectorAll('.crear-solo-video').forEach(el => { el.hidden = srcKind !== 'video'; });
  box.querySelectorAll('.crear-solo-imagen').forEach(el => { el.hidden = srcKind === 'video'; });
  const lg = box.querySelector('.crear-logo'); if (lg) lg.hidden = c.rotulo.icono !== 'logo';
  const modo = $('#card-settings .ctl [data-k="modo"]');
  if (modo) { modo.disabled = crea; modo.title = crea ? t('El método es de «Adaptar»; en «Crear» manda la receta.', 'The method belongs to «Adapt»; in «Create» the recipe rules.') : ''; }
}
function pickCard(f) { if (state.sel === f.id) return; state.sel = f.id; markSelected(); buildCardSettings(); }
// Aviso of a recipe (Avanzado) and its plan (Experto).
function crearAviso(f) {
  const cfg = crearCfg(f), kind = srcKindCrear(), seconds = recetaSeconds(), out = destino(f), dur = duracionReceta(cfg, {kind, seconds, src: state.src, dst: out});
  const r = desproporcion(state.src, out), what = `${t('Crear', 'Create')} · ${RECETA_NOMBRE[cfg.receta]} · MP4 ${secLabel(dur)} s · 25 fps`;
  let how = '';
  if (cfg.receta === 'tira') {
    const n = tiraN(state.src, out, cfg.tira.n);
    how = kind === 'video' ? (cfg.tira.bucle ? t(`${n} tramos de ${secLabel(dur)} s en bucle, sin audio`, `${n} segments of ${secLabel(dur)} s looping, no audio`) : t(`${n} momentos del vídeo, sin audio`, `${n} moments of the video, no audio`)) : t(`${n} zonas del contenido (zoom ${fmtNum(cfg.tira.zoom, 2)})`, `${n} zones of the content (zoom ${fmtNum(cfg.tira.zoom, 2)})`);
    how += t(' · aparecen en cascada', ' · cascading in');
  } else if (cfg.receta === 'barrido') {
    const p = barridoPlan(state.src, out.ancho, out.alto, state.fmt[f.id], cfg, dur);
    how = `${t('paneo', 'pan')} ${p.eje === 'x' ? t('horizontal', 'horizontal') : t('vertical', 'vertical')} · ${cfg.barrido.recorrido === 'vuelta' ? t('ida y vuelta', 'there and back') : t('ida', 'one way')} · ${t('sin deformar', 'no distortion')}${kind === 'video' ? t(' · audio si existe', ' · audio if present') : ''}`;
  } else {
    how = `${t('claim', 'claim')} «${rotuloTextos(cfg).join(' / ').slice(0, 60)}» · ${fmtNum(rotuloVelocidad(cfg, out.ancho, out.alto), 0)} px/s · ${cfg.rotulo.fondo === 'solido' ? t('fondo sólido', 'solid background') : t('fondo desenfocado', 'blurred background')}${kind === 'video' ? t(' · audio si existe', ' · audio if present') : ''}`;
  }
  return `${what} · ${how} · r = ${fmtNum(r, 2)}${f.output === 'png' ? t(' · PNG/JPG: fotograma representativo', ' · PNG/JPG: representative frame') : ''}`;
}
function crearCmd(f) {
  try {
    const job = crearJob({...crearArgs(f), profile: perfil(f), technical: plan(f) || {}, name: state.srcName, id: f.id, rotulo: rotuloLayoutDe(f, perfil(f))});
    return 'ffmpeg ' + job.args.map(arg => JSON.stringify(arg === 'output.mp4' ? job.filename : arg)).join(' ');
  } catch (_) { return ''; }
}
let drawDirty=true,lastFrame=-1;
// Cards on screen (IntersectionObserver): only these are repainted every frame by the preview clocks.
function observarTarjetas(g) {
  visibles.clear();
  if (!('IntersectionObserver' in window)) return;
  io = io || new IntersectionObserver(entries => { for (const e of entries) { const id = e.target.dataset.f; if (e.isIntersecting) visibles.add(id); else visibles.delete(id); } }, {rootMargin: '120px 0px'});
  io.disconnect(); g.querySelectorAll('.fmt[data-f]').forEach(el => io.observe(el));
}
function pintarTarjeta(el, f) {
  let info = null;
  if (f.especial) info = drawEspecial(el, f); else { const c = el.querySelector('canvas'); if (c) info = drawInto(c, f); }
  syncPrevio(el, f, info);
}
function loop(now) {
  if(anim) anim.tick(now ?? performance.now());
  const frame = anim ? anim.frameNo : video.currentTime;
  if(drawDirty||frame!==lastFrame){
  document.querySelectorAll('.fmt[data-f]').forEach((el) => { const f = FORMATOS.find((x) => x.id === el.dataset.f); if (f) pintarTarjeta(el, f); });
  const oc = document.querySelector('#grid .fmt-original canvas');
  if (oc && (isPicture() ? mediaReady() : video.readyState >= 2)) { const {el} = drawSource(oc.width, oc.height, 'contain', defaults()); oc.getContext('2d').clearRect(0, 0, oc.width, oc.height); oc.getContext('2d').drawImage(el, 0, 0, oc.width, oc.height); }
  drawDirty=false;lastFrame=frame;
  } else {
    // Previo animado: only «Crear» cards whose own clock runs, and only the visible ones.
    document.querySelectorAll('#grid .fmt-crear[data-f]').forEach(el => {
      const id = el.dataset.f; if ((io && !visibles.has(id)) || !previoCorre(ultimaInfo.get(id))) return;
      const f = FORMATOS.find(x => x.id === id); if (f) pintarTarjeta(el, f);
    });
  }
  syncPrevioTodas();
  studio?.draw();twin?.draw();
  requestAnimationFrame(loop);
}
// «Previsualizar todas» (next to «Adaptar · N»): every «Crear» card from 0, in step; again, pauses them all.
previoTodas = document.createElement('button');
previoTodas.id = 'previo-todas'; previoTodas.type = 'button'; previoTodas.className = 'pill'; previoTodas.hidden = true;
$('#export-all').after(previoTodas);
const tarjetasCrear = () => [...document.querySelectorAll('#grid .fmt-crear[data-f]')].map(el => el.dataset.f);
function syncPrevioTodas() {
  if (!previoTodas) return;
  const ids = tarjetasCrear(), todas = ids.length > 0 && ids.every(id => previoCorre(ultimaInfo.get(id)));
  if (previoTodas.hidden !== !ids.length) previoTodas.hidden = !ids.length;
  const label = todas ? t('⏸ Pausar todas', '⏸ Pause all') : t(`▶ Previsualizar todas · ${ids.length}`, `▶ Preview all · ${ids.length}`);
  if (previoTodas.textContent !== label) previoTodas.textContent = label;
  previoTodas.setAttribute('aria-pressed', String(todas));
  previoTodas.title = t('Anima a la vez todas las tarjetas en «Crear», desde el principio', 'Plays every «Create» card at once, from the start');
}
previoTodas.addEventListener('click', () => {
  const ids = tarjetasCrear(), ahora = performance.now(), todas = ids.length > 0 && ids.every(id => previoCorre(ultimaInfo.get(id)));
  for (const id of ids) {
    const f = FORMATOS.find(x => x.id === id); if (!f) continue;
    const pv = previoDe(f); pv.manual = true;
    if (todas) relojPausa(pv.reloj, ahora); else { relojSeek(pv.reloj, 0, ahora); relojPlay(pv.reloj, ahora); }
  }
  drawDirty = true;
});
// Playing the video again: every card follows it, as before.
video.addEventListener('play', () => { previos.forEach(p => { p.manual = false; }); drawDirty = true; });

// ── Fuente ──────────────────────────────────────────────────────────────────
let sourceObjectURL = null;
// El <video id="src"> y la <img id="src-img"> son crossorigin (se pintan en canvas y se codifican). Si el mismo MP4 se pidió antes sin
// CORS (miniatura, Stock, otra pestaña), el navegador puede reutilizar esa copia sin Access-Control-Allow-Origin
// y el vídeo falla con «No se pudo reproducir». Una URL propia del modo CORS nunca comparte caché con ella.
function corsURL(url) {
  if (!/^https?:\/\//.test(url)) return url;
  try { const u = new URL(url); if (u.origin === location.origin) return url; u.searchParams.set('cors', '1'); return u.href; } catch (_) { return url; }
}
// La fuente activa, para ficha-tecnica.js: evento pixeria:fuente (fase 'inicio' y 'listo').
function publicarFuente(fase) {
  window.PixeriaAdaptador.fuente = fuente;
  try { document.dispatchEvent(new CustomEvent('pixeria:fuente', {detail: {fase, fuente}})); } catch (_) {}
}
let previewEngine = null;
function stopAnim() {
  if (anim) { anim.close(); anim = null; }
  if (animStage) { animStage.replaceChildren(); animStage.hidden = true; }
  if (previewEngine) previewEngine.cancel();
  animSourceURL = null; animSeconds = 0;
}
function releaseDerived() {
  if (derivedURL && !queue.uses(derivedURL)) URL.revokeObjectURL(derivedURL);
  derivedURL = null;
}
function setSource(url, name, origin = {id:null,title:name}, kind = 'video', ext = 'png', extra = null) {
  advertisement?.clear();studio?.clear();twin?.close();
  state.origin = {id:origin.id||null,title:origin.title||name};
  releaseStill(); releaseDerived(); stopAnim(); resetCrearMedia();
  if (svgRasters) { svgRasters.clear(); svgRasters = null; }
  svgSrc = extra?.svgTexto ? {texto: extra.svgTexto, medidas: extra.svg} : null;
  if (svgSrc) svgRasters = svgCache(svgSrc.texto);
  // A local file still being exported keeps its blob URL until its last queue line ends.
  if (sourceObjectURL && sourceObjectURL !== url && !queue.uses(sourceObjectURL)) URL.revokeObjectURL(sourceObjectURL);
  sourceObjectURL = url.startsWith('blob:') ? url : null;
  $('#export-status').textContent='';
  state.src = {ancho:0,alto:0,fps:25,bitrateKbps:0};
  srcKind = kind === 'image' ? 'image' : kind === 'anim' ? 'anim' : 'video'; srcExt = ext;
  fuente = extra ? {...extra} : {tipo: srcKind === 'video' ? 'video' : 'imagen', nombre: name, url: url.startsWith('blob:') ? null : url, file: null, ext};
  fuente.imgSrc = srcKind === 'image' ? corsURL(url) : null;
  const loading = isAnim() ? t('Leyendo el GIF animado…','Reading the animated GIF…') : isImage() ? t('Cargando imagen…','Loading image…') : t('Cargando vídeo…','Loading video…');
  $('#src-info').textContent = loading; $('#src-msg').textContent = loading;
  state.srcName = name; syncKind(); refreshInfo();
  publicarFuente('inicio');
  if (isImage()) {
    // Free the previous video (its «emptied» must not hide the image's spec sheet: ficha-tecnica.js checks #src-img).
    img.src = corsURL(url);
    if (video.getAttribute('src')) { video.pause(); video.removeAttribute('src'); video.load(); }
  } else if (isAnim()) {
    img.removeAttribute('src');
    if (video.getAttribute('src')) { video.pause(); video.removeAttribute('src'); video.load(); }
  } else { img.removeAttribute('src'); video.src = corsURL(url); video.play().catch(() => {}); }
}
// Lo que no se puede usar se explica en el paso 1 sin cambiar la fuente activa.
function sourceMessage(text) { $('#src-msg').textContent = text; }
const FORMATOS_IMG = 'JPG, PNG, WebP, GIF, SVG, HEIC o AVIF', FORMATOS_IMG_EN = 'JPG, PNG, WebP, GIF, SVG, HEIC or AVIF';
async function leerBytes(file, url) {
  if (file) { if (file.size > MAX_SOURCE_BYTES) throw new Error('source-size'); return new Uint8Array(await file.arrayBuffer()); }
  const r = await fetch(corsURL(url), {credentials: 'omit'});
  if (!r.ok) throw new Error('HTTP ' + r.status);
  if (+r.headers.get('content-length') > MAX_SOURCE_BYTES) throw new Error('source-size');
  const bytes = new Uint8Array(await r.arrayBuffer());
  if (bytes.length > MAX_SOURCE_BYTES) throw new Error('source-size');
  return bytes;
}
const readError = (e, what) => String(e?.message) === 'source-size' ? t('El límite local es 100 MB. Elige un archivo más pequeño.','The local limit is 100 MB. Choose a smaller file.')
  : t(`No se pudo leer ${what.es}: su servidor no permite usarlo desde otra web (CORS) o ya no existe. Descárgalo y súbelo, o cópialo y pégalo con ⌘V.`, `Could not read ${what.en}: its server does not allow using it from another site (CORS) or it is gone. Download and upload it, or copy and paste it with ⌘V.`);
// Una fuente nueva: Stock, archivo del equipo, pegada o soltada. Decide el tipo (MIME, nombre y firma de
// los primeros bytes) y la ruta: vídeo, imagen (JPG/PNG/WebP/AVIF/HEIC/GIF estático), SVG o GIF animado.
let cargaTurno = 0;
async function cargarFuente(o) {
  const turno = ++cargaTurno, nombre = o.nombre || o.file?.name || 'archivo';
  announce(''); // el aviso de ⌘V solo describe la fuente que se acaba de pegar o soltar
  const origin = o.origin || {id: null, title: nombre.replace(/\.[^.]+$/, '')};
  let det = o.clase === 'video' ? {clase: 'video', ext: PF.extDe(nombre) || 'mp4'} : PF.detectar({mime: o.mime, nombre: o.file?.name || nombre, url: o.url, ext: o.ext});
  if (o.file && det?.clase !== 'video') { try { const sig = PF.firma(await o.file.slice(0, 4096).arrayBuffer()); if (sig) det = {clase: 'imagen', ext: PF.FIRMA_EXT[sig]}; } catch (_) {} }
  if (turno !== cargaTurno) return;
  if (!det) { sourceMessage(t(`Formato no reconocido. Elige un vídeo o una imagen (${FORMATOS_IMG}).`, `Unrecognised format. Choose a video or an image (${FORMATOS_IMG_EN}).`)); return; }
  if (det.clase === 'imagen' && !det.ext) { sourceMessage(t(`Imágenes: ${FORMATOS_IMG}.`, `Images: ${FORMATOS_IMG_EN}.`)); return; }
  const url = o.url || URL.createObjectURL(o.file);
  const base = {nombre, url: o.file ? null : o.url, file: o.file || null, ext: det.ext, origen: o.origen || (o.file ? 'archivo' : 'url')};
  if (det.clase === 'video') { setSource(url, nombre, origin, 'video', 'png', {...base, tipo: 'video'}); return; }
  if (det.ext === 'gif' || det.ext === 'svg') {
    sourceMessage(det.ext === 'svg' ? t('Leyendo el SVG…','Reading the SVG…') : t('Leyendo el GIF…','Reading the GIF…'));
    let bytes;
    try { bytes = await leerBytes(o.file, url); }
    catch (e) { if (o.file) URL.revokeObjectURL(url); if (turno === cargaTurno) sourceMessage(readError(e, det.ext === 'svg' ? {es: 'este SVG', en: 'this SVG'} : {es: 'este GIF', en: 'this GIF'})); return; }
    if (turno !== cargaTurno) { if (o.file) URL.revokeObjectURL(url); return; }
    if (det.ext === 'svg') {
      if (o.file) URL.revokeObjectURL(url);
      const texto = new TextDecoder().decode(bytes), medidas = PF.svgMedidas(texto);
      if (!medidas) { sourceMessage(t('Este archivo no es un SVG válido (falta la etiqueta <svg>).', 'This file is not a valid SVG (no <svg> element).')); return; }
      // Solo texto: nunca se inserta en la página. Como imagen (blob) el navegador no ejecuta scripts ni carga recursos externos.
      const prep = PF.svgConTamano(texto, medidas.ancho, medidas.alto);
      setSource(URL.createObjectURL(new Blob([prep], {type: 'image/svg+xml'})), nombre, origin, 'image', 'svg', {...base, tipo: 'imagen', formato: 'SVG', svg: medidas, svgTexto: prep});
      return;
    }
    const info = PF.gifInfo(bytes);
    if (!info || !info.ancho || !info.alto) { if (o.file) URL.revokeObjectURL(url); sourceMessage(t('Este GIF está dañado o no se puede leer.', 'This GIF is damaged or cannot be read.')); return; }
    if (!info.animado) { setSource(url, nombre, origin, 'image', 'gif', {...base, tipo: 'imagen', formato: 'GIF', gif: info}); return; }
    setAnim(url, nombre, origin, info, bytes, {...base, tipo: 'anim', formato: 'GIF', gif: info});
    return;
  }
  setSource(url, nombre, origin, 'image', det.ext, {...base, tipo: 'imagen', formato: PF.IMAGEN[det.ext]?.nombre || det.ext.toUpperCase()});
}
// GIF animado: ImageDecoder (WebCodecs) en un canvas propio; sin él, FFmpeg WASM lo pasa a un MP4 intermedio
// que el <video> reproduce en bucle. En los dos casos el MP4 final sale del GIF original.
async function setAnim(url, name, origin, info, bytes, extra) {
  const turno = cargaTurno;
  setSource(url, name, origin, 'anim', 'gif', extra);
  animSourceURL = corsURL(url); animSeconds = info.duracionMs / 1000;
  try {
    const player = await gifPlayer(bytes, info);
    if (turno !== cargaTurno) { player?.close(); return; }
    if (player) { anim = player; animStage.replaceChildren(player.canvas); animReady('imagedecoder'); return; }
    sourceMessage(t('Preparando la vista previa del GIF con el motor de vídeo (unos 32 MB la primera vez)…', 'Preparing the GIF preview with the video engine (about 32 MB the first time)…'));
    previewEngine = previewEngine || createEngine();
    let blob = null;
    await previewEngine.encode(animSourceURL, animPreviewJob(animSeconds, info.ancho, info.alto), ev => {
      if (turno === cargaTurno && ev.phase === 'encoding') sourceMessage(`${t('Preparando la vista previa del GIF…','Preparing the GIF preview…')} ${Math.round(ev.progress * 100)}%`);
    }, (_, b) => { blob = b; });
    previewEngine.cancel(); // frees the worker: the queue has its own engine
    if (turno !== cargaTurno || !blob) return;
    derivedURL = URL.createObjectURL(blob);
    fuente.previo = 'ffmpeg';
    video.src = derivedURL; video.play().catch(() => {}); // loadedmetadata → animReady
  } catch (e) {
    if (turno !== cargaTurno || String(e?.message) === 'cancelled') return;
    $('#src-preview').hidden = true; $('#btn-adaptar').disabled = true; $('.step[data-go="2"]').disabled = true;
    sourceMessage(t('No se pudo preparar la vista previa de este GIF animado en este navegador. Prueba con Chrome, Edge o Firefox, o súbelo como MP4.', 'Could not prepare the preview of this animated GIF in this browser. Try Chrome, Edge or Firefox, or upload it as MP4.'));
  }
}
function animReady(via) {
  const g = fuente.gif;
  fuente.previo = via;
  state.src = {ancho: g.ancho, alto: g.alto, fps: 25, bitrateKbps: 0};
  syncKind();
  const text = `${state.srcName} · ${g.ancho}×${g.alto} · ${t('GIF animado','animated GIF')} · ${g.fotogramas} ${t('fotogramas','frames')} · ${secLabel(animSeconds)} s`;
  $('#src-info').textContent = text; $('#src-info-2').textContent = text; $('#src-msg').textContent = '';
  $('#src-preview').hidden = false; $('#btn-adaptar').disabled = false; $('.step[data-go="2"]').disabled = false;
  publicarFuente('listo'); refreshOriginal(); refreshInfo(); drawDirty = true;
}
// HEIC fuera de Safari: libheif-js (WASM) bajo demanda, decodifica a PNG y la imagen sigue como una más.
async function heicWasm() {
  const turno = cargaTurno, f = fuente;
  f.heic = {via: 'libheif', estado: 'cargando'};
  sourceMessage(t(`Este navegador no abre HEIC: descargando el decodificador libheif ${LIBHEIF.version} (≈0,6 MB comprimido, solo la primera vez)…`, `This browser cannot open HEIC: downloading the libheif ${LIBHEIF.version} decoder (≈0.6 MB compressed, first time only)…`));
  try {
    const bytes = await leerBytes(f.file, f.url);
    const out = await decodeHEIC(bytes, phase => { if (turno === cargaTurno && phase === 'decoding') sourceMessage(t('Decodificando HEIC…','Decoding HEIC…')); });
    if (turno !== cargaTurno) return;
    releaseDerived(); derivedURL = URL.createObjectURL(out.blob);
    f.heic = {via: 'libheif', version: LIBHEIF.version, imagenes: out.imagenes};
    srcExt = 'png'; f.imgSrc = derivedURL; publicarFuente('inicio');
    img.src = derivedURL;
  } catch (e) {
    if (turno !== cargaTurno) return;
    f.heic = {via: 'libheif', estado: 'error'};
    $('#src-preview').hidden = true; $('#btn-adaptar').disabled = true; $('.step[data-go="2"]').disabled = true;
    const why = /integrity/.test(e?.message) ? t('el decodificador descargado no coincide con la versión fijada', 'the downloaded decoder does not match the pinned version')
      : /download|fetch|Failed|NetworkError|import/i.test(e?.message) ? t('no se pudo descargar el decodificador', 'the decoder could not be downloaded')
      : String(e?.message) === 'source-size' ? t('supera 100 MB', 'it is over 100 MB') : t('el archivo no se pudo decodificar', 'the file could not be decoded');
    sourceMessage(t(`No se pudo abrir este HEIC (${why}). Ábrelo en Safari o conviértelo a JPG (en el Mac: Vista Previa → Exportar).`, `Could not open this HEIC (${why}). Open it in Safari or convert it to JPG (on a Mac: Preview → Export).`));
  }
}
// Video and image sources share the stage; playback only exists for video and animated GIF, sound only for video,
// the MP4 length only for still images.
function syncKind() {
  const still = isImage(), animated = isAnim();
  video.hidden = still || (animated && !derivedURL); img.hidden = !still;
  if (animStage) animStage.hidden = !(animated && anim);
  ['#btn-play', '#btn-play-2'].forEach(s => { const b = $(s); if (b) b.hidden = still; });
  const sound = $('#btn-sound'); if (sound) sound.hidden = still || animated;
  const wrap = $('#still-wrap'); if (wrap) wrap.hidden = !still;
  const back = $('#btn-volver'); if (back) back.textContent = animated ? t('← Cambiar GIF','← Change GIF') : still ? t('← Cambiar imagen','← Change image') : t('← Cambiar vídeo','← Change video');
  document.querySelectorAll('.output-note-image').forEach(n => n.hidden = !still && !animated);
}
img.addEventListener('load', () => {
  if (!isImage() || !img.getAttribute('src')) return;
  const W = svgSrc ? svgSrc.medidas.ancho : img.naturalWidth, H = svgSrc ? svgSrc.medidas.alto : img.naturalHeight;
  if (fuente && srcExt === 'heic' && !fuente.heic) fuente.heic = {via: 'nativo'};
  state.src = { ancho: W, alto: H, fps: 25, bitrateKbps: 0 };
  const kind = svgSrc ? t('SVG vectorial','vector SVG') : t('imagen fija','still image');
  $('#src-info').textContent = `${state.srcName} · ${W}×${H} · ${kind}`;
  $('#src-info-2').textContent = `${state.srcName} · ${W}×${H} · ${kind}`; $('#src-msg').textContent = '';
  $('#src-preview').hidden = false; $('#btn-adaptar').disabled = false; $('.step[data-go="2"]').disabled = false;
  drawDirty = true; refreshOriginal(); refreshInfo();
});
img.addEventListener('error', () => {
  if (!isImage() || !img.getAttribute('src')) return;
  // HEIC: el navegador no lo abre (todo salvo Safari) → libheif.
  if (srcExt === 'heic' && fuente && !fuente.heic) { heicWasm(); return; }
  $('#src-preview').hidden = true; $('#btn-adaptar').disabled = true; $('.step[data-go="2"]').disabled = true;
  const remote = !!fuente?.url && !window.PixeriaStock?.item(fuente.url);
  $('#src-msg').textContent = $('#src-info').textContent = srcExt === 'avif'
    ? t('Este navegador no puede decodificar AVIF. Actualízalo (Chrome, Edge, Firefox y Safari recientes lo abren) o convierte la imagen a JPG o PNG.', 'This browser cannot decode AVIF. Update it (recent Chrome, Edge, Firefox and Safari open it) or convert the image to JPG or PNG.')
    : srcExt === 'svg' ? t('No se pudo dibujar este SVG como imagen. Puede depender de fuentes, imágenes o scripts externos, que por seguridad no se cargan.', 'This SVG could not be drawn as an image. It may depend on external fonts, images or scripts, which are not loaded for safety.')
    : remote ? readError(null, {es: 'esta imagen', en: 'this image'})
    : t(`No se pudo cargar esta imagen. Elige otro archivo (${FORMATOS_IMG}) o una fuente Stock disponible.`, `Unable to load this image. Choose another file (${FORMATOS_IMG_EN}) or an available Stock source.`);
});
// MP4 length for still images: 1–60 s, 10 by default, remembered in this browser.
const stillField = $('#still-seconds');
if (stillField) {
  stillField.value = String(stillSec);
  stillField.addEventListener('input', () => { const v = Number(stillField.value); if (Number.isInteger(v) && v >= STILL.min && v <= STILL.max) { stillSec = v; refreshInfo(); } });
  stillField.addEventListener('change', () => { stillSec = stillSeconds(stillField.value); stillField.value = String(stillSec); try { localStorage.setItem(STILL_KEY, String(stillSec)); } catch (_) {} refreshInfo(); });
}
video.addEventListener('error', () => {
  if (!video.getAttribute('src')) return;
  $('#src-preview').hidden = true; $('#btn-adaptar').disabled = true; $('.step[data-go="2"]').disabled = true;
  const remote = !!fuente?.url && !isAnim() && !window.PixeriaStock?.item(fuente.url);
  $('#src-msg').textContent = $('#src-info').textContent = isAnim() ? t('No se pudo reproducir la vista previa de este GIF.', 'Unable to play the preview of this GIF.')
    : remote ? readError(null, {es: 'este vídeo', en: 'this video'})
    : t('No se pudo reproducir este vídeo. Elige otro archivo o una fuente Stock disponible.', 'Unable to play this video. Choose another file or an available Stock source.');
});
video.addEventListener('loadedmetadata', () => {
  if (isAnim()) { if (video.getAttribute('src') === derivedURL) animReady('ffmpeg'); return; }
  state.src = { ancho: video.videoWidth, alto: video.videoHeight, fps: 25, bitrateKbps: 0 };
  $('#src-info').textContent = `${state.srcName} · ${video.videoWidth}×${video.videoHeight} · ${video.duration.toFixed(1)} s`;
  $('#src-info-2').textContent = state.srcName; $('#src-msg').textContent = '';
  $('#src-preview').hidden = false; $('#btn-adaptar').disabled = false; $('.step[data-go="2"]').disabled = false;
  refreshOriginal(); refreshInfo();
});
$('#src-select').onchange = (e) => {
  const o = e.target.selectedOptions[0]; if (!o.value) { emptySource(); return; }
  const item = window.PixeriaStock?.item(o.value) || null;
  cargarFuente({url: o.value, nombre: o.textContent.replace(/^Stock · /, ''), origin: {id: o.dataset.id, title: o.dataset.title}, origen: 'stock',
    clase: o.dataset.type === 'video' ? 'video' : undefined, mime: item?.mime, ext: window.PixeriaStockFuentes?.extension(item) || item?.ext});
};
// Sin vídeo por defecto (ninguna marca): estado vacío hasta que el usuario elige uno.
function emptySource() { advertisement?.clear();cargaTurno++; releaseStill(); releaseDerived(); stopAnim(); resetCrearMedia(); if (svgRasters) { svgRasters.clear(); svgRasters = null; } svgSrc = null; fuente = null; publicarFuente('inicio'); srcKind = 'video'; img.removeAttribute('src'); syncKind(); video.removeAttribute('src'); video.load(); state.srcName = ''; state.src = {ancho:0,alto:0,fps:25,bitrateKbps:0}; $('#src-info').textContent = ''; $('#src-msg').textContent = ''; $('#src-preview').hidden = true; $('#btn-adaptar').disabled = true; $('.step[data-go="2"]').disabled = true; goStep(1); refreshInfo(); drawDirty = true; document.querySelectorAll('.fmt canvas').forEach((c) => c.getContext('2d').clearRect(0, 0, c.width, c.height)); }
$('#src-file').onchange = (e) => {
  const f = e.target.files[0]; if (!f) return;
  if (f.size>MAX_SOURCE_BYTES) {$('#src-msg').textContent=t('El límite local es 100 MB. Elige un archivo más pequeño.','The local limit is 100 MB. Choose a smaller file.');e.target.value='';return;}
  cargarFuente({file: f, nombre: f.name, mime: f.type, origin: {id: null, title: f.name.replace(/\.[^.]+$/, '')}, origen: e.target.dataset.via || 'archivo'});
  delete e.target.dataset.via;
};
// ── Pegar (⌘V / Ctrl+V) y soltar en el paso 1 (Carlos, 5-oct-2026) ─────────
// Captura de pantalla, imagen copiada de otra web o archivo copiado en Finder: entra como una subida del
// equipo (#src-file, mismo límite y misma ficha). Una URL pegada de imagen o vídeo se usa como fuente
// remota (corsURL); la de YouTube, Instagram, TikTok… va al importador. Nada de esto actúa si el foco
// está en un campo de texto: ahí ⌘V pega texto, como siempre.
const MAC = /mac|iphone|ipad/i.test(navigator.userAgentData?.platform || navigator.platform || navigator.userAgent || '');
const PASTE_KEY = MAC ? '⌘V' : 'Ctrl+V';
document.querySelectorAll('.paste-key').forEach(k => { k.textContent = PASTE_KEY; });
const editable = el => !!el && el.nodeType === 1 && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
const announce = text => { const s = $('#paste-status'); if (s) { s.textContent = ''; s.textContent = text; } };
function useTransfer(dt, via) {
  const r = PF.portapapeles(dt);
  if (!r) return false;
  const pasted = via === 'paste';
  if (r.ignorado) { announce(t(`«${r.nombre || r.mime || 'archivo'}» no es una imagen ni un vídeo que el Adaptador pueda usar (${FORMATOS_IMG}).`, `«${r.nombre || r.mime || 'file'}» is not an image or video the Adapter can use (${FORMATOS_IMG_EN}).`)); return true; }
  if (r.archivo) {
    const f = r.archivo, nombre = PF.nombrePegado(f);
    const file = nombre !== f.name ? new File([f], nombre, {type: f.type || PF.IMAGEN[r.ext]?.mime || '', lastModified: Date.now()}) : f;
    const input = $('#src-file');
    try { const box = new DataTransfer(); box.items.add(file); input.files = box.files; input.dataset.via = via === 'paste' ? 'pegado' : 'soltado'; input.dispatchEvent(new Event('change', {bubbles: true})); }
    catch (_) { cargarFuente({file, nombre, mime: file.type, origen: via === 'paste' ? 'pegado' : 'soltado'}); }
    const what = r.clase === 'video' ? (pasted ? t('Vídeo pegado','Video pasted') : t('Vídeo soltado','Video dropped')) : (pasted ? t('Imagen pegada','Image pasted') : t('Imagen soltada','Image dropped'));
    announce(`${what}: ${nombre}`);
    return true;
  }
  if (r.destino === 'importar') {
    const inp = $('#imp-url'); if (inp) inp.value = r.url;
    if (window.PixeriaImportar?.importar) window.PixeriaImportar.importar(r.url);
    announce(t(`URL ${pasted ? 'pegada' : 'soltada'}: se importa con el importador (caja 2).`, `URL ${pasted ? 'pasted' : 'dropped'}: importing it with the importer (box 2).`));
    return true;
  }
  let nombre = 'url';
  try { nombre = decodeURIComponent(new URL(r.url).pathname.split('/').filter(Boolean).pop() || new URL(r.url).hostname); } catch (_) {}
  const item = window.PixeriaStock?.item(r.url) || null;
  cargarFuente({url: r.url, nombre, origin: {id: item?.id || null, title: item?.title || nombre.replace(/\.[^.]+$/, '')}, clase: r.destino === 'video' ? 'video' : undefined, mime: item?.mime, origen: item ? 'stock' : 'url'});
  announce(r.destino === 'video' ? t(`Vídeo por URL: ${nombre}`, `Video from URL: ${nombre}`) : t(`Imagen por URL: ${nombre}`, `Image from URL: ${nombre}`));
  return true;
}
document.addEventListener('paste', (e) => {
  if ($('#paso-1').hidden || editable(e.target) || editable(document.activeElement)) return;
  if (useTransfer(e.clipboardData, 'paste')) e.preventDefault();
});
// Soltar: archivos o una URL arrastrada sobre el paso 1 (no sobre un campo de texto).
{
  const zone = $('#paso-1');
  const droppable = dt => !!dt && [...(dt.types || [])].some(x => x === 'Files' || x === 'text/uri-list');
  zone.addEventListener('dragover', (e) => { if (!droppable(e.dataTransfer) || editable(e.target)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; zone.classList.add('drop-on'); });
  zone.addEventListener('dragleave', (e) => { if (!zone.contains(e.relatedTarget)) zone.classList.remove('drop-on'); });
  zone.addEventListener('drop', (e) => { zone.classList.remove('drop-on'); if (editable(e.target) || !droppable(e.dataTransfer)) return; if (useTransfer(e.dataTransfer, 'drop')) e.preventDefault(); });
}
function togglePlay() { if (isAnim() && anim) { if (anim.paused) anim.play(); else anim.pause(); return; } if (video.paused) video.play(); else video.pause(); }
$('#btn-play').onclick = $('#btn-play-2').onclick = togglePlay;
// ── Sonido de la vista previa (Carlos, 4-oct-2026) ─────────────────────────
// Arranca silenciado para que el autoplay siga funcionando; el botón activa y
// desactiva el audio (aria-pressed = sonido activado). Si el vídeo no trae pista
// de audio se muestra «Sin audio» en vez de fingir que suena.
const soundBtn = $('#btn-sound');
let soundNoTrack = false;
function hasAudioTrack(v) {
  if (typeof v.mozHasAudio === 'boolean') return v.readyState >= 1 ? v.mozHasAudio : null;
  if (v.audioTracks && typeof v.audioTracks.length === 'number' && v.readyState >= 1) return v.audioTracks.length > 0;
  if (typeof v.webkitAudioDecodedByteCount === 'number') {
    if (v.webkitAudioDecodedByteCount > 0) return true;
    if (v.currentTime > 1.2 && v.readyState >= 2) return false;
  }
  return null; // todavía no se sabe
}
function renderSound() {
  if (!soundBtn) return;
  const on = !video.muted && video.volume > 0 && !soundNoTrack;
  soundBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
  soundBtn.classList.toggle('no-audio', soundNoTrack);
  soundBtn.querySelector('.snd-ico').textContent = soundNoTrack ? '🔇' : on ? '🔊' : '🔇';
  soundBtn.querySelector('.snd-lbl').textContent = soundNoTrack ? t('Sin audio', 'No audio') : on ? t('Con sonido', 'Sound on') : t('Sin sonido', 'Sound off');
  soundBtn.title = soundNoTrack ? t('Este vídeo no tiene pista de audio', 'This video has no audio track') : on ? t('Silenciar', 'Mute') : t('Activar sonido', 'Turn sound on');
}
function checkAudioTrack() {
  const has = hasAudioTrack(video);
  if (has === false && !soundNoTrack) { soundNoTrack = true; video.muted = true; renderSound(); }
  else if (has === true && soundNoTrack) { soundNoTrack = false; renderSound(); }
}
if (soundBtn) {
  soundBtn.onclick = () => {
    checkAudioTrack();
    if (soundNoTrack) { renderSound(); return; }
    if (video.muted || video.volume === 0) {
      video.muted = false;
      if (video.volume === 0) video.volume = 1;
      if (video.paused) video.play().catch(() => { video.muted = true; renderSound(); video.play().catch(() => {}); });
    } else {
      video.muted = true;
    }
    renderSound();
  };
  video.addEventListener('volumechange', renderSound);
  video.addEventListener('timeupdate', () => { if (video.currentTime > 1.2 && hasAudioTrack(video) !== null) checkAudioTrack(); });
  video.addEventListener('loadstart', () => { soundNoTrack = false; renderSound(); });
  video.addEventListener('loadedmetadata', checkAudioTrack);
  renderSound();
}
// Flujo en dos pasos: 1 Vídeo (Stock, subir o crear + vista previa) · 2 Adaptar (formatos, vistas previas y Exportar).
// Al salir del paso 1 por cualquier vía (paso 2, «Adaptar», cambiar de página) se pausan y silencian
// todos los medios de la sección 1 (vista previa / reproductor del Stock). No vuelven a sonar solos:
// solo reanuda el usuario (⏯ o elegir otro vídeo). Las vistas del paso 2 muestran el fotograma.
function pausePaso1() {
  document.querySelectorAll('#paso-1 video, #paso-1 audio').forEach((m) => { try { m.pause(); m.muted = true; } catch (_) {} });
  if (anim) anim.pause();
  renderSound();
}
window.addEventListener('pagehide', pausePaso1);
function goStep(n) {
  if(n===2&&advertisement?.enabled())void advertisement.analyze();
  if (n === 2 && !state.src.ancho) return;
  if (n !== 1) pausePaso1();
  $('#paso-1').hidden = n !== 1; $('#paso-2').hidden = n !== 2; document.body.dataset.paso = String(n);
  document.querySelectorAll('.steps .step').forEach(b => { if (+b.dataset.go === n) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); });
  if (n === 2) { drawDirty = true; buildCardSettings(); refreshInfo(); }
  window.scrollTo({top: 0});
}
// [PORTRAIT-ENTRY-START]
function portraitSource() { return {...state.src,kind:srcKind}; }
function syncPortraitEntry() {
  const button=$('#btn-portrait');
  button.textContent=t('Horizontal → vertical','Landscape → portrait');
  button.hidden=!canEnterPortrait(portraitSource(),mediaReady());
  button.disabled=button.hidden;
}
function enterPortrait() {
  const entry=portraitEntryPlan({source:portraitSource(),ready:mediaReady(),formats:FORMATOS,profile:state.profile});
  if(!selectPortraitEntry(FORMATOS,entry))return;
  state.profile=entry.profile;state.sel=entry.id;
  $('#format-profile').value=entry.profile;syncCompat();buildGrid();goStep(2);
  const target=FORMATOS.find(f=>f.id===entry.id);
  $('#export-status').textContent=t(`Destino inicial: ${target.nombre} · ${entry.ancho}×${entry.alto}. Revisa texto y producto antes de crear y aprobar; puedes añadir más tamaños.`,`Initial destination: ${target.nombre} · ${entry.ancho}×${entry.alto}. Review copy and product before creating and approving; you can add more sizes.`);
  const card=Array.from(document.querySelectorAll('#grid [data-f]')).find(el=>el.dataset.f===entry.id);
  if(card){card.focus({preventScroll:true});card.scrollIntoView({block:'nearest',behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches?'instant':'smooth'});}
}
$('#btn-portrait').onclick=enterPortrait;
// [PORTRAIT-ENTRY-END]
document.querySelectorAll('.steps .step').forEach(b => b.onclick = () => goStep(+b.dataset.go));
$('#btn-adaptar').onclick = () => goStep(2);
$('#btn-volver').onclick = () => goStep(1);
$('#btn-sizes').onclick = () => { const m = document.querySelector('.pix-nav-icon-menu'); if (m && document.body.classList.contains('pf-left-off')) m.click(); else document.body.classList.remove('pf-left-off'); };
$('#modo-global').onchange = (e) => { state.modoGlobal = e.target.value; refreshInfo(); };
$('#format-profile').onchange = (e) => {
  state.profile = e.target.value;
  // Preserve selections and settings in every format family.
  syncCompat();
  buildGrid();
};
$('#compat').onchange = (e) => { state.compat = e.target.value; buildGrid(); };


// ── Estancos y circuito (Carlos, 6-oct-2026) ────────────────────────────────
// Con el proyecto activo y su JSON de estancos (ficha.estancos): elegir uno, varios o todos,
// «Preparar paquete» marca exactamente los formatos de sus pantallas y los exporta en la cola.
// Cada formato se codifica una vez; el ZIP (por estanco o global) copia el archivo en cada pantalla
// que lo usa, con manifest.json. La casilla Stock publica una pieza por fuente y formato con las
// etiquetas del proyecto y un externalRef estable (sin duplicados). Los players se programan desde el
// servidor (/players-programar): ver docs/adaptador.md · «Programación de players».
let EST_BASE = null, estApplications = [];
let EST = null;              // JSON de estancos del proyecto activo (validado) o null
const estSel = new Set();    // ids elegidos
let pkg = null, pkgSeq = 0;  // paquete en curso
const EST_KEY = id => `pixeria.adapter.estancos.${id}`;
const STOCK_REFS_KEY = 'pixeria.adapter.stock-refs';
const projectFormatList = () => FORMATOS.filter(f => f.proyecto);
function setEstancos(doc) {
  studio?.clear();twin?.close(); EST = null; EST_BASE=null; estApplications=[]; estSel.clear();
  if (doc && FICHA) {
    const errors = validateEstancos(doc, {formats: projectFormatList(), proyecto: FICHA.id});
    if (errors.length) console.warn('[estancos]', errors); else { EST_BASE=doc;let saved=null;try{saved=JSON.parse(localStorage.getItem(APPLICATION_KEY(FICHA.id)));}catch(_){}estApplications=restoreApplications(saved,doc,projectFormatList());EST=applyApplications(doc,estApplications,projectFormatList()); }
  }
  if (EST) { try { (JSON.parse(localStorage.getItem(EST_KEY(FICHA.id))) || []).forEach(id => { if (EST.estancos.some(e => e.id === id)) estSel.add(id); }); } catch (_) {} }
  renderEstancos();
}
function saveEstSel() { if (!EST) return; try { localStorage.setItem(EST_KEY(EST.proyecto), JSON.stringify([...estSel])); } catch (_) {} }
const fmtById = id => FORMATOS.find(f => f.id === id);
function renderEstancos() {
  const box = $('#estancos'); if (!box) return;
  box.hidden = !EST; if (!EST) { $('#paquete').hidden = true; return; }
  const demo = EST.estado === 'demo' ? t(' · demo: parque pendiente de confirmar', ' · demo: screens pending confirmation') : '';
  $('#estancos-nota').textContent = `${t('Circuito', 'Circuit')} ${EST.circuito} · ${EST.estancos.length} ${t('estancos', 'shops')}${demo}.`;
  $('#estancos-criterio').textContent = EN ? EST.mapa.criterioEn : EST.mapa.criterio;
  $('#estancos-n').textContent = String(EST.estancos.length);
  const list = $('#estancos-lista'); list.replaceChildren();
  for (const est of EST.estancos) {
    const li = document.createElement('li'); li.className = 'estanco';
    const label = document.createElement('label');
    const box2 = document.createElement('input'); box2.type = 'checkbox'; box2.value = est.id; box2.checked = estSel.has(est.id);
    box2.setAttribute('aria-label', `${t('Estanco', 'Shop')} ${est.nombre}`);
    box2.onchange = () => { if (box2.checked) estSel.add(est.id); else estSel.delete(est.id); saveEstSel(); syncEstancosButton(); };
    const text = document.createElement('span'), name = document.createElement('strong'), meta = document.createElement('small');
    name.textContent = `${est.orden}. ${est.nombre}`;
    meta.textContent = `${est.direccion}${est.expendeduria ? ` · ${t('expendeduría', 'licence')} ${est.expendeduria.numero}` : ''}`;
    text.append(name, meta);
    const screens = document.createElement('ul'); screens.className = 'estanco-pantallas';
    for (const p of est.pantallas) {
      const f = fmtById(p.formato), s = document.createElement('li');
      s.textContent = `${EN ? p.nameEn : p.nombre} · ${p.ancho}×${p.alto} → ${p.formato}${f ? ` ${f.nombre}` : ''}`;
      screens.append(s);
    }
    text.append(screens); label.append(box2, text); li.append(label); list.append(li);
  }
  syncEstancosButton();
}
function syncEstancosButton() {
  const btn = $('#estancos-preparar'); if (!btn || !EST) return;
  const all = $('#estancos-todos'), n = estSel.size;
  all.checked = n === EST.estancos.length; all.indeterminate = n > 0 && !all.checked;
  const fmts = formatsFor(EST, [...estSel]), screens = EST.estancos.filter(e => estSel.has(e.id)).reduce((a, e) => a + e.pantallas.length, 0);
  btn.textContent = n ? t(`Preparar paquete · ${n} ${n === 1 ? 'estanco' : 'estancos'} · ${fmts.length} ${fmts.length === 1 ? 'formato' : 'formatos'}`, `Prepare package · ${n} ${n === 1 ? 'shop' : 'shops'} · ${fmts.length} ${fmts.length === 1 ? 'format' : 'formats'}`) : t('Preparar paquete', 'Prepare package');
  btn.disabled = !n || !state.src.ancho || (pkg && pkg.running);
  const st = $('#estancos-status');
  if (st && !(pkg && pkg.running)) st.textContent = !state.src.ancho ? t('Elige primero un contenido (paso 1).', 'Choose some content first (step 1).') : n ? t(`${screens} pantallas reciben ${fmts.length} ${fmts.length === 1 ? 'formato' : 'formatos'}.`, `${screens} screens get ${fmts.length} ${fmts.length === 1 ? 'format' : 'formats'}.`) : t('Elige uno, varios o todos los estancos.', 'Pick one, several or all shops.');
}
$('#estancos-todos').onchange = e => { estSel.clear(); if (e.target.checked && EST) EST.estancos.forEach(x => estSel.add(x.id)); saveEstSel(); renderEstancos(); };
const hexOf = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const sha256 = async data => hexOf(await crypto.subtle.digest('SHA-256', data));
// Fuente estable del lote: el id del Stock o el SHA-256 del archivo (o de la URL remota).
async function packageSource() {
  const f = {id: state.origin.id || null, titulo: state.origin.title || state.srcName, url: fuente?.url || null, clave: null};
  if (f.id) f.clave = sourceKey({stockId: f.id});
  else if (fuente?.file) f.clave = sourceKey({sha256: await sha256(await fuente.file.arrayBuffer())});
  else if (fuente?.url) f.clave = sourceKey({sha256: await sha256(new TextEncoder().encode(fuente.url))});
  return f;
}
$('#estancos-preparar').onclick = async () => {
  if (!EST || !estSel.size || !state.src.ancho) return;
  const ids = EST.estancos.filter(e => estSel.has(e.id)).map(e => e.id), formatos = formatsFor(EST, ids);
  // Marca exactamente esos formatos (solo los del proyecto; la biblioteca general no se toca).
  state.profile = 'proyecto'; $('#format-profile').value = 'proyecto'; syncCompat();
  projectFormatList().forEach(f => { f.on = formatos.includes(f.id); });
  buildGrid();
  const formats = formatos.map(fmtById).filter(Boolean);
  pkg = {id: ++pkgSeq, ids, formatos, plan: packagePlan(EST, ids, projectFormatList()), fuente: await packageSource(), files: new Map(), items: new Map(), fallos: new Map(), publicar: $('#estancos-stock').checked, stock: new Map(), log: [], running: true, published: false, generado: new Date().toISOString()};
  $('#estancos-status').textContent = t(`Paquete en la cola: ${formats.length} ${formats.length === 1 ? 'formato' : 'formatos'} para ${ids.length} ${ids.length === 1 ? 'estanco' : 'estancos'}.`, `Package queued: ${formats.length} ${formats.length === 1 ? 'format' : 'formats'} for ${ids.length} ${ids.length === 1 ? 'shop' : 'shops'}.`);
  renderPackage();
  const mine = pkg;
  await exportFormats(formats, 'atlas', {paquete: mine.id});
  // Sin líneas en la cola (presupuesto de memoria o contenido no válido): el motivo está en #export-status.
  if (mine === pkg && !mine.items.size && !mine.files.size) { mine.running = false; $('#estancos-status').textContent = $('#export-status').textContent || t('No se pudo poner el paquete en la cola.', 'Could not queue the package.'); renderPackage(); }
  syncEstancosButton();
};
// Un archivo terminado de la cola: se guarda con su hash para el ZIP y el manifiesto.
async function onPackageFile(item, file) {
  if (!pkg || item.paquete !== pkg.id || !item.format) return;
  const p = pkg, data = new Uint8Array(await file.blob.arrayBuffer());
  p.files.set(item.format.id, {data, blob: file.blob, bytes: data.length, duracion: item.duration, sha256: await sha256(data), mime: file.blob.type, item});
  p.fallos.delete(item.format.id);
  if (p !== pkg) return;
  checkPackage();
}
// Errores o cancelaciones de líneas del paquete (la cola avisa en cada cambio).
function paintPackageRows(rows) {
  const p = pkg; if (!p || !p.running) return;
  let changed = false;
  for (const row of rows) {
    const id = p.items.get(row.id);
    if (id && (row.state === 'error' || row.state === 'cancelled') && !p.files.has(id) && p.fallos.get(id) !== row.state) { p.fallos.set(id, row.state); changed = true; }
  }
  if (changed) checkPackage();
}
function checkPackage() {
  const p = pkg; if (!p) return;
  const done = p.formatos.filter(id => p.files.has(id)).length;
  if (p.running && p.fallos.size && done + p.fallos.size >= p.formatos.length) {
    p.running = false;
    $('#estancos-status').textContent = t(`Paquete incompleto: no salieron ${[...p.fallos.keys()].join(', ')}. Vuelve a preparar el paquete.`, `Incomplete package: ${[...p.fallos.keys()].join(', ')} failed. Prepare the package again.`);
  }
  if (done === p.formatos.length && p.running) {
    p.running = false;
    $('#estancos-status').textContent = t('Paquete listo: descarga el ZIP por estanco o el de todos.', 'Package ready: download the ZIP per shop or for all.');
    if (p.publicar) publishPackage();
  }
  renderPackage(); syncEstancosButton();
}
function renderPackage() {
  const sec = $('#paquete'); if (!sec) return;
  const p = pkg; sec.hidden = !p || !EST; if (!p || !EST) return;
  const done = p.formatos.filter(id => p.files.has(id)).length, ready = done === p.formatos.length;
  $('#paquete-progreso').textContent = `${done}/${p.formatos.length} ${t('formatos', 'formats')}`;
  $('#paquete-fuente').textContent = `${t('Fuente', 'Source')}: ${p.fuente.titulo || '—'}${p.fuente.id ? ` · Stock ${p.fuente.id}` : ''} · ${p.ids.length} ${t('estancos', 'shops')} · ${p.plan.length} ${t('pantallas', 'screens')}`;
  const zipAll = $('#paquete-zip'); zipAll.disabled = !ready; zipAll.textContent = `${t('ZIP · todos', 'ZIP · all')} (${p.ids.length})`;
  const pub = $('#paquete-publicar'); pub.disabled = !ready || p.publishing;
  const box = $('#paquete-grupos'); box.replaceChildren();
  for (const g of groupByEstanco(p.plan)) {
    const el = document.createElement('div'); el.className = 'paquete-grupo'; el.dataset.estanco = g.estanco;
    const hd = document.createElement('div'); hd.className = 'paquete-grupo-hd';
    const h = document.createElement('h3'); h.textContent = g.nombre;
    const zip = document.createElement('button'); zip.type = 'button'; zip.className = 'pill export-one paquete-zip-estanco'; zip.textContent = 'ZIP'; zip.disabled = !ready;
    zip.setAttribute('aria-label', `ZIP · ${g.nombre}`); zip.onclick = () => downloadZip(g.estanco);
    hd.append(h, zip); el.append(hd);
    const ul = document.createElement('ul');
    for (const r of g.rows) {
      const li = document.createElement('li'), f = p.files.get(r.formato), s = p.stock.get(r.formato);
      li.innerHTML = `<code></code><small></small>`;
      li.querySelector('code').textContent = r.archivo.split('/').pop();
      li.querySelector('small').textContent = `${EN ? r.pantallaNameEn : r.pantallaNombre} · ${f ? `${(f.bytes / 1048576).toFixed(1)} MB` : p.fallos.has(r.formato) ? t('falló', 'failed') : t('en cola', 'queued')}${s ? ` · Stock ${s.num ? '#' + s.num : s.id}` : ''}`;
      ul.append(li);
    }
    el.append(ul); box.append(el);
  }
  const log = $('#paquete-stock'); log.hidden = !p.log.length;
  $('#paquete-stock-log').replaceChildren(...p.log.map(l => { const li = document.createElement('li'); li.textContent = `${l.formato} · ${({publicada: t('publicada', 'published'), reutilizada: t('ya estaba (mismo contenido)', 'already there (same content)'), 'ya-estaba': t('ya estaba', 'already there'), error: t('error', 'error'), omitida: t('omitida', 'skipped')})[l.estado] || l.estado}${l.num ? ` #${l.num}` : l.id ? ` ${l.id}` : ''}${l.error ? ` · ${l.error}` : ''}`; return li; }));
  renderProgramar();
}
// fflate fijado en jsDelivr, comprobado por SHA-256 antes de importarlo (como libheif).
let fflateLoading = null;
function loadFflate() {
  if (!fflateLoading) fflateLoading = (async () => {
    const r = await fetch(FFLATE.url, {credentials: 'omit'}); if (!r.ok) throw new Error('zip-download');
    const code = await r.arrayBuffer();
    if (await sha256(code) !== FFLATE.sha256) throw new Error('zip-integrity');
    const url = URL.createObjectURL(new Blob([code], {type: 'text/javascript'}));
    try { return await import(/* @vite-ignore */ url); } finally { URL.revokeObjectURL(url); }
  })().catch(e => { fflateLoading = null; throw e; });
  return fflateLoading;
}
function packageManifestFor(scope) { return packageManifest({doc: EST, plan: pkg.plan, files: pkg.files, fuente: pkg.fuente, generado: pkg.generado, scope, stock: pkg.stock}); }
async function downloadZip(estanco = null) {
  if (!pkg || !EST) return;
  const st = $('#estancos-status'), scope = estanco ? [estanco] : null;
  try {
    const {zipSync} = await loadFflate();
    const bytes = buildZip(zipEntries({plan: pkg.plan, files: pkg.files, manifestJSON: packageManifestFor(scope), scope}), zipSync);
    const name = zipName(EST, estanco ? EST.estancos.find(e => e.id === estanco) : null);
    const url = URL.createObjectURL(new Blob([bytes], {type: 'application/zip'}));
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    st.textContent = t(`ZIP listo: ${name} (${(bytes.length / 1048576).toFixed(1)} MB).`, `ZIP ready: ${name} (${(bytes.length / 1048576).toFixed(1)} MB).`);
  } catch (e) {
    st.textContent = /integrity/.test(e?.message) ? t('El compresor descargado no coincide con la versión fijada: no se genera el ZIP.', 'The downloaded zip library does not match the pinned version: no ZIP generated.') : t('No se pudo generar el ZIP (¿sin conexión con jsDelivr?).', 'Could not build the ZIP (no connection to jsDelivr?).');
  }
}
$('#paquete-zip').onclick = () => downloadZip(null);
// Referencias ya publicadas: índice del Stock (externalRef) + registro de este navegador.
function knownRefs(pieces) {
  const known = new Map();
  try { Object.entries(JSON.parse(localStorage.getItem(STOCK_REFS_KEY)) || {}).forEach(([k, v]) => known.set(k, v)); } catch (_) {}
  for (const piece of pieces) { const it = window.PixeriaStock?.porRef?.(piece.externalRef); if (it && !known.has(piece.externalRef)) known.set(piece.externalRef, {id: it.id, num: it.num ?? null}); }
  return known;
}
function saveRefs(known) { try { localStorage.setItem(STOCK_REFS_KEY, JSON.stringify(Object.fromEntries([...known].slice(-500)))); } catch (_) {} }
async function publishPackage() {
  const p = pkg; if (!p || p.publishing || !EST) return;
  p.publishing = true; renderPackage();
  const recetas = Object.fromEntries([...p.files].filter(([, x]) => x.item?.receta).map(([id, x]) => [id, x.item.receta]));
  const pieces = publishPlan({doc: EST, plan: p.plan, formatos: p.formatos, fuente: p.fuente, known: new Map(), proyectoTag: FICHA?.alias?.[0] || EST.proyecto, recetas});
  const known = knownRefs(pieces);
  // El Stock solo admite MP4 desde el Adaptador: los PNG van solo en el ZIP.
  const mp4 = pieces.filter(piece => p.files.get(piece.formato)?.mime === 'video/mp4');
  p.log = pieces.filter(piece => !mp4.includes(piece)).map(piece => ({formato: piece.formato, estado: 'omitida', error: 'PNG'}));
  if (!pieces.every(piece => piece.externalRef)) { p.log.push({formato: '—', estado: 'error', error: t('fuente sin referencia estable', 'source without a stable reference')}); p.publishing = false; renderPackage(); return; }
  const upload = async piece => {
    const f = p.files.get(piece.formato), fmt = fmtById(piece.formato), size = fmt ? (fmt.layout?.entrega || fmt.custom) : [0, 0];
    // Progreso de la subida por partes de cada pieza grande; al terminar el lote se pinta «Stock: x/y piezas».
    const onProgress = (hecho, bytes) => { $('#estancos-status').textContent = t(`Stock: subiendo ${piece.formato} · ${Math.floor(hecho / bytes * 100)} %`, `Stock: uploading ${piece.formato} · ${Math.floor(hecho / bytes * 100)} %`); };
    return publishAdaptation(f.blob, {title: adaptationTitle(p.fuente.titulo, {nombre: FICHA?.nombre || EST.proyecto}, fmt?.nombre || piece.formato), originId: p.fuente.id, client: null, format: piece.formato, width: size[0], height: size[1], duration: f.duracion, still: !!f.item?.still}, {tags: piece.tags, externalRef: piece.externalRef, comment: piece.comment}, {onProgress});
  };
  const base = p.log.slice();
  const log = await publishPieces(mp4, {upload, known, onStep: l => { p.log = [...base, ...l]; renderPackage(); }});
  for (const l of log) if (l.estado !== 'error') p.stock.set(l.formato, {id: l.id, num: l.num, externalRef: l.externalRef, reused: l.estado !== 'publicada'});
  saveRefs(known);
  p.publishing = false; p.published = true;
  const ok = log.filter(l => l.estado !== 'error').length;
  $('#estancos-status').textContent = t(`Stock: ${ok}/${mp4.length} piezas con etiquetas del proyecto.`, `Stock: ${ok}/${mp4.length} pieces tagged with the project.`);
  renderPackage();
}
$('#paquete-publicar').onclick = () => publishPackage();

// ── Programación de players (Carlos, 6-oct-2026) ────────────────────────────
// POST /players-programar con la sesión de Pixeria: «Probar» (modo prueba) enseña el plan exacto y
// qué pantallas no existen; «Programar» (modo real) solo se habilita con una prueba de ESTE lote,
// todas las pantallas dadas de alta, los assets servidos y el secreto instalado en el servidor.
// Pide confirmación explícita. El secreto de admira.tv nunca pasa por el navegador.
const prog = {prueba: null, running: false, log: []};
const hora = () => new Date().toLocaleTimeString(EN ? 'en-GB' : 'es-ES', {hour: '2-digit', minute: '2-digit', second: '2-digit'});
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
function progLote() { return pkg && EST ? programPieces({plan: pkg.plan, stock: pkg.stock, files: pkg.files}) : null; }
function progLog(text, estado = '') { prog.log.unshift({at: hora(), text, estado}); prog.log = prog.log.slice(0, 50); }
function renderProgramar() {
  const box = $('#programar'); if (!box) return;
  const lote = progLote(); if (!lote) return;
  const key = loteKey(lote.piezas), pr = prog.prueba && prog.prueba.key === key ? prog.prueba : null;
  const n = lote.piezas.length, m = lote.estancos;
  const probar = $('#programar-probar'), real = $('#programar-real');
  probar.disabled = prog.running || !n || n > PROGRAMAR_MAX || pkg.running || pkg.publishing;
  const bloqueo = !pr ? 'sin-prueba' : !pr.ok ? 'error' : pr.inexistentes.length ? 'inexistentes' : pr.assetsNoDisponibles.length ? 'assets' : !pr.secretoConfigurado ? 'secreto' : '';
  real.disabled = prog.running || !n || !!bloqueo;
  real.textContent = n ? t(`Programar ${plural(n, 'player', 'players')} de ${plural(m, 'estanco', 'estancos')}`, `Schedule ${plural(n, 'player', 'players')} in ${plural(m, 'shop', 'shops')}`) : t('Programar players', 'Schedule players');
  const st = $('#programar-status');
  if (!prog.running) st.textContent =
    !n ? (lote.faltan.length ? t(`Publica primero el lote en el Stock: los players solo reciben piezas del Stock (faltan ${lote.faltan.join(', ')}).`, `Publish the package to the Stock first: players only get Stock pieces (missing ${lote.faltan.join(', ')}).`) : t('Prepara un paquete para programarlo.', 'Prepare a package to schedule it.'))
    : n > PROGRAMAR_MAX ? t(`Como máximo ${PROGRAMAR_MAX} pantallas por programación.`, `At most ${PROGRAMAR_MAX} screens per run.`)
    : bloqueo === 'sin-prueba' ? t(`${plural(n, 'pantalla lista', 'pantallas listas')} para programar${lote.faltan.length ? ` (sin ${lote.faltan.join(', ')}: no está en el Stock)` : ''}. Prueba la programación antes de programar.`, `${n} ${n === 1 ? 'screen' : 'screens'} ready${lote.faltan.length ? ` (without ${lote.faltan.join(', ')}: not in the Stock)` : ''}. Test the scheduling before running it.`)
    : bloqueo === 'error' ? pr.mensaje
    : bloqueo === 'inexistentes' ? t(`No se puede programar: ${plural(pr.inexistentes.length, 'pantalla no existe', 'pantallas no existen')} en la parrilla de players (api.admira.store/grid/screens).`, `Cannot schedule: ${pr.inexistentes.length} ${pr.inexistentes.length === 1 ? 'screen does' : 'screens do'} not exist in the player grid (api.admira.store/grid/screens).`)
    : bloqueo === 'assets' ? t(`No se puede programar: el Stock no sirve ${plural(pr.assetsNoDisponibles.length, 'pieza', 'piezas')}.`, `Cannot schedule: the Stock does not serve ${pr.assetsNoDisponibles.length} ${pr.assetsNoDisponibles.length === 1 ? 'piece' : 'pieces'}.`)
    : bloqueo === 'secreto' ? t('Prueba correcta, pero falta configurar el secreto STOCK_NOTIFY_KEY en el proyecto Pages: no se puede programar todavía.', 'Test passed, but the STOCK_NOTIFY_KEY secret is not set in the Pages project: scheduling is not possible yet.')
    : t(`Prueba correcta: ${plural(n, 'pantalla', 'pantallas')} de ${plural(m, 'estanco', 'estancos')} listas para programar.`, `Test passed: ${n} ${n === 1 ? 'screen' : 'screens'} in ${m} ${m === 1 ? 'shop' : 'shops'} ready to schedule.`);
  const ul = $('#programar-plan');
  ul.hidden = !pr || !pr.plan.length;
  ul.replaceChildren(...(pr ? pr.plan : []).map(row => {
    const li = document.createElement('li'), mark = document.createElement('b'), name = document.createElement('code'), info = document.createElement('small');
    const bad = row.existe !== true || row.assetsOk === false;
    li.className = bad ? 'bad' : 'ok'; li.dataset.screen = row.screenId;
    mark.textContent = bad ? '✗' : '✓'; mark.setAttribute('aria-hidden', 'true');
    name.textContent = row.screenId;
    const items = row.payload?.items || [];
    const que = items.map(it => it.stockId ? `Stock ${it.stockId}` : it.asset.split('/').pop()).join(', ');
    const ahora = row.actual ? t(`ahora ${plural(row.actual.items, 'pieza', 'piezas')}`, `now ${row.actual.items} ${row.actual.items === 1 ? 'piece' : 'pieces'}`) : t('lista actual desconocida', 'current playlist unknown');
    const estado = row.existe === true ? t('existe', 'exists') : row.existe === false ? t('no existe en la parrilla', 'not in the grid') : t('parrilla no disponible', 'grid unavailable');
    info.textContent = `${estado} · ${t('recibiría', 'would get')} ${t(plural(items.length, 'pieza', 'piezas'), plural(items.length, 'piece', 'pieces'))} (${que}, ${items.map(it => it.seconds + ' s').join(', ')}) · ${ahora}${row.assetsOk === false ? ` · ${t('asset no disponible', 'asset unavailable')}` : ''}`;
    li.append(mark, ' ', name, info); return li;
  }));
  const reg = $('#programar-registro'); reg.hidden = !prog.log.length;
  $('#programar-log').replaceChildren(...prog.log.map(l => { const li = document.createElement('li'); li.textContent = `${l.at} · ${l.text}`; if (l.estado) li.className = l.estado; return li; }));
}
async function callProgramar(body) {
  let r, data = {};
  try {
    r = await fetch(PROGRAMAR_URL, {method: 'POST', credentials: 'same-origin', headers: {'Content-Type': 'application/json', Accept: 'application/json'}, body: JSON.stringify(body)});
    data = await r.json().catch(() => ({}));
  } catch (_) { return {status: 0, data: {ok: false, error: 'red'}}; }
  return {status: r.status, data};
}
function progError({status, data}) {
  if (status === 401) return t('Tu sesión de Pixeria ha caducado: vuelve a entrar.', 'Your Pixeria session has expired: sign in again.');
  if (status === 503 && data.error === 'falta-secreto') return t('Falta configurar el secreto STOCK_NOTIFY_KEY en el proyecto Pages.', 'The STOCK_NOTIFY_KEY secret is not set in the Pages project.');
  if (status === 400 && Array.isArray(data.errores)) return `${t('Lote no válido', 'Invalid package')}: ${data.errores.slice(0, 3).join(' · ')}`;
  if (status === 409 && data.error === 'pantallas-inexistentes') return t(`No se programa: ${plural(data.inexistentes.length, 'pantalla no existe', 'pantallas no existen')}.`, `Not scheduled: ${plural(data.inexistentes.length, 'screen does', 'screens do')} not exist.`);
  if (status === 409 && data.error === 'prueba-pendiente') return t('El lote cambió desde la prueba: vuelve a probarlo.', 'The package changed since the test: test it again.');
  if (status === 0) return t('Sin conexión con el servidor.', 'No connection to the server.');
  return `${t('Error', 'Error')} ${status || ''} ${data.error || ''}`.trim();
}
$('#programar-probar').onclick = async () => {
  const lote = progLote(); if (!lote || !lote.piezas.length || prog.running) return;
  const key = loteKey(lote.piezas);
  prog.running = true; $('#programar-status').textContent = t('Probando la programación (sin cambios)…', 'Testing the scheduling (no changes)…'); renderProgramar();
  const res = await callProgramar({modo: 'prueba', proyecto: EST.proyecto, piezas: lote.piezas});
  prog.running = false;
  if (res.status === 200 && res.data.ok) {
    prog.prueba = {key, ok: true, ...res.data};
    const r = res.data.resumen;
    progLog(t(`Prueba · ${plural(r.pantallas, 'pantalla', 'pantallas')} de ${plural(r.estancos, 'estanco', 'estancos')} · ${r.inexistentes ? `${r.inexistentes} no ${r.inexistentes === 1 ? 'existe' : 'existen'}` : 'todas existen'} · sin cambios · ${res.data.quien}`, `Test · ${plural(r.pantallas, 'screen', 'screens')} in ${plural(r.estancos, 'shop', 'shops')} · ${r.inexistentes ? `${r.inexistentes} missing` : 'all exist'} · no changes · ${res.data.quien}`), r.inexistentes || r.assetsNoDisponibles ? 'bad' : 'ok');
  } else {
    prog.prueba = {key, ok: false, plan: [], inexistentes: [], assetsNoDisponibles: [], mensaje: progError(res)};
    progLog(`${t('Prueba', 'Test')} · ${prog.prueba.mensaje}`, 'bad');
  }
  renderProgramar();
};
$('#programar-real').onclick = async () => {
  const lote = progLote(); if (!lote || prog.running) return;
  const key = loteKey(lote.piezas), pr = prog.prueba;
  if (!pr || pr.key !== key || !pr.ok) return;
  const n = lote.piezas.length, m = lote.estancos;
  const ask = t(`Vas a SUSTITUIR la lista por defecto de ${plural(n, 'player', 'players')} de ${plural(m, 'estanco', 'estancos')} en admira.tv con las piezas de este lote. Los players la releen en unos 30 s.

¿Programar ahora?`, `You are about to REPLACE the admira.tv default playlist of ${n} ${n === 1 ? 'player' : 'players'} in ${m} ${m === 1 ? 'shop' : 'shops'} with this package. Players reload it within about 30 s.

Schedule now?`);
  if (!window.confirm(ask)) { progLog(t('Programación cancelada: no se ha cambiado nada.', 'Scheduling cancelled: nothing changed.')); renderProgramar(); return; }
  prog.running = true; $('#programar-status').textContent = t(`Programando ${plural(n, 'player', 'players')}…`, `Scheduling ${plural(n, 'player', 'players')}…`); renderProgramar();
  const res = await callProgramar({modo: 'real', proyecto: EST.proyecto, piezas: lote.piezas, firma: pr.firma});
  prog.running = false;
  const d = res.data;
  if (Array.isArray(d.resultados)) {
    const ok = d.resultados.filter(x => x.ok).length;
    for (const x of d.resultados) progLog(`${x.ok ? '✓' : '✗'} ${x.screenId} · ${x.ok ? `${t(plural(x.items, 'pieza', 'piezas'), plural(x.items, 'piece', 'pieces'))} · rev ${x.rev}` : x.error}`, x.ok ? 'ok' : 'bad');
    progLog(t(`Programación · ${ok}/${d.resultados.length} players · ${d.quien} · ${new Date(d.cuando).toLocaleString('es-ES')}`, `Scheduling · ${ok}/${d.resultados.length} players · ${d.quien} · ${new Date(d.cuando).toLocaleString('en-GB')}`), d.ok ? 'ok' : 'bad');
    prog.prueba = null; // el estado de las listas cambió: la siguiente programación necesita otra prueba
    renderProgramar();
    $('#programar-status').textContent = d.ok ? t(`Programados ${plural(ok, 'player', 'players')}: lo reproducen en unos 30 s.`, `${plural(ok, 'player', 'players')} scheduled: they play it within about 30 s.`) : t(`Programación incompleta: ${ok}/${d.resultados.length} players. Revisa el registro.`, `Incomplete scheduling: ${ok}/${d.resultados.length} players. Check the log.`);
  } else {
    progLog(`${t('Programación', 'Scheduling')} · ${progError(res)}`, 'bad');
    if (res.status === 409) prog.prueba = null;
    renderProgramar();
    $('#programar-status').textContent = progError(res);
  }
};

// ── Proyecto (Carlos, 5-oct-2026) ───────────────────────────────────────────
// Lista: proyectos de Yokup (en vivo, con respaldo en proyectos/yokup.json). Ajustes propios:
// fichas de proyectos/index.json. Sin ficha, el proyecto usa solo la biblioteca general.
const PROJECTS_DIR = 'adaptaciones/proyectos/';
const getJSON = async (url) => { const r = await fetch(url); if (!r.ok) throw new Error(`${r.status} ${url}`); return r.json(); };
const fichaCache = new Map();
async function loadFicha(entry) {
  if (fichaCache.has(entry.id)) return fichaCache.get(entry.id);
  const path = PROJECTS_DIR + entry.archivo, ficha = await getJSON('/' + path), lists = {};
  for (const k of ['estandar', 'especiales']) {
    const ref = formatRef(ficha.formatos?.[k]);
    lists[k] = !ref ? [] : ref.inline ? ref.inline : ((await getJSON('/' + resolveRef(path, ref.archivo)))[ref.clave] || []);
  }
  // Estancos y circuito: si falta o no cuadra con los formatos, el proyecto sigue sin la sección.
  let estancos = null;
  if (ficha.estancos?.archivo) { try { estancos = await getJSON('/' + resolveRef(path, ficha.estancos.archivo)); } catch (_) { estancos = null; } }
  const out = {ficha, lists, estancos};
  fichaCache.set(entry.id, out);
  return out;
}
const projectName = id => PROJECTS.find(p => p.id === id)?.nombre || id;
function renderProjects() {
  const sel = $('#adapter-project'); if (!sel) return;
  const option = (parent, value, text) => { const o = document.createElement('option'); o.value = value; o.textContent = text; parent.appendChild(o); };
  const group = (label, list, text) => { if (!list.length) return; const g = document.createElement('optgroup'); g.label = label; list.forEach(p => option(g, p.id, text(p))); sel.appendChild(g); };
  sel.replaceChildren();
  option(sel, GENERAL, t('General (sin proyecto)', 'General (no project)'));
  const own = PROJECTS.filter(p => p.propios), rest = PROJECTS.filter(p => !p.propios);
  const count = p => (p.ficha.formatos?.estandar || 0) + (p.ficha.formatos?.especiales || 0);
  group(t('Con formatos propios', 'With own formats'), own, p => `★ ${p.nombre} · ${count(p)} ${t('propios', 'own')}`);
  group(t('Proyectos de Yokup · solo biblioteca general', 'Yokup projects · general library only'), rest, p => p.nombre);
  if (state.proyecto !== GENERAL && !PROJECTS.some(p => p.id === state.proyecto)) option(sel, state.proyecto, state.proyecto);
  sel.value = state.proyecto;
}
function renderProjectStatus(extra = '') {
  const box = $('#project-status'); if (!box) return;
  const own = FORMATOS.filter(f => f.proyecto && !f.especial).length, walls = FORMATOS.filter(f => f.especial).length, myblu = FORMATOS.filter(f => f.proyecto && f.myblu).length;
  const what = state.proyecto === GENERAL ? t('Biblioteca general, sin ajustes de cliente.', 'General library, no client settings.')
    : FICHA ? `${t('Biblioteca general', 'General library')} + ${own} ${t('formatos propios', 'own formats')}${myblu ? ` (${myblu} MyBlu)` : ''}${walls ? ` + ${walls} ${t('videowalls segmentados', 'segmented video walls')}` : ''}.`
    : t('Sin ficha propia: usa solo la biblioteca general.', 'No project file: uses the general library only.');
  const src = yokupSource === 'live' ? t('Proyectos de Yokup en vivo.', 'Live Yokup projects.')
    : yokupSource === 'saved' ? t(`Proyectos de Yokup: copia guardada (${yokupDate}).`, `Yokup projects: saved copy (${yokupDate}).`) : '';
  box.textContent = [extra, what, src].filter(Boolean).join(' ');
}
// «Perfil de formatos»: biblioteca general siempre; la familia del proyecto y sus videowalls solo si la ficha los trae.
function renderProfiles() {
  const sel = $('#format-profile'), fam = FICHA?.familias || {}, name = FICHA?.nombre || '';
  const set = (value, label, on) => { const o = sel.querySelector(`option[value="${value}"]`); if (!o) return; o.textContent = label; o.disabled = !on; o.hidden = !on; };
  set('proyecto', fam.proyecto ? (EN ? fam.proyecto.en : fam.proyecto.es) : `${name} · ${t('formatos propios', 'own formats')}`, hasFamily('proyecto') && FORMATOS.some(f => f.proyecto && !f.especial));
  set('especiales', fam.especiales ? (EN ? fam.especiales.en : fam.especiales.es) : `${name} · ${t('videowalls segmentados', 'segmented video walls')}`, FORMATOS.some(f => f.especial));
  sel.value = state.profile;
  const notes = $('#project-notes'), box = notes?.closest('details');
  if (notes) notes.textContent = FICHA?.notas ? (EN ? FICHA.notas.en : FICHA.notas.es) : '';
  if (box) box.hidden = !FICHA;
  const wallNote = document.querySelector('.especiales-note'); if (wallNote) wallNote.hidden = !FORMATOS.some(f => f.especial);
}
function syncURL() {
  try {
    const u = new URL(location.href);
    if (state.proyecto === GENERAL) u.searchParams.delete('proyecto'); else u.searchParams.set('proyecto', state.proyecto);
    if (u.href !== location.href) history.replaceState(history.state, '', u.href);
  } catch (_) {}
  try { if (state.proyecto === GENERAL) localStorage.removeItem(PROJECT_KEY); else localStorage.setItem(PROJECT_KEY, state.proyecto); } catch (_) {}
}
let switching = 0;
async function switchProject(id) {
  saveSettings();
  const turn = ++switching, entry = INDEX.find(x => x.id === id);
  let ficha = null, lists = {}, note = '', estancos = null;
  if (entry) {
    try { ({ficha, lists, estancos} = await loadFicha(entry)); }
    catch (_) { note = t('No se pudo leer la ficha del proyecto: se usa la biblioteca general.', 'Could not read the project file: using the general library.'); }
  }
  if (turn !== switching) return; // a later pick won while this ficha was loading
  FICHA = ficha; state.proyecto = id;
  campaigns = [...projectCampaigns(ficha), ...CAMPAIGNS];
  restoreSettings(lists);
  setEstancos(estancos);
  renderProfiles(); renderCampaigns(); renderProjects(); renderProjectStatus(note); syncURL();
  buildGrid();
}
$('#adapter-project').onchange = (e) => { switchProject(e.target.value); };
// Yokup en vivo: GET público con CORS *. Si tarda o falla, se queda la copia del repositorio.
function fetchYokup() {
  const ctl = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = ctl ? setTimeout(() => ctl.abort(), 4000) : 0;
  return fetch(YOKUP_URL, {cache: 'no-store', headers: {Accept: 'application/json'}, ...(ctl ? {signal: ctl.signal} : {})})
    .then(r => r.ok ? r.json() : null)
    .then(json => { const list = parseYokup(json); if (!list.length) return; yokupSource = 'live'; PROJECTS = mergeProjects(list, INDEX); renderProjects(); renderProjectStatus(); })
    .catch(() => {}).finally(() => clearTimeout(timer));
}

const [indexJSON, yokupJSON] = await Promise.all([getJSON('/' + PROJECTS_DIR + 'index.json').catch(() => null), getJSON('/' + PROJECTS_DIR + 'yokup.json').catch(() => null)]);
INDEX = Array.isArray(indexJSON?.proyectos) ? indexJSON.proyectos : [];
const savedList = parseYokup(yokupJSON);
if (savedList.length) { yokupSource = 'saved'; yokupDate = String(yokupJSON.actualizado || ''); }
PROJECTS = mergeProjects(savedList, INDEX);
// Altadis preferences saved before the fichas move to their project once; nothing is deleted.
let migratedTo = null; try { migratedTo = migrateStorage(localStorage, STORAGE_KEY); } catch (_) {}
campaignWorkshop=mountCampaign({t,queue,openTwin:f=>twin?.open(f)});
let query = null, lastProject = null;
try { query = new URLSearchParams(location.search).get('proyecto'); } catch (_) {}
try { lastProject = localStorage.getItem(PROJECT_KEY) || migratedTo; } catch (_) { lastProject = migratedTo; }
const live = fetchYokup();
let start = initialProject({query, saved: lastProject, projects: PROJECTS, index: INDEX});
// An id that is not in the saved copy may be a brand-new Yokup project: wait for the live list.
if (start.unknown) { await live; start = initialProject({query, saved: lastProject, projects: PROJECTS, index: INDEX}); }
await switchProject(start.id);
if (start.unknown) renderProjectStatus(t(`«${start.unknown}» no es un proyecto de Yokup: se usa ${projectName(start.id) === GENERAL ? 'General' : projectName(start.id)}.`, `«${start.unknown}» is not a Yokup project: using ${projectName(start.id) === GENERAL ? 'General' : projectName(start.id)}.`));
emptySource(); loop();

// El desplegable y el contador del Stock viven en ./stock-select.js (script clásico aparte): si este
// módulo falla en un navegador, el Stock se lista igual y avisa si no se puede leer.

studio=mountStudio({t,formats:projectFormatList,ficha:()=>FICHA,doc:()=>EST,baseDoc:()=>EST_BASE,applications:()=>estApplications,settings:()=>({...snapshot(state,FORMATOS),crear:state.crear}),
ready:mediaReady,destino,geometry,reference:(cv,f)=>paint(cv,destino(f),'blur',{fx:.5,fy:.5,zoom:1}),
draw:(cv,f,bg)=>{if(campaignWorkshop?.draw(cv,f))return;if(advertisement?.draw(cv,f))return;if(creando(f)&&!bg)paintCrear(cv,destino(f),f);else paint(cv,destino(f),modoEfectivo(f),state.fmt[f.id],null,bg);},
changed:()=>buildGrid(),visit:f=>twin?.open(f),apply:(estanco,formato,on)=>{const next=estApplications.filter(x=>x.estanco!==estanco||x.formato!==formato);if(on)next.push({estanco,formato});
const valid=restoreApplications(next,EST_BASE,projectFormatList());try{localStorage.setItem(APPLICATION_KEY(FICHA.id),JSON.stringify(valid));}catch(_){throw new Error('storage');}
estApplications=valid;EST=applyApplications(EST_BASE,valid,projectFormatList());renderEstancos();}});

let twinPlayback=null;
function startTwinPlayback(){
  if(campaignWorkshop?.active())return;
  twinPlayback={kind:srcKind,paused:srcKind==='video'?video.paused:srcKind==='anim'?anim?.paused:true,muted:video.muted};
  if(srcKind==='video'){video.muted=true;video.play().catch(()=>{});}
  else if(anim)anim.play();
}
function endTwinPlayback(){
  if(!twinPlayback)return;
  if(twinPlayback.kind===srcKind){if(srcKind==='video'){if(twinPlayback.paused)video.pause();video.muted=twinPlayback.muted;}else if(anim&&twinPlayback.paused)anim.pause();}
  twinPlayback=null;
}
twin=mountTwin({t,start:startTwinPlayback,end:endTwinPlayback,ready:()=>campaignWorkshop?.active()?campaignWorkshop.ready():mediaReady(),destino:f=>f.installation?{ancho:f.installation.width,alto:f.installation.height}:destino(f),formats:()=>campaignWorkshop?.active()?campaignWorkshop.formats():FORMATOS.filter(isProjectFormat),background:f=>studio?.background(f),shops:()=>EST?.estancos,shop:()=>studio?.shop(),selectShop:id=>studio?.selectShop(id),draw:(cv,f,bg)=>{if(campaignWorkshop?.draw(cv,f))return;if(advertisement?.draw(cv,f))return;if(creando(f)&&!bg)paintCrear(cv,destino(f),f);else paint(cv,destino(f),modoEfectivo(f),state.fmt[f.id],null,bg);}});
advertisement=mountAdvertisement({t,formats:()=>FORMATOS,selected:selectedFormats,source:()=>({kind:srcKind,image:img,src:state.src}),destino,seconds:()=>stillSec,
textZone:f=>{if(!f.especial)return null;const seg=geometry(f.layout).segments.reduce((a,b)=>a.wall.w*a.wall.h>=b.wall.w*b.wall.h?a:b);return {...seg.wall};},
changed:()=>{buildCardSettings();refreshInfo();drawDirty=true;}});

buildGrid();

async function exportAdvertisements(formats,kinds,extra){
 const frozen=formats.map(f=>({f,a:advertisement.entry(f)}));if(frozen.some(x=>!x.a?.approved))return;
 const seconds=stillSec,ctx={origin:{...state.origin},client:window.PixeriaCliente?.actual?.()||null,duration:seconds,still:true,...(extra||{})};
 const bundles=frozen.map(({f,a})=>{const src={ancho:a.canvas.width,alto:a.canvas.height,fps:25,bitrateKbps:0},label=`${f.nombre} · ${['recreate','reconstruct'].includes(a.action)?t('Recreación','Recreation'):t('Recomposición','Recomposition')}`;
  const jobs=f.output==='png'?[]:f.especial?[...(kinds!=='segments'?[atlasJob(src,f.layout,'contain',defaults(),especialTech(f))]:[]),...(kinds!=='atlas'?[segmentsJob(src,f.layout,'contain',defaults(),especialTech(f))]:[])]:[exportJob(src,perfil(f),plan(f)||{},'contain',defaults(),state.srcName,f.id)];
  return{f,a,label,jobs:jobs.map(job=>({...stillJob(job,seconds,'input.png'),label,input:'input.png'}))};});
 const budget=exportBudget(seconds,bundles.flatMap(b=>b.jobs));if(budget){$('#export-status').textContent=t('El lote supera el presupuesto local. Exporta menos formatos o reduce la duración.','Batch exceeds the local budget. Export fewer sizes or reduce duration.');return;}
 batchIds=new Set();batchTotal=bundles.reduce((n,b)=>n+(b.jobs.length||1),0);$('#export-status').textContent=`0/${batchTotal}`;
 for(const {f,a,label,jobs} of bundles){let blob=await new Promise(resolve=>a.canvas.toBlob(resolve,kinds==='jpg'?'image/jpeg':'image/png',.94));if(!blob)continue;
  if(!jobs.length){if(f.print&&kinds!=='jpg')blob=new Blob([pngDensity(new Uint8Array(await blob.arrayBuffer()))],{type:'image/png'});const jpg=kinds==='jpg';queue.addReady({label,sub:t('Texto completo recompuesto','Complete typeset copy'),sourceURL:null,format:f,...ctx,receta:a.action},[{blob,filename:`${f.id}-${a.action}-${a.canvas.width}x${a.canvas.height}.${jpg?'jpg':'png'}`}]);}
  else {const sourceURL=URL.createObjectURL(blob);for(const job of jobs)queue.add({label,sub:t('Composición aprobada · texto completo','Approved composition · complete copy'),sourceURL,job,format:f,...ctx,receta:a.action});}
 }
}
