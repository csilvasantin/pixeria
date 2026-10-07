import * as T from '../assets/xpaces/engine/premium-three.mjs';
import {createLifeScene} from '../assets/xpaces/engine/life-scene.mjs?v=px-1';
import {createLifeRenderer} from '../assets/xpaces/engine/life-renderer.mjs?v=studio-best-3';
import {GLTFLoader} from '../assets/xpaces/engine/vendor/GLTFLoader.mjs';
import {mergeGeometries} from '../assets/xpaces/engine/vendor/BufferGeometryUtils.mjs';
import {TWIN_REFERENCE,observerPoint} from './gemelo-reference.mjs?v=studio-best-3';
import {TWIN_BEST_REFERENCE} from './gemelo-assets.mjs?v=studio-best-3';
import {displayPlacementForReference,recommendedReferenceId} from './gemelo-catalog.mjs?v=studio-best-3';
import {previewSize,screenCrop} from './gemelo-core.mjs?v=studio-best-3';

function resources(root){const set=new Set();root.traverse(n=>{if(n.geometry)set.add(n.geometry);for(const m of [n.material].flat().filter(Boolean)){set.add(m);for(const v of Object.values(m))if(v?.isTexture)set.add(v);}});return set;}
function release(root){for(const r of resources(root)){r.source?.data?.close?.();r.dispose();}}
// Same bundled batching utility as Xpaces: static opaque geometry only, before dynamic display surfaces.
function batch(root,movables=[]){
  root.updateMatrixWorld(true);const groups=new Map(),inverse=new T.Matrix4().copy(root.matrixWorld).invert();
  root.traverseVisible(n=>{for(let p=n;p&&p!==root;p=p.parent)if(movables.some(x=>x.node===p))return;if(!n.isMesh||n.children.length||n.isSkinnedMesh||n.morphTargetInfluences?.length||Array.isArray(n.material)||n.material.transparent)return;
    const key=n.material.uuid+':'+!!n.geometry.index+':'+Object.keys(n.geometry.attributes).sort().map(k=>k+':'+n.geometry.attributes[k].itemSize+':'+n.geometry.attributes[k].normalized).join('|');
    if(!groups.has(key))groups.set(key,[]);groups.get(key).push(n);});
  for(const nodes of groups.values())if(nodes.length>1){const gs=nodes.map(n=>n.geometry.clone().applyMatrix4(new T.Matrix4().multiplyMatrices(inverse,n.matrixWorld))),g=mergeGeometries(gs,false);for(const v of gs)v.dispose();if(!g)continue;const mesh=new T.Mesh(g,nodes[0].material);mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);for(const n of nodes)n.visible=false;}
}
export async function createRetailTwin({canvas,geometry,signal,onCameraChange,quality='best',referenceId,formatId}={}){
  const reference=quality==='better'?TWIN_REFERENCE:TWIN_BEST_REFERENCE;if(!reference)throw Error('best-reference-unavailable');
  const response=await fetch(reference.url,{signal});if(!response.ok)throw Error('reference-unavailable');
  const bytes=await response.arrayBuffer();const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(v=>v.toString(16).padStart(2,'0')).join('');if(digest!==reference.sha256)throw Error('reference-changed');
  if(signal.aborted)throw new DOMException('Aborted','AbortError');
  const gltf=await new GLTFLoader().parseAsync(bytes,reference.url),root=gltf.scene;
  if(signal.aborted){release(root);throw new DOMException('Aborted','AbortError');}
  const floor=root.getObjectByName('suelo');if(!floor){release(root);throw Error('reference-floor-missing');}
  const floorBox=new T.Box3().setFromObject(floor);root.position.sub(new T.Vector3(floorBox.min.x,floorBox.max.y,floorBox.min.z));root.updateMatrixWorld(true);
  // Replace the wall display. Movable fixture roots retain their IDs/scale and are reset per trial.
  const originalWall=root.getObjectByName('pantalla-pared');if(!originalWall){release(root);throw Error('reference-wall-missing');}originalWall.visible=false;
  const movables=['planta','taburete-1','taburete-2','lampara-1','lampara-2','lampara-3'].map(name=>root.getObjectByName(name)).filter(Boolean).map(node=>({node,position:node.position.clone()}));
  root.traverse(n=>{if(n.isMesh){n.castShadow=true;n.receiveShadow=true;}});batch(root,movables);
  let initial;try{initial=displayPlacementForReference(geometry,referenceId||recommendedReferenceId(formatId),{formatId});}catch(error){release(root);throw error;}
  const snapshot={cols:initial.roomWidth,rows:initial.roomDepth,wallHeight:initial.roomHeight,layout:[],actors:[],moving:false};
  let model,viewer;const surface=new T.Group(),trial=new T.Group(),presentation=new T.Group();surface.name='studio:adapted-wall';trial.name='studio:reference-fixtures';presentation.add(root,surface,trial);
  try{viewer=createLifeRenderer({canvas,snapshot,stockCamera:true,assetQuality:quality,renderProfile:quality==='best'?'studio-best':'standard',onCameraChange,sceneFactory:(s,o)=>{model=createLifeScene(s,{...o,inventory:true});model.world.add(presentation);return model;}});}catch(e){release(root);throw e;}
  let panels=[],placement=null,arrangements=[],disposed=false,sz=previewSize(geometry);const master=document.createElement('canvas');master.width=sz.ancho;master.height=sz.alto;
  function clear(){for(const group of [surface,trial]){for(const r of resources(group))r.dispose();group.clear();}panels=[];}
  function box(name,x,y,z,w,h,d,color='#24333b',metalness=.25){const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),new T.MeshStandardMaterial({color,roughness:.35,metalness}));mesh.name=name;mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;trial.add(mesh);return mesh;}
  function referenceFixtures(){const b=placement.bounds,c=placement.centre,room=placement.reference.definition.room;
    if(room.width>6){box('studio:gallery-floor',(6+room.width)/2,-.045,room.depth/2,room.width-6,.09,room.depth,'#d7d4c8',0);box('studio:gallery-wall',(6+room.width)/2,1.5,.01,room.width-6,3,.10,'#263038',0);}
    const type=placement.reference.definition.supports.type;
    if(type==='overhead_fascia_rail'){for(const x of [b.min.x-.07,b.max.x+.07])box('studio:fascia-post',x,1.5,c.z-.13,.075,3,.075,'#24333b');box('studio:fascia-beam',c.x,2.98,c.z-.13,b.max.x-b.min.x+.22,.04,.1,'#ad8950',.75);}
    else if(placement.faceCount===4){box('studio:led-pedestal',c.x,b.min.y/2,c.z,(b.max.x-b.min.x)*.65,b.min.y,(b.max.z-b.min.z)*.65,'#17232a');box('studio:led-top',c.x,b.max.y+.02,c.z,b.max.x-b.min.x+.06,.04,b.max.z-b.min.z+.06,'#17232a');}
    else {const xs=b.max.x-b.min.x<1.5?[c.x]:[b.min.x+.12,b.max.x-.12],postZ=b.min.z+(placement.reference.definition.supports.postOffsetZ??-.11);for(const x of xs){box('studio:display-stand',x,b.min.y/2,postZ,.07,b.min.y,.07);box('studio:stand-foot',x,.025,postZ,.45,.05,.40);}box('studio:display-backrail',c.x,c.y,b.min.z-.1,b.max.x-b.min.x,.065,.06,'#ad8950',.75);}
  }
  function clearMountZone(){arrangements=[];const zone=placement.reference.definition.mount.zone,limit=new T.Box3(new T.Vector3(zone.min.x,zone.min.y,zone.min.z),new T.Vector3(zone.max.x,zone.max.y,zone.max.z));
    for(const item of movables){item.node.position.copy(item.position);root.updateMatrixWorld(true);if(!new T.Box3().setFromObject(item.node).intersectsBox(limit))continue;
      const from=item.node.position.clone();if(item.node.name.startsWith('lampara'))item.node.position.z=.8;else if(item.node.name==='planta'){item.node.position.x=.8;item.node.position.z=3.9;}else item.node.position.z=.95;root.updateMatrixWorld(true);
      if(new T.Box3().setFromObject(item.node).intersectsBox(limit))throw Error('trial-fixture-clearance');arrangements.push({nodeName:item.node.name,from:from.toArray(),to:item.node.position.toArray(),reason:'trial_mount_clearance'});
    }}
  function home(){viewer.preset('home');viewer.frameObject(presentation,{margin:1.07,angle:Math.PI/4,elevation:.64});}
  function front(){viewer.preset('front');viewer.frameObject(surface,{margin:1.25,angle:Math.PI/2,elevation:.02});}
  function setLayout(value){const next=displayPlacementForReference(geometry,value,{formatId});clear();placement=next;clearMountZone();model.update({...snapshot,cols:placement.roomWidth,rows:placement.roomDepth,wallHeight:placement.roomHeight});model.world.add(presentation);referenceFixtures();
    for(const piece of placement.pieces){const crop=screenCrop(piece.wall,geometry.pared,sz),cv=document.createElement('canvas');cv.width=Math.max(1,crop.w);cv.height=Math.max(1,crop.h);
      const texture=new T.CanvasTexture(cv);texture.colorSpace=T.SRGBColorSpace;texture.minFilter=T.LinearFilter;texture.generateMipmaps=false;
      const frame=new T.Mesh(new T.BoxGeometry(piece.width+.022,piece.height+.022,.06),new T.MeshStandardMaterial({color:'#17272a',roughness:.45}));frame.position.set(piece.position.x,piece.position.y,piece.position.z);frame.rotation.y=piece.rotation;surface.add(frame);
      const plane=new T.PlaneGeometry(piece.width*.991,piece.height*.991);if(piece.flipU){const uv=plane.attributes.uv;for(let i=0;i<uv.count;i++)uv.setX(i,1-uv.getX(i));}
      const screen=new T.Mesh(plane,new T.MeshBasicMaterial({map:texture,toneMapped:false}));frame.add(screen);screen.position.z=.033;panels.push({cv,crop,texture});
    }
    viewer.invalidateShadows();home();
  }
  try{setLayout(referenceId||recommendedReferenceId(formatId));home();}catch(error){clear();viewer.dispose();release(root);throw error;}
  return {reference,quality,viewer,master,setLayout,home,front,
    setGeometry(next,options={}){geometry=next;formatId=options.formatId;sz=previewSize(geometry);master.width=sz.ancho;master.height=sz.alto;setLayout(options.referenceId||recommendedReferenceId(formatId));},
    get arrangements(){return arrangements;},
    observe:settings=>viewer.setObservation(observerPoint(placement,settings)),
    get surfaces(){return panels.length;},get placement(){return placement;},
    draw(draw){if(disposed)return;draw(master);for(const p of panels){const c=p.cv.getContext('2d');c.clearRect(0,0,p.cv.width,p.cv.height);c.drawImage(master,p.crop.x,p.crop.y,p.crop.w,p.crop.h,0,0,p.cv.width,p.cv.height);p.texture.needsUpdate=true;}viewer.render(performance.now());},
    dispose(){if(disposed)return;disposed=true;clear();viewer.dispose();release(root);master.width=master.height=0;}
  };
}

// Compatibility entry point for existing integrations.
export const createBetterTwin=options=>createRetailTwin({...options,quality:'better'});
