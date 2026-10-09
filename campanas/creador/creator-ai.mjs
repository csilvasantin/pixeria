export const FULL_SCHEMA='admira.creator-full.v1';
export const MODEL='grok-imagine-image-pro';
export function fullPrompts(c){
 const scenes=['rainlit midnight basketball court','sunlit concrete skate park','minimal sculptural studio','rooftop overlooking the city at dawn','neon-lit urban tunnel','coastal promenade at golden hour','industrial warehouse with dramatic beams','futuristic glass pavilion'];
 const n=parseInt(c.seed.slice(0,8),16);return {image:`Photorealistic premium sneaker advertising hero photograph for campaign ${c.name}. A completely new original unbranded sneaker design, a single pair with intricate woven upper and sculpted sole, placed on a low plinth in a ${scenes[n%scenes.length]}. Colour accents ${c.accent} and ${c.secondary}. Camera three-quarter product view, sneakers fill 65 percent of the frame. Premium editorial lighting, accurate footwear proportions, sharp material detail, atmospheric depth. No people, no lettering, no logos, no watermark. Unique creative direction ${c.seed}.`,video:`Animate this exact sneaker advertising photograph for ${c.name}. Slow cinematic camera orbit, subtle atmospheric light movement, realistic material reflections. Preserve the sneaker design and setting from the image. No people, no added text or logos. Seamless gentle motion, premium product film. Creative direction ${c.seed}.`};
}
function db(){return new Promise((resolve,reject)=>{const r=indexedDB.open('admira.creator-full',1);r.onupgradeneeded=()=>r.result.createObjectStore('jobs',{keyPath:'seed'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(Error('campaign-storage-unavailable'));});}
export async function saveFull(job){const d=await db();try{await new Promise((resolve,reject)=>{const tx=d.transaction('jobs','readwrite');tx.objectStore('jobs').put(job);tx.oncomplete=resolve;tx.onerror=()=>reject(Error('campaign-storage-unavailable'));});}finally{d.close();}}
export async function readFull(seed){const d=await db();try{return await new Promise((resolve,reject)=>{const r=d.transaction('jobs').objectStore('jobs').get(seed);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(Error('campaign-storage-unavailable'));});}finally{d.close();}}
export function newFull(c){return {schema:FULL_SCHEMA,seed:c.seed,campaign:{...c,mode:'full',generatedBy:'Grok Imagine Image + Grok Imagine Video',productProvenance:'New AI image and image-to-video generated for this run'},phase:'brief',events:[],startedAt:Date.now(),prompts:fullPrompts(c)};}
export async function creatorRequest(action,body){const r=await fetch('/creator-ai/'+action,{method:body?'POST':'GET',credentials:'include',cache:'no-store',headers:{'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const data=await r.json().catch(()=>({error:'invalid-response'}));if(!r.ok||data.error)throw Error((typeof data.error==='object'?data.error.message||JSON.stringify(data.error):data.error||'HTTP '+r.status)+(data.detail?' · '+data.detail:'')+' · '+r.status);return data;}
export async function runFull(job,{checkpoint,changed,alive,delay,persist=saveFull,request=creatorRequest}){
 const emit=async(phase,detail)=>{job.phase=phase;job.error=null;job.events.push({phase,detail,at:new Date().toISOString()});await persist(job);changed(job);};
 const guard=async()=>{await checkpoint();if(!alive())throw Error('demo-stopped');};
 try{
  // Issued POSTs are never repeated automatically after reload or lost replies.
  if(['image-requested','video-requested','archive-requested'].includes(job.phase))throw Error('request-result-unknown');
  job.error=null;await guard();
  if(job.phase==='brief'||job.phase==='concept'){
   await emit('concept','New creative direction');await delay(4000);await guard();await emit('image-requested',MODEL);
   const d=await request('image',{prompt:job.prompts.image});if(!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(d.image||''))throw Error('no-ai-image-returned');job.imageData=d.image;await emit('image-ready','New AI image received');
  }
  await guard();
  if(job.phase==='image-ready'){
   await emit('archive-requested','Saving generated image');const d=await request('archive',{image:job.imageData,seed:job.seed,title:job.campaign.name,prompt:job.prompts.image});if(!d.ok||!d.id||!d.url)throw Error('image-not-archived');job.image={id:d.id,url:d.url,model:MODEL};delete job.imageData;await emit('image-archived',d.id);
  }
  await guard();
  if(job.phase==='image-archived'){
   await emit('video-requested','Grok Imagine Video · 5 s');const d=await request('video',{stock_id:job.image.id,prompt:job.prompts.video});if(!d.request_id)throw Error('no-video-request-id');job.request_id=d.request_id;await emit('video-pending',d.request_id);
  }
  let queries=0;
  while(job.phase==='video-pending'){
   await guard();const d=await request('status?request_id='+encodeURIComponent(job.request_id));job.providerStatus=d.status||d.state||'pending';
   if(d.archived===true&&d.url){job.video={id:d.id,url:d.url,model:'grok-imagine-video',seconds:5};await emit('media-ready','New image and video archived');break;}
   if(['failed','expired','error','cancelled'].includes(job.providerStatus))throw Error('video-'+job.providerStatus);
   await persist(job);changed(job);if(++queries>=120)throw Error('video-polling-paused');await delay(5000);
  }
  if(job.phase==='media-ready')await guard();return job;
 }catch(e){if(e.message==='demo-stopped')return job;job.error=e.message;await persist(job);changed(job);return job;}
}
