// Pixeria · Adaptaciones (FLT-101349, 2-oct-2026): un vídeo → todas las pantallas.
// Render en vivo en canvas; las reglas son las del motor de signage de Pixeria.
// Reutiliza el motor de reglas real de Pixeria: assets/signage-perfiles.js
import { perfilDeSalida, planificar } from '/assets/signage-perfiles.js';
import { STORAGE_KEY, defaults, restore, snapshot, rect, cropWindow, exportBudget, exportJob } from './adapter-core.mjs';
import { createEngine, MAX_SOURCE_BYTES } from './adapter-export.js';
import { createExportQueue } from './export-queue.js';
import { publishAdaptation, shortFormat, adaptationTitle } from './stock-publish.mjs';
import { createCatalog, CATEGORIES, CAMPAIGNS, matchingFormats, customFormat, restoreCustomFormats, formatFamily } from './format-catalog.mjs';
import { geometry, segmentsJob, atlasJob, atlasFilename, segmentFilename, segmentKbps } from './especiales-core.mjs';
import { pngDensity } from './png-density.mjs';

const EN = document.documentElement.lang === 'en';
const t = (es, en) => EN ? en : es;
const $ = (s) => document.querySelector(s);
const FORMATOS = createCatalog(EN);
const MODOS = { auto: t('Auto (regla Pixeria)', 'Auto (Pixeria rule)'), cover: t('Recorte', 'Crop'), blur: t('Expandir · fondo desenfocado', 'Expand · blurred background'), contain: t('Contener · negro', 'Contain · black') };
const picker = {query:'',orientation:'all',open:new Set()};
const state = { sel: '', profile: 'standard', compat: 'fhd', modoGlobal: 'auto', fmt: {}, src: { ancho: 0, alto: 0, fps: 25, bitrateKbps: 0 }, srcName: '', origin: { id: null, title: '' } };
FORMATOS.forEach((f) => (state.fmt[f.id] = { modo: 'auto', fx: 0.5, fy: 0.5, zoom: 1 }));

