import {createClock,DURATION} from './render.mjs';
const aliases={start:'start',iniciar:'start',play:'start',reproducir:'start',resume:'start',reanudar:'start',continuar:'start',pause:'pause',pausa:'pause',pausar:'pause',stop:'stop',parar:'stop',detener:'stop',off:'stop',restart:'restart',reiniciar:'restart',status:'status',estado:'status'};
export function playbackAction(value=''){
 const command=String(value).trim().toLowerCase();
 return command===''?'start':aliases[command]||null;
}
// One clock for the seven compositions; no draft, history or playlist writes.
export function createPlayback(now){
 const clock=createClock(now);clock.pause();clock.restart();let state='stopped';
 const snapshot=()=>({state,seconds:clock.time(),duration:DURATION});
 return {snapshot,run(action){
  if(action==='start'){clock.play();state='playing';}
  else if(action==='pause'&&state==='playing'){clock.pause();state='paused';}
  else if(action==='stop'){clock.pause();clock.restart();state='stopped';}
  else if(action==='restart'){clock.restart();clock.play();state='playing';}
  else if(!['status','pause'].includes(action))throw Error('unknown-playback-action');
  return snapshot();
 }};
}
export function twinURL(origin,language='es',host=location.hostname){
 let base='https://www.admira.store';
 const preview=/^[a-z0-9-]+\.(?:pixeria|admira-studio)\.pages\.dev$/.test(host);
 const local=['localhost','127.0.0.1'].includes(host);
 if(preview||local){
  try{
   const candidate=new URL(origin);
   const allowed=candidate.protocol==='https:'&&/^[a-z0-9-]+\.admira-store\.pages\.dev$/.test(candidate.hostname)
    ||local&&candidate.protocol==='http:'&&['localhost','127.0.0.1'].includes(candidate.hostname);
   if(!allowed||candidate.username||candidate.password||candidate.pathname!=='/'||candidate.search||candidate.hash)return null;
   base=candidate.origin;
  }catch{return null;}
 }
 const url=new URL('/xpacios/sneakerstore/',base);
 url.search=new URLSearchParams({campaign:'next-step',view:'jordan',lang:language==='en'?'en':'es'});
 return url.href;
}
