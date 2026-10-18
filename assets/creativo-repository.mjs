// Durable jobs and MP3s. Claim and result commits are atomic across tabs.
export function openCreativeDB(factory=globalThis.indexedDB){
 return new Promise((resolve,reject)=>{const r=factory.open('admira-creativo',1);r.onupgradeneeded=()=>{r.result.createObjectStore('jobs',{keyPath:'id'});r.result.createObjectStore('media');};r.onerror=()=>reject(r.error);r.onsuccess=()=>resolve(r.result);});
}
export class CreativeRepository {
 constructor(db){this.db=db;}
 tx(stores,mode,run){return new Promise((resolve,reject)=>{const tx=this.db.transaction(stores,mode);let result;tx.oncomplete=()=>resolve(result);tx.onerror=tx.onabort=()=>reject(tx.error||Error('creative-storage'));try{run(tx,value=>{result=value;});}catch(error){tx.abort();reject(error);}});}
 list(){return this.tx(['jobs'],'readonly',(tx,out)=>{const r=tx.objectStore('jobs').getAll();r.onsuccess=()=>out(r.result.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)));});}
 get(id){return this.tx(['jobs'],'readonly',(tx,out)=>{const r=tx.objectStore('jobs').get(id);r.onsuccess=()=>out(r.result);});}
 put(job){return this.tx(['jobs'],'readwrite',tx=>tx.objectStore('jobs').put(job));}
 claim(id){return this.tx(['jobs'],'readwrite',(tx,out)=>{const s=tx.objectStore('jobs'),r=s.get(id);r.onsuccess=()=>{if(r.result?.state!=='prepared'){out(null);return;}const now=new Date().toISOString(),job={...r.result,state:'submitting',submittedAt:now,updatedAt:now};s.put(job);out(job);};});}
 finish(job,blob){return this.tx(['jobs','media'],'readwrite',tx=>{if(blob)tx.objectStore('media').put(blob,job.id);tx.objectStore('jobs').put(job);});}
 media(id){return this.tx(['media'],'readonly',(tx,out)=>{const r=tx.objectStore('media').get(id);r.onsuccess=()=>out(r.result);});}
}