const video = $('#src');
let initialized = false;
const selectedFormats = () => FORMATOS.filter(f => f.on && formatFamily(f) === state.profile);
// Biblioteca uses the compatibility selector; client profiles keep native resolutions.
const syncCompat = () => { $('#compat').disabled = state.profile !== 'standard'; };
function saveSettings() {
  if (!initialized) return;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot(state, FORMATOS))); $('#settings-status').textContent = t('Ajustes guardados en este navegador. Al volver, elige de nuevo tu archivo local.', 'Settings saved in this browser. Select your local file again when returning.'); }
  catch (_) { $('#settings-status').textContent = t('Este navegador no permite guardar los ajustes.', 'This browser does not allow saving settings.'); }
}
function restoreSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
    restoreCustomFormats(raw?.custom,EN).forEach(f=>{FORMATOS.push(f);state.fmt[f.id]=defaults();});
    const saved = restore(raw, FORMATOS);
    if (saved) { Object.assign(state, {profile:saved.profile,compat:saved.compat,modoGlobal:saved.modoGlobal,fmt:saved.fmt}); FORMATOS.forEach(f=>f.on=saved.selected.includes(f.id)); }
  } catch (_) { /* corrupt or unavailable storage: keep safe defaults */ }
  $('#format-profile').value=state.profile; $('#compat').value=state.compat; $('#modo-global').value=state.modoGlobal;
  syncCompat();initialized=true;
}
// kinds applies to special layouts: the client delivery file, one MP4 per screen, or both.
function especialJobs(f,kinds) {
  const tech=especialTech(f),mode=modoEfectivo(f),s=state.fmt[f.id],jobs=[];
  if(kinds!=='segments') jobs.push({...atlasJob(state.src,f.layout,mode,s,tech),label:`${f.nombre} · ${t('entrega','delivery')}`});
  if(kinds!=='atlas') {
    const job=segmentsJob(state.src,f.layout,mode,s,tech);job.label=`${f.nombre} · ${job.outputs.length} ${t('pantallas','screens')}`;
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
  try {result=await publishAdaptation(file.blob,{title,originId:item.origin.id,client:item.client,format,width:file.output.W,height:file.output.H,duration:item.duration});}
  catch(_) {result={ok:false,error:'network'};}
  if(result.ok){item.stock.ok++;item.stock.ids.push(result.num?`#${result.num}`:result.id);}else item.stock.fail++;
  const done=item.stock.ok+item.stock.fail;
  if(done<total){queue.note(item,`${t('Guardando en el Stock…','Saving to Stock…')} ${done}/${total}`);return;}
  queue.note(item,item.stock.fail
    ?(result.error==='too-big'?t('Supera 70 MB: no se guardó en el Stock; descárgalo.','Over 70 MB: not saved to Stock; download it.'):t('No se pudo guardar en el Stock; descárgalo.','Could not save to Stock; download it.'))
    :`${t('En el Stock','In Stock')} ${item.stock.ids.join(' ')}`.trim());
  item.stockTitle=title;
}
const queue = createExportQueue({engine:createEngine(),t,onComplete:saveToStock,onRelease:url=>{if(url!==sourceObjectURL&&url.startsWith('blob:'))URL.revokeObjectURL(url);}});
async function exportFormats(formats,kinds='both') {
  if(!state.src.ancho || !formats.length) return;
  const status=$('#export-status');status.textContent='';
  const pngFormats=formats.filter(f=>f.output==='png');
  const jobs=formats.filter(f=>f.output!=='png').flatMap(f=>f.especial?especialJobs(f,kinds).map(job=>({job,f})):[{job:{...exportJob(state.src,perfil(f),plan(f),modoEfectivo(f),state.fmt[f.id],state.srcName,f.id),label:f.nombre},f}]);
  const budget=jobs.length?exportBudget(video.duration,jobs.map(j=>j.job)):null;
  if(budget) {status.textContent=budget==='batch-size'
    ?t('El lote supera el presupuesto local de memoria. Selecciona menos formatos y expórtalos por separado.','This batch exceeds the local memory budget. Select fewer formats and export them separately.')
    :t('Este vídeo es demasiado largo para exportarlo con este perfil en el navegador. Usa un clip más corto o un perfil de menor resolución.','This video is too long to export with this profile in the browser. Use a shorter clip or a lower resolution profile.');return;}
  const sourceURL=video.currentSrc||video.src,sub=state.srcName;
  // Frozen at click time: original video, active client (top bar selector) and duration.
  const ctx={origin:{...state.origin},client:window.PixeriaCliente?.actual?.()||null,duration:video.duration};
  for(const f of pngFormats){
    const p=perfil(f),canvas=document.createElement('canvas');canvas.width=p.ancho;canvas.height=p.alto;
    drawInto(canvas,f);
    let blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
    canvas.width=canvas.height=0;
    if(!blob)continue;
    if(f.print)blob=new Blob([pngDensity(new Uint8Array(await blob.arrayBuffer()))],{type:'image/png'});
    queue.addReady({label:`${f.nombre} · PNG`,sub,sourceURL:null,format:f,...ctx},[{blob,filename:`${f.id}-${p.ancho}x${p.alto}.png`}]);
  }
  for(const {job,f} of jobs) queue.add({label:job.label,sub,sourceURL,job,format:f,...ctx});
}
$('#export-all').onclick=()=>exportFormats(selectedFormats());
$('#reset-settings').onclick=()=>{
  Object.assign(state,{profile:'standard',compat:'fhd',modoGlobal:'auto'});FORMATOS.forEach(f=>{f.on=['9:16','16:9','1:1','4:5'].includes(f.id);state.fmt[f.id]=defaults();});
  FORMATOS.filter(f=>f.especial).forEach((f,i)=>f.on=i===0);
  $('#format-profile').value='standard';$('#compat').value='fhd';syncCompat();$('#modo-global').value='auto';buildGrid();
};
// Closing the tab mid-export loses the work: the browser asks first.
window.addEventListener('beforeunload',event=>{if(!queue.busy()&&!savingToStock)return;event.preventDefault();event.returnValue=t('Hay exportaciones en curso','Exports are in progress');return event.returnValue;});
window.addEventListener('pagehide',event=>{if(event.persisted)return;queue.cancelAll();queue.clear();if(sourceObjectURL)URL.revokeObjectURL(sourceObjectURL);});

// ── Perfil + plan (motor Pixeria) ───────────────────────────────────────────
function perfil(f) {
  if(f.output==='png')return {ancho:f.custom[0],alto:f.custom[1],orientacion:f.custom[0]>f.custom[1]?'apaisada':f.custom[0]<f.custom[1]?'vertical':'custom',fps:25,techoKbps:8000,sueloKbps:2500,h264:'high@4.0'};
  return f.custom
    ? perfilDeSalida({ formato: 'custom', ancho: f.custom[0], alto: f.custom[1], compatibilidad: f.cliente || f.especial ? 'uhd' : f.native ? (Math.max(...f.custom)>1920||f.custom[0]*f.custom[1]>1920*1080?'uhd':'fhd') : state.compat })
    : perfilDeSalida({ formato: f.id, compatibilidad: state.compat });
}
function plan(f) {
  if (!state.src.ancho) return null;
  try { const output = planificar(state.src, perfil(f)); if (f.cliente || f.especial) output.fps = 25; return output; } catch (e) { return { error: e.message }; }
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
    const summary=document.createElement('summary');summary.textContent=`${EN?cat.en:cat.es} · ${formats.length}`;detail.append(summary);
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
    const campaign=CAMPAIGNS.find(c=>c.id===button.dataset.campaign),formats=FORMATOS.filter(campaign.matches);
    button.querySelector('.campaign-count').textContent=t(`${formats.length} tamaños`,`${formats.length} sizes`);
    button.setAttribute('aria-label',`${t('Añadir','Add')} ${EN?campaign.en:campaign.es}`);
  });
}
$('#campaigns').replaceChildren(...CAMPAIGNS.map(c=>{
  const b=document.createElement('button');b.type='button';b.className='campaign';b.dataset.campaign=c.id;
  const heading=document.createElement('strong');heading.textContent=EN?c.en:c.es;
  const count=document.createElement('span');count.className='campaign-count';
  const description=document.createElement('small');description.textContent=EN?c.descriptionEn:c.descriptionEs;
  b.append(heading,count,description);
  b.onclick=()=>{state.profile='standard';$('#format-profile').value='standard';syncCompat();FORMATOS.filter(c.matches).forEach(f=>f.on=true);buildGrid();};return b;
}));
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
    el.querySelector('.export-one').textContent=f.output==='png'?t('Exportar PNG','Export PNG'):t('Exportar MP4','Export MP4'); el.querySelector('.export-one').onclick=(e)=>{e.stopPropagation();exportFormats([f]);};
    selectable(el, f);
    g.appendChild(el);
  });
  if (!selected.some(f=>f.id===state.sel)) state.sel = selected[0]?.id || '';
  markSelected(); buildCardSettings(); refreshInfo();
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
  box.innerHTML = `<div class="card-sel-hd">${t('Tarjeta seleccionada','Selected card')}: <b>${f.nombre}</b> · ${size}</div>${f.output==='png'?'':controlsHTML()}<div class="aviso"></div>`
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
    <div class="esp-actions"><button class="pill accent export-one export-atlas" type="button">${t('Exportar entrega · 1 MP4','Export delivery · 1 MP4')} ${W}×${H}</button>
    <button class="pill export-one export-segments" type="button">${t('Exportar por pantalla','Export per screen')} · ${g.segments.length} MP4 ${cw}×${ch}</button></div>
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
  const aviso = state.src.ancho ? `${MODOS[m]} · ${t('sobre la pared','on the wall')} ${g.pared.ancho}×${g.pared.alto}${m === 'cover' ? ` · ${Math.round(lost * 100)}% ${t('perdido','lost')}` : ''}${m === 'blur' ? t(' · fondo derivado, sin expansión IA', ' · derived background, no AI expansion') : ''}` : t('Elige un vídeo para calcular el recorte.', 'Choose a video to calculate cropping.');
  const rate = segmentKbps(L, tech.bitrateKbps);
  const files = [`${t('Entrega','Delivery')}: ${atlasFilename(L)} · H.264 ${tech.h264Perfil}@${tech.h264Nivel} · ${tech.bitrateKbps} kbps · ${t('audio si existe','audio if present')}`,
    `${t('Por pantalla','Per screen')}: H.264 ${tech.segmentPerfil}@${tech.segmentNivel} · ${rate} kbps · ${t('sin audio','no audio')} · GOP 1 s`,
    ...g.segments.map(seg => `  ${seg.n}/${seg.N} · ${t('celda','cell')} ${seg.cell} (${seg.atlas.x},${seg.atlas.y}) · ${t('pared','wall')} x=${seg.wall.x} · ${segmentFilename(L, seg.n)}`),
    ...(g.unused.length ? [`${t('Celdas sin uso (negro)','Unused cells (black)')}: ${g.unused.map(c => c.index).join(', ')}`] : []),
    t('Esta página no sincroniza players: la continuidad depende de que arranquen a la vez.','This page does not synchronise players: continuity depends on them starting together.')];
  return { aviso, plan: files.join('\n') + (state.src.ancho ? `\n\nffmpeg ${atlasJob(state.src, L, m, s, tech).args.map(a => JSON.stringify(a)).join(' ')}` : '') };
}
function cardAviso(f) {
  if (f.especial) return especialInfo(f).aviso;
  if (f.output === 'png') return t('Fotograma actual en PNG.','Current frame as PNG.');
  const p = plan(f), m = modoEfectivo(f), settings = state.fmt[f.id];
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
    ? `${MODOS[m]} · ${Math.round(lost * 100)}% ${t('perdido', 'lost')}${m === 'blur' ? t(' · fondo derivado, sin expansión IA', ' · derived background, no AI expansion') : ''}`
    : t('Elige un vídeo para calcular el recorte.', 'Choose a video to calculate cropping.');
}
function refreshInfo() {
  drawDirty=true;saveSettings();
  $('#export-all').disabled=!state.src.ancho || !selectedFormats().length;
  document.querySelectorAll('.export-one').forEach(el=>el.disabled=!state.src.ancho);
  const selF = FORMATOS.find((x) => x.id === state.sel && x.on), selAviso = $('#card-settings .aviso');
  if (selF && selAviso) selAviso.textContent = cardAviso(selF);
  const rows = selectedFormats().map((f) => {
    if (f.especial) return `<div class="fmt${f.id===state.sel?' sel':''}" data-plan="${f.id}" style="margin-bottom:8px"><h3>${f.nombre} · ${f.layout.entrega[0]}×${f.layout.entrega[1]}</h3><pre style="white-space:pre-wrap;font-size:11px;color:#9fc3ff">${especialInfo(f).plan.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c])}</pre></div>`;
    const p = plan(f); if(f.output==='png')return `<p>${f.nombre} · ${perfil(f).ancho}×${perfil(f).alto} · PNG${f.print?' · 150 ppp':''}</p>`; if (!p || p.error) return `<p>${f.nombre}: ${p ? p.error : 'sin vídeo'}</p>`;
    return `<div class="fmt${f.id===state.sel?' sel':''}" data-plan="${f.id}" style="margin-bottom:8px"><h3>${f.nombre} · ${p.ancho}×${p.alto}</h3>
      <div class="dims">encaje <b>${p.encaje}</b> · adaptación <b>${p.adaptacion}</b> · recorte ${Math.round(p.recortePerdido * 100)}%<br>
      H.264 ${p.h264Perfil}@${p.h264Nivel} · ${p.bitrateKbps} kbps (${p.bitrateMotivo}) · ${p.fps} fps · GOP ${p.gopSegundos}s</div>
      <div class="aviso">${(p.avisos || []).map(a=>/generativ|imagina/i.test(a)?t('Fondo desenfocado derivado del original; sin expansión IA.','Blurred background derived from the original; no AI expansion.'):a).join(' · ')}</div><pre style="white-space:pre-wrap;font-size:11px;color:#9fc3ff">${ffmpegCmd(f)}</pre></div>`;
  });
  $('#plan-tecnico').innerHTML = rows.join('');
}
function ffmpegCmd(f) {
  if(!state.src.ancho) return '';
  const job=exportJob(state.src,perfil(f),plan(f)||{},modoEfectivo(f),state.fmt[f.id],state.srcName,f.id);
  return 'ffmpeg ' + job.args.map(arg=>JSON.stringify(arg==='output.mp4'?job.filename:arg)).join(' ');
}

