import {INSTALLATIONS,DURATION,cue,drawNextStep,loadNextStepAssets} from './render.mjs';
import {createPlayback,playbackAction,twinURL} from './control.mjs?v=5834-2';
const en=new URLSearchParams(location.search).get('lang')==='en'||document.documentElement.lang==='en',t=(a,b)=>en?b:a;
document.documentElement.lang=en?'en':'es';
const $=s=>document.querySelector(s),playback=createPlayback();
let product,selected='landscape',tour=false,raf=0,last=-1,renderedTime=-1,disposed=false;
const canvases=new Map();
$('.next-eyebrow').textContent=t('CREADOR / SNEAKER STORE / NEXT STEP','CREATOR / SNEAKER STORE / NEXT STEP');
$('#demo-title').textContent=t('Una tienda. Un pulso.','One store. One pulse.');
$('#demo-subtitle').textContent=t('NEXT STEP · una campaña que se vive, desde la entrada hasta el fondo.','NEXT STEP · a campaign to experience, from entrance to rear.');
$('#twin-link').textContent=t('Ver en la tienda ↗','View in the store ↗');
const defaultTwin=twinURL(null,en?'en':'es');
if(defaultTwin)$('#twin-link').href=defaultTwin;
else{
 $('#twin-link').setAttribute('aria-disabled','true');
 fetch('./preview-targets.json',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(config=>{
  const href=twinURL(['localhost','127.0.0.1'].includes(location.hostname)?config?.localTwinOrigin:config?.twinOrigin,en?'en':'es');
  if(href){$('#twin-link').href=href;$('#twin-link').removeAttribute('aria-disabled');}
  else $('#twin-link').textContent=t('Gemelo no disponible','Store twin unavailable');
 }).catch(()=>{$('#twin-link').textContent=t('Gemelo no disponible','Store twin unavailable');});
}
$('#creator-link').textContent=t('Volver a Creador','Back to Creator');
$('#creator-link').href=(en?'/en/creador/':'/creador/')+'?lang='+(en?'en':'es');
$('#download-label').textContent=t('Piezas listas para reproducir','Pieces ready to play');
$('#demo-note').textContent=t('Demo del gemelo digital. Las medidas especiales son aproximadas; la activación y sincronización en la tienda física requieren comprobar sus players.','Digital twin demo. Special dimensions are approximate; physical store activation and synchronisation require checking its players.');
$('#contract-link').textContent=t('Campaña y mapa de pantallas ↓','Campaign and screen map ↓');
for(const i of INSTALLATIONS){
 const b=document.createElement('button');b.type='button';b.textContent=i.name[en?'en':'es'];b.dataset.installation=i.id;b.setAttribute('aria-pressed',String(i.id===selected));
 b.onclick=()=>{tour=false;$('#demo-tour').setAttribute('aria-pressed','false');selected=i.id;select();render(true);};$('#demo-tabs').append(b);
 const card=document.createElement('button');card.type='button';card.className='next-preview';card.setAttribute('aria-label',i.name[en?'en':'es']);card.onclick=()=>b.click();
 const canvas=document.createElement('canvas');canvas.width=Math.min(560,i.width);canvas.height=Math.round(i.height*canvas.width/i.width);canvas.setAttribute('aria-label',i.name[en?'en':'es']);
 const label=document.createElement('span');label.textContent=i.name[en?'en':'es'];card.append(canvas,label);$('#demo-overview').append(card);canvases.set(i.id,canvas);
 for(const s of i.screens){const a=document.createElement('a');a.href=`./media/${s.id}.mp4`;a.download=`next-step-${s.id}.mp4`;a.textContent=`${i.name[en?'en':'es']} · ${s.id}`;$('#demo-files').append(a);}
}
function select(){const i=INSTALLATIONS.find(i=>i.id===selected);$('#demo-current').textContent=i.name[en?'en':'es'];$('#demo-stage').dataset.installation=i.id;$('#demo-hero').width=Math.min(1440,i.width);$('#demo-hero').height=Math.round(i.height*$('#demo-hero').width/i.width);for(const b of $('#demo-tabs').children)b.setAttribute('aria-pressed',String(b.dataset.installation===selected));}
function stateText(){return {playing:t('● Campaña en directo','● Live campaign'),paused:t('Ⅱ Campaña pausada','Ⅱ Campaign paused'),stopped:t('■ Campaña detenida','■ Campaign stopped')}[playback.snapshot().state];}
function controls(){
 const state=playback.snapshot().state,ready=!!product;
 $('#demo-state').textContent=stateText();$('#demo-state').dataset.state=state;
 $('#demo-start').textContent=state==='paused'?t('▶ Continuar','▶ Resume'):t('▶ Iniciar','▶ Start');$('#demo-start').disabled=!ready||state==='playing';
 $('#demo-pause').textContent=t('Ⅱ Pausar','Ⅱ Pause');$('#demo-pause').disabled=!ready||state!=='playing';
 $('#demo-stop').textContent=t('■ Detener','■ Stop');$('#demo-stop').disabled=!ready||state==='stopped';
 $('#demo-restart').textContent=t('↺ Desde el principio','↺ Restart');$('#demo-restart').disabled=!ready;
 $('#demo-tour').textContent=t('Recorrer pantallas','Tour the screens');$('#demo-tour').disabled=!ready;
}
function render(force=false){
 if(!product)return;
 const seconds=playback.snapshot().seconds;
 if(tour&&playback.snapshot().state==='playing'){const next=INSTALLATIONS[Math.floor(seconds/6)%INSTALLATIONS.length].id;if(next!==selected){selected=next;select();force=true;}}
 if(force||renderedTime!==seconds){renderedTime=seconds;for(const i of INSTALLATIONS)drawNextStep(canvases.get(i.id),i,product,seconds,en);drawNextStep($('#demo-hero'),INSTALLATIONS.find(i=>i.id===selected),product,seconds,en);}
 $('#demo-progress').value=seconds%DURATION;$('#demo-cue').textContent=cue(seconds,en).title;$('#demo-clock').textContent=String(Math.floor(seconds%DURATION)).padStart(2,'0')+' / 32';
}
function frame(now){if(disposed)return;raf=requestAnimationFrame(frame);if(document.hidden||now-last<40)return;last=now;render();}
function run(args=''){
 if(!product)return t('Preparando campaña…','Preparing campaign…');
 const command=String(args).trim().toLowerCase();
 if(/^(tour|recorrer)$/.test(command)){tour=true;$('#demo-tour').setAttribute('aria-pressed','true');playback.run('start');}
 else{
  const action=playbackAction(command);
  if(!action){controls();render(true);return t('Orden no reconocida. Usa iniciar, pausa, reanudar, reiniciar, estado o parar.','Unknown command. Use start, pause, resume, restart, status or stop.');}
  if(action==='stop'){tour=false;$('#demo-tour').setAttribute('aria-pressed','false');}
  playback.run(action);
 }
 controls();render(true);
 return 'NEXT STEP · '+stateText()+' · '+t('7 configuraciones · 13 piezas · reloj compartido','7 configurations · 13 pieces · shared clock');
}
$('#demo-start').onclick=()=>run('start');$('#demo-pause').onclick=()=>run('pause');$('#demo-stop').onclick=()=>run('stop');$('#demo-restart').onclick=()=>run('restart');
$('#demo-tour').onclick=()=>{if(tour){tour=false;$('#demo-tour').setAttribute('aria-pressed','false');}else run('tour');};
window.NextStepDemo={run,get ready(){return !!product;},get state(){return {...playback.snapshot(),installation:selected,tour};}};
select();controls();$('#demo-state').textContent=t('Preparando campaña…','Preparing campaign…');
try{product=await loadNextStepAssets();run(new URLSearchParams(location.search).get('action')||'start');frame(0);}
catch{$('#demo-state').textContent=t('No se pudo cargar la campaña. Recarga para reintentar.','Campaign could not load. Reload to retry.');}
window.addEventListener('pagehide',()=>{disposed=true;cancelAnimationFrame(raf);},{once:true});
