import {sessionInfo} from '../_auth.js';
const UPSTREAM='https://macmini.tail48b61c.ts.net/suno';
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function musicRequest({request,env,params},fetchImpl=fetch,authorize=sessionInfo){
 if(!await authorize(request,env))return json({error:'session-required'},401);
 const action=params?.action,method=request.method;
 if(!['healthz','generate','status'].includes(action))return json({error:'unknown-action'},404);
 if(method!==(action==='generate'?'POST':'GET'))return json({error:'method-not-allowed'},405);
 const origin=request.headers.get('Origin');if(origin&&origin!==new URL(request.url).origin)return json({error:'invalid-origin'},403);
 let target=UPSTREAM+'/'+action,init={method,headers:{Accept:'application/json'},signal:AbortSignal.timeout(action==='generate'?120000:20000)};
 if(action==='generate'){
  let data;try{const raw=await request.text();if(raw.length>16000)return json({error:'request-too-large'},413);data=JSON.parse(raw);}catch{return json({error:'invalid-json'},400);}
  if(typeof data?.lyrics!=='string'||!data.lyrics.trim()||data.lyrics.length>5000||typeof data.prompt!=='string'||!data.prompt.trim()||data.prompt.length>600||typeof data.title!=='string'||data.title.length>200||data.instrumental!==false||data.model!=='chirp-v5-5')return json({error:'invalid-song'},400);
  init.headers['Content-Type']='application/json';init.body=JSON.stringify({prompt:data.prompt,lyrics:data.lyrics,title:data.title,instrumental:false,model:'chirp-v5-5'});
 }
 if(action==='status'){
  const search=new URL(request.url).searchParams,ids=search.get('ids'),pending=search.get('pending');
  if(Boolean(ids)===Boolean(pending))return json({error:'invalid-reference'},400);
  if(ids){const list=ids.split(',');if(list.length>4||list.some(id=>!/^[a-z0-9_-]{1,120}$/i.test(id)))return json({error:'invalid-reference'},400);target+='?ids='+encodeURIComponent(list.join(','));}
  if(pending){if(!/^[a-z0-9_-]{1,200}$/i.test(pending))return json({error:'invalid-reference'},400);target+='?pending='+encodeURIComponent(pending);}
 }
 try{const r=await fetchImpl(target,init),result=await r.json();return json(result,r.status);}catch{return json({error:'music-engine-unavailable'},503);}
}
export const onRequestGet=musicRequest;
export const onRequestPost=musicRequest;
