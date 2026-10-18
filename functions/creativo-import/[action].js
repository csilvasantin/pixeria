import {sessionInfo} from '../_auth.js';
const NODES=['https://macmini.tail48b61c.ts.net/admira/tube','https://macbook-pro-16.tail48b61c.ts.net/admira/tube'];
const ALLOWED=/(^|\.)(youtube\.com|youtu\.be|vimeo\.com|twitter\.com|x\.com|tiktok\.com|instagram\.com|facebook\.com|fb\.watch)$/i;
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function importRelay({request,env,params},fetcher=fetch,authorize=sessionInfo){
 if(!await authorize(request,env))return json({error:'session-required'},401);
 const action=params?.action;if(!['health','start','status','get'].includes(action))return json({error:'unknown-action'},404);
 if(request.method!==(action==='start'?'POST':'GET'))return json({error:'method-not-allowed'},405);
 const origin=request.headers.get('Origin');if(origin&&origin!==new URL(request.url).origin)return json({error:'invalid-origin'},403);
 const query=new URL(request.url).searchParams,node=query.get('node')||'0';if(!/^[01]$/.test(node))return json({error:'invalid-node'},400);
 let target=NODES[Number(node)]+'/'+action,init={method:request.method,headers:{Accept:action==='get'?'*/*':'application/json'},signal:AbortSignal.timeout(action==='get'?120000:20000)};
 if(action==='start'){
  let data,url;try{const raw=await request.text();if(raw.length>5000)return json({error:'request-too-large'},413);data=JSON.parse(raw);url=new URL(data.url);}catch{return json({error:'invalid-url'},400);}
  if(!['https:','http:'].includes(url.protocol)||url.username||url.password||url.port||!ALLOWED.test(url.hostname)||data.format!=='video'&&data.format!=='audio')return json({error:'invalid-url'},400);
  init.headers['Content-Type']='application/json';init.body=JSON.stringify({url:url.href,format:data.format});
 }
 if(action==='get'||action==='status'){const id=query.get('id');if(!id||!/^[a-z0-9_-]{1,160}$/i.test(id))return json({error:'invalid-job'},400);target+='?id='+encodeURIComponent(id);}
 try{const response=await fetcher(target,init);if(action!=='get'||!response.ok)return json(await response.json(),response.status);
  const headers=new Headers({'Cache-Control':'no-store','Content-Type':response.headers.get('Content-Type')||'application/octet-stream'});
  for(const key of ['Content-Length','X-Tube-Title'])if(response.headers.has(key))headers.set(key,response.headers.get(key));
  return new Response(response.body,{status:response.status,headers});
 }catch{return json({error:'importer-unavailable'},503);}
}
export const onRequestGet=importRelay;export const onRequestPost=importRelay;
