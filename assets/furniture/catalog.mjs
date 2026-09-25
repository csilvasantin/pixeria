// Superseded grouping drafts: plants and suspension lengths differ.
const retired=new Set(["1790368325710-fnzcvr", "1790368359200-1fppi2", "1790368387109-jrzy92", "1790368504264-fiuoqb", "1790368536628-uueijh", "1790368592506-ca7e3w", "1790368601152-7o2fq5", "1790368788851-usnrcj", "1790368844094-regk76", "1790368944990-j2ohsk", "1790368951823-l0bf4e", "1790369440611-0j3hgy", "1790369440624-b44eek"]);
export const API='https://api.admira.store';
export const isFurniture3D=item=>!retired.has(item?.id)&&!item?.oculto&&item?.type==='furni'&&String(item.mime).split(';')[0]==='model/gltf-binary';
export function furnitureData(item){
 try{const d=JSON.parse(item.prompt);return d.schema==='pixeria.furniture/1'&&typeof d.xpace==='string'&&typeof d.slug==='string'&&Number.isInteger(d.quantity)&&d.quantity>0&&Array.isArray(d.inventoryIds)&&d.inventoryIds.length>0&&d.inventoryIds.every(id=>typeof id==='string')&&Array.isArray(d.dimensionsCm)&&d.dimensionsCm.length===3&&d.dimensionsCm.every(n=>Number.isFinite(n)&&n>0)?d:null;}catch{return null;}
}
export async function loadFurniture(signal,expectedIds=[]){
 const response=await fetch(new URL('./catalog.json',import.meta.url),{signal});if(!response.ok)throw Error('Catálogo no disponible');
 const seed=await response.json(),map=new Map(seed.map(i=>[i.id,i]));
 // The complete public index includes variants saved on other devices.
 try{const r=await fetch('https://stock.admira.store/stock/index.json?t='+Math.floor(Date.now()/60000),{signal,cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);const d=await r.json(),all=Array.isArray(d)?d:d.items||d.assets||[];for(const item of all)if(isFurniture3D(item)&&furnitureData(item))map.set(item.id,item);}catch(e){if(signal?.aborted)throw e;}
 // A freshly saved variant may precede the asynchronously rebuilt index.
 for(const id of expectedIds){if(map.has(id)||!/^[-a-zA-Z0-9]+$/.test(id))continue;try{const r=await fetch('https://stock.admira.store/stock/'+id+'/meta.json',{signal,cache:'no-store'});if(!r.ok)continue;const row=await r.json();if(isFurniture3D(row)&&furnitureData(row))map.set(id,{...row,url:API+'/stock/asset/'+id,poster:API+'/stock/poster/'+id});}catch(e){if(signal?.aborted)throw e;}}
 return [...map.values()];
}
export function dimensions(values){if(values.length!==3||!values.every(v=>Number.isFinite(v)&&v>=.1&&v<=10000))throw Error('Las medidas deben estar entre 0,1 y 10.000 cm.');return values;}
export function replacementURL(xpace,inventoryId,variantId){const url=new URL('/stock','https://www.pixeria.com');url.searchParams.set('type','xpaces');url.searchParams.set('highlight',xpace);url.searchParams.set('xvariant-'+xpace,JSON.stringify({[inventoryId]:variantId}));return url.href;}
export const textures=[['roble','Roble','roble.jpg'],['nogal','Nogal','nogal.jpg'],['terrazo','Terrazo','terrazo.png']].map(([id,name,file])=>({id,name,url:new URL('./textures/'+file,import.meta.url).href}));
