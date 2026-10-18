// GOOD uses a local, masked video model. No image API or paid fallback.
export const GOOD_METHOD='wan-vace-1.3b-temporal-v1';
const BASE='http://127.0.0.1:6385';
export const isGood=job=>job.action==='recrear'&&job.type==='video'&&job.method===GOOD_METHOD;
export async function goodIdentity(digest,orientation){
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(GOOD_METHOD+digest+orientation+'0:3:480:20'));
 return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
}
export async function goodPreflight(fetcher=fetch){
 try{const r=await fetcher(BASE+'/health',{signal:AbortSignal.timeout(45000),credentials:'omit'}),data=await r.json();if(!r.ok||!data.ok||data.engine!==GOOD_METHOD||!data.token)throw Error();return data.token;}catch{throw Error('good-offline');}
}
export async function renderGoodVideo(job,source,blob,token,{fetcher=fetch,notify=()=>{},resume=false,pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}){
 const id=await goodIdentity(source.digest,job.orientation),headers={'X-Creativo-Good':token},url=BASE+'/jobs/'+id;
 const get=()=>fetcher(url,{headers,credentials:'omit',signal:AbortSignal.timeout(10000)});
 let r=await get(),data;
 if(r.status===404&&!resume){r=await fetcher(BASE+'/jobs?orientation='+job.orientation,{method:'POST',headers:{...headers,'Content-Type':'application/octet-stream'},body:blob,credentials:'omit',signal:AbortSignal.timeout(60000)});}
 if(!r.ok)throw Error(r.status===404?'good-interrupted':'good-offline');data=await r.json();
 while(data.state!=='complete'){
  if(['failed','unknown'].includes(data.state))throw Error('good-failed');
  notify({...data,phase:'good',message:data.phase});await pause(2000);r=await get();if(!r.ok)throw Error('good-offline');data=await r.json();
 }
 notify({...data,phase:'good',message:data.phase});
 r=await fetcher(url+'/result',{headers,credentials:'omit',signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('good-offline');return await r.blob();
}
