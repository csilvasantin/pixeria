// Installation-aware, deterministic campaign layouts. No generative API calls.
export const CAMPAIGN_SCHEMA='pixeria.installation-campaign.v1';
export const DIRECTIONS=[{id:'hero',es:'Producto protagonista',en:'Product hero'},{id:'editorial',es:'Composición editorial',en:'Editorial composition'},{id:'sequence',es:'Relato entre pantallas',en:'Story across screens'}];
const screen=(id,x,y,w,h)=>({id,x,y,w,h,rotation:0});
export const INSTALLATIONS=[
 {id:'landscape',name:{es:'Horizontal',en:'Landscape'},width:1920,height:1080,screens:[screen('lcd',0,0,1920,1080)]},
 {id:'portrait',name:{es:'Vertical',en:'Portrait'},width:1080,height:1920,screens:[screen('entrance',0,0,1080,1920)]},
 {id:'strip',name:{es:'Tira panorámica',en:'Panoramic strip'},width:3840,height:600,screens:[screen('strip',0,0,3840,600)]},
 {id:'jordan',name:{es:'Jordan · cinco paneles',en:'Jordan · five panels'},width:2780,height:1280,approximate:true,screens:[screen('jordan-1',0,320,540,960),screen('jordan-2',560,160,540,1120),screen('jordan-3',1120,0,540,1280),screen('jordan-4',1680,160,540,1120),screen('jordan-5',2240,320,540,960)]},
 {id:'rear',name:{es:'LED con puerta',en:'LED with doorway'},width:2880,height:1620,approximate:true,screens:[screen('rear-left',0,0,1120,1620),screen('rear-top',1120,0,640,540),screen('rear-right',1760,0,1120,1620)],masks:[{id:'door',x:1120,y:540,w:640,h:1080}]}
];
export const DEFAULT_CAMPAIGN={schema:CAMPAIGN_SCHEMA,id:'sneakers-store',revision:1,name:'Sneakers Store',headline:'ESTRENA TU PRÓXIMO PASO.',cta:'DESCUBRE LA COLECCIÓN',price:'',background:'#081614',accent:'#47f795',foreground:'#f5fff9',direction:'hero',placements:{},seconds:10,product:'/adaptaciones/campanas/sneaker-demo.svg',logo:'/adaptaciones/campanas/sneakers-wordmark.svg',productLabel:'Sneaker · ilustración de ejemplo',installations:INSTALLATIONS};
const clone=x=>JSON.parse(JSON.stringify(x));
export const intersects=(a,b)=>a.x<b.x+b.w-.01&&a.x+a.w>b.x+.01&&a.y<b.y+b.h-.01&&a.y+a.h>b.y+.01;
const inside=(a,b)=>a.x>=b.x-.01&&a.y>=b.y-.01&&a.x+a.w<=b.x+b.w+.01&&a.y+a.h<=b.y+b.h+.01;
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const identifier=v=>typeof v==='string'&&/^[a-z0-9][a-z0-9_-]{0,79}$/i.test(v);
export function validateInstallation(i){
 const errors=[];if(i?.enabled!==undefined&&typeof i.enabled!=='boolean')errors.push('installation-enabled');if(!i||!Number.isInteger(i.width)||!Number.isInteger(i.height)||i.width<64||i.height<64||i.width>16384||i.height>16384||i.width*i.height>16777216)errors.push('installation-size');
 if(!identifier(i?.id))errors.push('installation-id');
 if(i?.enabled!==undefined&&typeof i.enabled!=='boolean')errors.push('installation-enabled');
 if(!Array.isArray(i?.screens)||!i.screens.length||i.screens.length>32)errors.push('screens');
 if(i?.masks!==undefined&&(!Array.isArray(i.masks)||i.masks.length>32))errors.push('masks');
 if(errors.length)return errors;
 const ids=new Set(),wall={x:0,y:0,w:i.width,h:i.height};
 for(const s of [...i.screens,...(i.masks||[])]){
  if(!s||!identifier(s.id)||ids.has(s.id))errors.push('screen-id');if(!s)continue;ids.add(s.id);
  if(![s.x,s.y,s.w,s.h].every(finite)||!Number.isInteger(s.w)||!Number.isInteger(s.h)||s.w<2||s.h<2||!inside(s,wall)||![0,90,180,270].includes(s.rotation||0))errors.push('screen-bounds');
 }
 if(errors.length)return [...new Set(errors)];
 for(let n=0;n<i.screens.length;n++)for(let j=n+1;j<i.screens.length;j++)if(intersects(i.screens[n],i.screens[j]))errors.push('screen-overlap');
 return [...new Set(errors)];
}
export function restoreCampaign(value){
 if(!value||value.schema!==CAMPAIGN_SCHEMA)throw Error('campaign-schema');
 const out=clone(DEFAULT_CAMPAIGN);
 if(!identifier(value.id))throw Error('campaign-id');out.id=value.id;
 for(const k of ['name','headline','cta','price','productLabel']){if(typeof value[k]!=='string'||value[k].length>500)throw Error('campaign-copy');out[k]=value[k];}
 if(!out.headline.trim())throw Error('campaign-copy');
 for(const k of ['background','accent','foreground']){if(!/^#[\da-f]{6}$/i.test(value[k]))throw Error('campaign-colour');out[k]=value[k];}
 for(const k of ['product','logo']){const u=String(value[k]||'');if(!/^(\/[^/]|https:\/\/|data:image\/(png|jpeg|webp);base64,)/.test(u)||u.length>12000000)throw Error('campaign-asset');out[k]=u;}
 if(!DIRECTIONS.some(x=>x.id===value.direction))throw Error('campaign-direction');out.direction=value.direction;
 if(!Number.isInteger(value.seconds)||value.seconds<1||value.seconds>60)throw Error('campaign-duration');out.seconds=value.seconds;
 if(!Array.isArray(value.installations)||!value.installations.length||value.installations.length>64||new Set(value.installations.map(i=>i?.id)).size!==value.installations.length||value.installations.some(i=>validateInstallation(i).length))throw Error('campaign-installations');
 if(value.placements!==undefined){if(!value.placements||Array.isArray(value.placements)||typeof value.placements!=='object'||Object.keys(value.placements).length>1000)throw Error('campaign-placements');for(const [key,r] of Object.entries(value.placements))if(!/^[a-z0-9_-]+:(hero|editorial|sequence):(logo|product|headline|cta|price)$/.test(key)||!r||!['x','y','w','h'].every(k=>finite(r[k]))||r.w<=0||r.h<=0||r.w>2||r.h>2||Math.abs(r.x)>2||Math.abs(r.y)>2)throw Error('campaign-placements');out.placements=clone(value.placements);}
 if(!Number.isSafeInteger(value.revision)||value.revision<1)throw Error('campaign-revision');
 out.installations=clone(value.installations);out.revision=value.revision;return out;
}
// Subtract openings from individual panels, preserving rectangular safe regions.
export function safeRegions(i){
 let regions=i.screens.map(s=>({...s}));
 for(const mask of i.masks||[])regions=regions.flatMap(r=>{
  if(!intersects(r,mask))return[r];
  const x=Math.max(r.x,mask.x),y=Math.max(r.y,mask.y),right=Math.min(r.x+r.w,mask.x+mask.w),bottom=Math.min(r.y+r.h,mask.y+mask.h);
  return [{...r,h:y-r.y},{...r,y:bottom,h:r.y+r.h-bottom},{...r,y,w:x-r.x,h:bottom-y},{...r,x:right,y,w:r.x+r.w-right,h:bottom-y}].filter(q=>q.w>4&&q.h>4);
 });
 return regions.map(r=>{const p=Math.min(r.w,r.h)*.055;return{...r,x:r.x+p,y:r.y+p,w:r.w-2*p,h:r.h-2*p};});
}
function fit(text,box,min,max,measure){
 for(let px=max;px>=min;px-=Math.max(1,max/60)){
  const words=text.trim().split(/\s+/),lines=[];let line='';
  if(words.some(w=>measure(w,px)>box.w))continue;
  for(const w of words){if(line&&measure(line+' '+w,px)>box.w){lines.push(line);line=w;}else line=line?line+' '+w:w;}if(line)lines.push(line);
  if(lines.length*px*1.14<=box.h)return{px,lines,lineHeight:px*1.14};
 }return null;
}
function divide(r,wide,direction){
 const gap=Math.min(r.w,r.h)*.06,fraction=direction==='editorial'?.49:.42;
 return wide?[{...r,w:r.w*fraction-gap/2},{...r,x:r.x+r.w*fraction+gap/2,w:r.w*(1-fraction)-gap/2}]
 :[{...r,h:r.h*fraction-gap/2},{...r,y:r.y+r.h*fraction+gap/2,h:r.h*(1-fraction)-gap/2}];
}
export function planCampaign(c,i,direction=c.direction,measure=(s,px)=>s.length*px*.59){
 const errors=validateInstallation(i);if(errors.length)return{valid:false,errors,layers:[]};
 if(!DIRECTIONS.some(d=>d.id===direction))return{valid:false,errors:['campaign-direction'],layers:[]};
 const regions=safeRegions(i);if(!regions.length)return{valid:false,errors:['safe-space'],layers:[]};
 let copy,product,logo,extras=[];
 if(i.screens.length===1&&regions.length===1){
  [copy,product]=divide(regions[0],i.width/i.height>1.3,direction);if(direction==='editorial')[copy,product]=[product,copy];logo={...copy,h:Math.min(copy.h*.16,100)};
  if(direction==='sequence'){
   const r={...product},gap=Math.min(r.w,r.h)*.06;
   product={...r,h:r.h*.7};
   extras=[0,1].map(n=>({...r,x:r.x+n*(r.w+gap)/2,y:r.y+r.h*.7+gap,w:(r.w-gap)/2,h:r.h*.3-gap}));
  }
 }
 else {
  const byArea=[...regions].sort((a,b)=>b.w*b.h-a.w*a.h),ordered=[...byArea].sort((a,b)=>a.x-b.x||a.y-b.y);
  const large=ordered.filter(r=>r.w*r.h>=byArea[0].w*byArea[0].h*.6);product=direction==='editorial'?large.at(-1):large.reduce((a,b)=>Math.abs(a.x+a.w/2-i.width/2)<=Math.abs(b.x+b.w/2-i.width/2)?a:b);
  copy=ordered.find(r=>r!==product&&r.w>=120&&r.h>=180);
  if(!copy){[copy,product]=divide(byArea[0],byArea[0].w>byArea[0].h,direction);}
  logo={...copy,h:Math.min(copy.h*.16,100)};
  if(direction==='sequence')extras=regions.filter(r=>!intersects(r,copy)&&!intersects(r,product)&&r.w>150&&r.h>150).slice(0,5);
 }
 const layers=[{role:'logo',...logo},{role:'product',...product}];
 const body={...copy,y:copy.y+logo.h+copy.h*.08,h:copy.h-logo.h-copy.h*.08};
 const headline={...body,h:body.h*(c.price?.trim()?.58:.68)},cta={...body,y:body.y+body.h*.78,h:body.h*.22};
 const min=Math.max(14,Math.min(i.width,i.height)*.022),max=Math.min(copy.w*.19,copy.h*.16);
 for(const [role,text,box,lo,hi] of [['headline',c.headline,headline,min,max],['cta',c.cta,cta,Math.max(12,min*.65),max*.32],['price',c.price,{...body,y:body.y+body.h*.61,h:body.h*.14},min,max*.6]]){
  if(!String(text||'').trim())continue;const type=fit(text,box,lo,Math.max(lo,hi),measure);
  if(!type)errors.push('text-overflow:'+role);else layers.push({role,text,...box,...type});
 }
 extras.forEach((r,n)=>layers.push({role:'echo',...r,step:n+1}));
 for(const l of layers){const override=c.placements?.[`${i.id}:${direction}:${l.role}`];if(!override)continue;Object.assign(l,{x:override.x*i.width,y:override.y*i.height,w:override.w*i.width,h:override.h*i.height});if(l.text){const type=fit(l.text,l,l.role==='headline'?min:Math.max(12,min*.65),Math.max(min,max),measure);if(type)Object.assign(l,type);else errors.push('text-overflow:'+l.role);}}
 // Critical layers must fit in a single visible region; backgrounds may flow across joints.
 for(const l of layers.filter(x=>x.role!=='echo'))if(!regions.some(r=>inside(l,r)))errors.push('unsafe-layer:'+l.role);
 for(let n=0;n<layers.length;n++)for(let j=n+1;j<layers.length;j++)if(intersects(layers[n],layers[j]))errors.push('layer-overlap');
 return{valid:!errors.length,errors:[...new Set(errors)],layers,regions,direction,installation:i.id,width:i.width,height:i.height};
}
export function campaignContract(c,approvals={}){
 const campaign=restoreCampaign(c);
 return{schema:CAMPAIGN_SCHEMA,campaign,delivery:{fps:25,gopFrames:25,audio:false,kind:'still-composition',hardwareVerified:false},approvals:clone(approvals),limits:{measuredGeometry:false,anamorphicExport:false,automaticVideoLayerExtraction:false},derived:campaign.installations.filter(i=>i.enabled!==false).flatMap(i=>i.screens.map(s=>({installation:i.id,screen:s.id,width:s.rotation%180?s.h:s.w,height:s.rotation%180?s.w:s.h,rotation:s.rotation||0,tags:['campaign:'+campaign.id,'installation:'+i.id,'screen:'+s.id,'direction:'+campaign.direction]})))};
}
export function campaignJob(c,i,s){
 if(validateInstallation(i).length)throw Error('campaign-installations');
 const W=s.rotation%180?s.h:s.w,H=s.rotation%180?s.w:s.h;
 if(W%2||H%2)throw Error('even-resolution');
 const rate=Math.max(800,Math.min(12000,Math.round(W*H*.004))),filename=`${c.id}-${i.id}-${c.direction}-${s.id}-r${c.revision}-${W}x${H}.mp4`;
 return{filename,W,H,input:'input.png',durationSeconds:c.seconds,bitrateKbps:rate,args:['-loop','1','-framerate','25','-t',String(c.seconds),'-i','input.png','-t',String(c.seconds),'-vf','format=yuv420p,setsar=1','-an','-c:v','libx264','-preset','veryfast','-tune','stillimage','-threads','1','-profile:v','high','-level:v','5.1','-pix_fmt','yuv420p','-color_range','tv','-r','25','-b:v',rate+'k','-maxrate',rate+'k','-bufsize',rate*2+'k','-g','25','-movflags','+faststart','output.mp4']};
}
