// Downloads only. Publishing and paid generation never belong to this retry loop.
export const IMPORT_NODES = Object.freeze([
  {id:2,kind:'admira-tube-studio',base:'https://macstudio.tail48b61c.ts.net/admira/tube'},
  {id:0,kind:'admira-tube',base:'https://macmini.tail48b61c.ts.net/admira/tube'},
  {id:1,kind:'admira-tube-backup',base:'https://macbook-pro-16.tail48b61c.ts.net/admira/tube'},
]);
export function relayNodes(){return IMPORT_NODES.map(n=>({...n,relay:true}));}
function target(node,action,id){
  return node.relay?'/creativo-import/'+action+'?node='+node.id+(id?'&id='+encodeURIComponent(id):'')
    :node.base+'/'+action+(id?'?id='+encodeURIComponent(id):'');
}
export class ImportFailure extends Error{
  constructor(message,{terminal=false,status=0}={}){super(message);this.terminal=terminal;this.status=status;}
}
async function timed(operation,ms){
  const control=new AbortController();let timer;
  try{return await Promise.race([operation(control.signal),new Promise((_,reject)=>{timer=setTimeout(()=>{control.abort();reject(new ImportFailure('import-timeout'));},ms);})]);}
  finally{clearTimeout(timer);}
}
async function requestJSON(fetcher,url,init,ms){
  return timed(async signal=>{
    const response=await fetcher(url,{cache:'no-store',...init,signal});
    if(!response.ok)throw new ImportFailure('import-http-'+response.status,{status:response.status,terminal:[400,401,403,413,422].includes(response.status)});
    try{return await response.json();}catch{throw new ImportFailure('import-invalid-response');}
  },ms);
}
export async function readImportMedia(response,{maxBytes=100000000,idleMs=15000,onProgress=()=>{}}={}){
  if(!response.ok)throw new ImportFailure('import-download',{status:response.status});
  const total=Number(response.headers.get('Content-Length'))||0;
  if(total>maxBytes)throw new ImportFailure('import-too-large',{terminal:true});
  const type=response.headers.get('Content-Type')||'application/octet-stream';
  if(!/^(video\/|audio\/|application\/octet-stream)/i.test(type))throw new ImportFailure('import-not-media');
  if(!response.body?.getReader){const blob=await timed(()=>response.blob(),idleMs);if(blob.size>maxBytes)throw new ImportFailure('import-too-large',{terminal:true});if(!blob.size||total&&blob.size!==total)throw new ImportFailure('import-truncated');return blob;}
  const reader=response.body.getReader(),chunks=[];let size=0;
  try{
    for(;;){const {done,value}=await timed(()=>reader.read(),idleMs);if(done)break;size+=value.byteLength;
      if(size>maxBytes)throw new ImportFailure('import-too-large',{terminal:true});chunks.push(value);onProgress(size,total);}
    if(!size||total&&size!==total)throw new ImportFailure('import-truncated');
    return new Blob(chunks,{type});
  }catch(error){void reader.cancel().catch(()=>{});throw error;}
}
export async function downloadWithFailover({url,format='video',nodes=IMPORT_NODES,resume=null,
  fetcher=fetch,save=async()=>{},onProgress=()=>{},wait=ms=>new Promise(r=>setTimeout(r,ms)),now=()=>Date.now(),
  healthMs=4500,requestMs=12000,idleMs=15000,pollMs=1500,jobMs=210000,statusFailures=3,maxBytes=100000000}={}){
  // A saved node means an existing remote job, not a new preference decision.
  const previous=nodes.find(n=>n.id===resume?.node),order=previous?[previous,...nodes.filter(n=>n.id!==previous.id)]:nodes;
  // A machine rejected before a reload may now be healthy. Exclusions belong
  // to this bounded attempt only, never permanently to a saved user job.
  const failed=new Set();let lastError;
  async function persist(value){try{await save(value);}catch{throw new ImportFailure('import-storage',{terminal:true});}}
  for(const node of order){
    if(failed.has(node.id))continue;
    let jobId=previous?.id===node.id?resume?.jobId:null;
    try{
      if(!jobId){
        onProgress({phase:'checking',node:node.id});
        const health=await requestJSON(fetcher,target(node,'health'),{},healthMs);
        if(health.ok===false||health.available===false)throw new ImportFailure('import-offline');
        await persist({node:node.id,jobId:null,failedNodes:[...failed]});
        const started=await requestJSON(fetcher,target(node,'start'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url,format})},requestMs);
        if(!/^[a-z0-9_-]{1,160}$/i.test(started.jobId||''))throw new ImportFailure('import-invalid-job');
        jobId=started.jobId;await persist({node:node.id,jobId,failedNodes:[...failed]});
      }
      const begun=now();let misses=0,title='',description='',ready=false;
      while(now()-begun<jobMs){
        let state;
        try{state=await requestJSON(fetcher,target(node,'status',jobId),{},requestMs);misses=0;}
        catch(error){if(error.terminal||error.status===404||++misses>=statusFailures)throw error;await wait(pollMs);continue;}
        if(state.title)title=String(state.title).slice(0,200);
        onProgress({phase:'downloading',node:node.id,jobId,bytes:state.size||0});
        if(state.state==='done'){description=String(state.description||'').slice(0,4000);ready=true;break;}
        if(!['running','queued'].includes(state.state))throw new ImportFailure('import-download');
        await wait(pollMs);
      }
      if(!ready)throw new ImportFailure('import-timeout');
      const response=await timed(signal=>fetcher(target(node,'get',jobId),{cache:'no-store',signal}),requestMs);
      if([401,403].includes(response.status))throw new ImportFailure('import-session',{terminal:true});
      if(!title)try{title=decodeURIComponent(response.headers.get('X-Tube-Title')||'');}catch{}
      const blob=await readImportMedia(response,{maxBytes,idleMs,onProgress:(bytes,total)=>onProgress({phase:'receiving',node:node.id,jobId,bytes,total})});
      return {blob,title,description,node:node.id,kind:node.kind,jobId};
    }catch(error){
      if(error.terminal)throw error;
      lastError=error;failed.add(node.id);
      await persist({node:node.id,jobId:null,failedNodes:[...failed]});
      onProgress({phase:'switching',node:node.id});
    }
  }
  await persist({node:resume?.node??nodes[0]?.id,jobId:null,failedNodes:[...failed],exhausted:true});
  const error=new ImportFailure('import-offline');error.cause=lastError;throw error;
}
