// Pixeria · Adaptaciones (FLT-101349, 2-oct-2026): un vídeo → todas las pantallas.
// Render en vivo en canvas; las reglas son las del motor de signage de Pixeria.
// Reutiliza el motor de reglas real de Pixeria: assets/signage-perfiles.js
import { perfilDeSalida, planificar } from '/assets/signage-perfiles.js';
import { STORAGE_KEY, defaults, restore, snapshot, rect, cropWindow, exportBudget, exportJob, STILL, stillSeconds, stillJob, animJob, animPreviewJob } from './adapter-core.mjs';
import { createEngine, MAX_SOURCE_BYTES } from './adapter-export.js';
import { createExportQueue } from './export-queue.js';
import { publishAdaptation, shortFormat, adaptationTitle } from './stock-publish.mjs';
import { createCatalog, CATEGORIES, CAMPAIGNS, matchingFormats, customFormat, restoreCustomFormats, formatFamily, isProjectFormat, isLibrarySize, applyCampaign, setGroupSelected, groupSelection, selectAllSizes } from './format-catalog.mjs';
import { GENERAL, YOKUP_URL, PROJECT_KEY, projectStorageKey, formatRef, resolveRef, projectLibrary, projectCampaigns, parseYokup, mergeProjects, migrateStorage, initialProject } from './proyectos-core.mjs';
import { geometry, segmentsJob, atlasJob, atlasFilename, segmentFilename, segmentKbps } from './especiales-core.mjs';
import { pngDensity } from './png-density.mjs';
import { gifPlayer, hasImageDecoder, decodeHEIC, LIBHEIF, rasterSVG, svgCache } from './fuentes-especiales.mjs';

