// One floor-space collision contract for the simulation and its three views.
// Furniture rotates around its layout origin, exactly as life-scene does.
const EPS=1e-7,STEP=.5,CORNER_CLEARANCE=1e-5;
const DEFAULT_FOOTPRINTS={counter:[1,2],shelves:[1,2],wineRack:[2,1],lottery:[2,1],vending:[1,1],magazines:[2,1],manager:[2,1],plant:[1,1],floorLamp:[1,1],rug:[2,2],djBooth:[2,1],tablet:[1,1],turnKiosk:[1,1],aroma:[1,1],metahuman:[1,1]};
const NON_SOLID=new Set(['rug','led','tft','aroma','door']);
const finite=(value,fallback)=>Number.isFinite(Number(value))?Number(value):fallback;
const point=value=>({col:Number(value?.col),row:Number(value?.row)});
const valid=p=>Number.isFinite(p.col)&&Number.isFinite(p.row);
const distance=(a,b)=>Math.hypot(a.col-b.col,a.row-b.row);
function touchesSegment(a,b,box,padding){
  let lo=0,hi=1;
  // Explicit slabs avoid allocating axis arrays for every visibility edge.
  const dc=b.col-a.col,minCol=box.minCol-padding,maxCol=box.maxCol+padding;
  if(Math.abs(dc)<EPS){if(a.col<minCol||a.col>maxCol)return false;}
  else{
    const t1=(minCol-a.col)/dc,t2=(maxCol-a.col)/dc;
    lo=Math.max(lo,Math.min(t1,t2));hi=Math.min(hi,Math.max(t1,t2));
    if(lo>hi)return false;
  }
  const dr=b.row-a.row,minRow=box.minRow-padding,maxRow=box.maxRow+padding;
  if(Math.abs(dr)<EPS){if(a.row<minRow||a.row>maxRow)return false;}
  else{
    const t1=(minRow-a.row)/dr,t2=(maxRow-a.row)/dr;
    lo=Math.max(lo,Math.min(t1,t2));hi=Math.min(hi,Math.max(t1,t2));
    if(lo>hi)return false;
  }
  return hi>=0&&lo<=1;
}

