import {sessionInfo,esSuperusuario} from './_auth.js';
const TV='https://admira.tv/api/stock-playlists';
const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Robots-Tag':'noindex'}});
// Distribuir exige permisos positivos y un directorio disponible; la vista del
// Stock tiene una política más amplia y no sirve como autorización de escritura.
export async function distributionClients(session,env){
  if(esSuperusuario(session))return null;
  if(!env.AUTH_DB)throw Error('permissions_unavailable');
  const email=String(session.email||'').trim().toLowerCase();
  const user=await env.AUTH_DB.prepare('SELECT role, account_kind FROM admiranext_users WHERE lower(email)=?').bind(email).first();
  if(!user)return [];
  const rows=await env.AUTH_DB.prepare('SELECT project_key FROM admiranext_user_projects WHERE lower(user_email)=?').bind(email).all();
  const keys=(rows?.results||[]).map(r=>String(r.project_key||''));
  if(user.role==='admin'||keys.includes('*')||keys.includes('commercial-projects'))return null;
  return [...new Set(keys.filter(k=>k.startsWith('commercial:')).map(k=>k.slice(11).toLowerCase()).filter(k=>/^[a-z0-9][a-z0-9-]{0,63}$/.test(k)))];
}
export function restrictCatalog(data,clients){
  if(clients===null)return data;
  const has=new Set(clients||[]);
  return {...data,rows:(data.rows||[]).filter(r=>has.has(r.project)),assignments:(data.assignments||[]).filter(a=>has.has(a.project))};
}
export function selectionScreens(rows,selection){
  if(!selection||!selection.project||selection.device&&!selection.location||selection.location&&!selection.circuit)return [];
  return [...new Set(rows.filter(r=>r.project===selection.project&&(!selection.circuit||r.circuit===selection.circuit)&&(!selection.location||r.location===selection.location)&&(!selection.device||r.screen===selection.device)).map(r=>r.screen))];
}
export async function onRequest({request,env,waitUntil}){
  const session=await sessionInfo(request,env);
  if(!session)return reply({ok:false,error:'unauthorized'},401);
  if(!['GET','POST'].includes(request.method))return reply({ok:false,error:'method_not_allowed'},405);
  if(!env.STOCK_NOTIFY_KEY)return reply({ok:false,error:'distribution_unavailable'},503);
  let clients;try{clients=await distributionClients(session,env);}catch{return reply({ok:false,error:'permissions_unavailable'},503);}
  const headers={'User-Agent':'Mozilla/5.0 (compatible; AdmiraStudio/1.0)','X-Notify-Key':env.STOCK_NOTIFY_KEY,'Accept':'application/json'};
  const upstream=await fetch(TV,{headers,cache:'no-store'}).catch(()=>null);
  const payload=upstream?.ok?await upstream.json().catch(()=>null):null;
  if(!payload?.ok)return reply({ok:false,error:'destinations_unavailable'},503);
  const data=restrictCatalog(payload,clients);
  if(request.method==='GET')return reply({...data,superuser:esSuperusuario(session),restricted:clients!==null});
  if(request.headers.get('Origin')!==new URL(request.url).origin)return reply({ok:false,error:'origin_denied'},403);
  if(!/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type')||''))return reply({ok:false,error:'json_required'},415);
  let body;try{const raw=await request.text();if(raw.length>65536)return reply({ok:false,error:'body_too_large'},413);body=JSON.parse(raw);}catch{return reply({ok:false,error:'invalid_json'},400);}
  const screens=selectionScreens(data.rows,body.selection);
  if(!screens.length||screens.length>36)return reply({ok:false,error:screens.length?'too_many_screens':'no_destination'},400);
  const r=await fetch(TV,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({screens,stockIds:body.stockIds,name:body.name})}).catch(()=>null);
  if(!r)return reply({ok:false,error:'distribution_unavailable'},503);
  const result=await r.json().catch(()=>({ok:false,error:'distribution_failed'}));
  return reply(result,r.status);
}
