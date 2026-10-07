import * as T from './premium-three.mjs';

// Opt-in Studio presentation profile. Existing Xpaces cameras and simulation
// keep their renderer; only the reviewed Best model requests this light rig.
export function bestPixelRatio(width,height,dpr=1){
  return Math.min(2,Math.max(.1,Number.isFinite(dpr)?dpr:1),Math.sqrt(2_600_000/(Math.max(1,width)*Math.max(1,height))));
}
export function applyBestProfile(renderer,scene){
  const room=new T.Scene(),resources=[],box=new T.BoxGeometry(1,1,1);
  resources.push(box);
  const shell=new T.MeshBasicMaterial({color:'#c4c9d0',side:T.BackSide});resources.push(shell);
  const enclosure=new T.Mesh(box,shell);enclosure.scale.set(10,8,10);enclosure.position.y=3;room.add(enclosure);
  for(const [x,y,z,sx,sy,sz,intensity] of [[-3,4,0,.05,4,5,4],[3,4,1,.05,3,4,2],[0,6,0,6,.05,4,5]]){
    const material=new T.MeshBasicMaterial({color:new T.Color(intensity,intensity*.94,intensity*.86)});resources.push(material);
    const lamp=new T.Mesh(box,material);lamp.position.set(x,y,z);lamp.scale.set(sx,sy,sz);room.add(lamp);
  }
  const pmrem=new T.PMREMGenerator(renderer);pmrem.compileCubemapShader();
  const environment=pmrem.fromScene(room,.035,.1,100);pmrem.dispose();for(const r of resources)r.dispose();room.clear();
  const previous=scene.environment;scene.environment=environment.texture;
  scene.traverse(n=>{if(n.isLight&&n.castShadow){n.shadow.mapSize.set(4096,4096);n.shadow.normalBias=.018;n.shadow.radius=3;}});
  renderer.toneMappingExposure=1;
  scene.traverse(n=>{if(n.isMesh)for(const m of [n.material].flat().filter(Boolean))if(m.isMeshStandardMaterial){m.envMapIntensity=.45;m.needsUpdate=true;}});
  return {dispose(){scene.environment=previous;environment.dispose();}};
}
