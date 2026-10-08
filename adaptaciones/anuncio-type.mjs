// Self-hosted OFL fonts. Classification is an approximation, never font identification.
export const FONT_CATALOG={
 anton:{family:'Pixer Anton',file:'Anton-Regular.ttf',weight:'400'},
 oswald:{family:'Pixer Oswald',file:'Oswald-Variable.ttf',weight:'200 700'},
 rounded:{family:'Pixer Fredoka',file:'Fredoka-Variable.ttf',weight:'300 700'},
 sans:{family:'Pixer Montserrat',file:'Montserrat-Variable.ttf',weight:'100 900'},
 serif:{family:'Pixer Baskerville',file:'LibreBaskerville-Variable.ttf',weight:'400 700'},
 script:{family:'Pixer Lobster',file:'Lobster-Regular.ttf',weight:'400'},
 mono:{family:'Pixer Mono',file:'RobotoMono-Variable.ttf',weight:'100 700'}
};
const loaded=new Map();
export function typographyFor(role,s){
 const observed=!!s&&['condensed','rounded','sans','serif','script','mono'].includes(s.family)&&/^#[0-9a-f]{6}$/i.test(s.color||'');
 if(!observed)return{observed:false,family:'sans',weight:['headline','brand'].includes(role)?800:500,color:role==='headline'?'#073e3a':'#162b29',align:'left',italic:false,trackingEm:0,lineHeight:1.18,outlineEm:0,outlineColor:'#102d36',shadow:false};
 const bounded=(x,a,b,f)=>Number.isFinite(x)?Math.min(b,Math.max(a,x)):f;
 return{observed:true,family:s.family,weight:bounded(s.weight,300,900,700),color:s.color,align:['left','center','right'].includes(s.align)?s.align:'left',italic:!!s.italic,trackingEm:bounded(s.trackingEm,-.04,.12,0),lineHeight:bounded(s.lineHeight,1,1.5,1.08),outlineEm:bounded(s.outlineEm,0,.06,0),outlineColor:/^#[0-9a-f]{6}$/i.test(s.outlineColor||'')?s.outlineColor:'#102d36',shadow:!!s.shadow};
}
export function fontChoice(role,s){const t=typographyFor(role,s);return !t.observed?null:t.family==='condensed'?(t.weight>=700?'anton':'oswald'):t.family;}
export function fontFor(size,role,s){const t=typographyFor(role,s),id=fontChoice(role,s),f=FONT_CATALOG[id];return `${t.italic?'italic ':''}${id==='anton'||id==='script'?400:t.weight} ${size}px ${f?'"'+f.family+'"':'Arial, Helvetica, sans-serif'}`;}
export function configureType(ctx,size,role,s){const t=typographyFor(role,s);ctx.font=fontFor(size,role,s);if('letterSpacing' in ctx)ctx.letterSpacing=`${t.trackingEm*size}px`;return t;}
export function measureCopy(ctx,text,size,role,s){const t=configureType(ctx,size,role,s);return ctx.measureText(text).width+('letterSpacing' in ctx?0:Math.max(0,Array.from(text).length-1)*t.trackingEm*size);}
export async function loadDocumentFonts(doc,{signal,Font=globalThis.FontFace,fontSet=globalThis.document?.fonts,timeout=15000}={}){
 const ids=[...new Set(doc.texts.map(x=>fontChoice(x.role,x.typography)).filter(Boolean))];if(!ids.length)return;
 if(!Font||!fontSet)throw Error('font-unavailable');
 let timer,abort;const stop=new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('font-unavailable')),timeout);abort=()=>reject(new DOMException('Cancelled','AbortError'));if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});});
 try{await Promise.race([Promise.all(ids.map(id=>{if(!loaded.has(id)){const f=FONT_CATALOG[id],face=new Font(f.family,`url("${new URL('./fonts/'+f.file,import.meta.url)}")`,{weight:f.weight,style:'normal'});const p=face.load().then(v=>{fontSet.add(v);return v;}).catch(()=>{loaded.delete(id);throw Error('font-unavailable');});loaded.set(id,p);}return loaded.get(id);})),stop]);}finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
// Human review corrects observed traits without modifying copy or allowing arbitrary CSS.
export function editTypography(doc,index,patch){
 if(!Number.isInteger(index)||!doc?.texts?.[index])throw Error('invalid-type-block');
 const allowed=['family','color','outlineColor'];
 if(Object.keys(patch).some(k=>!allowed.includes(k))||('family'in patch&&!['condensed','rounded','sans','serif','script','mono'].includes(patch.family))||['color','outlineColor'].some(k=>k in patch&&!/^#[0-9a-f]{6}$/i.test(patch[k])))throw Error('invalid-type-style');
 const base=typographyFor(doc.texts[index].role,doc.texts[index].typography),{observed,...style}=base;
 return {...doc,texts:doc.texts.map((x,i)=>i===index?{...x,typography:{...style,...patch}}:x)};
}