export function buildCustomerNavigation(scene={}, {radius=.24,allowOutside=false}={}){
  const cols=Math.max(1,finite(scene.cols??scene.iso?.cols,14)),rows=Math.max(1,finite(scene.rows??scene.iso?.rows,8));
  radius=Math.max(0,finite(radius,.24));
  const doorRow=finite(scene.doorRow??scene.iso?.doorRow,3.35),doorHalfWidth=1.15;
  const footprints={...DEFAULT_FOOTPRINTS,...scene.footprints};
  const obstacles=[];
  for(const item of Array.isArray(scene.layout)?scene.layout:[]){
    if(!item||NON_SOLID.has(item.type)||item.mount==='wall'||item.hidden===true)continue;
    const fp=Array.isArray(item.fp)?item.fp:footprints[item.type]||[1,1];
    const width=Math.max(.1,finite(fp[0],1)),depth=Math.max(.1,finite(fp[1],1));
    const scale=Math.max(.1,Math.abs(finite(item.sx,1))),flip=item.flipX?-1:1;
    const angle=-finite(item.rot,0)*Math.PI/2,cos=Math.cos(angle),sin=Math.sin(angle);
    // THREE's rotation about Y: x'=cos*x+sin*z, z'=-sin*x+cos*z.
    const corners=[[0,0],[width,0],[width,depth],[0,depth]].map(([x,z])=>{
      x*=scale*flip;z*=scale;
      return {col:finite(item.col,0)+cos*x+sin*z,row:finite(item.row,0)-sin*x+cos*z};
    });
    obstacles.push({id:String(item.id??item.type),minCol:Math.min(...corners.map(p=>p.col)),maxCol:Math.max(...corners.map(p=>p.col)),minRow:Math.min(...corners.map(p=>p.row)),maxRow:Math.max(...corners.map(p=>p.row))});
  }
  const key=JSON.stringify([cols,rows,radius,allowOutside,doorRow,obstacles]);
  function inBounds(p){
    if(p.row<radius||p.row>rows-radius||p.col<radius)return false;
    if(p.col<=cols-radius)return true;
    return allowOutside&&p.col<=cols+1.5&&p.row>=doorRow-doorHalfWidth+radius&&p.row<=doorRow+doorHalfWidth-radius;
  }
  function isWalkable(value){const p=point(value);return valid(p)&&inBounds(p)&&!obstacles.some(box=>touchesSegment(p,p,box,radius));}
  function segmentClear(start,end){
    const a=point(start),b=point(end);
    if(!valid(a)||!valid(b)||!inBounds(a)||!inBounds(b))return false;
    // The room plus vestibule is non-convex. At their shared boundary a
    // segment must cross the actual opening, even for a sub-pixel corner cut.
    const roomEdge=cols-radius;
    if((a.col>roomEdge)!==(b.col>roomEdge)){
      const t=(roomEdge-a.col)/(b.col-a.col),crossRow=a.row+(b.row-a.row)*t;
      if(crossRow<doorRow-doorHalfWidth+radius||crossRow>doorRow+doorHalfWidth-radius)return false;
    }
    return !obstacles.some(box=>touchesSegment(a,b,box,radius));
  }
  // Coarse samples are only a compatibility fallback for an invalid target;
  // routing itself never depends on a passage lining up with this grid.
  let samples;
  function recoverySamples(){
    if(samples)return samples;
    samples=[];
    for(let col=.25;col<cols+(allowOutside?1.5:0);col+=STEP)for(let row=.25;row<rows;row+=STEP){
      const p={col,row};if(isWalkable(p))samples.push(p);
    }
    return samples;
  }
  let visibility;
  function visibilityGraph(){
    if(visibility)return visibility;
    const nodes=[],seen=new Set();
    const add=(col,row)=>{
      const p={col,row},id=col.toFixed(8)+','+row.toFixed(8);
      if(!seen.has(id)&&isWalkable(p)){seen.add(id);nodes.push(p);}
    };
    // A shortest route around axis-aligned solids bends at their expanded
    // corners. Keeping those vertices supports arbitrary fractional layouts
    // and leaves at most four candidates per solid, rather than a dense grid.
    for(const box of obstacles){
      for(const col of [box.minCol-radius-CORNER_CLEARANCE,box.maxCol+radius+CORNER_CLEARANCE]){
        for(const row of [box.minRow-radius-CORNER_CLEARANCE,box.maxRow+radius+CORNER_CLEARANCE])add(col,row);
      }
    }
    for(const col of [radius,cols-radius])for(const row of [radius,rows-radius])add(col,row);
    if(allowOutside){
      const low=Math.max(radius,doorRow-doorHalfWidth+radius),high=Math.min(rows-radius,doorRow+doorHalfWidth-radius);
      if(low<=high)for(const col of [cols-radius,cols+1.5])for(const row of [low,high])add(col,row);
    }
    const edges=nodes.map(()=>[]);
    for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){
      if(!segmentClear(nodes[i],nodes[j]))continue;
      const d=distance(nodes[i],nodes[j]);edges[i].push([j,d]);edges[j].push([i,d]);
    }
    return visibility={nodes,edges};
  }
  function resolve(value){
    const p=point(value);if(!valid(p))return null;if(isWalkable(p))return p;
    let best=null,score=Infinity;
    for(const candidate of recoverySamples()){const d=distance(p,candidate);if(d<score){score=d;best=candidate;}}
    // An exceptionally tight free region can contain no half-tile sample.
    if(!best)for(const candidate of visibilityGraph().nodes){const d=distance(p,candidate);if(d<score){score=d;best=candidate;}}
    return best?{...best}:null;
  }
  function route(start,end){
    const a=point(start),b=point(end);
    // Never invent a safe start and then draw a line through the intervening
    // furniture. A newly placed obstacle requires waiting for a safe route.
    if(!isWalkable(a)||!isWalkable(b))return null;
    if(distance(a,b)<EPS)return [];
    if(segmentClear(a,b))return [b];
    const graph=visibilityGraph(),all=[a,...graph.nodes,b],last=all.length-1;
    // Static visibility is cached for the lifetime of this layout. Only the
    // two moving endpoints need collision checks for each new journey.
    const edges=[[],...graph.edges.map(list=>list.map(([i,d])=>[i+1,d])),[]];
    for(let i=1;i<last;i++){
      if(segmentClear(a,all[i]))edges[0].push([i,distance(a,all[i])]);
      if(segmentClear(all[i],b))edges[i].push([last,distance(all[i],b)]);
    }
    const open=new Set([0]),closed=new Set(),cost=new Map([[0,0]]),parent=new Map();
    while(open.size){
      let current=-1,score=Infinity;
      for(const i of open){const f=cost.get(i)+distance(all[i],b);if(f<score){score=f;current=i;}}
      if(current===last){
        const raw=[];let i=last;while(i!==0){raw.unshift(all[i]);i=parent.get(i);}
        // Only remove waypoints when the entire swept body segment is clear.
        const smooth=[];let from=a;
        for(let at=0;at<raw.length;){let next=at;for(let j=at+1;j<raw.length;j++)if(segmentClear(from,raw[j]))next=j;smooth.push({...raw[next]});from=raw[next];at=next+1;}
        return smooth;
      }
      open.delete(current);closed.add(current);
      for(const [next,d] of edges[current]){
        if(closed.has(next))continue;
        const candidate=cost.get(current)+d;
        if(candidate<(cost.get(next)??Infinity)){parent.set(next,current);cost.set(next,candidate);open.add(next);}
      }
    }
    return null;
  }
  return {cols,rows,radius,obstacles,key,isWalkable,segmentClear,resolve,route};
}
