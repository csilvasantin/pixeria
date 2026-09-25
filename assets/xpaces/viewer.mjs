import {createLifeRenderer} from './engine/life-renderer.mjs?v=ver-libro';
import {createLifeScene} from './engine/life-scene.mjs?v=px-1';
import {GLTFLoader} from './engine/vendor/GLTFLoader.mjs';
import * as T from './engine/premium-three.mjs';
import {bindInventory,mountInventory} from './inventory.mjs?v=ver-libro3';
import {mergeGeometries} from './engine/vendor/BufferGeometryUtils.mjs';

function release(root) {
  const resources=new Set();
  root.traverse(node=>{if(node.geometry)resources.add(node.geometry);for(const material of [node.material].flat().filter(Boolean)){resources.add(material);for(const value of Object.values(material))if(value?.isTexture)resources.add(value);}});
  for(const resource of resources){resource.source?.data?.close?.();resource.dispose();}
}


// Blender exports hundreds of static opaque meshes. Batch equal materials using
// the same Three r160 utility already shipped with Better's GLTFLoader.
// Transparent, skinned and animated geometry keeps its original draw order.
export function batchStatic(root) {
  root.updateMatrixWorld(true);const groups=new Map(),merged=[];
  root.traverseVisible(node=>{
    if(!node.isMesh || node.children.length || node.isSkinnedMesh || node.morphTargetInfluences?.length || Array.isArray(node.material) || node.material.transparent)return;
    const signature=Object.keys(node.geometry.attributes).sort().map(k=>k+':'+node.geometry.attributes[k].itemSize+':'+node.geometry.attributes[k].normalized).join('|');
    const key=node.material.uuid+':'+!!node.geometry.index+':'+signature;
    if(!groups.has(key))groups.set(key,[]);groups.get(key).push(node);
  });
  const inverse=new T.Matrix4().copy(root.matrixWorld).invert();
  for(const nodes of groups.values()){
    if(nodes.length<2)continue;
    const geometries=nodes.map(node=>node.geometry.clone().applyMatrix4(new T.Matrix4().multiplyMatrices(inverse,node.matrixWorld)));
    const geometry=mergeGeometries(geometries,false);for(const g of geometries)g.dispose();if(!geometry)continue;
    const mesh=new T.Mesh(geometry,nodes[0].material);mesh.castShadow=nodes.some(n=>n.castShadow);mesh.receiveShadow=true;root.add(mesh);merged.push(geometry);
    for(const node of nodes)node.visible=false;
  }
  return merged.length;
}

