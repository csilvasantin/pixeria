import {sessionInfo,createApiToken} from '../_auth.js';
const API='https://api.admira.store';
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function onRequest({request,env,params}){
 const session=await sessionInfo(request,env);if(!session)return json({error:'session-required'},401);
 const origin=request.headers.get('Origin');if(origin&&origin!==new URL(request.url).origin)return json({error:'invalid-origin'},403);
 const action=params.action;let body=null,path,method='POST';
 if(action==='status'&&request.method==='GET'){const id=new URL(request.url).searchParams.get('request_id');if(!/^[a-zA-Z0-9_-]{6,160}$/.test(id||''))return json({error:'invalid-request-id'},400);path='/xai/video/'+encodeURIComponent(id);method='GET';}
 else if(request.method==='POST'){
  if(Number(request.headers.get('content-length'))>24000000)return json({error:'too-big'},413);
  let d;try{d=await request.json();}catch{return json({error:'invalid-json'},400);}
  const prompt=String(d.prompt||'').trim();if(prompt.length>6000)return json({error:'prompt-too-long'},400);
  if(action==='image'&&prompt){path='/imagen/generate';body={prompt,aspectRatio:'16:9',model:'imagen-4.0-generate-001',numberOfImages:1};}
  else if(action==='video'&&prompt&&/^[a-zA-Z0-9_-]{6,100}$/.test(d.stock_id||'')){path='/xai/video';body={prompt,stock_id:d.stock_id,aspect_ratio:'16:9',duration:5,resolution:'720p'};}
  else if(action==='archive'&&/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(d.image||'')&&d.image.length<23000000&&/^[a-f0-9]{32}$/.test(d.seed||'')){
   const m=/^data:([^;]+);base64,(.+)$/.exec(d.image);path='/stock/publish';body={type:'image',motor:'imagen-4.0-generate-001',mime:m[1],base64:m[2],prompt,title:String(d.title||'Sneaker Xtore').slice(0,120),comment:'Demo Creator full · '+d.seed,tags:['demo','sneakers','creator'],quality:'better'};
  }else return json({error:'invalid-input'},400);
 }else return json({error:'invalid-action'},405);
 // A short-lived, server-signed token uses the existing paid API perimeter.
 const token=await createApiToken(env,session.email);
 try{
  const response=await fetch(API+path,{method,headers:{'Content-Type':'application/json','Authorization':'Bearer '+token.token,'User-Agent':'Mozilla/5.0','Origin':'https://www.pixeria.com'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(130000)});
  const data=await response.json().catch(()=>({error:'invalid-provider-response'}));
  return json(data,response.status);
 }catch{return json({error:'upstream-connection-unknown'},502);}
}
