import {paintTransform,loadTransformMedia} from './creativo-transform-render.mjs?v=creativo-20261018-10';
import {transformGeometry} from './creativo-transform-core.mjs?v=creativo-20261018-10';
// A small live composition previews the same geometry as export. It never decodes encoder output.
export async function createTransformPreview(container,{blob,source,order,result=null,background=null,en=false}){
 const t=(es,eng)=>en?eng:es,loaded=await loadTransformMedia(blob,order.type),original=loaded.media,dst=transformGeometry(source,order.orientation),canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');let disposed=false,frame=null,lastPaint=0,bg=null,output=null,resultURL=null;
 if(background)bg=await loadTransformMedia(background,'image');
 const left=document.createElement('figure'),right=document.createElement('figure'),leftLabel=document.createElement('figcaption'),rightLabel=document.createElement('figcaption'),stage=document.createElement('div'),leftStage=document.createElement('div');leftStage.className=stage.className='transform-screen';
 leftLabel.textContent=t('Original','Original')+' · '+source.width+' × '+source.height+' px';rightLabel.textContent=(order.action==='recrear'&&!background&&!result?t('Encaje previo · IA pendiente','Layout · AI pending'):t('Vista previa','Preview'))+' · '+dst.width+' × '+dst.height+' px · '+dst.ratio;canvas.setAttribute('role','img');canvas.setAttribute('aria-label',t('Adaptación en directo','Live adaptation'));stage.append(canvas);leftStage.append(original);left.append(leftLabel,leftStage);right.append(rightLabel,stage);container.replaceChildren(left,right);
 if(order.type==='video'){original.controls=true;original.muted=true;original.loop=true;original.playsInline=true;}else original.alt=t('Original completo','Full original');
 function paint(){if(disposed||output)return;paintTransform(ctx,original,source,order.orientation,{background:bg?.media,maxWidth:360});}
 function tick(time){if(disposed||output)return;if(!document.hidden&&time-lastPaint>=80){paint();lastPaint=time;}frame=original.requestVideoFrameCallback?original.requestVideoFrameCallback(tick):requestAnimationFrame(tick);}
 function stop(){if(frame!==null){if(original.cancelVideoFrameCallback)original.cancelVideoFrameCallback(frame);else cancelAnimationFrame(frame);frame=null;}}
 function startLoop(){stop();if(!disposed&&!output){paint();if(order.type==='video')frame=original.requestVideoFrameCallback?original.requestVideoFrameCallback(tick):requestAnimationFrame(tick);}}
 if(order.type==='video'){original.addEventListener('play',startLoop);original.addEventListener('seeked',paint);original.addEventListener('pause',()=>{stop();paint();});}
 paint();
 if(result){
  original.pause?.();output=document.createElement(order.type==='image'?'img':'video');resultURL=URL.createObjectURL(result);output.src=resultURL;
  if(order.type==='image')output.alt=t('Resultado terminado','Completed result');else{output.controls=true;output.playsInline=true;output.preload='metadata';output.addEventListener('play',()=>{original.currentTime=output.currentTime;void original.play().catch(()=>{});});output.addEventListener('pause',()=>original.pause());output.addEventListener('seeked',()=>{original.currentTime=output.currentTime;});output.addEventListener('timeupdate',()=>{if(Math.abs(original.currentTime-output.currentTime)>.2)original.currentTime=output.currentTime;});output.addEventListener('ended',()=>original.pause());}
  rightLabel.textContent=t('Resultado','Result')+' · '+dst.width+' × '+dst.height+' px · '+dst.ratio;stage.replaceChildren(output);
 }
 return {
  async start(){if(disposed||output||order.type!=='video')return;await original.play().catch(()=>{});},
  async background(pixels){const next=await loadTransformMedia(pixels,'image');if(disposed){next.close();return;}bg?.close();bg=next;rightLabel.textContent=(order.type==='video'?t('Fondo IA fijo · Vista previa','Fixed AI background · Preview'):t('Vista previa IA','AI preview'))+' · '+dst.width+' × '+dst.height+' px · '+dst.ratio;paint();},
  stop(){stop();original.pause?.();},
  dispose(){disposed=true;stop();original.pause?.();output?.pause?.();loaded.close();bg?.close();if(resultURL)URL.revokeObjectURL(resultURL);container.replaceChildren();}
 };
}
