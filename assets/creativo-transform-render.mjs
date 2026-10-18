import {transformGeometry,transformVideoJob,outpaintRequest} from './creativo-transform-core.mjs?v=creativo-20261018-12';
import {rect,defaults} from '../adaptaciones/adapter-core.mjs';
import {isGood,renderGoodVideo} from './creativo-good.mjs?v=creativo-20261018-12';
import {createEngine} from '../adaptaciones/adapter-export.js';
export async function loadTransformMedia(blob,type){
 const url=URL.createObjectURL(blob),media=type==='image'?new Image():document.createElement('video');
 try{await new Promise((resolve,reject)=>{const timer=setTimeout(()=>finish(Error('transform-size')),15000);function finish(error){clearTimeout(timer);media.onload=media.onloadeddata=media.onerror=null;error?reject(error):resolve();}media.onerror=()=>finish(Error('transform-size'));if(type==='image')media.onload=()=>finish();else{media.onloadeddata=()=>finish();media.preload='auto';media.muted=true;media.playsInline=true;}media.src=url;});
 const metadata={width:media.naturalWidth||media.videoWidth,height:media.naturalHeight||media.videoHeight,...(type==='video'?{duration:media.duration}:{})};transformGeometry(metadata,'horizontal');return {media,...metadata,close(){media.removeAttribute('src');if(type==='video')media.load();URL.revokeObjectURL(url);}};
 }catch(error){URL.revokeObjectURL(url);throw error;}
}
export function paintTransform(ctx,media,source,orientation,{reference=false,background=null,maxWidth=Infinity,method}={}){
 const geometry=transformGeometry(source,orientation,method),scale=Math.min(1,maxWidth/geometry.width),W=Math.round(geometry.width*scale),H=Math.round(geometry.height*scale),original=geometry.sourceRect,r={x:original.x*scale,y:original.y*scale,width:original.width*scale,height:original.height*scale};ctx.canvas.width=W;ctx.canvas.height=H;ctx.fillStyle=reference?'#808080':'#080c12';ctx.fillRect(0,0,W,H);
 if(background)ctx.drawImage(background,0,0,W,H);
 else if(!reference){const b=rect({ancho:source.width,alto:source.height},W,H,'cover',{...defaults(),zoom:1.1});ctx.save();ctx.filter=`blur(${14*Math.max(W,H)/384}px) brightness(.85)`;ctx.drawImage(media,b.x,b.y,b.w,b.h);ctx.restore();}
 ctx.drawImage(media,r.x,r.y,r.width,r.height);return ctx.canvas;
}
const png=canvas=>new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('transform-size')),'image/png'));
export async function transformPreflight(fetcher=fetch){const r=await fetcher('/auth/api-token',{credentials:'include',cache:'no-store'});if(!r.ok)throw Error('session');const {token}=await r.json();if(!token)throw Error('session');return token;}
export async function renderTransform(job,source,blob,token,{fetcher=fetch,notify=()=>{},background=null,saveBackground=async()=>{},resume=false}={}){
 if(job.action==='recrear'&&job.type==='video'){
  if(!isGood(job))throw Error('video-temporal-required');
  return renderGoodVideo(job,source,blob,token,{fetcher,notify,resume});
 }
 let loaded,bg;const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
 try{
  if(job.action==='recrear'){
   if(!background){
    loaded=await loadTransformMedia(blob,job.type);
    paintTransform(ctx,loaded.media,source,job.orientation,{reference:true});const body=outpaintRequest(canvas.toDataURL('image/png'),source,job.orientation);notify({phase:'generating-background'});
    // One paid POST per stored claim. Network ambiguity must never trigger a retry.
    const response=await fetcher('https://api.admira.store/image/edit',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(body),signal:AbortSignal.timeout(95000)}),data=await response.json();
    if(!response.ok||!data.ok||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(data.image||''))throw Error('transform-unknown');
    background=await(await fetcher(data.image)).blob();bg=await loadTransformMedia(background,'image');
    const expected=transformGeometry(source,job.orientation);if(Math.abs(bg.width/bg.height-expected.width/expected.height)>.03)throw Error('transform-unknown');
    await saveBackground(background);
   }else bg=await loadTransformMedia(background,'image');
   notify({phase:'background-ready',blob:background});
  }
  if(job.type==='video'){
   loaded?.close();loaded=null;
   const engine=createEngine(),url=URL.createObjectURL(blob);let output;
   try{const plan=transformVideoJob(source,job.orientation,source.name);
    await engine.encode(url,plan,notify,(_job,result)=>{output=result;});if(!output)throw Error('encoding');return output;
   }finally{engine.cancel();URL.revokeObjectURL(url);}
  }
  loaded=loaded||await loadTransformMedia(blob,'image');paintTransform(ctx,loaded.media,source,job.orientation,{background:bg?.media});return await png(canvas);
 }finally{loaded?.close();bg?.close();}
}
