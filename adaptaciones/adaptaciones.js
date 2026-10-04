// Pixeria · Adaptaciones (FLT-101349, 2-oct-2026): un vídeo → todas las pantallas.
// Render en vivo en canvas; las reglas son las del motor de signage de Pixeria.
// Reutiliza el motor de reglas real de Pixeria: assets/signage-perfiles.js
import { perfilDeSalida, planificar } from '/assets/signage-perfiles.js';
import { STORAGE_KEY, defaults, restore, snapshot, rect, cropWindow, exportBudget, exportJob } from './adapter-core.mjs';
import { createExporter, MAX_SOURCE_BYTES } from './adapter-export.js';
import { createCatalog, CATEGORIES, CAMPAIGNS, matchingFormats, customFormat, restoreCustomFormats } from './format-catalog.mjs';
import { pngDensity } from './png-density.mjs';

const EN = document.documentElement.lang === 'en';
const t = (es, en) => EN ? en : es;
const $ = (s) => document.querySelector(s);
const FORMATOS = createCatalog(EN);
const MODOS = { auto: t('Auto (regla Pixeria)', 'Auto (Pixeria rule)'), cover: t('Recorte', 'Crop'), blur: t('Expandir · fondo desenfocado', 'Expand · blurred background'), contain: t('Contener · negro', 'Contain · black') };
const picker = {query:'',orientation:'all',open:new Set()};
const state = { profile: 'standard', compat: 'fhd', modoGlobal: 'auto', fmt: {}, src: { ancho: 0, alto: 0, fps: 25, bitrateKbps: 0 }, srcName: '', isJti: true };
FORMATOS.forEach((f) => (state.fmt[f.id] = { modo: 'auto', fx: 0.5, fy: 0.5, zoom: 1 }));

