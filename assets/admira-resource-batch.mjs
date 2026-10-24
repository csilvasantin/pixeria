// Shared catalogue/editor contract. Fragments keep the selection out of request URLs.
export const MAX_RESOURCES=20;
const ID=/^[A-Za-z0-9-]{1,160}$/;
export function resource(item){
 if(!item||!ID.test(item.id||''))throw Error('Recurso sin identidad de catálogo válida.');
 let url;try{url=new URL(item.url);}catch{throw Error('Recurso sin dirección válida.');}
 if(url.protocol!=='https:'||url.username||url.password)throw Error('Los recursos necesitan una dirección HTTPS pública.');
 const mime=String(item.mime||'').toLowerCase().split(';')[0];
 if(/html|svg|javascript/.test(mime)||['interactive','furni','capsula','guion','sync-creative'].includes(item.type))throw Error('Selecciona imágenes, vídeos o audios; los proyectos interactivos se editan por separado.');
 let mediaType=/^image\//.test(mime)?'image':/^video\//.test(mime)?'video':/^audio\//.test(mime)?'audio':({image:'image',video:'video',animation:'video',audio:'audio',music:'audio',locucion:'audio'})[item.type];
 if(!mediaType||(!mime&&/\.html?(?:$|[?#])/i.test(url.href)))throw Error('Tipo de recurso no compatible.');
 const positive=(v,max)=>Number.isFinite(Number(v))&&Number(v)>0?Math.min(Number(v),max):null;
 return {id:item.id,url:url.href,title:String(item.title||item.id).slice(0,160),type:mediaType,mime,width:positive(item.width,16384),height:positive(item.height,16384),duration:positive(item.duration,3600)};
}
export function validateBatch(input){
 if(input?.schema!=='admira.resource-batch.v1'||!['video','interactive'].includes(input.output)||!['landscape','portrait','square'].includes(input.orientation)||!Array.isArray(input.items)||!input.items.length||input.items.length>MAX_RESOURCES)throw Error('Selecciona entre 1 y 20 recursos y elige vídeo o interactivo y su formato.');
 const items=input.items.map(resource);if(new Set(items.map(x=>x.id)).size!==items.length)throw Error('La selección contiene recursos repetidos.');
 const returnUrl=new URL(input.returnUrl);
 if(!['https://admira.studio','https://www.admira.studio','https://pixeria.com','https://www.pixeria.com'].includes(returnUrl.origin)||!/^\/(en\/)?stock(?:\.html|\/)?$/.test(returnUrl.pathname))throw Error('Catálogo de regreso no válido.');
 for(const key of ['highlight','origen'])returnUrl.searchParams.delete(key);returnUrl.hash='';
 return {schema:input.schema,title:String(input.title||'Nueva creación de Admira').trim().slice(0,80)||'Nueva creación de Admira',output:input.output,orientation:input.orientation,returnUrl:returnUrl.href,items};
}
export function batchHref(input){const batch=validateBatch(input),fragment=new URLSearchParams({admiraBatch:JSON.stringify(batch)}).toString();if(fragment.length>48000)throw Error('La selección ocupa demasiado. Reduce el número de recursos.');return 'https://ainimation.studio/studio.html#'+fragment;}
export function batchFromHash(hash){const raw=new URLSearchParams(hash.replace(/^#/,'' )).get('admiraBatch');if(raw===null)return null;if(hash.length>48001)throw Error('La selección ocupa demasiado.');let data;try{data=JSON.parse(raw);}catch{throw Error('La selección de Admira está dañada. Vuelve al catálogo y reintenta.');}return validateBatch(data);}
export function batchPlan(batch,memberFromParams){
 batch=validateBatch(batch);let frame=1;
 const cast=batch.items.map((item,index)=>{const params=new URLSearchParams({admiraStockId:item.id,admiraStockUrl:item.url,admiraStockTitle:item.title,admiraStockType:item.type,admiraStockMime:item.mime,admiraStockWidth:item.width||'',admiraStockHeight:item.height||'',admiraStockDuration:item.duration||''});const member=memberFromParams(params,index,index);if(!member)throw Error('No se ha podido preparar '+item.title);const length=Math.round((item.duration||4)*24);Object.assign(member,{stockId:item.id,onStage:true,startFrame:item.type==='audio'?1:frame,durationFrames:length,durationPending:false,stageX:0,stageY:0,stageW:100,stageH:100});if(item.type==='audio')Object.assign(member,{stageX:0,stageY:90,stageW:30,stageH:10});if(item.type!=='audio')frame+=length;return member;});
 const [w,h]=batch.orientation==='portrait'?[1080,1920]:batch.orientation==='square'?[1080,1080]:[1920,1080];
 return {title:batch.title,logline:'Nueva composición con los recursos seleccionados de Admira.',protagonist:'Recursos de Admira',world:'Nueva composición',treatment:'Organiza los recursos de Admira en Cast y Timeline. Añade textos, botones y comportamientos para completar tu creación.',theme:'Creación con recursos de Admira',cast,stageItems:[],scenes:[],stage:{w,h},admiraOutput:batch.output==='interactive'?'interactive':'video',admiraEdit:{returnUrl:batch.returnUrl},admiraSources:batch.items.map(x=>({id:x.id,url:x.url})),durationSeconds:Math.max(4,...cast.map(m=>(m.startFrame+m.durationFrames-1)/24))};
}
