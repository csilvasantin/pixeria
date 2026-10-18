import {restoreCampaign,DIRECTIONS} from './campaign-core.mjs?v=campaign-1';
const DATABASE='admira.campaign-recovery.v1';
export function recoverySnapshot(c,{selected,approvals={},guides=true}={}){
 const campaign=restoreCampaign(c),reviews={};
 for(const i of campaign.installations)for(const direction of DIRECTIONS){const key=`${i.id}:${direction.id}:r${campaign.revision}`,r=approvals[key];if(r?.revision===campaign.revision&&r.direction===direction.id&&typeof r.reviewedAt==='string')reviews[key]=structuredClone(r);}
 return {schema:DATABASE,campaign,selected:campaign.installations.some(i=>i.id===selected)?selected:campaign.installations[0].id,approvals:reviews,guides:guides!==false,updatedAt:new Date().toISOString()};
}
export function restoreRecovery(value){
 if(value?.schema!==DATABASE)throw Error('campaign-recovery-invalid');
 return {...recoverySnapshot(value.campaign,value),updatedAt:value.updatedAt,token:value.token};
}
function open(){return new Promise((resolve,reject)=>{
 const r=indexedDB.open(DATABASE,1);r.onupgradeneeded=()=>{r.result.createObjectStore('campaigns',{keyPath:'key'});r.result.createObjectStore('current');};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(Error('campaign-storage-unavailable'));r.onblocked=()=>reject(Error('campaign-storage-blocked'));
});}
async function transaction(mode,run){const db=await open();try{return await new Promise((resolve,reject)=>{const tx=db.transaction(['campaigns','current'],mode);let result,error;tx.oncomplete=()=>resolve(result);tx.onerror=tx.onabort=()=>reject(error||Error('campaign-storage-unavailable'));run(tx,value=>{result=value;},reason=>{error=reason;tx.abort();});});}finally{db.close();}}
export function saveRecovery(scope,value,{expected}={}){const snapshot={...restoreRecovery(value),token:crypto.randomUUID()};return transaction('readwrite',(tx,done,fail)=>{const key=scope+':'+snapshot.campaign.id,store=tx.objectStore('campaigns'),r=store.get(key);r.onsuccess=()=>{if(expected!==undefined&&(r.result?.token||null)!==expected)return fail(Error('campaign-version-conflict'));store.put({key,scope,...snapshot});tx.objectStore('current').put(key,scope);done(snapshot);};});}
export function readRecovery(scope,id){return transaction('readonly',(tx,done)=>{const read=key=>{if(!key)return done(null);const r=tx.objectStore('campaigns').get(key);r.onsuccess=()=>{try{done(r.result?restoreRecovery(r.result):null);}catch{tx.abort();}};};if(id)read(scope+':'+id);else{const r=tx.objectStore('current').get(scope);r.onsuccess=()=>read(r.result);}});}
export function listRecovery(scope){return transaction('readonly',(tx,done)=>{const r=tx.objectStore('campaigns').getAll();r.onsuccess=()=>done(r.result.filter(row=>row.scope===scope).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).map(row=>({id:row.campaign.id,name:row.campaign.name,revision:row.campaign.revision,updatedAt:row.updatedAt})));});}
// Snapshot before enqueueing: a later edit/new campaign cannot mutate an earlier save.
export function recoveryWriter(scope,{saved=()=>{},failed=()=>{}}={}){
 let tail=Promise.resolve();const bases=new Map();
 return {adopt(value){bases.set(value.campaign.id,value.token||null);},save(value){const snapshot=structuredClone(value);tail=tail.catch(()=>{}).then(()=>saveRecovery(scope,snapshot,{expected:bases.get(snapshot.campaign.id)||null})).then(result=>{bases.set(result.campaign.id,result.token);saved(result);return result;}).catch(e=>{failed(e);throw e;});tail.catch(()=>{});return tail;},flush:()=>tail};
}
