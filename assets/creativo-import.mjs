import {parseImportCommand,importIdentity,importMessage} from './creativo-import-core.mjs?v=creativo-20261018-6';
import {stockSource} from '../adaptaciones/stock-publish.mjs';
import {localMedia,MAX_LOCAL_BYTES} from './stock-local-files.mjs';
import {readMediaDimensions} from './content-orientation.mjs';
import {sampleImportVideo} from './import-context.mjs';
export class ImportRepository{
 constructor(db){this.db=db;}
 static async open(factory=globalThis.indexedDB){return new Promise((resolve,reject)=>{const r=factory.open('admira-creativo-imports',1);r.onupgradeneeded=()=>{r.result.createObjectStore('jobs',{keyPath:'id'});r.result.createObjectStore('media');};r.onerror=()=>reject(r.error);r.onsuccess=()=>resolve(new ImportRepository(r.result));});}
 tx(mode,run){return new Promise((resolve,reject)=>{const tx=this.db.transaction(['jobs','media'],mode);let result;tx.oncomplete=()=>resolve(result);tx.onerror=tx.onabort=()=>reject(tx.error||Error('import-storage'));try{run(tx,value=>{result=value;});}catch(e){tx.abort();reject(e);}});}
 get(id){return this.tx('readonly',(tx,out)=>{const r=tx.objectStore('jobs').get(id);r.onsuccess=()=>out(r.result);});}
 async create(order){const id=await importIdentity(order),now=new Date().toISOString();return this.tx('readwrite',(tx,out)=>{const s=tx.objectStore('jobs'),r=s.get(id);r.onsuccess=()=>{const job=r.result||{id,...order,state:'prepared',createdAt:now,updatedAt:now};if(!r.result)s.put(job);out(job);};});}
 move(id,states,patch,blob){return this.tx('readwrite',(tx,out)=>{const s=tx.objectStore('jobs'),r=s.get(id);r.onsuccess=()=>{if(!r.result||!states.includes(r.result.state)){out(null);return;}const job={...r.result,...patch,updatedAt:new Date().toISOString()};s.put(job);if(blob)tx.objectStore('media').put(blob,id);out(job);};});}
 media(id){return this.tx('readonly',(tx,out)=>{const r=tx.objectStore('media').get(id);r.onsuccess=()=>out(r.result);});}
}
export async function readImportBlob(response,onProgress=()=>{}){
 if(!response.ok)throw Error('import-download');const total=Number(response.headers.get('Content-Length'))||0;if(total>MAX_LOCAL_BYTES)throw Error('import-too-large');
 const reader=response.body?.getReader();if(!reader){const blob=await response.blob();if(blob.size>MAX_LOCAL_BYTES)throw Error('import-too-large');return blob;}
 const chunks=[];let size=0;for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_LOCAL_BYTES){await reader.cancel();throw Error('import-too-large');}chunks.push(value);onProgress(size,total);}
 if(!size)throw Error('import-not-media');return new Blob(chunks,{type:response.headers.get('Content-Type')||'application/octet-stream'});
}
export async function runImport(job,repository,{fetcher=fetch,notify=()=>{},wait=ms=>new Promise(r=>setTimeout(r,ms)),source=stockSource,dimensions=readMediaDimensions,sample=sampleImportVideo,tags=[]}={}){
 const show=(value,extra={})=>notify(value,extra),id=job.id;show(job);
 if(['complete','starting','publishing','unknown','failed'].includes(job.state))return job;
 try{
  if(job.state==='prepared'){
   let node=0;
   if(!job.direct){let healthy=false;for(node=0;node<2;node++){try{const r=await fetcher('/creativo-import/health?node='+node),d=await r.json();if(r.ok&&d.ok!==false&&d.available!==false){healthy=true;break;}}catch{}}if(!healthy)throw Error('import-offline');}
   const claimed=await repository.move(id,['prepared'],{state:job.direct?'downloading':'starting',node});if(!claimed)return await repository.get(id);job=claimed;show(job);
   if(!job.direct){const r=await fetcher('/creativo-import/start?node='+node,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:job.url,format:job.format})});if(!r.ok)throw Error('import-unknown');const data=await r.json();if(!data.jobId||!/^[a-z0-9_-]{1,160}$/i.test(data.jobId))throw Error('import-unknown');job=await repository.move(id,['starting'],{state:'downloading',jobId:data.jobId});if(!job)throw Error('import-storage');show(job);}
  }
  if(job.state==='downloading'){
   let title=job.title||'',description='';
   if(job.jobId){let done=false;for(let n=0;n<240;n++){const r=await fetcher('/creativo-import/status?node='+job.node+'&id='+encodeURIComponent(job.jobId),{cache:'no-store'});if(!r.ok)throw Error('import-poll');const data=await r.json();show(job,{bytes:data.size||0});if(data.title)title=String(data.title).slice(0,200);if(data.state==='done'){description=String(data.description||'').slice(0,4000);done=true;break;}if(data.state!=='running'&&data.state!=='queued')throw Error('import-download');await wait(1500);}if(!done)throw Error('import-poll');}
   const url=job.jobId?'/creativo-import/get?node='+job.node+'&id='+encodeURIComponent(job.jobId):job.url;
   const r=await fetcher(url,{credentials:job.jobId?'same-origin':'omit',cache:'no-store'});if(!title)try{title=decodeURIComponent(r.headers.get('X-Tube-Title')||'');}catch{}
   const blob=await readImportBlob(r,(bytes,total)=>show(job,{bytes,total}));const name=title||decodeURIComponent(new URL(job.url).pathname.split('/').pop()||'Importado'),media=localMedia({type:blob.type,name});if(!media)throw Error('import-not-media');
   job=await repository.move(id,['downloading'],{state:'downloaded',title:name,description,...media,size:blob.size},blob);if(!job)return await repository.get(id);show(job);
  }
  if(job.state==='downloaded'){
   const blob=await repository.media(id);if(!blob)throw Error('import-storage');const claimed=await repository.move(id,['downloaded'],{state:'publishing'});if(!claimed)return await repository.get(id);job=claimed;show(job);
   let measured=null,frames=[];try{if(job.type!=='audio')measured=await dimensions(blob,job.type);}catch{}
   if(job.type==='video'){const local=URL.createObjectURL(blob);try{frames=await sample(local);}catch{}finally{URL.revokeObjectURL(local);}}
   const upload=await source(blob,{fetch:fetcher,type:job.type,mime:job.mime,motor:job.direct?'import':'yt-dlp',onProgress:(bytes,total)=>show(job,{bytes,total})});if(!upload.ok)throw Error('import-unknown');
   const payload={type:job.type,mime:job.mime,motor:job.direct?'import':'yt-dlp',title:job.title,prompt:job.url,externalRef:id,tags,quality:'good',dimensions:measured,costEst:'import · '+(blob.size/1e6).toFixed(2)+' MB',...upload.fields,...(!job.direct?{searchContext:{version:1,description:job.description||''},analysisFrames:frames}:{}),...(frames.length?{poster:frames[0]}:{})};
   const response=await fetcher('/stock-publish',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}),data=await response.json();if(!response.ok||!data.ok||!data.id)throw Error('import-unknown');
   job=await repository.move(id,['publishing'],{state:'complete',stockId:data.id,stockURL:data.url||null,reused:Boolean(data.reused)});show(job);return job;
  }
  return job;
 }catch(error){const saved=await repository.get(id);if(saved&&['starting','publishing'].includes(saved.state))job=await repository.move(id,[saved.state],{state:'unknown'});else if(saved&&['import-not-media','import-too-large'].includes(error.message))job=await repository.move(id,[saved.state],{state:'failed',error:error.message});else job=saved||job;show(job,{error:error.message});return job;}
}
export async function bindCreativeImport({open,back,en=false}){
 const repository=await ImportRepository.open(),box=document.getElementById('creative-import'),status=document.getElementById('creative-import-status'),title=document.getElementById('creative-import-url'),result=document.getElementById('creative-import-result'),resume=document.getElementById('creative-import-resume');let active=null,running=false;
 const t=(es,eng)=>en?eng:es,key='admira.creativo.import.active';
 function draw(job,extra={}){if(!job)return;active=job;title.textContent=job.url;result.replaceChildren();const messages={prepared:t('URL guardada. Preparando importación…','URL saved. Preparing import…'),starting:t('Solicitando la descarga…','Requesting download…'),downloading:t('Descargando contenido…','Downloading media…'),downloaded:t('Contenido recibido. Preparando Stock…','Media received. Preparing Stock…'),publishing:t('Guardando en Stock…','Saving to Stock…'),complete:t('Guardado en Stock.','Saved to Stock.'),unknown:importMessage(Error('import-unknown'),en),failed:t('No se completó la importación.','Import did not complete.')};status.textContent=extra.error?importMessage(Error(extra.error),en):(job.error?importMessage(Error(job.error),en):messages[job.state]);if(extra.bytes)status.textContent+=' '+(extra.bytes/1e6).toFixed(1)+(extra.total?' / '+(extra.total/1e6).toFixed(1):'')+' MB';resume.hidden=!['prepared','downloading','downloaded'].includes(job.state)||running;if(job.stockId){const link=document.createElement('a');link.href='/stock.html?highlight='+encodeURIComponent(job.stockId)+'&lang='+(en?'en':'es');link.target='_blank';link.rel='noopener';link.textContent=t('Ver en Stock','View in Stock');result.append(link);}}
 function clientTags(){try{const client=window.parent.PixeriaCliente?.actual?.();return client?.id?[client.id]:[];}catch{return [];}}
 async function run(){if(!active||running)return;running=true;resume.hidden=true;try{await runImport(active,repository,{notify:draw,tags:clientTags()});}catch{status.textContent=t('No se pudo guardar el estado. No se repetirá automáticamente.','Could not save the state. It will not repeat automatically.');}finally{running=false;resume.hidden=!active||!['prepared','downloading','downloaded'].includes(active.state);}}
 async function launch(text){const order=parseImportCommand(text);if(!order)return false;if(running&&active?.url!==order.url){status.textContent=t('Hay una importación en curso. Espera a que termine para enviar otra URL.','An import is in progress. Wait for it before sending another URL.');return true;}open();box.hidden=false;if(order.help){title.textContent='';result.replaceChildren();resume.hidden=true;status.textContent=t('Usa /importar URL o pega una URL. Se importará y guardará en Stock. Puedes añadir audio o video al final.','Use /import URL or paste a URL. It will be imported and saved in Stock. Optionally append audio or video.');return true;}active=await repository.create(order);localStorage.setItem(key,active.id);draw(active);void run();return true;}
 resume.onclick=()=>void run();document.getElementById('creative-import-back').onclick=()=>{box.hidden=true;localStorage.removeItem(key);back();};
 const previous=localStorage.getItem(key);if(previous){const saved=await repository.get(previous);if(saved){active=saved;open();box.hidden=false;draw(saved);if(['downloading','downloaded'].includes(saved.state))void run();}}
 return {launch,hide(){box.hidden=true;}};
}