// ── Render en vivo (canvas) ─────────────────────────────────────────────────
function drawInto(cv, f) { paint(cv, perfil(f), modoEfectivo(f), state.fmt[f.id]); }
function paint(cv, output, m, s) {
  const ctx = cv.getContext('2d'), W = cv.width, H = cv.height, vw = video.videoWidth;
  if (!vw) return;
  const ratio=W/output.ancho;
  const drawRect=(mode,settings)=>{const r=rect(state.src,output.ancho,output.alto,mode,settings);return [r.x*ratio,r.y*ratio,r.w*ratio,r.h*ratio];};
  ctx.filter = 'none'; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  const drawCrop=settings=>{const c=cropWindow(state.src,output.ancho,output.alto,settings);ctx.drawImage(video,c.x,c.y,c.w,c.h,0,0,W,H);};
  if (m === 'cover') { drawCrop(s); return; }
  if (m === 'blur') { ctx.filter = `blur(${14*Math.max(output.ancho,output.alto)/384*ratio}px) brightness(0.85)`; drawCrop({zoom:1.1,fx:.5,fy:.5}); ctx.filter = 'none'; }
  ctx.drawImage(video, ...drawRect('contain',s));
}
// Preview only: the wall is painted once, then every screen is copied into its
// delivery cell, exactly as the encoder cuts them. Cut lines and numbers are overlays.
function drawEspecial(el, f) {
  const wall = el.querySelector('canvas.wall'), atlas = el.querySelector('canvas.atlas'); if (!wall || !video.videoWidth) return;
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
function loop() {
  if(drawDirty||video.currentTime!==lastFrame){
  document.querySelectorAll('.fmt[data-f]').forEach((el) => { const f = FORMATOS.find((x) => x.id === el.dataset.f); if (f.especial) { drawEspecial(el, f); return; } const c = el.querySelector('canvas'); if (c) drawInto(c, f); });
  drawDirty=false;lastFrame=video.currentTime;
  }
  requestAnimationFrame(loop);
}

// ── Fuente ──────────────────────────────────────────────────────────────────
let sourceObjectURL = null;
function setSource(url, name, origin = {id:null,title:name}) {
  state.origin = {id:origin.id||null,title:origin.title||name};
  // A local file still being exported keeps its blob URL until its last queue line ends.
  if (sourceObjectURL && sourceObjectURL !== url && !queue.uses(sourceObjectURL)) URL.revokeObjectURL(sourceObjectURL);
  sourceObjectURL = url.startsWith('blob:') ? url : null;
  $('#export-status').textContent='';
  state.src = {ancho:0,alto:0,fps:25,bitrateKbps:0};
  $('#src-info').textContent = t('Cargando vídeo…','Loading video…'); $('#src-msg').textContent = t('Cargando vídeo…','Loading video…');
  state.srcName = name; refreshInfo(); video.src = url; video.play().catch(() => {});
}
video.addEventListener('error', () => { if (!video.getAttribute('src')) return; $('#src-preview').hidden = true; $('#btn-adaptar').disabled = true; $('.step[data-go="2"]').disabled = true; $('#src-msg').textContent = $('#src-info').textContent = t('No se pudo reproducir este vídeo. Elige otro archivo o una fuente Stock disponible.', 'Unable to play this video. Choose another file or an available Stock source.'); });
video.addEventListener('loadedmetadata', () => {
  state.src = { ancho: video.videoWidth, alto: video.videoHeight, fps: 25, bitrateKbps: 0 };
  $('#src-info').textContent = `${state.srcName} · ${video.videoWidth}×${video.videoHeight} · ${video.duration.toFixed(1)} s`;
  $('#src-info-2').textContent = state.srcName; $('#src-msg').textContent = '';
  $('#src-preview').hidden = false; $('#btn-adaptar').disabled = false; $('.step[data-go="2"]').disabled = false;
  refreshInfo();
});
$('#src-select').onchange = (e) => { const o = e.target.selectedOptions[0]; if (!o.value) { emptySource(); return; } setSource(o.value, o.textContent.replace(/^Stock · /, ''), {id:o.dataset.id,title:o.dataset.title}); };
// Sin vídeo por defecto (ninguna marca): estado vacío hasta que el usuario elige uno.
function emptySource() { video.removeAttribute('src'); video.load(); state.srcName = ''; state.src = {ancho:0,alto:0,fps:25,bitrateKbps:0}; $('#src-info').textContent = ''; $('#src-msg').textContent = ''; $('#src-preview').hidden = true; $('#btn-adaptar').disabled = true; $('.step[data-go="2"]').disabled = true; goStep(1); refreshInfo(); drawDirty = true; document.querySelectorAll('.fmt canvas').forEach((c) => c.getContext('2d').clearRect(0, 0, c.width, c.height)); }
$('#src-file').onchange = (e) => { const f = e.target.files[0]; if(f && f.size>MAX_SOURCE_BYTES) {$('#src-msg').textContent=t('El límite local es 100 MB. Elige un vídeo más pequeño.','The local limit is 100 MB. Choose a smaller video.');e.target.value='';return;} if (f) setSource(URL.createObjectURL(f), f.name, {id:null,title:f.name.replace(/\.[^.]+$/,'')}); };
$('#btn-play').onclick = $('#btn-play-2').onclick = () => (video.paused ? video.play() : video.pause());
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
function goStep(n) {
  if (n === 2 && !state.src.ancho) return;
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


const clienteResponse = await fetch('/adaptaciones/perfil-cliente-18.json');
if (clienteResponse.ok) {
 const data = await clienteResponse.json();
 for (const f of data.formats) { f.on=true;f.category='digital'; if (EN) f.uso = f.useEn; FORMATOS.push(f); state.fmt[f.id] = {modo:'auto',fx:0.5,fy:0.5,zoom:1}; }
 $('#format-profile').querySelector('[value=cliente]').disabled = false;
}
const especialesResponse = await fetch('/adaptaciones/perfil-cliente-especiales.json');
if (especialesResponse.ok) {
 const data = await especialesResponse.json();
 data.layouts.forEach((layout, i) => { FORMATOS.push({ id: layout.id, nombre: layout.nombre, nameEn: layout.nombre, uso: EN ? layout.useEn : layout.uso, custom: layout.entrega, category: 'digital', especial: true, layout, fps: 25, on: i === 0 }); state.fmt[layout.id] = defaults(); });
 $('#format-profile').querySelector('[value=especiales]').disabled = false;
}
restoreSettings(); buildGrid(); emptySource(); loop();

// Índice del Stock: primero el proxy comprimido del propio dominio y, si no responde
// JSON (sin sesión la verja redirige a /auth/login, y en admira.studio ese salto
// cambia de host y el fetch revienta por CORS), el bucket público con CORS abierto.
async function fetchStockIndex() {
  for (const url of ['/stock-index', 'https://stock.admira.store/stock/index.json']) {
    try {
      const response = await fetch(url, url.startsWith('/') ? { redirect: 'manual', credentials: 'same-origin' } : { credentials: 'omit' });
      if (!response.ok || !/json/i.test(response.headers.get('content-type') || '')) continue;
      return await response.json();
    } catch (_) { /* siguiente origen */ }
  }
  throw new Error('stock unavailable');
}

async function loadStock() {
  try {
    const data = await fetchStockIndex();
    // Admira (por defecto) ve todos los vídeos. Con otro cliente (/marca <cliente>), solo los suyos
    // más lo genérico de Admira: las marcas competidoras nunca se mezclan. Se repinta al cambiar.
    stockVideos = (data.items || []).filter(item => item.type === 'video' && (item.url || item.mediaUrl));
    paintStockOptions();
  } catch (_) { $('#stock-status').textContent = t('Stock remoto no disponible. Puedes subir un vídeo.', 'Remote Stock unavailable. You can upload a video.'); }
}
let stockVideos = null, clienteEsperaAgotada = false;
setTimeout(() => { clienteEsperaAgotada = true; paintStockOptions(); }, 4000); // sin selector: se lista todo
// ¿Se pidió un cliente que no es Admira? Admira lo ve todo, así que con Admira no se espera a nada.
function clientePendiente() {
  try { const q = new URLSearchParams(location.search).get('cliente'); const g = JSON.parse(localStorage.getItem('pixeria:cliente:v2') || 'null');
    const id = String(q != null ? q : (g && g.id) || '').toLowerCase(); return !!id && !/^(admira|todos|todas|all|off|ninguno)$/.test(id); } catch (_) { return false; }
}
function paintStockOptions() {
  const PC = window.PixeriaCliente, listo = !!(PC && PC.listo && PC.listo());
  if (!stockVideos || (!listo && clientePendiente() && !clienteEsperaAgotada)) return;
  const select = $('#src-select'), current = select.value;
  select.querySelectorAll('option[data-id]').forEach(o => o.remove());
  const videos = listo ? stockVideos.filter(item => PC.visible(item)) : stockVideos;
  for (const item of videos) {
    const url = item.url || item.mediaUrl;
    if (!/^https:\/\//.test(url)) continue;
    const option = document.createElement('option'); option.value = url; option.dataset.id = item.id || ''; option.dataset.title = item.title || item.name || item.id || '';
    option.textContent = 'Stock · ' + (item.title || item.name || item.id);
    select.append(option);
  }
  const activo = listo && !PC.esDefecto() && PC.actual();
  $('#stock-status').textContent = t('Vídeos Stock disponibles: ', 'Stock videos available: ') + videos.length + (activo ? ` · ${activo.nombre}` : '');
  if ([...select.options].some(o => o.value === current)) select.value = current;
}
document.addEventListener('pixeria:cliente', paintStockOptions);
loadStock();
