import {COMPOSITION_SCHEMA,validateComposition} from '../assets/content-composition.mjs?v=composition-1';
// Only these authored demo assets are known not to carry an imported advertising headline.
// An uploaded/remote product may contain rasterised copy: retain the authored layers, but keep OCR.
const ownProducts=new Set(['/adaptaciones/campanas/sneaker-demo.svg','/adaptaciones/campanas/product-placeholder.svg']);
const ownLogos=new Set(['/adaptaciones/campanas/sneakers-wordmark.svg','/adaptaciones/campanas/logo-placeholder.svg']);
export function campaignComposition(c,installation,screen,plan,{mediaType='video'}={}){
 if(!plan?.valid)throw Error('invalid-campaign-composition');
 const rotation=screen.rotation||0,width=rotation%180?screen.h:screen.w,height=rotation%180?screen.w:screen.h;
 const point=(x,y)=>rotation===90?[y,screen.w-x]:rotation===180?[screen.w-x,screen.h-y]:rotation===270?[screen.h-y,x]:[x,y];
 let complete=ownProducts.has(c.product)&&ownLogos.has(c.logo);
 const copy=[];
 // This owned SVG has two literal brand text nodes. Retain them as well as canvas text.
 // Boxes are conservative native SVG text bounds, transformed by the same contain placement.
 const layers=plan.layers.flatMap(l=>{
  if(l.role!=='logo'||c.logo!=='/adaptaciones/campanas/sneakers-wordmark.svg')return [l];
  const k=Math.min(l.w/760,l.h/160),ox=l.x+(l.w-760*k)/2,oy=l.y+(l.h-160*k)/2;
  return [{role:'brand',text:'SNEAKERS',x:ox+66*k,y:oy+14*k,w:600*k,h:76*k,typography:{family:'sans',weight:900,color:'#f5fff9',align:'left'}},{role:'brand',text:'STORE',x:ox+69*k,y:oy+100*k,w:560*k,h:40*k,typography:{family:'sans',weight:700,color:'#47f795',align:'left'}}];
 });
 for(const layer of layers.filter(l=>typeof l.text==='string'&&l.text.trim())){
  const x=layer.x-screen.x,y=layer.y-screen.y;
  if(x+layer.w<=0||y+layer.h<=0||x>=screen.w||y>=screen.h)continue;
  if(x<0||y<0||x+layer.w>screen.w+.01||y+layer.h>screen.h+.01){complete=false;continue;}
  const points=[[x,y],[x+layer.w,y],[x,y+layer.h],[x+layer.w,y+layer.h]].map(([px,py])=>point(px,py));
  const xs=points.map(p=>p[0]/width*1000),ys=points.map(p=>p[1]/height*1000);
  copy.push({role:layer.role==='headline'?'headline':layer.role==='brand'?'brand':'body',text:layer.text,box:[Math.max(0,Math.min(...ys)),Math.max(0,Math.min(...xs)),Math.min(1000,Math.max(...ys)),Math.min(1000,Math.max(...xs))],typography:layer.typography||{family:'sans',weight:layer.role==='headline'?900:600,color:layer.role==='headline'?c.foreground:c.accent,align:'left'}});
 }
 return validateComposition({schema:COMPOSITION_SCHEMA,producer:'admira.studio',renderer:'campaign-canvas.v1',mediaType,width,height,complete,copy});
}
