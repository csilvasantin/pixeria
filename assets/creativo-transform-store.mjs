import {ImportRepository} from './creativo-import.mjs?v=creativo-20261018-7';
import {blobDigest,transformIdentity} from './creativo-transform-core.mjs?v=creativo-20261018-7';
export class TransformRepository extends ImportRepository{
 static open(factory=globalThis.indexedDB){return new Promise((resolve,reject)=>{const r=factory.open('admira-creativo-transforms',1);r.onupgradeneeded=()=>{r.result.createObjectStore('jobs',{keyPath:'id'});r.result.createObjectStore('media');};r.onerror=()=>reject(r.error);r.onsuccess=()=>resolve(new TransformRepository(r.result));});}
 async saveSource(blob,metadata){const digest=await blobDigest(blob),id='source-'+digest,source={...metadata,digest,id,state:'source',updatedAt:new Date().toISOString()};await this.tx('readwrite',(tx)=>{tx.objectStore('jobs').put(source);tx.objectStore('media').put(blob,id);});return source;}
 list(){return this.tx('readonly',(tx,out)=>{const r=tx.objectStore('jobs').getAll();r.onsuccess=()=>out(r.result.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)));});}
 create(order,source){const id=transformIdentity(order,source);return this.tx('readwrite',(tx,out)=>{const store=tx.objectStore('jobs'),r=store.get(id);r.onsuccess=()=>{const job=r.result||{...order,id,sourceId:source.id,state:'prepared',updatedAt:new Date().toISOString()};if(!r.result)store.put(job);out(job);};});}
}
export async function runTransform(job,repository,{preflight=async()=>null,render,notify=()=>{}}){
 if(job.state!=='prepared')return job;
 // Authentication happens before the atomic claim; paid requests are never auto-resumed.
 const token=job.action==='recrear'?await preflight():null;
 const claimed=await repository.move(job.id,['prepared'],{state:'rendering'});if(!claimed)return repository.get(job.id);notify(claimed);
 try{const source=await repository.get(claimed.sourceId),blob=await repository.media(claimed.sourceId);if(!blob)throw Error('transform-source');const output=await render(claimed,source,blob,token);
 const saved=await repository.move(job.id,['rendering'],{state:'complete',mime:output.type,size:output.size},output);notify(saved);return saved;
 }catch(error){const failed=await repository.move(job.id,['rendering'],{state:job.action==='recrear'?'unknown':'failed',error:error.message});notify(failed);throw error;}
}
