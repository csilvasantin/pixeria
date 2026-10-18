import {voicePayload} from './creativo-core.mjs?v=creativo-20261018-14';
export const MUSIC_ORIGIN='/creativo-music';
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
 const r=await fetcher(MUSIC_ORIGIN+'/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(counselorPayload(job))});
 if(!r.ok)throw Error('creative-provider-'+r.status);
 return counselorResult(await r.json());
}
export function counselorPayload(job){return {request_id:job.id,lyrics:job.brief,voice:job.voice,languages:job.languages,style:job.style,title:job.name,...(job.durationSeconds?{duration_seconds:job.durationSeconds}:{}),...(job.pendingId?{previous_pending_id:job.pendingId}:{}),...(job.ids?.length?{previous_clip_ids:job.ids}:{})};}
function counselorResult(data){if(!data.request_id||!data.phase)throw Error('creative-music-no-reference');return {musicProgress:data,clips:data.clips||[],state:data.state};}
export async function pollMusic(job,fetcher=fetch){
 const r=await fetcher(MUSIC_ORIGIN+'/status?request_id='+encodeURIComponent(job.id),{cache:'no-store'});
 if(r.status===404&&!job.musicProgress){
  // Old uncertain attempts are audited, never sent to the generation queue.
  const tracked=await fetcher(MUSIC_ORIGIN+'/track',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(counselorPayload(job))});
  if(!tracked.ok)throw Error('creative-poll');return counselorResult(await tracked.json());
 }
 if(!r.ok)throw Error('creative-poll');return counselorResult(await r.json());
}