const EN = document.documentElement.lang === 'en';
const t = (es, en) => EN ? en : es;
const $ = (s) => document.querySelector(s);
const FORMATOS = createCatalog(EN);
const MODOS = { auto: t('Auto (regla Pixeria)', 'Auto (Pixeria rule)'), cover: t('Recorte', 'Crop'), blur: t('Expandir · fondo desenfocado', 'Expand · blurred background'), contain: t('Contener · negro', 'Contain · black') };
const picker = {query:'',orientation:'all',open:new Set()};
const state = { sel: '', proyecto: GENERAL, profile: 'standard', compat: 'fhd', modoGlobal: 'auto', fmt: {}, src: { ancho: 0, alto: 0, fps: 25, bitrateKbps: 0 }, srcName: '', origin: { id: null, title: '' } };
FORMATOS.forEach((f) => (state.fmt[f.id] = { modo: 'auto', fx: 0.5, fy: 0.5, zoom: 1 }));
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
  FORMATOS.forEach(f => { f.on = f.proyecto ? !f.especial : RATIOS.includes(f.id); state.fmt[f.id] = defaults(); });
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
    const saved = restore(readJSON(keyFor(state.proyecto)), FORMATOS);
    if (saved) { Object.assign(state, {profile:saved.profile,compat:saved.compat,modoGlobal:saved.modoGlobal,fmt:saved.fmt}); FORMATOS.forEach(f=>f.on=saved.selected.includes(f.id)); }
  } catch (_) { /* corrupt or unavailable storage: keep safe defaults */ }
  syncControls(); initialized = true;
}
// kinds applies to special layouts: the client delivery file, one MP4 per screen, or both.
function especialJobs(f,kinds,src=state.src) {
  const tech=especialTech(f),mode=modoEfectivo(f),s=state.fmt[f.id],jobs=[];
  if(kinds!=='segments') jobs.push({...atlasJob(src,f.layout,mode,s,tech),label:`${f.nombre} · ${t('entrega','delivery')}`});
  if(kinds!=='atlas') {
    const job=segmentsJob(src,f.layout,mode,s,tech);job.label=`${f.nombre} · ${job.outputs.length} ${t('pantallas','screens')}`;
    job.outputs.forEach(o=>o.label=`${f.nombre} · ${t('pantalla','screen')} ${o.n}/${o.N}`);jobs.push(job);
  }
  return jobs;
}
// Exports go to the background queue: each line freezes its job (settings, size and
// source) at click time, so the user can keep editing, switch video or go back to step 1.
// Every finished MP4 is also saved to the Stock as a new video: «<title> · <client> · <format>».
let savingToStock=0;
async function saveToStock(item,file) {
  if(file.blob.type!=='video/mp4') return;
  savingToStock++;try {await saveOne(item,file);} finally {savingToStock--;}
}
async function saveOne(item,file) {
  const total=item.files.length,format=shortFormat(item.format,file.output);
  const title=adaptationTitle(item.origin.title,item.client,format);
  item.stock=item.stock||{ok:0,fail:0,ids:[]};
  queue.note(item,t('Guardando en el Stock…','Saving to Stock…'));
  let result;
  try {result=await publishAdaptation(file.blob,{title,originId:item.origin.id,client:item.client,format,width:file.output.W,height:file.output.H,duration:item.duration,still:!!item.still});}
  catch(_) {result={ok:false,error:'network'};}
  if(result.ok){item.stock.ok++;item.stock.ids.push(result.num?`#${result.num}`:result.id);}else item.stock.fail++;
  const done=item.stock.ok+item.stock.fail;
  if(done<total){queue.note(item,`${t('Guardando en el Stock…','Saving to Stock…')} ${done}/${total}`);return;}
  queue.note(item,item.stock.fail
    ?(result.error==='too-big'?t('Supera 70 MB: no se guardó en el Stock; descárgalo.','Over 70 MB: not saved to Stock; download it.'):t('No se pudo guardar en el Stock; descárgalo.','Could not save to Stock; download it.'))
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
  engine:createEngine(),t,onChange:paintBatch,
  onCreate(item){ if (batchIds) batchIds.add(item.id); },
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
async function exportFormats(formats,kinds='both') {
  if(!state.src.ancho || !formats.length) return;
  const status=$('#export-status');status.textContent='';
  const still=isImage(),animated=isAnim(),seconds=stillSec,duration=animated?animSeconds:still?seconds:video.duration;
  const pngFormats=formats.filter(f=>f.output==='png'),mp4Formats=formats.filter(f=>f.output!=='png');
  const build=(f,src)=>f.especial?especialJobs(f,kinds,src).map(job=>({job,f})):[{job:{...exportJob(src,perfil(f),plan(f),modoEfectivo(f),state.fmt[f.id],state.srcName,f.id),label:f.nombre},f}];
  const jobs=mp4Formats.flatMap(f=>build(f,state.src));
  const budget=jobs.length?exportBudget(duration,jobs.map(j=>j.job)):null;
  if(budget) {status.textContent=budget==='batch-size'
    ?t('El lote supera el presupuesto local de memoria. Selecciona menos formatos y expórtalos por separado.','This batch exceeds the local memory budget. Select fewer formats and export them separately.')
    :still?t('Esta duración es demasiado larga para este perfil en el navegador. Baja los segundos del MP4 o usa un perfil de menor resolución.','This length is too long for this profile in the browser. Lower the MP4 seconds or use a lower resolution profile.')
    :t('Este vídeo es demasiado largo para exportarlo con este perfil en el navegador. Usa un clip más corto o un perfil de menor resolución.','This video is too long to export with this profile in the browser. Use a shorter clip or a lower resolution profile.');return;}
  let sourceURL=video.currentSrc||video.src,input=null;
  if(animated) sourceURL=animSourceURL;
  else if(still&&jobs.length&&!svgSrc){({url:sourceURL,input}=await stillSource());}
  const kind=animated?t('GIF animado','animated GIF'):svgSrc?t('SVG vectorial','vector SVG'):t('imagen fija','still image');
  const sub=isPicture()?`${state.srcName} · ${kind}`:state.srcName;
  // Frozen at click time: original content, active client (top bar selector) and duration.
  const ctx={origin:{...state.origin},client:window.PixeriaCliente?.actual?.()||null,duration,still};
  batchIds = new Set();
  batchTotal = pngFormats.length + jobs.length;
  status.textContent = `0/${batchTotal}`;
  const jpg=kinds==='jpg';
  for(const f of pngFormats){
    const p=perfil(f),canvas=document.createElement('canvas');canvas.width=p.ancho;canvas.height=p.alto;
    let override=null;
    if(svgSrc){try{override=await svgExportSource(p,modoEfectivo(f),state.fmt[f.id]);}catch(_){status.textContent=t('No se pudo rasterizar este SVG.','Could not rasterise this SVG.');continue;}}
    drawInto(canvas,f,override);
    if(override)override.el.width=override.el.height=0;
    let blob=await new Promise(resolve=>jpg?canvas.toBlob(resolve,'image/jpeg',0.9):canvas.toBlob(resolve,'image/png'));
    canvas.width=canvas.height=0;
    if(!blob)continue;
    if(f.print&&!jpg)blob=new Blob([pngDensity(new Uint8Array(await blob.arrayBuffer()))],{type:'image/png'});
    queue.addReady({label:`${f.nombre} · ${jpg?'JPG':'PNG'}`,sub,sourceURL:null,format:f,...ctx},[{blob,filename:`${f.id}-${p.ancho}x${p.alto}.${jpg?'jpg':'png'}`}]);
  }
  if(svgSrc){
    // One PNG per format at its own resolution; the job's geometry uses that raster as the source.
    for(const f of mp4Formats){
      const out=f.especial?wallOutput(f):perfil(f);let src;
      try{src=await svgExportSource(out,modoEfectivo(f),state.fmt[f.id]);}catch(_){status.textContent=t('No se pudo rasterizar este SVG.','Could not rasterise this SVG.');continue;}
      const blob=await pngBlob(src.el);src.el.width=src.el.height=0;if(!blob)continue;
      const url=URL.createObjectURL(blob);
      for(const {job} of build(f,src.dims)) queue.add({label:job.label,sub:`${sub} · ${src.raster.ancho}×${src.raster.alto}`,sourceURL:url,job:stillJob(job,seconds,'input.png'),format:f,...ctx});
    }
    return;
  }
  for(const {job,f} of jobs) queue.add({label:job.label,sub,sourceURL,job:animated?animJob(job,animSeconds,'input.gif'):still?stillJob(job,seconds,input):job,format:f,...ctx});
}
$('#export-all').onclick=()=>exportFormats(selectedFormats());
// Back to the active project's defaults (General: the four ratios and the standard library).
$('#reset-settings').onclick=()=>{ resetState(); syncControls(); buildGrid(); };
// Closing the tab mid-export loses the work: the browser asks first.
window.addEventListener('beforeunload',event=>{if(!queue.busy()&&!savingToStock)return;event.preventDefault();event.returnValue=t('Hay exportaciones en curso','Exports are in progress');return event.returnValue;});
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
function buildPicker() {
  const visible=matchingFormats(FORMATOS,{query:picker.query,orientation:picker.orientation,profile:state.profile});
  const container=$('#size-categories');container.replaceChildren();
  for(const cat of CATEGORIES){
    const formats=visible.filter(f=>f.category===cat.id);if(!formats.length)continue;
    const detail=document.createElement('details');detail.className='size-category';detail.open=!!picker.query||picker.open.has(cat.id)||state.profile!=='standard';
    const group=groupSelection(FORMATOS,cat.id);
    const summary=document.createElement('summary');
    const title=document.createElement('span');title.textContent=`${EN?cat.en:cat.es} · ${group.total}`;
    const groupLabel=document.createElement('label');groupLabel.className='group-toggle';
    const groupBox=document.createElement('input');groupBox.type='checkbox';groupBox.checked=group.all;groupBox.indeterminate=!group.all&&!group.none;
    groupBox.setAttribute('aria-label',t('Seleccionar todo el grupo','Select the whole group'));
    groupLabel.addEventListener('click',event=>event.stopPropagation());
    groupBox.addEventListener('click',event=>event.stopPropagation());
    groupBox.onchange=()=>{setGroupSelected(FORMATOS,cat.id,groupBox.checked);buildGrid();};
    const groupText=document.createElement('span');groupText.textContent=t('Seleccionar todo el grupo','Select the whole group');
    groupLabel.append(groupBox,groupText);summary.append(title,groupLabel);detail.append(summary);
    detail.ontoggle=()=>{if(detail.open)picker.open.add(cat.id);else picker.open.delete(cat.id);};
    for(const f of formats){
      const label=document.createElement('label');label.className='size-option';
      const input=document.createElement('input');input.type='checkbox';input.checked=f.on;input.setAttribute('aria-label',`${t('Tamaño','Size')} ${f.nombre}`);
      input.onchange=()=>{f.on=input.checked;buildGrid();};
      const text=document.createElement('span');const name=document.createElement('strong');name.textContent=f.nombre;
      const dims=document.createElement('small');const p=perfil(f);dims.textContent=f.especial?`${p.ancho} × ${p.alto} px · ${f.layout.pantallas} ${t('pantallas','screens')} · MP4`:`${p.ancho} × ${p.alto} px · ${f.output==='png'?'PNG':'MP4'}${f.regional?t(' · Polonia',' · Poland'):''}`;
      text.append(name,dims);label.append(input,text);detail.append(label);
    }
    container.append(detail);
  }
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
$('#all-sizes').onclick=()=>{state.profile='standard';$('#format-profile').value='standard';syncCompat();selectAllSizes(FORMATOS);buildGrid();};
$('#size-search').oninput=e=>{picker.query=e.target.value;buildPicker();};
$('#size-orientation').onchange=e=>{picker.orientation=e.target.value;buildPicker();};
$('#clear-formats').onclick=()=>{selectedFormats().forEach(f=>f.on=false);buildGrid();};
$('#custom-size-form').onsubmit=e=>{
  e.preventDefault();const f=customFormat($('#custom-width').value,$('#custom-height').value,EN);
  if(!f){$('#custom-status').textContent=t('Usa dimensiones pares de 64 a 3840 px, máximo 8,3 Mpx.','Use even dimensions from 64 to 3840 px, maximum 8.3 MP.');return;}
  const existing=FORMATOS.find(x=>x.id===f.id);
  if(!existing&&FORMATOS.filter(x=>x.user).length>=12){$('#custom-status').textContent=t('Máximo 12 tamaños personalizados guardados.','Maximum 12 saved custom sizes.');return;}
  if(existing)existing.on=true;else{f.on=true;FORMATOS.push(f);state.fmt[f.id]=defaults();}
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
    const p = perfil(f); const cw = p.ancho >= p.alto ? 384 : Math.round(384 * p.ancho / p.alto); const ch = Math.round(cw * p.alto / p.ancho);
    const el = document.createElement('div'); el.className = 'fmt'; el.dataset.f = f.id;
    el.innerHTML = `<div class="fmt-title"><h3>${f.nombre}</h3><button class="remove-format" type="button" aria-label="${t('Quitar','Remove')} ${f.nombre}">×</button></div><div class="dims">${p.ancho}×${p.alto}</div>
      <div class="stage"><canvas width="${cw}" height="${ch}"></canvas></div>
      <button class="pill accent export-one" type="button"></button>`;
    el.querySelector('.remove-format').onclick=(e)=>{e.stopPropagation();f.on=false;buildGrid();};
    el.querySelector('.export-one').onclick=(e)=>{e.stopPropagation();exportFormats([f]);};
    // Display (no print) from a still image: JPG as well, lighter for ad networks.
    if(f.category==='display'&&f.output==='png'){const j=document.createElement('button');j.type='button';j.className='pill export-one export-jpg';j.textContent='JPG';j.hidden=!isPicture();j.title=t('JPG calidad 90, más ligero para redes de display','JPG quality 90, lighter for display networks');j.onclick=(e)=>{e.stopPropagation();exportFormats([f],'jpg');};el.querySelector('.export-one').after(j);}
    selectable(el, f);
    g.appendChild(el);
  });
  refreshOriginal();
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
  const pick = () => { if (state.sel === f.id) return; state.sel = f.id; markSelected(); buildCardSettings(); refreshInfo(); };
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
  const L = f.layout, size = f.especial ? `${L.entrega[0]}×${L.entrega[1]}` : `${perfil(f).ancho}×${perfil(f).alto}`;
  box.innerHTML = `<div class="card-sel-hd">${t('Tarjeta seleccionada','Selected card')}: <b>${f.nombre}</b> · ${size}</div>${controlsHTML()}<div class="aviso"></div>`
    + (f.especial && L.ambiguedades.length ? `<ul class="esp-warn">${L.ambiguedades.map(a => `<li>${t('Ambigüedad en el PDF','PDF ambiguity')}: ${a}</li>`).join('')}</ul>` : '');
  bindControls(box, f);
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
  el.innerHTML = `<div class="fmt-title"><h3>${f.nombre}</h3><button class="remove-format" type="button" aria-label="${t('Quitar','Remove')} ${f.nombre}">×</button></div>
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
  const atlas = state.src.ancho ? atlasJob(state.src, L, m, s, tech) : null;
  return { aviso, plan: files.join('\n') + (atlas ? `\n\nffmpeg ${pictureJob(atlas).args.map(a => JSON.stringify(a)).join(' ')}` : '') };
}
function cardAviso(f) {
  if (f.especial) return especialInfo(f).aviso;
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
  drawDirty=true;saveSettings();
  const chosen=selectedFormats().length;
  $('#export-all').textContent=t(`Adaptar · ${chosen}`,`Adapt · ${chosen}`);
  $('#export-all').disabled=!state.src.ancho || !chosen;
  const allCount=FORMATOS.filter(isLibrarySize).length;
  const allLabel=$('#all-sizes .all-sizes-count');if(allLabel)allLabel.textContent=String(allCount);
  document.querySelectorAll('.export-one').forEach(el=>el.disabled=!state.src.ancho);
  labelExports();
  const selF = FORMATOS.find((x) => x.id === state.sel && x.on), selAviso = $('#card-settings .aviso');
  if (selF && selAviso) selAviso.textContent = cardAviso(selF);
  const rows = selectedFormats().map((f) => {
    if (f.especial) return `<div class="fmt${f.id===state.sel?' sel':''}" data-plan="${f.id}" style="margin-bottom:8px"><h3>${f.nombre} · ${f.layout.entrega[0]}×${f.layout.entrega[1]}</h3><pre style="white-space:pre-wrap;font-size:11px;color:var(--link)">${especialInfo(f).plan.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c])}</pre></div>`;
    const p = plan(f); if(f.output==='png')return `<p>${f.nombre} · ${perfil(f).ancho}×${perfil(f).alto} · PNG${f.print?' · 150 ppp':''}${isPicture()&&f.category==='display'?' · JPG':''}</p>`; if (!p || p.error) return `<p>${f.nombre}: ${p ? p.error : t('sin contenido','no content')}</p>`;
    return `<div class="fmt${f.id===state.sel?' sel':''}" data-plan="${f.id}" style="margin-bottom:8px"><h3>${f.nombre} · ${p.ancho}×${p.alto}</h3>
      <div class="dims">encaje <b>${p.encaje}</b> · adaptación <b>${p.adaptacion}</b> · recorte ${Math.round(p.recortePerdido * 100)}%<br>
      H.264 ${p.h264Perfil}@${p.h264Nivel} · ${p.bitrateKbps} kbps (${p.bitrateMotivo}) · ${p.fps} fps · GOP ${p.gopSegundos}s${isImage() ? ` · ${t('imagen fija','still image')} ${stillSec} s · ${t('sin audio','no audio')}` : isAnim() ? ` · ${t('GIF animado','animated GIF')} ${secLabel(animSeconds)} s → 25 fps · ${t('sin audio','no audio')}` : ''}</div>
      <div class="aviso">${(p.avisos || []).map(a=>/generativ|imagina/i.test(a)?t('Fondo desenfocado derivado del original; sin expansión IA.','Blurred background derived from the original; no AI expansion.'):a).join(' · ')}</div><pre style="white-space:pre-wrap;font-size:11px;color:var(--link)">${ffmpegCmd(f)}</pre></div>`;
  });
  $('#plan-tecnico').innerHTML = rows.join('');
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
      if (a) { a.textContent = `${t('Exportar entrega · 1 MP4','Export delivery · 1 MP4')} ${W}×${H}${sec}`; a.title = mp4Title; }
      if (s) { s.textContent = `${t('Exportar por pantalla','Export per screen')} · ${g.segments.length} MP4 ${cw}×${ch}${sec}`; s.title = t('MP4 H.264 · 25 fps · sin audio','MP4 H.264 · 25 fps · no audio') + sec; }
      return;
    }
    const b = el.querySelector('.export-one:not(.export-jpg)'); if (!b) return;
    if (f.output === 'png') { b.textContent = t('Exportar PNG','Export PNG'); b.title = f.print ? t('PNG RGB a 150 ppp','RGB PNG at 150 ppi') : 'PNG'; }
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
  const job=pictureJob(exportJob(state.src,perfil(f),plan(f)||{},modoEfectivo(f),state.fmt[f.id],state.srcName,f.id));
  return 'ffmpeg ' + job.args.map(arg=>JSON.stringify(arg==='output.mp4'?job.filename:arg)).join(' ');
}

// ── Render en vivo (canvas) ─────────────────────────────────────────────────
function drawInto(cv, f, override) { paint(cv, perfil(f), modoEfectivo(f), state.fmt[f.id], override); }
// What the preview draws: the media element, or for an SVG a raster at this canvas' needed resolution
// (cached in √2 steps; the base image is used for the frame or two until it arrives).
const SVG_PREVIEW = {paso: true, maxLado: 4096, maxPx: 2048 * 2048};
function drawSource(W, H, mode, s) {
  if (!svgSrc || !svgRasters) return {el: media(), dims: state.src};
  const r = PF.svgRaster(svgSrc.medidas, W, H, mode, s, SVG_PREVIEW);
  const c = svgRasters.get(r.ancho, r.alto, () => { drawDirty = true; });
  return c ? {el: c, dims: {ancho: c.width, alto: c.height}} : {el: img, dims: state.src};
}
function paint(cv, output, m, s, override) {
  const ctx = cv.getContext('2d'), W = cv.width, H = cv.height;
  if (!mediaReady()) return;
  const ratio=W/output.ancho;
  const {el: src, dims} = override || drawSource(W, H, m, s);
  const drawRect=(mode,settings)=>{const r=rect(dims,output.ancho,output.alto,mode,settings);return [r.x*ratio,r.y*ratio,r.w*ratio,r.h*ratio];};
  ctx.filter = 'none'; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  const drawCrop=settings=>{const c=cropWindow(dims,output.ancho,output.alto,settings);ctx.drawImage(src,c.x,c.y,c.w,c.h,0,0,W,H);};
  if (m === 'cover') { drawCrop(s); return; }
  if (m === 'blur') { ctx.filter = `blur(${14*Math.max(output.ancho,output.alto)/384*ratio}px) brightness(0.85)`; drawCrop({zoom:1.1,fx:.5,fy:.5}); ctx.filter = 'none'; }
  ctx.drawImage(src, ...drawRect('contain',s));
}
// Preview only: the wall is painted once, then every screen is copied into its
// delivery cell, exactly as the encoder cuts them. Cut lines and numbers are overlays.
function drawEspecial(el, f) {
  const wall = el.querySelector('canvas.wall'), atlas = el.querySelector('canvas.atlas'); if (!wall || !mediaReady()) return;
  const g = geometry(f.layout); paint(wall, wallOutput(f), modoEfectivo(f), state.fmt[f.id]);
  const k = wall.width / g.pared.ancho, a = atlas.width / g.entrega.ancho, ctx = atlas.getContext('2d');
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, atlas.width, atlas.height);
  for (const seg of g.segments) ctx.drawImage(wall, seg.wall.x * k, seg.wall.y * k, seg.wall.w * k, seg.wall.h * k, seg.atlas.x * a, seg.atlas.y * a, seg.atlas.w * a, seg.atlas.h * a);
  const label = (c, x, y, text, size) => { c.font = `700 ${size}px ui-monospace,monospace`; const w = c.measureText(text).width + size * .8; c.fillStyle = 'rgba(6,13,20,.82)'; c.fillRect(x + 3, y + 3, w, size * 1.5); c.fillStyle = '#71f4dc'; c.fillText(text, x + 3 + size * .4, y + 3 + size * 1.13); };
  const wc = wall.getContext('2d'); wc.strokeStyle = '#71f4dc'; wc.lineWidth = 2; wc.setLineDash([8, 6]);
  for (const seg of g.segments) { if (seg.n > 1) { wc.beginPath(); wc.moveTo(seg.wall.x * k, 0); wc.lineTo(seg.wall.x * k, wall.height); wc.stroke(); } label(wc, seg.wall.x * k, seg.wall.y * k, String(seg.n), Math.round(Math.min(wall.height * .17, seg.wall.w * k / 3))); }
  ctx.strokeStyle = '#71f4dc'; ctx.lineWidth = 1; ctx.setLineDash([5, 4]);
  for (const seg of g.segments) { ctx.strokeRect(seg.atlas.x * a + .5, seg.atlas.y * a + .5, seg.atlas.w * a - 1, seg.atlas.h * a - 1); label(ctx, seg.atlas.x * a, seg.atlas.y * a, String(seg.n), Math.max(10, Math.min(18, seg.atlas.w * a / 6))); }
  ctx.setLineDash([]); ctx.strokeStyle = '#ff6a3d';
  for (const c of g.unused) { const [x, y, w, h] = [c.x * a, c.y * a, c.w * a, c.h * a]; ctx.fillStyle = '#111'; ctx.fillRect(x, y, w, h); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y + h); ctx.moveTo(x + w, y); ctx.lineTo(x, y + h); ctx.stroke(); }
}
let drawDirty=true,lastFrame=-1;
function loop(now) {
  if(anim) anim.tick(now ?? performance.now());
  const frame = anim ? anim.frameNo : video.currentTime;
  if(drawDirty||frame!==lastFrame){
  document.querySelectorAll('.fmt[data-f]').forEach((el) => { const f = FORMATOS.find((x) => x.id === el.dataset.f); if (f.especial) { drawEspecial(el, f); return; } const c = el.querySelector('canvas'); if (c) drawInto(c, f); });
  const oc = document.querySelector('#grid .fmt-original canvas');
  if (oc && (isPicture() ? mediaReady() : video.readyState >= 2)) { const {el} = drawSource(oc.width, oc.height, 'contain', defaults()); oc.getContext('2d').clearRect(0, 0, oc.width, oc.height); oc.getContext('2d').drawImage(el, 0, 0, oc.width, oc.height); }
  drawDirty=false;lastFrame=frame;
  }
  requestAnimationFrame(loop);
}

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
  state.origin = {id:origin.id||null,title:origin.title||name};
  releaseStill(); releaseDerived(); stopAnim();
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
function emptySource() { cargaTurno++; releaseStill(); releaseDerived(); stopAnim(); if (svgRasters) { svgRasters.clear(); svgRasters = null; } svgSrc = null; fuente = null; publicarFuente('inicio'); srcKind = 'video'; img.removeAttribute('src'); syncKind(); video.removeAttribute('src'); video.load(); state.srcName = ''; state.src = {ancho:0,alto:0,fps:25,bitrateKbps:0}; $('#src-info').textContent = ''; $('#src-msg').textContent = ''; $('#src-preview').hidden = true; $('#btn-adaptar').disabled = true; $('.step[data-go="2"]').disabled = true; goStep(1); refreshInfo(); drawDirty = true; document.querySelectorAll('.fmt canvas').forEach((c) => c.getContext('2d').clearRect(0, 0, c.width, c.height)); }
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
  if (n === 2 && !state.src.ancho) return;
  if (n !== 1) pausePaso1();
  $('#paso-1').hidden = n !== 1; $('#paso-2').hidden = n !== 2; document.body.dataset.paso = String(n);
  document.querySelectorAll('.steps .step').forEach(b => { if (+b.dataset.go === n) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); });
  if (n === 2) { drawDirty = true; buildCardSettings(); refreshInfo(); }
  window.scrollTo({top: 0});
}
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
  const out = {ficha, lists};
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
  let ficha = null, lists = {}, note = '';
  if (entry) {
    try { ({ficha, lists} = await loadFicha(entry)); }
    catch (_) { note = t('No se pudo leer la ficha del proyecto: se usa la biblioteca general.', 'Could not read the project file: using the general library.'); }
  }
  if (turn !== switching) return; // a later pick won while this ficha was loading
  FICHA = ficha; state.proyecto = id;
  campaigns = [...projectCampaigns(ficha), ...CAMPAIGNS];
  restoreSettings(lists);
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
