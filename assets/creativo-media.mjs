import {voicePayload,musicPayload,musicReferences} from './creativo-core.mjs?v=creativo-20261018-2';
export const MUSIC_ORIGIN=globalThis.location?.protocol==='http:'?'http://127.0.0.1:3777':'https://macmini.tail48b61c.ts.net/suno';
// GET-only preflight. Missing sessions/providers do not leave a job marked submitted.
export async function mediaPreflight(job,fetcher=fetch){
 if(job.kind==='locucion'){
  const r=await fetcher('/auth/api-token',{credentials:'include',cache:'no-store',headers:{Accept:'application/json'}});
  const data=await r.json();if(!r.ok||!data.token)throw Error('creative-session');return data.token;
 }
 const r=await fetcher(MUSIC_ORIGIN+'/healthz'),data=await r.json();
 if(!r.ok||!(data.ok||data.sleeping))throw Error('creative-music-offline');return '';
}
export async function submitMedia(job,token,fetcher=fetch){
 if(job.kind==='locucion'){
  const r=await fetcher('https://api.admira.store/tts',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(voicePayload(job))});
  if(!r.ok)throw Error('creative-provider-'+r.status);
  if(!r.headers.get('Content-Type')?.includes('audio/'))throw Error('creative-audio-invalid');
  const blob=await r.blob();if(!blob.size)throw Error('creative-audio-empty');return {blob};
 }
 const r=await fetcher(MUSIC_ORIGIN+'/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(musicPayload(job))});
 if(!r.ok)throw Error('creative-provider-'+r.status);
 const refs=musicReferences(await r.json());if(!refs.ids.length&&!refs.pendingId)throw Error('creative-music-no-reference');return refs;
}
export async function pollMusic(job,fetcher=fetch){
 const query=job.ids?.length?'ids='+encodeURIComponent(job.ids.join(',')):'pending='+encodeURIComponent(job.pendingId);
 const r=await fetcher(MUSIC_ORIGIN+'/status?'+query);if(!r.ok)throw Error('creative-poll');const data=await r.json();
 if(!Array.isArray(data)){
  if(data.status==='error')return {state:'failed',error:'creative-provider-failed'};
  const refs=musicReferences(data);return {...refs,state:'pending'};
 }
 const clips=data.filter(c=>c.audio_url&&/^https:\/\//i.test(c.audio_url)).map(c=>({id:c.id,title:c.title||job.name,audio_url:c.audio_url,status:c.status}));
 const allDone=data.length>=Math.max(1,job.ids?.length||0)&&data.every(c=>['complete','error','failed'].includes(c.status));
 return {clips,state:allDone?(clips.length?'complete':'failed'):'pending'};
}
