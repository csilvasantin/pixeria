import {sessionInfo,esSuperusuario} from '../_auth.js';
import {MusicQueue,QueueError,validateSong,validatePart} from '../_creative-music.js';
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
// Studio stores requests. Only an authenticated counselor picks them up; no Suno POST here.
export async function musicRequest({request,env,params},_fetch=fetch,authorize=sessionInfo){
 try{
  const session=await authorize(request,env);if(!session)return json({error:'session-required'},401);
  const action=params?.action,read=['healthz','status','queue'].includes(action);
  if(!['healthz','generate','track','status','queue','claim','progress'].includes(action))return json({error:'unknown-action'},404);
  if(request.method!==(read?'GET':'POST'))return json({error:'method-not-allowed'},405);
  const origin=request.headers.get('Origin');if(origin&&origin!==new URL(request.url).origin)return json({error:'invalid-origin'},403);
  if(['queue','claim','progress'].includes(action)&&!esSuperusuario(session))return json({error:'counselor-required'},403);
  if(!env.AUTH_DB)return json({error:'queue-unavailable'},503);
  const queue=new MusicQueue(env.AUTH_DB);await queue.ready();
  if(action==='healthz')return json({ok:true,via:'consejeros',poll_seconds:30});
  if(action==='queue')return json({requests:await queue.list()});
  if(action==='status')return json(await queue.get(new URL(request.url).searchParams.get('request_id'),session.email,esSuperusuario(session)));
  let data;try{const raw=await request.text();if(raw.length>24000)return json({error:'request-too-large'},413);data=JSON.parse(raw);}catch{return json({error:'invalid-json'},400);}
  if(action==='generate'||action==='track')return json(await queue.create(session.email,validateSong(data),action==='track'));
  if(action==='claim')return json(await queue.claim(data.request_id,session.email));
  return json(await queue.update(validatePart(data),session.email));
 }catch(error){if(error instanceof QueueError)return json({error:error.message},error.status);return json({error:'queue-unavailable'},503);}
}
export const onRequestGet=musicRequest;
export const onRequestPost=musicRequest;
