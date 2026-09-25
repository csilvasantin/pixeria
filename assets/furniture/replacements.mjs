import {loadFurniture,furnitureData} from './catalog.mjs';
import {GLTFLoader} from '../xpaces/engine/vendor/GLTFLoader.mjs';
import * as T from '../xpaces/engine/premium-three.mjs';
const key=id=>'xvariant-'+id;
export function readReplacements(url,id){try{const d=JSON.parse(new URL(url).searchParams.get(key(id))||'{}');return d&&typeof d==='object'&&!Array.isArray(d)?Object.fromEntries(Object.entries(d).filter(([k,v])=>typeof k==='string'&&typeof v==='string')):{};}catch{return {};}}
function release(root){const resources=new Set();root.traverse(n=>{if(n.geometry)resources.add(n.geometry);for(const m of [n.material].flat().filter(Boolean)){resources.add(m);for(const v of Object.values(m))if(v?.isTexture)resources.add(v);}});for(const r of resources){r.source?.data?.close?.();r.dispose();}}
export async function mountReplacements({item,bound,viewer,on,signal,host,refresh}){
 const assets=await loadFurniture(signal,Object.values(readReplacements(location.href,item.id)));if(signal?.aborted)return;
 const relevant=assets.filter(asset=>furnitureData(asset)?.xpace===item.id),selected=readReplacements(location.href,item.id),originals=new Map();
 for(const e of bound.entries){
  const choices=relevant.filter(a=>furnitureData(a).inventoryIds.includes(e.id));if(!choices.length)continue;
  const select=document.createElement('select');select.className='furniture-replace';select.setAttribute('aria-label','Mueble de '+e.id);
  select.add(new Option('Original del local',''));for(const asset of choices)select.add(new Option(asset.title+(furnitureData(asset).parent?' · variante':''),asset.id));e.row.append(select);
  const originalValues={nombre:e.nombre,medidas:e.medidas};const object=e.object,parent=object.parent;object.updateWorldMatrix(true,true);
  // Base position in the original object's coordinate frame, then converted to glTF Y-up.
  // Each source has its own local base; repetitions share geometry, not world position.
  // Blender empty roots carry the Z-up conversion. Compute bounds in the root's
  // coordinate frame instead, so rotations/scales and either export convention work.
  const inverse=object.matrixWorld.clone().invert(),localBox=new T.Box3();
  object.traverse(n=>{if(!n.isMesh)return;const g=n.geometry;if(!g.boundingBox)g.computeBoundingBox();const b=g.boundingBox.clone().applyMatrix4(new T.Matrix4().multiplyMatrices(inverse,n.matrixWorld));localBox.union(b);});
  // glTF root rotation can retain Blender Z-up on empties. Determine up via its world rotation.
  const worldUp=new T.Vector3(0,1,0).transformDirection(inverse),axis=Math.abs(worldUp.z)>.9?'z':'y';
  const center=localBox.getCenter(new T.Vector3());center[axis]=worldUp[axis]>0?localBox.min[axis]:localBox.max[axis];
  const placement=object.matrix.clone().multiply(new T.Matrix4().makeTranslation(center.x,center.y,center.z));
  // Exported furniture scene is Y-up, while the original empty may retain Z-up.
  if(axis==='z')placement.multiply(new T.Matrix4().makeRotationX(Math.PI/2));
  originals.set(e.id,{object,parent,placement});let replacement,version=0;
  async function apply(id,write=true){const request=++version;select.disabled=true;const message=host.querySelector('.xpace-inventory-message');
   try{let next;if(id){const asset=choices.find(a=>a.id===id);if(!asset)throw Error('Variante no vinculada a esta unidad');const r=await fetch(asset.url,{signal});if(!r.ok)throw Error('HTTP '+r.status);const gltf=await new GLTFLoader().parseAsync(await r.arrayBuffer(),asset.url);next=gltf.scene;if(signal?.aborted||request!==version){release(next);return;}next.applyMatrix4(placement);next.traverse(n=>{if(n.isMesh){n.castShadow=true;n.receiveShadow=true;}});next.userData.item={id:e.id};}
    if(replacement){replacement.removeFromParent();release(replacement);}replacement=next;
    object.visible=!id&&e.visible;
    if(next){const asset=choices.find(a=>a.id===id),d=furnitureData(asset);parent.add(next);next.visible=e.visible;e.object=next;e.variant=id;e.nombre=asset.title;e.medidas={ancho:d.dimensionsCm[0]/100,fondo:d.dimensionsCm[1]/100,alto:d.dimensionsCm[2]/100,unidad:'m'};}else{e.object=object;delete e.variant;Object.assign(e,originalValues);}
    e.button.querySelector('strong').textContent=e.nombre;e.button.querySelector('small:last-child').textContent=`${e.medidas.ancho} × ${e.medidas.fondo} × ${e.medidas.alto} m${e.pantalla?' · '+e.pantalla:''}`;
    select.value=id||'';if(id)selected[e.id]=id;else delete selected[e.id];if(write){const url=new URL(location.href);if(Object.keys(selected).length)url.searchParams.set(key(item.id),JSON.stringify(selected));else url.searchParams.delete(key(item.id));history.replaceState(history.state,'',url);}
    refresh();viewer.invalidateShadows();if(write)message.textContent=id?'Mueble sustituido. El enlace de esta vista conserva la variante.':'Original restaurado.';
   }catch(error){select.value=e.variant||'';message.textContent='No se pudo aplicar la variante: '+error.message;}finally{select.disabled=false;}
  }
  on(select,'change',()=>apply(select.value));on(window,'popstate',()=>apply(readReplacements(location.href,item.id)[e.id]||'',false));
  if(selected[e.id])await apply(selected[e.id],false);
 }
 return originals;
}