export async function mountXpace(host, item, {signal,furniture=false,onModel}={}) {
  const en=document.documentElement.lang==='en';
  host.innerHTML=`<div class="xpace-stage"><canvas tabindex="0" aria-label="${en?'Interactive 3D space':'Espacio 3D interactivo'}"></canvas><p class="xpace-loading" role="status">${en?'Loading space…':'Cargando el espacio…'}</p></div>
    <div class="xpace-tools"><div role="group" aria-label="${en?'Views':'Vistas'}"><button data-preset="home">${en?'Isometric':'Isométrica'}</button><button data-preset="floor">${en?'Floor plan':'Planta'}</button><button data-preset="front">${en?'Front':'Frontal'}</button></div><div role="group" aria-label="Zoom"><button data-zoom="0.8" aria-label="${en?'Zoom out':'Alejar'}">−</button><button data-zoom="1.25" aria-label="${en?'Zoom in':'Acercar'}">+</button><button data-pan aria-pressed="false">${en?'Pan':'Desplazar'}</button></div><div role="group" aria-label="${en?'Lighting':'Iluminación'}"><button data-light="day" aria-pressed="true">☀ ${en?'Day':'Día'}</button><button data-light="sunset" aria-pressed="false">◒ ${en?'Sunset':'Atardecer'}</button><button data-light="night" aria-pressed="false">☾ ${en?'Night':'Noche'}</button></div></div><p class="xpace-help">${en?'Drag to orbit · wheel or pinch to zoom · Pan + drag to move':'Arrastra para orbitar · rueda o pellizco para zoom · Desplazar + arrastrar para mover'}</p>`;
  const stage=host.querySelector('.xpace-stage'),canvas=host.querySelector('canvas'),status=host.querySelector('[role=status]');
  let viewer,root,inventory,frame=0,observer,disposed=false,pan=false;
  const listeners=[];
  const on=(el,event,handler,opts)=>{el.addEventListener(event,handler,opts);listeners.push(()=>el.removeEventListener(event,handler,opts));};
  function dispose(){if(disposed)return;disposed=true;cancelAnimationFrame(frame);observer?.disconnect();for(const off of listeners)off();inventory?.dispose();viewer?.dispose();if(root)release(root);signal?.removeEventListener('abort',dispose);}
  signal?.addEventListener('abort',dispose,{once:true});
  if(signal?.aborted){dispose();return dispose;}
  try {
    const response=await fetch(item.url,{signal});if(!response.ok)throw Error(`HTTP ${response.status}`);
    const bytes=await response.arrayBuffer();if(disposed)return dispose;
    const gltf=await new GLTFLoader().parseAsync(bytes,item.url);root=gltf.scene;
    if(disposed){release(root);root=null;return dispose;}
    // Normalize the exported scene's origin; preserve its dimensions and materials.
    root.updateMatrixWorld(true);const box=new T.Box3().setFromObject(root),size=box.getSize(new T.Vector3());
    if(box.isEmpty()||![size.x,size.y,size.z].every(Number.isFinite))throw Error('Modelo sin geometría');
    root.position.sub(box.min);root.updateMatrixWorld(true);
    root.traverse(node=>{if(node.isMesh){node.castShadow=true;node.receiveShadow=true;}});
    const bound=furniture?null:await bindInventory(gltf,item,bytes,signal);
    if(disposed)return dispose;
    // Batch inside each inventory element, never across independently visible items.
    if(bound&&!gltf.animations.length)for(const entry of bound.entries)batchStatic(entry.object);
    const snapshot={cols:size.x,rows:size.z,wallHeight:size.y,layout:[],actors:[],moving:true};
    viewer=createLifeRenderer({canvas,snapshot,stockCamera:furniture?'furniture':true,onSelect:data=>inventory?.select(data?.item?.id),sceneFactory:(input,options)=>{
      // Better's exact scene owns the lights and their day/sunset/night settings.
      const scene=createLifeScene(input,{...options,inventory:true});scene.world.add(root);return scene;
    }});
    viewer.preset('home');
    bound?.capsulas?.setViewer(viewer);bound?.capsulas?.attachUI?.({stage,canvas,on});
    if(bound)inventory=mountInventory(host,item,bound,viewer,on,signal);
    // Let Better's existing Shift-drag handler work with an explicit touch-friendly Pan toggle.
    on(canvas,'pointerdown',event=>{if(pan)Object.defineProperty(event,'shiftKey',{value:true});},true);
    for(const button of host.querySelectorAll('[data-preset]'))on(button,'click',()=>{viewer.preset(button.dataset.preset);for(const b of host.querySelectorAll('[data-preset]'))b.setAttribute('aria-pressed',String(b===button));});
    for(const button of host.querySelectorAll('[data-zoom]'))on(button,'click',()=>viewer.zoomBy(Number(button.dataset.zoom)));
    for(const button of host.querySelectorAll('[data-light]'))on(button,'click',()=>{viewer.setLighting(button.dataset.light);for(const b of host.querySelectorAll('[data-light]'))b.setAttribute('aria-pressed',String(b===button));});
    on(host.querySelector('[data-pan]'),'click',event=>{pan=!pan;event.currentTarget.setAttribute('aria-pressed',String(pan));});
    on(canvas,'keydown',event=>{if(event.key==='Escape')return;event.stopPropagation();if(['ArrowLeft','ArrowRight','+','=','-','Home'].includes(event.key))event.preventDefault();if(event.key==='ArrowLeft'||event.key==='ArrowRight')viewer.rotate(event.key==='ArrowLeft'?1:-1);if(['+','=','-'].includes(event.key))viewer.zoomBy(event.key==='-'?.8:1.25);if(event.key==='Home')viewer.preset('home');
    });
    observer=new ResizeObserver(()=>viewer.resize(stage.clientWidth,stage.clientHeight));observer.observe(stage);viewer.resize(stage.clientWidth,stage.clientHeight);
    on(canvas,'webglcontextlost',event=>{event.preventDefault();dispose();status.hidden=false;status.textContent=en?'Graphics interrupted. Close and reopen to retry.':'Se ha interrumpido el 3D. Cierra y vuelve a abrir para reintentar.';});
    if(inventory)await inventory.ready;
    if(disposed)return dispose;
    if(onModel)await onModel({root,viewer,size,canvas,on,resizeModel:next=>{snapshot.cols=next[0]/100;snapshot.rows=next[1]/100;snapshot.wallHeight=next[2]/100;}});
    status.hidden=true;host.dataset.ready='true';
    // Enlace de vista con &ver=<id>: encuadra y resalta ese objeto al abrir.
    inventory?.openFromURL();
    function tick(now){if(disposed)return;if(!document.hidden)viewer.render(now);frame=requestAnimationFrame(tick);}frame=requestAnimationFrame(tick);
    // Read-only diagnostics make camera motion and resource cleanup testable.
    host.xpaceBookPoint=id=>{const c=bound?.capsulas?.bookCenter?.(id);return c?viewer.project(c):null;};
    host.xpaceState=()=>({camera:viewer.cameraState,disposed,inventory:inventory?.state(),capsulas:bound?.capsulas?.state||null});
    return dispose;
  } catch(error) {
    dispose();if(signal?.aborted)return dispose;
    status.hidden=false;status.textContent=(en?'Could not open 3D. Close and reopen to retry. ':'No se ha podido abrir el 3D. Cierra y vuelve a abrir para reintentar. ')+error.message;
    host.dataset.error='true';return dispose;
  }
}