const video = $('#src');
let initialized = false, activeExport = null;
const downloads = [];
const selectedFormats = () => FORMATOS.filter(f => f.on && (state.profile === 'altadis' ? f.altadis : !f.altadis));
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
  $('#compat').disabled=state.profile==='altadis';initialized=true;
}
function clearDownloads() { downloads.splice(0).forEach(URL.revokeObjectURL); $('#export-results').replaceChildren(); }
function lockEditor(locked) {
  document.querySelectorAll('#sec-adapt input, #sec-adapt select, #sec-adapt button').forEach(el=>el.disabled=locked);
  $('#cancel-export').disabled=false;$('#cancel-export').hidden=!locked;
  if(!locked) {$('#compat').disabled=state.profile==='altadis';refreshInfo();}
}
async function exportFormats(formats) {
  if(activeExport || !state.src.ancho || !formats.length) return;
  const pngFormats=formats.filter(f=>f.output==='png');
  const jobs=formats.filter(f=>f.output!=='png').map(f=>({...exportJob(state.src,perfil(f),plan(f),modoEfectivo(f),state.fmt[f.id],state.srcName,f.id),label:f.nombre}));
  const budget=jobs.length?exportBudget(video.duration,jobs):null;
  if(budget) {$('#export-status').textContent=budget==='batch-size'
    ?t('El lote supera el presupuesto local de memoria. Selecciona menos formatos y expórtalos por separado.','This batch exceeds the local memory budget. Select fewer formats and export them separately.')
    :t('Este vídeo es demasiado largo para exportarlo con este perfil en el navegador. Usa un clip más corto o un perfil de menor resolución.','This video is too long to export with this profile in the browser. Use a shorter clip or a lower resolution profile.');return;}
  const exporter=createExporter();let cancelled=false;activeExport={cancel(){cancelled=true;exporter.cancel();}};
  clearDownloads(); lockEditor(true);video.pause();
  const status=$('#export-status'), progress=$('#export-progress');progress.hidden=false;progress.removeAttribute('value');
  let completed=0,totalBytes=0;
  const addResult=(job,blob)=>{
    totalBytes+=blob.size;if(totalBytes>192*1048576)throw new Error('output-size');
    completed++;const url=URL.createObjectURL(blob);downloads.push(url);
    const link=document.createElement('a');link.href=url;link.download=job.filename;link.className='pill';link.textContent=`${t('Descargar','Download')} ${job.label} · ${job.W}×${job.H} · ${blob.size<1048576?`${Math.ceil(blob.size/1024)} KB`:`${(blob.size/1048576).toFixed(1)} MB`}${job.limit&&blob.size>job.limit?t(' · revisar límite de 150 KB',' · check the 150 KB limit'):''}`;
    $('#export-results').append(link);
  };
  try {
    for(const f of pngFormats){
      if(cancelled)throw new Error('cancelled');
      const p=perfil(f),canvas=document.createElement('canvas');canvas.width=p.ancho;canvas.height=p.alto;
      status.textContent=`${t('Exportando PNG','Exporting PNG')} · ${f.nombre}`;
      drawInto(canvas,f);
      let blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
      canvas.width=canvas.height=0;
      if(!blob)throw new Error('encoding');
      if(f.print)blob=new Blob([pngDensity(new Uint8Array(await blob.arrayBuffer()))],{type:'image/png'});
      if(cancelled)throw new Error('cancelled');
      addResult({filename:`${f.id}-${p.ancho}x${p.alto}.png`,label:`${f.nombre} · PNG`,W:p.ancho,H:p.alto,limit:f.category==='display'?150*1024:0},blob);
      progress.value=completed/formats.length;
    }
    if(jobs.length) await exporter.run(video.src,jobs,event=>{
      if(event.phase==='loading') status.textContent=t('Cargando motor de vídeo (unos 32 MB)…','Loading video engine (about 32 MB)…');
      else if(event.phase==='source') status.textContent=t('Leyendo vídeo de origen…','Reading source video…');
      else { progress.value=(pngFormats.length+event.index+event.progress)/formats.length;status.textContent=`${t('Exportando','Exporting')} ${event.index+1}/${event.total} · ${event.job.label} · ${Math.floor(event.progress*100)}%`; }
    },addResult);
    progress.value=1;status.textContent=t(`${completed} ${completed===1?'archivo listo':'archivos listos'}. Descárgalos antes de salir de esta página.`,`${completed} ${completed===1?'file':'files'} ready. Download them before leaving this page.`);
  } catch(error) {
    const reason=String(error?.message||error);
    status.textContent=reason==='cancelled'?t('Exportación cancelada. Puedes conservar los archivos ya terminados.','Export cancelled. You can keep files already completed.')
      :reason==='output-size'?t('La salida alcanzó el límite de memoria. Usa un clip más corto. El archivo incompleto no se ofrece para descarga.','The output reached the memory limit. Use a shorter clip. Incomplete files are not offered for download.')
      :reason==='source-size'?t('El vídeo supera el límite local de 100 MB. Usa un archivo más pequeño.','The video exceeds the local 100 MB limit. Use a smaller file.')
      :t('No se pudo completar la exportación. Comprueba la conexión y usa un MP4 local de menos de 100 MB; algunas fuentes Stock no permiten su descarga. Los archivos terminados siguen disponibles.','Export could not complete. Check your connection and try a local MP4 under 100 MB; some Stock sources block downloading. Completed files remain available.');
    progress.hidden=true;
  } finally {activeExport=null;lockEditor(false);}
}
$('#export-all').onclick=()=>exportFormats(selectedFormats());
$('#cancel-export').onclick=()=>activeExport?.cancel();
$('#reset-settings').onclick=()=>{
  Object.assign(state,{profile:'standard',compat:'fhd',modoGlobal:'auto'});FORMATOS.forEach(f=>{f.on=['9:16','16:9','1:1','4:5'].includes(f.id);state.fmt[f.id]=defaults();});
  $('#format-profile').value='standard';$('#compat').value='fhd';$('#compat').disabled=false;$('#modo-global').value='auto';buildGrid();
};
window.addEventListener('pagehide',event=>{activeExport?.cancel();if(!event.persisted) {clearDownloads();if(sourceObjectURL)URL.revokeObjectURL(sourceObjectURL);}});

