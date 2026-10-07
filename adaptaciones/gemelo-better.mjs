import * as T from '../assets/xpaces/engine/premium-three.mjs';
import {createLifeScene} from '../assets/xpaces/engine/life-scene.mjs?v=px-1';
import {createLifeRenderer} from '../assets/xpaces/engine/life-renderer.mjs?v=studio-observer-1';
import {GLTFLoader} from '../assets/xpaces/engine/vendor/GLTFLoader.mjs';
import {mergeGeometries} from '../assets/xpaces/engine/vendor/BufferGeometryUtils.mjs';
import {TWIN_REFERENCE,displayPlacement,observerPoint} from './gemelo-reference.mjs';
import {previewSize,screenCrop} from './gemelo-core.mjs';

function resources(root){const set=new Set();root.traverse(n=>{if(n.geometry)set.add(n.geometry);for(const m of [n.material].flat().filter(Boolean)){set.add(m);for(const v of Object.values(m))if(v?.isTexture)set.add(v);}});return set;}
function release(root){for(const r of resources(root)){r.source?.data?.close?.();r.dispose();}}
// Same bundled batching utility as Xpaces: static opaque geometry only, before dynamic display surfaces.
function batch(root){
  root.updateMatrixWorld(true);const groups=new Map(),inverse=new T.Matrix4().copy(root.matrixWorld).invert();
  root.traverseVisible(n=>{if(!n.isMesh||n.children.length||n.isSkinnedMesh||n.morphTargetInfluences?.length||Array.isArray(n.material)||n.material.transparent)return;
    const key=n.material.uuid+':'+!!n.geometry.index+':'+Object.keys(n.geometry.attributes).sort().map(k=>k+':'+n.geometry.attributes[k].itemSize+':'+n.geometry.attributes[k].normalized).join('|');
    if(!groups.has(key))groups.set(key,[]);groups.get(key).push(n);});
  for(const nodes of groups.values())if(nodes.length>1){const gs=nodes.map(n=>n.geometry.clone().applyMatrix4(new T.Matrix4().multiplyMatrices(inverse,n.matrixWorld))),g=mergeGeometries(gs,false);for(const v of gs)v.dispose();if(!g)continue;const mesh=new T.Mesh(g,nodes[0].material);mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);for(const n of nodes)n.visible=false;}
}
export async function createBetterTwin({canvas,geometry,signal,onCameraChange}={}){
  const response=await fetch(TWIN_REFERENCE.url,{signal});if(!response.ok)throw Error('reference-unavailable');
  const bytes=await response.arrayBuffer();const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(v=>v.toString(16).padStart(2,'0')).join('');if(digest!==TWIN_REFERENCE.sha256)throw Error('reference-changed');
  if(signal.aborted)throw new DOMException('Aborted','AbortError');
  const gltf=await new GLTFLoader().parseAsync(bytes,TWIN_REFERENCE.url),root=gltf.scene;
  if(signal.aborted){release(root);throw new DOMException('Aborted','AbortError');}
  const bounds=new T.Box3().setFromObject(root),size=bounds.getSize(new T.Vector3());
  root.position.sub(bounds.min);root.updateMatrixWorld(true);
  // The original wall display is replaced by this virtual format. Other shop fixtures stay intact.
  const originalWall=root.getObjectByName('pantalla-pared');if(!originalWall){release(root);throw Error('reference-wall-missing');}originalWall.visible=false;
  root.traverse(n=>{if(n.isMesh){n.castShadow=true;n.receiveShadow=true;}});batch(root);
  const snapshot={cols:size.x,rows:size.z,wallHeight:size.y,layout:[],actors:[],moving:false};
  let model,viewer;const surface=new T.Group();surface.name='studio:adapted-wall';
  try{viewer=createLifeRenderer({canvas,snapshot,stockCamera:true,assetQuality:'better',onCameraChange,sceneFactory:(s,o)=>{model=createLifeScene(s,{...o,inventory:true});model.world.add(root,surface);return model;}});}catch(e){release(root);throw e;}
  let panels=[],placement=null,corner=false,disposed=false;const master=document.createElement('canvas'),sz=previewSize(geometry);master.width=sz.ancho;master.height=sz.alto;
  function clear(){for(const r of resources(surface))r.dispose();surface.clear();panels=[];}
  function home(){viewer.preset('home');viewer.frameObject(root,{margin:1.12,angle:Math.PI/4,elevation:.64});}
  function front(){viewer.frameObject(surface,{margin:1.25,angle:Math.PI/2,elevation:.02});}
  function setLayout(value){corner=value==='corner';clear();placement=displayPlacement(geometry,corner);
    for(const piece of placement.pieces){const crop=screenCrop(piece.wall,geometry.pared,sz),cv=document.createElement('canvas');cv.width=Math.max(1,crop.w);cv.height=Math.max(1,crop.h);
      const texture=new T.CanvasTexture(cv);texture.colorSpace=T.SRGBColorSpace;texture.minFilter=T.LinearFilter;texture.generateMipmaps=false;
      const frame=new T.Mesh(new T.BoxGeometry(piece.width+.022,piece.height+.022,.06),new T.MeshStandardMaterial({color:'#17272a',roughness:.45}));frame.position.set(piece.position.x,piece.position.y,piece.position.z);frame.rotation.y=piece.rotation;surface.add(frame);
      const plane=new T.PlaneGeometry(piece.width*.991,piece.height*.991);if(piece.flipU){const uv=plane.attributes.uv;for(let i=0;i<uv.count;i++)uv.setX(i,1-uv.getX(i));}
      const screen=new T.Mesh(plane,new T.MeshBasicMaterial({map:texture,toneMapped:false}));frame.add(screen);screen.position.z=.033;panels.push({cv,crop,texture});
    }
    viewer.invalidateShadows();home();
  }
  setLayout('flat');home();
  return {reference:TWIN_REFERENCE,viewer,master,setLayout,home,front,
    observe:settings=>viewer.setObservation(observerPoint(placement,settings)),
    get surfaces(){return panels.length;},get placement(){return placement;},
    draw(draw){if(disposed)return;draw(master);for(const p of panels){const c=p.cv.getContext('2d');c.clearRect(0,0,p.cv.width,p.cv.height);c.drawImage(master,p.crop.x,p.crop.y,p.crop.w,p.crop.h,0,0,p.cv.width,p.cv.height);p.texture.needsUpdate=true;}viewer.render(performance.now());},
    dispose(){if(disposed)return;disposed=true;clear();viewer.dispose();release(root);master.width=master.height=0;}
  };
}
