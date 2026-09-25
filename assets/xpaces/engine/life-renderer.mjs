import * as T from './premium-three.mjs';
import {createLifeScene} from './life-scene.mjs?v=px-1';
import {mappedCameraFrame} from './life-camera.mjs';

const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
/** Presentation only: no simulation, media owner or autonomous animation loop. */
export function createLifeRenderer({canvas,snapshot,getPlayer=()=>null,onSelect=()=>{},onCameraChange=()=>{},assetQuality='better',sceneFactory=createLifeScene,stockCamera=false}={}){
  const renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
  renderer.setClearColor('#e7e8dc');renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
  if(stockCamera){renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;}
  let model;
  try{model=sceneFactory(snapshot,{
    assetQuality,
    loadFurniture:item=>import('./furniture-asset.mjs').then(m=>m.loadFurniture(item,assetQuality)),
    loadPerson:assetQuality==='best'?actor=>import('./best-person-asset.mjs?v=visitors-24').then(m=>m.loadBestPerson(actor)):null
  });}catch(error){renderer.dispose();renderer.forceContextLoss();throw error;}
  const camera=new T.OrthographicCamera(-15,15,10,-10,.1,200);
  const target=new T.Vector3(),raycaster=new T.Raycaster(),pointers=new Map();
  let width=1,height=1,lastMedia=-Infinity,disposed=false,gesture=null,selected=null;
  const initial=mappedCameraFrame(model.snapshot);
  const current={zoom:1,angle:initial.angle,elevation:initial.elevation,panX:0,panY:0};let desired={...current},mode='mapped',framing='mapped';
  const angleLimit=value=>stockCamera?value:clamp(value,.10,Math.PI/2-.10);
  const zoomLimit=value=>clamp(value,stockCamera?.25:.7,stockCamera?8:3.2);
  const cameraState=()=>Object.freeze({mode,registration:framing==='mapped'?mappedCameraFrame(model.snapshot,width,height).registration:'room-fit',...desired});
  function changeMode(next){if(mode!==next){mode=next;onCameraChange(cameraState());}}
  const haloGeometry=new T.RingGeometry(.55,.59,64),haloMaterial=new T.MeshBasicMaterial({color:'#4d967a',transparent:true,opacity:.85,depthWrite:false,side:T.DoubleSide});
  const halo=new T.Mesh(haloGeometry,haloMaterial);halo.rotation.x=-Math.PI/2;halo.position.y=.035;halo.visible=false;model.scene.add(halo);
  function frameCamera(){
    const s=stockCamera==='furniture'?snapshot:model.snapshot,radius=Math.max(Math.hypot(s.cols,s.rows),s.wallHeight)*2.8,{angle,elevation,zoom,panX,panY}=current;
    target.set(s.cols*.5,stockCamera==='furniture'?s.wallHeight/2:.65,s.rows*.5);
    camera.position.set(target.x+Math.cos(angle)*Math.cos(elevation)*radius,target.y+Math.sin(elevation)*radius,target.z+Math.sin(angle)*Math.cos(elevation)*radius);
    camera.lookAt(target);camera.updateMatrixWorld(true);
    const mapped=framing==='mapped'?mappedCameraFrame(s,width,height):null;
    if(mapped?.frustum){
      const f=mapped.frustum,centerX=(f.left+f.right)/2+panX,centerY=(f.top+f.bottom)/2+panY;
      const horizontal=(f.right-f.left)/zoom,vertical=(f.top-f.bottom)/zoom;
      camera.left=centerX-horizontal/2;camera.right=centerX+horizontal/2;camera.top=centerY+vertical/2;camera.bottom=centerY-vertical/2;camera.updateProjectionMatrix();return;
    }
    let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
    const pad=stockCamera==='furniture'?Math.max(s.cols,s.rows,s.wallHeight)*.12:null;
    for(const x of [pad===null?-.8:-pad,s.cols+(pad??2.1)])for(const y of [pad===null?-.5:-pad,s.wallHeight+(pad??.5)])for(const z of [pad===null?-.7:-pad,s.rows+(pad??1.2)]){
      const p=new T.Vector3(x,y,z).applyMatrix4(camera.matrixWorldInverse);
      minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y);
    }
    const aspect=width/height,vertical=Math.max(maxY-minY,(maxX-minX)/aspect)*1.06/zoom,horizontal=vertical*aspect;
    const centerX=(minX+maxX)/2+panX,centerY=(minY+maxY)/2+panY;
    camera.left=centerX-horizontal/2;camera.right=centerX+horizontal/2;camera.top=centerY+vertical/2;camera.bottom=centerY-vertical/2;camera.updateProjectionMatrix();
  }
  function resize(w,h,dpr=globalThis.devicePixelRatio||1){if(disposed)return;width=Math.max(1,w);height=Math.max(1,h);renderer.setPixelRatio(clamp(dpr,1,1.75));renderer.setSize(width,height,false);frameCamera();}
  function update(next){if(disposed)return;model.update(next);if(mode==='mapped'){const mapped=mappedCameraFrame(model.snapshot);desired.angle=current.angle=mapped.angle;desired.elevation=current.elevation=mapped.elevation;}}
  function selectAt(x,y){
    const bounds=canvas.getBoundingClientRect();raycaster.setFromCamera(new T.Vector2((x-bounds.left)/bounds.width*2-1,-(y-bounds.top)/bounds.height*2+1),camera);
    model.scene.updateMatrixWorld(true);selected=null;
    for(const hit of raycaster.intersectObjects([model.world,model.actors],true)){
      let visible=true;for(let n=hit.object;n;n=n.parent)if(!n.visible)visible=false;if(!visible)continue;
      for(let node=hit.object;node;node=node.parent){if(node.userData.item||node.userData.actor){selected=node;break;}}
      if(selected)break;
    }
    halo.visible=!!selected;onSelect(selected?.userData||null);
  }
  function render(now=performance.now()){
    if(disposed)return;
    for(const key of Object.keys(current))current[key]+=(desired[key]-current[key])*.16;
    frameCamera();model.animate(now);
    if(now-lastMedia>125){model.refreshMedia(getPlayer());lastMedia=now;}
    if(selected){if(!selected.parent){selected=null;halo.visible=false;onSelect(null);}else{const p=selected.getWorldPosition(new T.Vector3());halo.position.set(p.x,.04,p.z);}}
    renderer.render(model.scene,camera);
  }
  const pinchDistance=()=>{const [a,b]=[...pointers.values()];return a&&b?Math.hypot(a.x-b.x,a.y-b.y):0;};
  const handlers={
    pointerdown(event){
      if(event.button!==0&&event.button!==2)return;
      pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});canvas.setPointerCapture?.(event.pointerId);
      gesture={x:event.clientX,y:event.clientY,...desired,pinch:pinchDistance(),moved:false,pan:event.shiftKey||event.button===2};
    },
    pointermove(event){
      if(!pointers.has(event.pointerId)||!gesture)return;pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
      const dx=event.clientX-gesture.x,dy=event.clientY-gesture.y;if(Math.hypot(dx,dy)>5)gesture.moved=true;
      if(!gesture.moved&&pointers.size===1)return;
      changeMode('free');
      if(pointers.size>1){if(gesture.pinch>0)desired.zoom=zoomLimit(gesture.zoom*pinchDistance()/gesture.pinch);gesture.moved=true;}
      else if(gesture.pan){desired.panX=gesture.panX-dx/width*(camera.right-camera.left);desired.panY=gesture.panY+dy/height*(camera.top-camera.bottom);}
      else{desired.angle=angleLimit(gesture.angle-dx*.005);desired.elevation=clamp(gesture.elevation+dy*.003,stockCamera?.02:.32,stockCamera?Math.PI/2-.001:1.16);}
    },
    pointerup(event){
      if(gesture&&!gesture.moved&&pointers.size===1)selectAt(event.clientX,event.clientY);pointers.delete(event.pointerId);
      const remaining=[...pointers.values()][0];gesture=remaining?{...remaining,...desired,pinch:0,moved:true,pan:false}:null;
    },
    pointercancel(event){pointers.delete(event.pointerId);gesture=null;},
    wheel(event){event.preventDefault();desired.zoom=zoomLimit(desired.zoom*Math.exp(-event.deltaY*.001));changeMode('free');},
    contextmenu(event){event.preventDefault();}
  };
  for(const [event,handler]of Object.entries(handlers))canvas.addEventListener(event,handler,{passive:false});
  function preset(name){
    desired={zoom:1,angle:Math.PI/4,elevation:.64,panX:0,panY:0};framing=name==='mapped'?'mapped':'room-fit';
    if(name==='mapped'){const mapped=mappedCameraFrame(model.snapshot,width,height);Object.assign(desired,{angle:mapped.angle,elevation:mapped.elevation});Object.assign(current,desired);}
    if(name==='floor')desired.elevation=stockCamera?Math.PI/2-.001:1.12;
    if(stockCamera&&name==='front')Object.assign(desired,{angle:Math.PI/2,elevation:.02});if(name==='detail')Object.assign(desired,{zoom:1.65,angle:.88,elevation:.51});
    const next=name==='mapped'?'mapped':'free';mode=next;onCameraChange(cameraState());frameCamera();
  }
  function rotate(direction){desired.angle=angleLimit(desired.angle+direction*.18);changeMode('free');}
  function zoomBy(factor){desired.zoom=zoomLimit(desired.zoom*factor);changeMode('free');}
  function clearSelection(){selected=null;halo.visible=false;onSelect(null);}
  function setLighting(mode){model.setLighting(mode);if(stockCamera)renderer.shadowMap.needsUpdate=true;renderer.setClearColor(mode==='night'?'#202d3d':mode==='sunset'?'#e9d9c4':'#e7e8dc');}
  function peopleStatus(){
    const result={ready:0,loading:0,fallback:0,total:0};
    for(const actor of model.actors.children){const status=actor.userData.personAssetStatus;if(status&&Object.hasOwn(result,status)){result[status]++;result.total++;}}
    return result;
  }
  function dispose(){if(disposed)return;disposed=true;for(const [event,handler]of Object.entries(handlers))canvas.removeEventListener(event,handler);pointers.clear();haloGeometry.dispose();haloMaterial.dispose();halo.removeFromParent();model.dispose();renderer.dispose();renderer.forceContextLoss();}
  resize(canvas.clientWidth||1000,canvas.clientHeight||700);
  onCameraChange(cameraState());
  return {invalidateShadows:()=>{renderer.shadowMap.needsUpdate=true;},resize,update,render,preset,rotate,zoomBy,setLighting,clearSelection,dispose,get bestPeopleCount(){return peopleStatus().ready;},get bestPeopleStatus(){return peopleStatus();},get blenderAssets(){return model.world.children.filter(o=>o.userData.assetStatus==='ready').length;},get blenderCounters(){return model.world.children.filter(o=>o.userData.type==='counter'&&o.userData.assetStatus==='ready').length;},get snapshot(){return model.snapshot;},get cameraState(){return cameraState();}};
}
