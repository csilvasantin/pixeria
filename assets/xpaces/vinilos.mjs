// Cápsulas sonoras: locución primero, preview oficial de Apple después (#4419).
import * as T from './engine/premium-three.mjs';

export const PREVIEW_SECONDS=20;
export function safeDisc(d){return d&&/^https:\/\/audio-ssl\.itunes\.apple\.com\//.test(d.previewUrl||'')&&/^https:\/\/music\.apple\.com\//.test(d.appleMusicUrl||'')&&/^https:\/\/is\d+-ssl\.mzstatic\.com\//.test(d.artworkUrl||'');}
export function drawDiscScreen(canvas,disc,phase){
 const c=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
 c.fillStyle='#191126';c.fillRect(0,0,w,h);c.textBaseline='top';c.textAlign='left';
 const side=h*.66,x=w*.06,y=(h-side)/2;if(disc.cover)c.drawImage(disc.cover,x,y,side,side);
 const tx=x+side+w*.045,tw=w-tx-w*.04;
 c.fillStyle='#e7bb75';c.font=`700 ${Math.round(w*.021)}px Arial`;c.fillText(phase==='preview'?'♫  PREVIEW OFICIAL · 20 S':'◉  CÁPSULA SONORA',tx,h*.16,tw);
 c.fillStyle='#fff6e9';c.font=`700 ${Math.round(w*.049)}px Georgia`;c.fillText(disc.title,tx,h*.34,tw);
 c.font=`400 ${Math.round(w*.029)}px Arial`;c.fillText(disc.artist,tx,h*.51,tw);
 c.font=`400 ${Math.round(w*.021)}px Arial`;c.fillText(phase==='preview'?'Voz en silencio · escucha el tema':'Portada y locución · el tema espera',tx,h*.67,tw);
 c.fillText('Comprar en Apple Music ↗',tx,h*.78,tw);
}
export function buildVinyls(shelf,discs){
 const s=shelf.userData.shelf,group=new T.Group();group.name='vinilos-capsulas';shelf.add(group);s.vinyls=group;
 const span=Math.min(.225,(s.W-.12)/discs.length),left=-(discs.length-1)*span/2;
 discs.forEach((d,i)=>{
  const holder=new T.Group();holder.name='vinilo:'+d.slug;holder.userData.vinilo=d.slug;holder.position.set(left+i*span,s.t+.108,s.D-.064);
  const black=new T.MeshStandardMaterial({color:'#171619',roughness:.34,metalness:.2});
  const record=new T.Mesh(new T.CylinderGeometry(.099,.099,.008,48),black);record.rotation.x=Math.PI/2;holder.add(record);
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
  const x=canvas.getContext('2d');x.fillStyle='#171619';x.fillRect(0,0,256,256);
  for(let r=116;r>78;r-=7){x.strokeStyle='#413d41';x.lineWidth=1;x.beginPath();x.arc(128,128,r,0,Math.PI*2);x.stroke();}
  const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;
  const label=new T.Mesh(new T.CircleGeometry(.074,48),new T.MeshBasicMaterial({map:tex,side:T.DoubleSide}));label.position.z=.006;holder.add(label);
  const img=new Image();img.crossOrigin='anonymous';img.onload=()=>{d.cover=img;x.save();x.beginPath();x.arc(128,128,76,0,Math.PI*2);x.clip();x.drawImage(img,52,52,152,152);x.restore();tex.needsUpdate=true;};img.src=d.artworkUrl;
  holder.traverse(n=>{n.userData.vinilo=d.slug;});group.add(holder);
 });
 return group;
}

export function playCapsule(disc,{onPhase=()=>{},onDone=()=>{},onError=()=>{}}={}){
 let stopped=false,finished=false,voice=null,audio=null,timer=0;
 const stop=()=>{stopped=true;clearTimeout(timer);if(audio){audio.pause();audio.removeAttribute('src');audio.load();}if(voice&&globalThis.speechSynthesis){globalThis.speechSynthesis.cancel();}};
 const preview=()=>{
  if(stopped)return;onPhase('preview');audio=new Audio(disc.previewUrl);audio.preload='auto';
  const end=()=>{if(stopped||finished)return;finished=true;audio.pause();audio.currentTime=0;clearTimeout(timer);onDone();};
  audio.addEventListener('timeupdate',()=>{if(audio.currentTime>=PREVIEW_SECONDS)end();});
  audio.addEventListener('ended',end,{once:true});audio.addEventListener('error',()=>onError('La preview oficial no está disponible.'),{once:true});
  audio.play().then(()=>{if(stopped)return;timer=setTimeout(end,PREVIEW_SECONDS*1000);}).catch(()=>onError('Pulsa reproducir para autorizar el audio.'));
 };
 onPhase('voz');
 if(!globalThis.speechSynthesis||typeof SpeechSynthesisUtterance==='undefined'){
  onError('Este navegador no dispone de locución.');return {stop};
 }
 globalThis.speechSynthesis.cancel();voice=new SpeechSynthesisUtterance(disc.hook);voice.lang='es-ES';voice.rate=1;
 const voices=globalThis.speechSynthesis.getVoices();voice.voice=voices.find(v=>/^es[-_]ES/i.test(v.lang))||voices.find(v=>/^es/i.test(v.lang))||null;
 voice.onend=()=>{if(!stopped)preview();};voice.onerror=()=>{if(!stopped)onError('No se pudo reproducir la locución.');};
 globalThis.speechSynthesis.speak(voice);
 return {stop};
}
