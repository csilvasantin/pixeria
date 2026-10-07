// Published Xtanco family; geometry/materials retained, never a scan of the selected OSM shop.
export const TWIN_REFERENCE=Object.freeze({id:'xtanco-4380',assetId:'1790370139269-2ty118',url:'https://api.admira.store/stock/asset/1790370139269-2ty118',sha256:'a6a670ad3edebb9b3a56e22707b4bb89dabb4ad000ced9eec3fc51cbe91b2706',quality:'better',units:'m'});
export function displayPlacement(g,corner=false){
  const ratio=g.pared.ancho/g.pared.alto;
  if(!Number.isFinite(ratio)||ratio<=0)throw Error('invalid-wall');
  const width=Math.min(5.1,1.8*ratio),height=width/ratio,left=.6,front=.64,top=2.89;
  // One continuous pixel wall can be folded at its midpoint for an explicit virtual experiment.
  // Split even a single screen at the fold, preserving adjacent pixel bounds and UVs.
  const fold=g.pared.ancho/2,pieces=[];
  for(const seg of g.segments){
    const r=seg.wall,edges=corner&&r.x<fold&&r.x+r.w>fold?[r.x,fold,r.x+r.w]:[r.x,r.x+r.w];
    for(let i=0;i<edges.length-1;i++){
      const x=edges[i],w=edges[i+1]-x,k=width/g.pared.ancho,side=corner&&x>=fold;
      pieces.push({screen:seg.n,wall:{x,y:r.y,w,h:r.h},width:w*k,height:r.h*k,
        position:{x:side?left+width/2:left+(x+w/2)*k,y:top-(r.y+r.h/2)*k,z:side?front+(x-fold+w/2)*k:front},rotation:side?Math.PI/2:0,flipU:side});
    }
  }
  return {width,height,pieces,centre:{x:left+width/2,y:top-height/2,z:front}};
}
export function observerPoint(placement,{height=1.65,distance=3,lateral=0}={}){
  if(![height,distance,lateral].every(Number.isFinite)||height<1.2||height>2.2||distance<1.5||distance>3.6||Math.abs(lateral)>2)throw Error('invalid-observer');
  if(placement.faceCount===2){
    const target={x:placement.bounds.max.x,y:placement.centre.y,z:placement.bounds.min.z},offset=distance/Math.sqrt(2);
    return {position:{x:target.x-offset+lateral,y:height,z:target.z+offset},target,fov:55};
  }
  return {position:{x:placement.centre.x+lateral,y:height,z:placement.centre.z+distance},target:{...placement.centre},fov:55};
}
