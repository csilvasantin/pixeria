import {comboExportJob} from './creativo-combo-core.mjs?v=creativo-20261018-15';
import {createEngine} from '../adaptaciones/adapter-export.js';
export async function generateComboImage(job,fetcher=fetch){
 const prompt=job.imagePrompt+'\nOutput composition: '+(job.orientation==='horizontal'?'landscape 16:9':'portrait 9:16')+'. Keep every subject and requested word fully inside the frame.';
 const r=await fetcher('/creator-ai/image',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt}),signal:AbortSignal.timeout(135000)}),data=await r.json();
 if(!r.ok||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(data.image||''))throw Error('combo-image');
 const response=await fetcher(data.image);const blob=await response.blob();if(!blob.size||blob.size>20000000)throw Error('combo-image');return blob;
}
export function audioDuration(blob){return new Promise((resolve,reject)=>{const audio=document.createElement('audio'),url=URL.createObjectURL(blob),timer=setTimeout(()=>finish(Error('combo-audio')),15000);function finish(error){clearTimeout(timer);audio.removeAttribute('src');audio.load();URL.revokeObjectURL(url);error?reject(error):resolve(audio._measuredDuration);}audio.onloadedmetadata=()=>{audio._measuredDuration=audio.duration;Number.isFinite(audio.duration)&&audio.duration>0?finish():finish(Error('combo-audio'));};audio.onerror=()=>finish(Error('combo-audio'));audio.preload='metadata';audio.src=url;});}
export async function renderCombo(job,image,audio,{start=0,notify=()=>{},excerptApproved=false}={}){
 const duration=await audioDuration(audio);if(job.kind==='musica'&&duration>10.05&&!excerptApproved)throw Error('combo-excerpt-review');const plan=comboExportJob(job,{audioDuration:duration,start,imageMime:image.type}),imageURL=URL.createObjectURL(image),audioURL=URL.createObjectURL(audio),engine=createEngine();plan.extraFiles=[{name:'audio',url:audioURL}];let result;
 try{await engine.encode(imageURL,plan,notify,(_plan,blob)=>{result=blob;});if(!result)throw Error('encoding');return result;}finally{engine.cancel();URL.revokeObjectURL(imageURL);URL.revokeObjectURL(audioURL);}
}
export async function downloadComboMusic(job,fetcher=fetch){
 const r=await fetcher('/creativo-music/audio?request_id='+encodeURIComponent(job.id)+'&clip=0',{cache:'no-store'});if(!r.ok||!/^audio\//.test(r.headers.get('Content-Type')||''))throw Error('combo-audio');const blob=await r.blob();if(!blob.size||blob.size>50000000)throw Error('combo-audio');return blob;
}
