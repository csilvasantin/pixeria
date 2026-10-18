import {ImportRepository} from './creativo-import.mjs?v=creativo-20261018-15';
import {comboSpec,comboIdentity,comboImageIdentity,comboHash} from './creativo-combo-core.mjs?v=creativo-20261018-15';
import {creativeJob} from './creativo-core.mjs?v=creativo-20261018-15';
export class ComboRepository extends ImportRepository{
 static open(factory=globalThis.indexedDB){return new Promise((resolve,reject)=>{const r=factory.open('admira-creativo-combos',1);r.onupgradeneeded=()=>{r.result.createObjectStore('jobs',{keyPath:'id'});r.result.createObjectStore('media');};r.onerror=()=>reject(r.error);r.onsuccess=()=>resolve(new ComboRepository(r.result));});}
 list(){return this.tx('readonly',(tx,out)=>{const r=tx.objectStore('jobs').getAll();r.onsuccess=()=>out(r.result.filter(x=>x.recordType==='combo').sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)));});}
 async create(value){
  const spec=comboSpec(value),id=await comboIdentity(spec),imageId=await comboImageIdentity(spec),audioId='combo-audio-'+await comboHash([spec.kind,spec.audioText,spec.voice,spec.languages,spec.style,10]),now=new Date().toISOString();
  const records=[{...spec,id,imageId,audioId,recordType:'combo',state:'prepared',createdAt:now,updatedAt:now},{id:imageId,recordType:'image',state:'prepared',imagePrompt:spec.imagePrompt,orientation:spec.orientation,updatedAt:now},{...creativeJob({id:audioId,kind:spec.kind==='musica'?'cancion':'locucion',brief:spec.audioText,voice:spec.voice,languages:spec.languages,style:spec.style}),recordType:'audio',...(spec.kind==='musica'?{durationSeconds:10}:{})}];
  await this.tx('readwrite',tx=>{const store=tx.objectStore('jobs');for(const record of records){const r=store.get(record.id);r.onsuccess=()=>{if(!r.result)store.put(record);};}});return this.get(id);
 }
}
// Every paid component has its own atomic claim. Editing audio reuses identical image pixels.
export async function runCombo(job,repo,{preflight,generateImage,submitAudio,pollAudio,downloadAudio,assemble,notify=()=>{},allowGenerate=true,start=0,resumeAssembly=false}={}){
 job=await repo.get(job.id);if(job.state==='complete'||job.state==='publishing'||job.state==='publish-unknown')return job;
 if(job.state==='assembling'){if(!resumeAssembly)return job;const reset=await repo.move(job.id,['assembling'],{state:'render-failed'});if(!reset)return repo.get(job.id);job=reset;}
 let image=await repo.get(job.imageId),audio=await repo.get(job.audioId),token;
 const show=async phase=>{job=await repo.move(job.id,['prepared','waiting','ready','assembling','render-failed'],{state:'waiting',phase});notify(job,{image,audio});};
 if(allowGenerate&&(image.state==='prepared'||audio.state==='prepared'))token=await preflight(audio);
 if(image.state==='prepared'&&allowGenerate){
  const claim=await repo.move(image.id,['prepared'],{state:'submitting'});
  if(claim){image=claim;await show('image');try{const blob=await generateImage(image);image=await repo.move(image.id,['submitting'],{state:'complete',mime:blob.type,size:blob.size},blob);}catch(error){await repo.move(image.id,['submitting'],{state:'unknown'});throw error;}}
  else image=await repo.get(image.id);
 }
 if(image.state!=='complete'){await show(image.state==='prepared'?'prepared':'image-unconfirmed');return job;}
 if(audio.state==='prepared'&&allowGenerate){
  const claim=await repo.move(audio.id,['prepared'],{state:'submitting'});
  if(claim){audio=claim;await show('audio');try{const result=await submitAudio(audio,token);const patch={...result,state:result.blob?'complete':(result.state||'pending')};delete patch.blob;audio=await repo.move(audio.id,['submitting'],patch,result.blob);}catch(error){await repo.move(audio.id,['submitting'],{state:'unknown'});throw error;}}
  else audio=await repo.get(audio.id);
 }
 if(audio.kind==='cancion'&&['pending','unknown','blocked'].includes(audio.state)){
  const result=await pollAudio(audio);audio=await repo.move(audio.id,[audio.state],result)||await repo.get(audio.id);
 }
 if(audio.state!=='complete'){await show(audio.state==='prepared'?'image-ready':audio.kind==='cancion'?'music-pending':'audio-unconfirmed');return job;}
 let sound=await repo.media(audio.id);
 if(!sound&&audio.kind==='cancion'){sound=await downloadAudio(audio);await repo.move(audio.id,['complete'],{},sound);}
 if(!sound)throw Error('combo-audio');
 const parentId=job.id;job=await repo.move(parentId,['prepared','waiting','ready','render-failed'],{state:'assembling',phase:'assembling',start});if(!job)return repo.get(parentId);notify(job,{image,audio});
 try{const result=await assemble(job,await repo.media(image.id),sound,{start});job=await repo.move(job.id,['assembling'],{state:'complete',phase:'complete',mime:result.type,size:result.size},result);notify(job,{image,audio});return job;}
 catch(error){await repo.move(job.id,['assembling'],{state:'render-failed',error:error.message});throw error;}
}
