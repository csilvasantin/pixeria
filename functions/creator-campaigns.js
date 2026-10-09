import {sessionInfo} from './_auth.js';
import {cloudIdentity,MAX_CAMPAIGN_BYTES} from '../campanas/creador/creator-cloud-core.mjs';
const TABLE=`CREATE TABLE IF NOT EXISTS pixeria_campaign_versions(owner TEXT NOT NULL,id TEXT NOT NULL,version INTEGER NOT NULL,name TEXT NOT NULL,kind TEXT NOT NULL,mutation TEXT NOT NULL,hash TEXT NOT NULL,payload TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(owner,id,version),UNIQUE(owner,mutation))`;
const reply=(d,status=200)=>Response.json(d,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export async function campaignCloud(request,env,session){
 if(!session)return reply({error:'session-required'},401);
 if(!env.AUTH_DB)return reply({error:'campaign-cloud-unavailable'},503);
 const origin=request.headers.get('Origin');if(origin&&origin!==new URL(request.url).origin)return reply({error:'invalid-origin'},403);
 const owner=session.email.toLowerCase(),u=new URL(request.url),id=u.searchParams.get('id'),v=u.searchParams.get('version');
 if(id&&!/^[-a-zA-Z0-9_]{1,80}$/.test(id))return reply({error:'invalid-id'},400);
 if(v&&(!/^[1-9]\d{0,8}$/.test(v)||!id))return reply({error:'invalid-version'},400);
 try{
 await env.AUTH_DB.prepare(TABLE).run();
 if(request.method==='GET'){
  if(!id){const rows=await env.AUTH_DB.prepare('SELECT id,MAX(version) AS version,name,kind,created_at FROM pixeria_campaign_versions WHERE owner=? GROUP BY id ORDER BY created_at DESC LIMIT 100').bind(owner).all();return reply({schema:'pixeria.campaign-cloud.v1',campaigns:rows.results||[]});}
  if(u.searchParams.get('history')==='1'){const rows=await env.AUTH_DB.prepare('SELECT version,name,kind,hash,created_at FROM pixeria_campaign_versions WHERE owner=? AND id=? ORDER BY version DESC LIMIT 100').bind(owner,id).all();return reply({id,versions:rows.results||[]});}
  const row=await env.AUTH_DB.prepare(v?'SELECT * FROM pixeria_campaign_versions WHERE owner=? AND id=? AND version=?':'SELECT * FROM pixeria_campaign_versions WHERE owner=? AND id=? ORDER BY version DESC LIMIT 1').bind(...(v?[owner,id,Number(v)]:[owner,id])).first();
  return row?reply({id:row.id,version:row.version,hash:row.hash,created_at:row.created_at,payload:JSON.parse(row.payload)}):reply({error:'campaign-not-found'},404);
 }
 if(request.method!=='POST')return reply({error:'method-not-allowed'},405);
 // Read a bounded stream even when Content-Length is omitted.
 const reader=request.body?.getReader();if(!reader)return reply({error:'invalid-json'},400);let bytes=0,text='';const decoder=new TextDecoder();
 try{while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>MAX_CAMPAIGN_BYTES+4096){await reader.cancel();return reply({error:'campaign-too-big'},413);}text+=decoder.decode(value,{stream:true});}text+=decoder.decode();}finally{reader.releaseLock();}
 let data;try{data=JSON.parse(text);}catch{return reply({error:'invalid-json'},400);}
 let identity;try{identity=cloudIdentity(data.payload);}catch(e){return reply({error:e.message},400);}
 if(!Number.isSafeInteger(data.baseVersion)||data.baseVersion<0||!/^[-a-zA-Z0-9_]{16,80}$/.test(data.mutation||''))return reply({error:'invalid-save-contract'},400);
 const payload=JSON.stringify(data.payload),hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(payload)))).map(b=>b.toString(16).padStart(2,'0')).join('');
 const old=await env.AUTH_DB.prepare('SELECT id,version,hash FROM pixeria_campaign_versions WHERE owner=? AND mutation=?').bind(owner,data.mutation).first();
 if(old)return old.id===identity.id&&old.hash===hash?reply({ok:true,...old,replayed:true}):reply({error:'mutation-mismatch'},409);
 // One atomic INSERT SELECT implements compare-and-swap: simultaneous writers cannot overwrite.
 const result=await env.AUTH_DB.prepare('INSERT INTO pixeria_campaign_versions(owner,id,version,name,kind,mutation,hash,payload,created_at) SELECT ?,?,?,?,?,?,?,?,? WHERE COALESCE((SELECT MAX(version) FROM pixeria_campaign_versions WHERE owner=? AND id=?),0)=?').bind(owner,identity.id,data.baseVersion+1,identity.name,identity.kind,data.mutation,hash,payload,new Date().toISOString(),owner,identity.id,data.baseVersion).run();
 if(!result.meta?.changes){const raced=await env.AUTH_DB.prepare('SELECT id,version,hash FROM pixeria_campaign_versions WHERE owner=? AND mutation=?').bind(owner,data.mutation).first();if(raced?.id===identity.id&&raced.hash===hash)return reply({ok:true,...raced,replayed:true});return reply({error:'version-conflict'},409);}
 return reply({ok:true,id:identity.id,version:data.baseVersion+1,hash},201);
 }catch{return reply({error:'campaign-cloud-unavailable'},503);}
}
export async function onRequest({request,env}){return campaignCloud(request,env,await sessionInfo(request,env));}
