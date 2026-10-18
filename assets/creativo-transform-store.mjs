import {ImportRepository} from './creativo-import.mjs?v=creativo-20261018-16';
import {blobDigest,transformIdentity} from './creativo-transform-core.mjs?v=creativo-20261018-16';
import {GOOD_METHOD,isGood} from './creativo-good.mjs?v=creativo-20261018-16';
export class TransformRepository extends ImportRepository{
 static open(factory=globalThis.indexedDB){return new Promise((resolve,reject)=>{const r=factory.open('admira-creativo-transforms',1);r.onupgradeneeded=()=>{r.result.createObjectStore('jobs',{keyPath:'id'});r.result.createObjectStore('media');};r.onerror=()=>reject(r.error);r.onsuccess=()=>resolve(new TransformRepository(r.result));});}
 async saveSource(blob,metadata){const digest=await blobDigest(blob),id='source-'+digest,source={...metadata,digest,id,state:'source',updatedAt:new Date().toISOString()};await this.tx('readwrite',(tx)=>{tx.objectStore('jobs').put(source);tx.objectStore('media').put(blob,id);});return source;}
 background(id){return this.media(id+':background');}
 saveBackground(id,blob){return this.tx('readwrite',(tx,out)=>{const jobs=tx.objectStore('jobs'),r=jobs.get(id);r.onsuccess=()=>{if(r.result?.state!=='rendering'){out(null);return;}const job={...r.result,backgroundReady:true,updatedAt:new Date().toISOString()};tx.objectStore('media').put(blob,id+':background');jobs.put(job);out(job);};});}
 list(){return this.tx('readonly',(tx,out)=>{const r=tx.objectStore('jobs').getAll();r.onsuccess=()=>out(r.result.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)));});}
 create(order,source){const id=transformIdentity(order,source),method=order.action==='recrear'&&order.type==='video'?GOOD_METHOD:undefined;return this.tx('readwrite',(tx,out)=>{const store=tx.objectStore('jobs'),r=store.get(id);r.onsuccess=()=>{const job=r.result||{...order,...(method?{method,duration:3}:{}),id,sourceId:source.id,state:'prepared',updatedAt:new Date().toISOString()};if(!r.result)store.put(job);out(job);};});}
}
export async function runTransform(job,repository,{preflight=async()=>null,render,notify=()=>{}}){
 const good=isGood(job),resume=good&&job.state==='rendering';
 if(!['prepared','render-failed'].includes(job.state)&&!resume)return job;
 if(job.action==='recrear'&&job.type==='video'&&!good)throw Error('video-temporal-required');
 const background=await repository.background?.(job.id);
 if(job.state==='render-failed'&&!background)return job;
 // Stored AI pixels survive an interrupted encode; retrying the montage never pays twice.
 const token=good||job.action==='recrear'&&!background?await preflight():null;
 const claimed=resume?await repository.get(job.id):await repository.move(job.id,[job.state],{state:'rendering'});if(!claimed||claimed.state!=='rendering')return repository.get(job.id);notify(claimed);
 try{const source=await repository.get(claimed.sourceId),blob=await repository.media(claimed.sourceId);if(!blob)throw Error('transform-source');
 const output=await render(claimed,source,blob,token,{background,resume,saveBackground:async pixels=>{if(!await repository.saveBackground(claimed.id,pixels))throw Error('transform-storage');}});
 const saved=await repository.move(job.id,['rendering'],{state:'complete',mime:output.type,size:output.size},output);notify(saved);return saved;
 }catch(error){if(good&&error.message==='good-offline')throw error;const hasBackground=await repository.background?.(job.id);const failed=await repository.move(job.id,['rendering'],{state:job.action==='recrear'?(hasBackground?'render-failed':'unknown'):'failed',error:error.message});notify(failed);throw error;}
}
