import {sessionInfo,esSuperusuario} from '../_auth.js';
import {MusicQueue,QueueError,validateSong,validatePart} from '../_creative-music.js';
import {MusicAudioStore,MUSIC_AUDIO_MAX,exportedAudioType,validMusicAudioURL} from '../_creative-music-audio.js';
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
// Studio stores requests. Only an authenticated counselor picks them up; no Suno POST here.
export async function musicRequest({request,env,params},_fetch=fetch,authorize=sessionInfo){
 try{
  const session=await authorize(request,env);if(!session)return json({error:'session-required'},401);
  const action=params?.action,read=['healthz','status','queue','audio'].includes(action);
  if(!['healthz','generate','track','status','queue','claim','progress','audio','deliver'].includes(action))return json({error:'unknown-action'},404);
  if(request.method!==(read?'GET':'POST'))return json({error:'method-not-allowed'},405);
  const origin=request.headers.get('Origin');if(origin&&origin!==new URL(request.url).origin)return json({error:'invalid-origin'},403);
  if(['queue','claim','progress','deliver'].includes(action)&&!esSuperusuario(session))return json({error:'counselor-required'},403);
  if(!env.AUTH_DB)return json({error:'queue-unavailable'},503);
  const queue=new MusicQueue(env.AUTH_DB);await queue.ready();
  if(action==='healthz')return json({ok:true,via:'consejeros',poll_seconds:30});
  if(action==='queue')return json({requests:await queue.list()});
  if(action==='deliver'){
   const url=new URL(request.url),id=url.searchParams.get('request_id'),clipId=url.searchParams.get('clip_id');
   const row=await queue.claimed(id,request.headers.get('X-Music-Claim'),session.email),progress=JSON.parse(row.progress);
   if(!['recuperando_audio','terminado'].includes(progress.phase)||!(progress.clips||[]).some(c=>c.id===clipId))return json({error:'clip-not-registered'},409);
   const reader=request.body?.getReader();if(!reader)return json({error:'audio-required'},400);
   const chunks=[];let size=0;for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>MUSIC_AUDIO_MAX){await reader.cancel();return json({error:'audio-too-large'},413);}chunks.push(part.value);}
   const bytes=await new Blob(chunks).arrayBuffer(),mime=exportedAudioType(bytes,(request.headers.get('Content-Type')||'').split(';')[0]);if(!size||!mime)return json({error:'invalid-audio-file'},415);
   const store=new MusicAudioStore(env.AUTH_DB);await store.ready();let saved;
   try{saved=await store.save(id,clipId,bytes,mime);}catch(error){if(error.message==='audio-already-delivered')return json({error:error.message},409);throw error;}
   return json({ok:true,request_id:id,clip_id:clipId,mime:saved.mime,size:saved.size,sha256:saved.sha256,generation:false,publication:false});
  }
  if(action==='audio'){
   const url=new URL(request.url),index=Number(url.searchParams.get('clip')||0);if(!Number.isInteger(index)||index<0||index>3)return json({error:'invalid-clip'},400);
   const job=await queue.get(url.searchParams.get('request_id'),session.email,esSuperusuario(session));const clip=job.clips[index];if(job.state!=='complete'||!clip)return json({error:'audio-not-ready'},409);
   const store=new MusicAudioStore(env.AUTH_DB);await store.ready();const saved=await store.read(job.request_id,clip.id);if(saved)return new Response(saved.blob,{headers:{'Content-Type':saved.meta.mime,'Cache-Control':'no-store'}});
   let target=clip.audio_url,response;for(let hop=0;hop<4;hop++){const trusted=validMusicAudioURL(target,clip.id);if(!trusted)return json({error:'invalid-audio-host'},502);const parsed=new URL(trusted);response=await _fetch(parsed.href,{redirect:'manual',signal:AbortSignal.timeout(30000)});if(response.status>=300&&response.status<400){target=new URL(response.headers.get('Location'),parsed).href;continue;}break;}
   if(!response?.ok||!/^audio\//.test(response.headers.get('Content-Type')||''))return json({error:'audio-unavailable'},502);
   const reader=response.body.getReader(),chunks=[];let size=0;for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>50000000){await reader.cancel();return json({error:'audio-too-large'},413);}chunks.push(part.value);}
   return new Response(new Blob(chunks),{headers:{'Content-Type':response.headers.get('Content-Type'),'Cache-Control':'no-store'}});
  }
  if(action==='status')return json(await queue.get(new URL(request.url).searchParams.get('request_id'),session.email,esSuperusuario(session)));
  let data;try{const raw=await request.text();if(raw.length>24000)return json({error:'request-too-large'},413);data=JSON.parse(raw);}catch{return json({error:'invalid-json'},400);}
  if(action==='generate'||action==='track')return json(await queue.create(session.email,validateSong(data),action==='track'));
  if(action==='claim')return json(await queue.claim(data.request_id,session.email));
  return json(await queue.update(validatePart(data),session.email));
 }catch(error){if(error instanceof QueueError)return json({error:error.message},error.status);return json({error:'queue-unavailable'},503);}
}
export const onRequestGet=musicRequest;
export const onRequestPost=musicRequest;
