import {drawCreatorCampaign} from './creator-render.mjs?v=creator-tools-1';
import {loadCreatorMedia} from './creator-media.mjs?v=creator-tools-1';
import {createEngine} from '../../adaptaciones/adapter-export.js?v=creator-tools-1';
export function animatedJob(c,i){
 if(i.screens.some(s=>s.w%2||s.h%2||s.rotation))throw Error('video-screen-geometry');
 const outputs=i.screens.map((s,n)=>({file:'screen-'+n+'.mp4',filename:`${c.id}-${s.id}-${s.w}x${s.h}.mp4`,W:s.w,H:s.h,screen:s.id}));
 const args=['-i','input','-filter_complex',i.screens.map((s,n)=>`[0:v]crop=${s.w}:${s.h}:${s.x}:${s.y},fps=25,setsar=1[v${n}]`).join(';')];
 outputs.forEach((o,n)=>args.push('-map',`[v${n}]`,'-an','-c:v','libx264','-preset','ultrafast','-crf','20','-pix_fmt','yuv420p','-r','25','-g','25','-t',String(c.seconds||32),'-movflags','+faststart',o.file));
 return {input:'input',args,outputs,durationSeconds:c.seconds||32};
}
export async function recordWall(c,i,media,{signal,onProgress=()=>{}}={}){
 if(document.hidden)throw Error('keep-export-tab-visible');if(typeof MediaRecorder==='undefined'||!HTMLCanvasElement.prototype.captureStream)throw Error('video-browser-unsupported');
 const mime=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/mp4'].find(type=>MediaRecorder.isTypeSupported(type));if(!mime)throw Error('video-browser-unsupported');
 const canvas=document.createElement('canvas');canvas.width=i.width;canvas.height=i.height;drawCreatorCampaign(canvas,i,media.image,0,c,media.background);
 const stream=canvas.captureStream(25),recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:12000000}),chunks=[];let raf=0,bytes=0;
 try{
 media.video.pause();media.video.currentTime=0;await new Promise((resolve,reject)=>{if(media.video.readyState>=2&&media.video.currentTime===0)resolve();else{media.video.onseeked=resolve;media.video.onerror=()=>reject(Error('video-seek'));}});await media.video.play();
 return await new Promise((resolve,reject)=>{
  let ended=false;const finish=(error)=>{if(ended)return;ended=true;cancelAnimationFrame(raf);signal?.removeEventListener('abort',abort);if(recorder.state!=='inactive')recorder.stop();if(error)reject(error);};const abort=()=>finish(Error('cancelled'));const hidden=()=>{if(document.hidden)finish(Error('keep-export-tab-visible'));};document.addEventListener('visibilitychange',hidden);recorder.addEventListener('stop',()=>document.removeEventListener('visibilitychange',hidden),{once:true});
  recorder.ondataavailable=e=>{bytes+=e.data.size;if(bytes>90*1024*1024){finish(Error('video-recording-size'));return;}if(e.data.size)chunks.push(e.data);};recorder.onerror=()=>finish(Error('video-recording'));recorder.onstop=()=>{if(!signal?.aborted)resolve(new Blob(chunks,{type:mime}));};signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)return abort();
  const start=performance.now();function tick(){if(ended)return;const elapsed=(performance.now()-start)/1000,seconds=Math.min(elapsed,c.seconds||32);drawCreatorCampaign(canvas,i,media.frame(seconds),seconds,c,media.background);onProgress(seconds/(c.seconds||32));if(elapsed>=(c.seconds||32))finish();else raf=requestAnimationFrame(tick);}recorder.start(1000);tick();
 });
 }finally{cancelAnimationFrame(raf);stream.getTracks().forEach(t=>t.stop());media.video.pause();}
}
export async function exportAnimatedCampaign(c,installations,{signal,onProgress,onFile,engine=createEngine()}={}){
 const media=await loadCreatorMedia(c),abort=()=>engine.cancel();signal?.addEventListener('abort',abort,{once:true});
 try{for(const [n,i]of installations.entries()){
  if(signal?.aborted)throw Error('cancelled');const recording=await recordWall(c,i,media,{signal,onProgress:p=>onProgress?.({installation:i.id,phase:'recording',progress:p,index:n,total:installations.length})});
  if(signal?.aborted)throw Error('cancelled');const url=URL.createObjectURL(recording);try{await engine.encode(url,animatedJob(c,i),p=>onProgress?.({...p,installation:i.id,index:n,total:installations.length}),(output,blob)=>onFile?.({...output,blob,installation:i.id}));}finally{URL.revokeObjectURL(url);}
 }}finally{signal?.removeEventListener('abort',abort);engine.cancel();media.dispose();}
}
