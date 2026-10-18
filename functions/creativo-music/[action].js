import {sessionInfo,esSuperusuario} from '../_auth.js';
import {MusicQueue,QueueError,validateSong,validatePart} from '../_creative-music.js';
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
// Studio stores requests. Only an authenticated counselor picks them up; no Suno POST here.
export async function musicRequest({request,env,params},_fetch=fetch,authorize=sessionInfo){
 try{
  const session=await authorize(request,env);if(!session)return json({error:'session-required'},401);
  const action=params?.action,read=['healthz','status','queue','audio'].includes(action);
  if(!['healthz','generate','track','status','queue','claim','progress','audio'].includes(action))return json({error:'unknown-action'},404);
  if(request.method!==(read?'GET':'POST'))return json({error:'method-not-allowed'},405);
  const origin=request.headers.get('Origin');if(origin&&origin!==new URL(request.url).origin)return json({error:'invalid-origin'},403);
  if(['queue','claim','progress'].includes(action)&&!esSuperusuario(session))return json({error:'counselor-required'},403);
  if(!env.AUTH_DB)return json({error:'queue-unavailable'},503);
  const queue=new MusicQueue(env.AUTH_DB);await queue.ready();
  if(action==='healthz')return json({ok:true,via:'consejeros',poll_seconds:30});
  if(action==='queue')return json({requests:await queue.list()});
  if(action==='audio'){
   const url=new URL(request.url),index=Number(url.searchParams.get('clip')||0);if(!Number.isInteger(index)||index<0||index>3)return json({error:'invalid-clip'},400);
   const job=await queue.get(url.searchParams.get('request_id'),session.email,esSuperusuario(session));const clip=job.clips[index];if(job.state!=='complete'||!clip)return json({error:'audio-not-ready'},409);
   let target=clip.audio_url,response;for(let hop=0;hop<4;hop++){const parsed=new URL(target);if(parsed.protocol!=='https:'||parsed.username||parsed.password||!/(^|\.)suno\.(ai|com)$/i.test(parsed.hostname))return json({error:'invalid-audio-host'},502);response=await _fetch(parsed.href,{redirect:'manual',signal:AbortSignal.timeout(30000)});if(response.status>=300&&response.status<400){target=new URL(response.headers.get('Location'),parsed).href;continue;}break;}
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