// ── Perfil + plan (motor Pixeria) ───────────────────────────────────────────
function perfil(f) {
  if(f.output==='png')return {ancho:f.custom[0],alto:f.custom[1],orientacion:f.custom[0]>f.custom[1]?'apaisada':f.custom[0]<f.custom[1]?'vertical':'custom',fps:25,techoKbps:8000,sueloKbps:2500,h264:'high@4.0'};
  return f.custom
    ? perfilDeSalida({ formato: 'custom', ancho: f.custom[0], alto: f.custom[1], compatibilidad: f.altadis ? 'uhd' : f.native ? (Math.max(...f.custom)>1920||f.custom[0]*f.custom[1]>1920*1080?'uhd':'fhd') : state.compat })
    : perfilDeSalida({ formato: f.id, compatibilidad: state.compat });
}
function plan(f) {
  if (!state.src.ancho) return null;
  try { const output = planificar(state.src, perfil(f)); if (f.altadis) output.fps = 25; return output; } catch (e) { return { error: e.message }; }
}
function modoEfectivo(f) {
  const m = state.fmt[f.id].modo !== 'auto' ? state.fmt[f.id].modo : state.modoGlobal;
  if (m !== 'auto') return m;
  const p = plan(f); if (!p || p.error) return 'blur';
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
    const detail=document.createElement('details');detail.className='size-category';detail.open=!!picker.query||picker.open.has(cat.id)||state.profile==='altadis';
    const summary=document.createElement('summary');summary.textContent=`${EN?cat.en:cat.es} · ${formats.length}`;detail.append(summary);
    detail.ontoggle=()=>{if(detail.open)picker.open.add(cat.id);else picker.open.delete(cat.id);};
    for(const f of formats){
      const label=document.createElement('label');label.className='size-option';
      const input=document.createElement('input');input.type='checkbox';input.checked=f.on;input.disabled=!!activeExport;input.setAttribute('aria-label',`${t('Tamaño','Size')} ${f.nombre}`);
      input.onchange=()=>{f.on=input.checked;buildGrid();};
      const text=document.createElement('span');const name=document.createElement('strong');name.textContent=f.nombre;
      const dims=document.createElement('small');const p=perfil(f);dims.textContent=`${p.ancho} × ${p.alto} px · ${f.output==='png'?'PNG':'MP4'}${f.regional?t(' · Polonia',' · Poland'):''}`;
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
  b.onclick=()=>{state.profile='standard';$('#format-profile').value='standard';$('#compat').disabled=false;FORMATOS.filter(c.matches).forEach(f=>f.on=true);buildGrid();};return b;
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
  state.profile='standard';$('#format-profile').value='standard';$('#compat').disabled=false;
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
    const p = perfil(f); const cw = p.ancho >= p.alto ? 384 : Math.round(384 * p.ancho / p.alto); const ch = Math.round(cw * p.alto / p.ancho);
    const el = document.createElement('div'); el.className = 'fmt'; el.dataset.f = f.id;
    el.innerHTML = `<div class="fmt-title"><h3>${f.nombre}</h3><button class="remove-format" type="button" aria-label="${t('Quitar','Remove')} ${f.nombre}">×</button></div><div class="dims">${p.ancho}×${p.alto} · ${f.uso} · ${f.output==='png'?'PNG':'MP4'}</div>
      <div class="stage"><canvas width="${cw}" height="${ch}"></canvas></div>
      <div class="ctl"><span>${t('Método','Method')}</span><select data-k="modo">${Object.entries(MODOS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
      <span>${t('Foco X','Focus X')}</span><input type="range" data-k="fx" min="0" max="1" step="0.01" value="0.5">
      <span>${t('Foco Y','Focus Y')}</span><input type="range" data-k="fy" min="0" max="1" step="0.01" value="0.5">
      <span>Zoom</span><input type="range" data-k="zoom" min="1" max="2" step="0.01" value="1"></div>
      <div class="aviso"></div><button class="pill accent export-one" type="button"></button><details class="card-plan"><summary>${t("Plan técnico H.264", "H.264 encoding plan")}</summary><pre></pre></details>`;
    el.querySelectorAll('[data-k]').forEach((inp) => { inp.value = state.fmt[f.id][inp.dataset.k]; inp.setAttribute('aria-label', `${t('Ajuste','Setting')} ${inp.dataset.k} · ${f.nombre}`); inp.oninput = () => { const k = inp.dataset.k; state.fmt[f.id][k] = k === 'modo' ? inp.value : +inp.value; refreshInfo(); }; });
    el.querySelector('.remove-format').onclick=()=>{f.on=false;buildGrid();};
    el.querySelector('.card-plan').hidden=f.output==='png';
    el.querySelector('.export-one').textContent=f.output==='png'?t('Exportar PNG','Export PNG'):t('Exportar MP4','Export MP4'); el.querySelector('.export-one').onclick=()=>exportFormats([f]);
    g.appendChild(el);
  });
  refreshInfo();
}
function refreshInfo() {
  drawDirty=true;saveSettings();
  $('#export-all').disabled=!!activeExport || !state.src.ancho || !selectedFormats().length;
  document.querySelectorAll('.export-one').forEach(el=>el.disabled=!!activeExport || !state.src.ancho);
  document.querySelectorAll('#grid .fmt[data-f]').forEach((el) => {
    const f = FORMATOS.find((x) => x.id === el.dataset.f); const p = plan(f); const m = modoEfectivo(f);
    const settings = state.fmt[f.id];
    let lost = 0;
    if (state.src.ancho) {
      const sourceRatio = state.src.ancho / state.src.alto;
      const targetRatio = perfil(f).ancho / perfil(f).alto;
      if (m === 'cover') lost = 1 - Math.min(sourceRatio / targetRatio, targetRatio / sourceRatio) / settings.zoom ** 2;
      else if (settings.zoom > 1) {
        const k = Math.min(perfil(f).ancho / state.src.ancho, perfil(f).alto / state.src.alto) * settings.zoom;
        lost = 1 - Math.min(1, perfil(f).ancho / (state.src.ancho * k)) * Math.min(1, perfil(f).alto / (state.src.alto * k));
      }
    }
    el.querySelector('.aviso').textContent = p && !p.error
      ? `${MODOS[m]} · ${Math.round(lost * 100)}% ${t('perdido', 'lost')}${m === 'blur' ? t(' · fondo derivado, sin expansión IA', ' · derived background, no AI expansion') : ''}`
      : t('Elige un vídeo para calcular el recorte.', 'Choose a video to calculate cropping.');
    el.querySelector('.card-plan pre').textContent = f.output==='png' ? t('Fotograma actual en PNG.','Current frame as PNG.') : p && !p.error
      ? `${p.ancho}×${p.alto} · H.264 ${p.h264Perfil}@${p.h264Nivel} · ${p.bitrateKbps} kbps · ${p.fps} fps · GOP ${p.gopSegundos}s\n${ffmpegCmd(f)}`
      : t('Sin vídeo', 'No video');
  });
  const rows = selectedFormats().map((f) => {
    const p = plan(f); if(f.output==='png')return `<p>${f.nombre} · ${perfil(f).ancho}×${perfil(f).alto} · PNG${f.print?' · 150 ppp':''}</p>`; if (!p || p.error) return `<p>${f.nombre}: ${p ? p.error : 'sin vídeo'}</p>`;
    return `<div class="fmt" style="margin-bottom:8px"><h3>${f.nombre} · ${p.ancho}×${p.alto}</h3>
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
function drawInto(cv, f) {
  const ctx = cv.getContext('2d'), W = cv.width, H = cv.height, vw = video.videoWidth, vh = video.videoHeight;
  if (!vw) return;
  const m = modoEfectivo(f), s = state.fmt[f.id];
  const output=perfil(f), ratio=W/output.ancho;
  const drawRect=(mode,settings)=>{const r=rect(state.src,output.ancho,output.alto,mode,settings);return [r.x*ratio,r.y*ratio,r.w*ratio,r.h*ratio];};
  ctx.filter = 'none'; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  const drawCrop=settings=>{const c=cropWindow(state.src,output.ancho,output.alto,settings);ctx.drawImage(video,c.x,c.y,c.w,c.h,0,0,W,H);};
  if (m === 'cover') { drawCrop(s); return; }
  if (m === 'blur') { ctx.filter = `blur(${14*Math.max(output.ancho,output.alto)/384*ratio}px) brightness(0.85)`; drawCrop({zoom:1.1,fx:.5,fy:.5}); ctx.filter = 'none'; }
  ctx.drawImage(video, ...drawRect('contain',s));
}
let drawDirty=true,lastFrame=-1;
function loop() {
  if(drawDirty||video.currentTime!==lastFrame){
  document.querySelectorAll('.fmt[data-f]').forEach((el) => { const c = el.querySelector('canvas'); if (c) drawInto(c, FORMATOS.find((f) => f.id === el.dataset.f)); });
  if (!state.isJti) { drawInto($('#tw-cv-v'), FORMATOS[0]); drawInto($('#tw-cv-h'), FORMATOS[1]); }
  drawDirty=false;lastFrame=video.currentTime;
  }
  requestAnimationFrame(loop);
}

// ── Fuente ──────────────────────────────────────────────────────────────────
let sourceObjectURL = null;
function setSource(url, name, isJti) {
  if (sourceObjectURL && sourceObjectURL !== url) URL.revokeObjectURL(sourceObjectURL);
  sourceObjectURL = url.startsWith('blob:') ? url : null;
  clearDownloads();$('#export-status').textContent='';
  state.src = {ancho:0,alto:0,fps:25,bitrateKbps:0};
  $('#src-info').textContent = t('Cargando vídeo…','Loading video…');
  state.srcName = name; state.isJti = isJti; refreshInfo(); video.src = url; video.play().catch(() => {});
  document.querySelectorAll('#twin video').forEach((v) => (v.style.display = isJti ? '' : 'none'));
  document.querySelectorAll('#twin canvas').forEach((v) => (v.hidden = isJti));
}
video.addEventListener('error', () => { $('#src-info').textContent = t('No se pudo reproducir este vídeo. Elige otro archivo o una fuente Stock disponible.', 'Unable to play this video. Choose another file or an available Stock source.'); });
video.addEventListener('loadedmetadata', () => {
  state.src = { ancho: video.videoWidth, alto: video.videoHeight, fps: 25, bitrateKbps: 0 };
  $('#src-info').textContent = `${state.srcName} · ${video.videoWidth}×${video.videoHeight} · ${video.duration.toFixed(1)} s`;
  refreshInfo();
});
$('#src-select').onchange = (e) => { const o = e.target.selectedOptions[0]; setSource(o.value, o.textContent.replace(/^Stock · /, ''), /jti-/.test(o.value)); };
$('#src-file').onchange = (e) => { const f = e.target.files[0]; if(f && f.size>MAX_SOURCE_BYTES) {$('#export-status').textContent=t('El límite local es 100 MB. Elige un vídeo más pequeño.','The local limit is 100 MB. Choose a smaller video.');e.target.value='';return;} if (f) setSource(URL.createObjectURL(f), f.name, false); };
$('#btn-play').onclick = () => (video.paused ? video.play() : video.pause());
$('#modo-global').onchange = (e) => { state.modoGlobal = e.target.value; refreshInfo(); };
$('#format-profile').onchange = (e) => {
  state.profile = e.target.value;
  // Preserve selections and settings in both format families.
  $('#compat').disabled = state.profile === 'altadis';
  buildGrid();
};
$('#compat').onchange = (e) => { state.compat = e.target.value; buildGrid(); };

// ── Altadis: 9 estancos + gemelo + recorrido estilo CanalKiosk ─────────────
// Patrón copiado de admira.app (clearchannel-tv/app.js · startCircuitDemo /
// showCircuitDemoPoint): parada a parada, estado «i/N · nombre», dwell fijo y
// la siguiente parada precargada; el previo abre la pantalla sobre la fachada.
const TOUR_DWELL_MS = 8000;
let ESTANCOS = [], ORIGEN = null, cur = 0, tour = null;
async function loadEstancos() {
  const d = await (await fetch('/adaptaciones/altadis-bcn-9.json')).json();
  ESTANCOS = d.estancos; ORIGEN = d.origen;
  $('#lista-estancos').innerHTML = ESTANCOS.map((e, i) => `<li data-i="${i}"><b>${e.orden}. ${e.name}</b><small>${e.addr}<br>${e.dist_planeta7_m} m ${t('de','from')} Planeta 7 · OSM ${e.osm}</small></li>`).join('');
  $('#lista-estancos').querySelectorAll('li').forEach((li) => (li.onclick = () => { stopTour(); go(+li.dataset.i); }));
  drawMap(); go(0);
}
function proj(lat, lon) {
  const pts = ESTANCOS.map((e) => [e.lat, e.lon]).concat([[ORIGEN.lat, ORIGEN.lon]]);
  const la = pts.map((p) => p[0]), lo = pts.map((p) => p[1]);
  const [a0, a1, o0, o1] = [Math.min(...la), Math.max(...la), Math.min(...lo), Math.max(...lo)];
  const kx = Math.cos((a0 * Math.PI) / 180); const sx = 360 / ((o1 - o0) * kx), sy = 220 / (a1 - a0), s = Math.min(sx, sy);
  return [20 + (lon - o0) * kx * s, 240 - (lat - a0) * s];
}
function drawMap() {
  const svg = $('#minimap'); const P = ESTANCOS.map((e) => proj(e.lat, e.lon)); const o = proj(ORIGEN.lat, ORIGEN.lon);
  svg.innerHTML = `<text x="10" y="16" fill="#8a93a6" font-size="11">${t('Circuito Altadis','Altadis circuit')} · Gràcia (${t('ruta','route')} ${'≈'}${(ESTANCOS.reduce((a, e) => a + e.tramo_desde_anterior_m, 0) / 1000).toFixed(1)} km)</text>
    <polyline points="${P.map((p) => p.join(',')).join(' ')}" fill="none" stroke="#ff6a3d" stroke-width="2" stroke-dasharray="4 3"/>
    <rect x="${o[0] - 5}" y="${o[1] - 5}" width="10" height="10" fill="#3ddc97"/><text x="${o[0] + 8}" y="${o[1] + 4}" fill="#3ddc97" font-size="10">Planeta 7</text>
    ${P.map((p, i) => `<g data-i="${i}" style="cursor:pointer"><circle cx="${p[0]}" cy="${p[1]}" r="9" fill="#1b2030" stroke="#ff6a3d"/><text x="${p[0]}" y="${p[1] + 4}" text-anchor="middle" fill="#fff" font-size="10">${i + 1}</text></g>`).join('')}
    <circle id="mk" r="13" fill="none" stroke="#ffd84a" stroke-width="3" cx="${P[0][0]}" cy="${P[0][1]}" style="transition:cx 1.2s ease,cy 1.2s ease"/>`;
  svg.querySelectorAll('g[data-i]').forEach((g) => (g.onclick = () => { stopTour(); go(+g.dataset.i); }));
}
function go(i) {
  cur = (i + ESTANCOS.length) % ESTANCOS.length; const e = ESTANCOS[cur];
  document.querySelectorAll('#lista-estancos li').forEach((li) => li.classList.toggle('on', +li.dataset.i === cur));
  document.querySelector('#lista-estancos li.on')?.scrollIntoView({ block: 'nearest' });
  $('#twin-name').textContent = `${t('Gemelo','Twin')} ${e.orden}/9 · ${e.name}`;
  $('#twin-addr').textContent = e.addr;
  $('#twin-ft').innerHTML = `${t('Disposición','Layout')}: <b>P1 ${t('vertical','portrait')} 1080×1920</b> (${t('escaparate','shop window')}) + <b>P2 ${t('horizontal','landscape')} 1920×1080</b> (${t('sobre mostrador','above counter')}) · ${e.dist_planeta7_m} m ${t('de','from')} Planeta 7 · <a href="https://www.openstreetmap.org/${e.osm}" target="_blank" rel="noopener">OSM ${e.osm}</a>${e.opening_hours ? ' · ' + e.opening_hours : ''}${cur === 0 ? ` · <b style="color:#3ddc97">${t('el más cercano a Planeta 7','nearest to Planeta 7')}</b>` : ''}`;
  $('#link-gemelo').href = `https://altadis-adaptador.xpaceos.pages.dev/admira-xp/?autostart=xtanco&loc=${e.id}&adaptado=1&quality=good&lang=${EN?"en":"es"}`;
  const p = proj(e.lat, e.lon); const mk = $('#mk'); if (mk) { mk.setAttribute('cx', p[0]); mk.setAttribute('cy', p[1]); }
  const tw = $('#twin'); tw.animate([{ opacity: 0.25, transform: 'translateX(18px)' }, { opacity: 1, transform: 'none' }], { duration: 500, easing: 'ease-out' });
  $('#tour-status').textContent = tour ? `${t('Recorrido · parada','Tour · stop')} ${cur + 1}/${ESTANCOS.length} · ${e.name}` : `${t('Parada','Stop')} ${cur + 1}/${ESTANCOS.length}`;
}
function startTour() { stopTour(); tour = { i: cur }; $('#tour').textContent = t('■ Parar recorrido', '■ Stop tour'); go(cur); tour.timer = setInterval(() => { if (cur === ESTANCOS.length - 1) { stopTour(); $('#tour-status').textContent = `${t('Recorrido completado','Tour completed')} · ${ESTANCOS.length} ${t('estancos','stores')}`; return; } go(cur + 1); }, TOUR_DWELL_MS); }
function stopTour() { if (tour) clearInterval(tour.timer); tour = null; $('#tour').textContent = t('▶ Recorrido del circuito', '▶ Circuit tour'); }
$('#prev').onclick = () => { stopTour(); go(cur - 1); };
$('#next').onclick = () => { stopTour(); go(cur + 1); };
$('#tour').onclick = () => (tour ? stopTour() : startTour());
document.addEventListener('keydown', (ev) => { if (ev.target.tagName === 'INPUT') return; if (ev.key === 'ArrowRight') $('#next').click(); if (ev.key === 'ArrowLeft') $('#prev').click(); });

const altadisResponse = await fetch('/adaptaciones/altadis-18.json');
if (altadisResponse.ok) {
 const data = await altadisResponse.json();
 for (const f of data.formats) { f.on=true;f.category='digital'; if (EN) f.uso = f.useEn; FORMATOS.push(f); state.fmt[f.id] = {modo:'auto',fx:0.5,fy:0.5,zoom:1}; }
 $('#format-profile').querySelector('[value=altadis]').disabled = false;
}
restoreSettings(); buildGrid(); setSource('/adaptaciones/media/neutro-original.mp4', t('Naturaleza · reserva neutra','Nature · neutral reserve'), false); loadEstancos(); loop();
window.__pixAdapt = { go, startTour };

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
  if(new URLSearchParams(location.search).get('demo')==='altadis') {$('#src-file').disabled=true;$('#src-select').disabled=true;$('#stock-status').textContent=t('Reserva neutra Pixeria · campaña oficial Altadis pendiente.','Neutral Pixeria reserve · official Altadis campaign pending.');return;}
  try {
    const data = await fetchStockIndex();
    const videos = (data.items || []).filter(item => item.type === 'video' && (item.url || item.mediaUrl) && !/\bjti\b|tu sitio de siempre/i.test(JSON.stringify(item)));
    for (const item of videos) {
      const url = item.url || item.mediaUrl;
      if (!/^https:\/\//.test(url)) continue;
      const option = document.createElement('option'); option.value = url;
      option.textContent = 'Stock · ' + (item.title || item.name || item.id);
      $('#src-select').append(option);
    }
    $('#stock-status').textContent = t('Vídeos Stock disponibles: ', 'Stock videos available: ') + (videos.length + 1);
  } catch (_) { $('#stock-status').textContent = t('Stock remoto no disponible. Puedes usar la muestra o subir un vídeo.', 'Remote Stock unavailable. Use the sample or upload a video.'); }
}
loadStock();
