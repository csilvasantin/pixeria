// AI background + untouched source, composed on the physical wall before segmentation.
import {rect, composeFilter} from './adapter-core.mjs';
export const AI_ENDPOINT = 'https://api.admira.store/image/edit';
export const AI_SYS = 'Create a photorealistic environmental background for digital signage, guided by the reference image. Extend the atmosphere and lighting across the canvas. No text, no logos, no products, no people. The original content will be composited separately and must not be recreated.';
export function referenceSize({ancho,alto}) {
  if (!(ancho > 0 && alto > 0)) throw new Error('size');
  const k=Math.min(1,1536/ancho,1536/alto);
  return {ancho:Math.max(16,Math.round(ancho*k)),alto:Math.max(16,Math.round(alto*k))};
}
export function aiPrompt(output, brief='') {
  return `Continuous background for a physical wall ${output.ancho} x ${output.alto} pixels (${(output.ancho/output.alto).toFixed(3)}:1). Match the reference atmosphere. Leave a quiet centre for the unchanged original. The returned background will be fitted to the exact wall dimensions. ${String(brief).trim().slice(0,1200)}`;
}
export function aiGraph(source,output,s,label='out',input='0:v') {
  const r=rect(source,output.ancho,output.alto,'contain',{...s,zoom:1});
  return `[1:v]scale=${output.ancho}:${output.alto},setsar=1[ai_bg];[${input}]scale=${r.w}:${r.h},setsar=1[ai_fg];[ai_bg][ai_fg]overlay=x=${r.x}:y=${r.y}:shortest=1:format=auto,setsar=1[${label}]`;
}
export function aiJob(job,source,output,s,url,{wall=false}={}) {
  const args=[...job.args],at=args.indexOf('-filter_complex');
  if(at<0) throw new Error('graph');
  if(wall) {
    const old=`[0:v]fps=25[src];${composeFilter(source,output.ancho,output.alto,'blur',s,'wall','src')}`;
    if(!args[at+1].startsWith(old)) throw new Error('wall-graph');
    args[at+1]=`[0:v]fps=25[src];${aiGraph(source,output,s,'wall','src')}`+args[at+1].slice(old.length);
  } else args[at+1]=aiGraph(source,output,s);
  args.splice(at,0,'-loop','1','-framerate','25','-i','ai-background.png');
  return {...job,args,extraFiles:[{name:'ai-background.png',url}],ia:true};
}
export async function generateBackground(image,output,brief,{fetchImpl=fetch,signal}={}) {
  const tokenRes=await fetchImpl('/auth/api-token',{credentials:'include',cache:'no-store',signal});
  if(!tokenRes.ok) throw new Error(tokenRes.status===401||tokenRes.status===403?'session':'token');
  const {token}=await tokenRes.json(); if(!token) throw new Error('session');
  const r=await fetchImpl(AI_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},signal,
    body:JSON.stringify({image,sys:AI_SYS,prompt:aiPrompt(output,brief)})});
  const d=await r.json().catch(()=>({}));
  if(!r.ok||!d.ok||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(d.image||'')) throw new Error(r.status===401?'session':d.reason||d.error||`HTTP ${r.status}`);
  return d.image;
}
