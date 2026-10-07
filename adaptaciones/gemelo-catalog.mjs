// Representative retail trial scenes. These are independent of OSM shop IDs:
// choosing a reference never claims that its hardware is installed in a shop.
// Coordinates: metres, Y up, rear wall Z=0, original Xtanco footprint X=0..6,
// Z=0..4.5. Wide trial rooms add space on +X without stretching stock furniture.
const freeze = value => {
  if(value && typeof value === 'object') {
    for(const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
};
const limits = {
  measuredShop: false, hardwareConfirmed: false, exportGeometryUnchanged: true,
  anamorphicGeneration: false, metricSize: 'representative_trial',
};
export const TRIAL_FIXTURE_POLICY = freeze({
  movableRoots:['planta','taburete-1','taburete-2'],
  adjustablePendantRoots:['lampara-1','lampara-2','lampara-3'],
  preservedRoots:['mostrador','vitrina','expendedora','tpv','pantalla-mostrador','pantalla-escaparate'],
  preservedArchitecture:['suelo','pared_fondo','pared_fachada','puerta_entrada','puerta_almacén'],
  replacedDisplayRoot:'pantalla-pared',
  relocation:{trigger:'world_aabb_intersects_reserved_mount_zone',
    positionOnly:true,axes:['x','z'],preserveIds:true,preserveScale:true,preserveRotation:true,
    restoreSourceBeforeReferenceChange:true,moveWholeSemanticRoot:true,
    evidenceFields:['nodeName','from','to','reason'],reason:'trial_mount_clearance'},
  coordinateOrigin:'architectural_floor_origin_not_decorative_bounding_box_min',
});
function reference(id, es, en, width, topology, zone, dimensions, supports, extra={}) {
  return {id,label:{es,en},trial:true,definition:{
    quality:'best',room:{width,depth:4.5,height:3,origin:{x:0,y:0,z:0},units:'m'},
    mount:{topology,zone,reservedForTrial:true,clearanceRequired:true,...dimensions},
    supports,fixturePolicy:TRIAL_FIXTURE_POLICY,limits:{...limits,...extra},
  }};
}
// These boxes reserve space for the complete display, including its frame.
// The scene builder must keep all unrelated fixtures outside the reserved box.
export const TWIN_REFERENCES = freeze([
  reference('mostrador','Estanco · Mostrador','Shop · Counter',6,'flat',
    {min:{x:2.8,y:1.05,z:3.25},max:{x:4.15,y:2.85,z:3.65}},
    {centreX:3.475,front:3.45,bottom:1.12,maxWidth:1.2,maxHeight:1.55},
    {type:'counter_or_totem_stand',baseY:0,screenBottom:1.12}),
  reference('mural','Estanco · Mural videowall','Shop · Video wall',8,'flat',
    {min:{x:.25,y:1,z:3.25},max:{x:7.75,y:2.96,z:3.65}},
    {centreX:4,front:3.45,top:2.89,maxWidth:7.3,maxHeight:1.8},
    {type:'gallery_display_rail',baseY:0,extensionAxis:'+X'}),
  reference('columna','Estanco · Columna y góndola','Shop · Column and gondola',6,'flat',
    {min:{x:3.9,y:.55,z:3.25},max:{x:5.9,y:2.86,z:3.65}},
    {centreX:4.9,front:3.45,bottom:.65,maxWidth:1.8,maxHeight:2.05},
    {type:'vertical_gondola_stand',baseY:0,screenBottom:.65}),
  reference('superstretch','Estanco · Superstretch','Shop · Superstretch',8,'flat',
    {min:{x:.25,y:2,z:3.25},max:{x:7.75,y:2.99,z:3.65}},
    {centreX:4,front:3.45,top:2.92,maxWidth:7.3,maxHeight:.85},
    {type:'overhead_fascia_rail',baseY:2,extensionAxis:'+X'}),
  reference('cubo','Estanco · Cubo LED (ensayo)','Shop · LED cube (trial)',6,'four-face-prism-trial',
    {min:{x:3.05,y:1.05,z:2.65},max:{x:4.45,y:2.92,z:3.95}},
    {centreX:3.75,front:3.85,bottom:1.15,maxEdge:1.05,maxHeight:1.65},
    {type:'four_side_led_pedestal',baseY:0,screenBottom:1.15},
    {confirmedNet:false,faces:4,faceDefinition:'equal_quarter_width_trial',
      note:'Four vertical faces retain native aspect; the prism need not be a mathematical cube. No confirmed PDF cube net.'}),
  reference('esquina','Estanco · Esquina anamórfica (ensayo)','Shop · Anamorphic corner (trial)',6,'corner-90-trial',
    {min:{x:1.65,y:1.065,z:2.1},max:{x:4.15,y:2.96,z:4.45}},
    {left:1.75,front:2.15,top:2.89,maxWidth:4.4,maxHeight:1.8,
      interior:true,observationSide:'negative_x_positive_z',
      faceNormals:[{x:0,y:0,z:1},{x:-1,y:0,z:0}]},
    // Front-mounted feet remain beyond the original counter (maximum Z=2.11).
    // A rearward stand would intersect it even though the LED faces are clear.
    {type:'corner_display_rail',baseY:0,postOffsetZ:.24,footDepth:.4},
    {fold:'native_wall_midpoint',calibratedObserver:false}),
]);

export const FORMAT_REFERENCE_MAP = freeze(Object.fromEntries([
  ...['01','02','04','07','20'].map(n=>[`cliente-${n}`,'mostrador']),
  ...['03','05','06','14','15','16','17','22','24'].map(n=>[`cliente-${n}`,'mural']),
  ...[1,2,3,4,5].map(n=>[`cliente-esp-${n}`,'mural']),
  ...['10','11','12','13','21','23'].map(n=>[`cliente-${n}`,'columna']),
  ...['09','18','19'].map(n=>[`cliente-${n}`,'superstretch']),
  ['cliente-08','cubo'],
]));

export function referenceById(id) {
  const result=TWIN_REFERENCES.find(reference=>reference.id===id);
  if(!result) throw new Error('invalid-reference');
  return result;
}
export function recommendedReferenceId(format) {
  return FORMAT_REFERENCE_MAP[typeof format==='string'?format:format?.id] || 'mural';
}
export function referenceForFormat(format) { return referenceById(recommendedReferenceId(format)); }

function validatedGeometry(g) {
  const {ancho:width,alto:height}=g?.pared || {};
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0||!Array.isArray(g.segments)||!g.segments.length||g.segments.length>64) throw new Error('invalid-wall');
  const ids=new Set();
  for(const segment of g.segments) {
    const r=segment.wall;
    if(!Number.isInteger(segment.n)||segment.n<1||ids.has(segment.n)||!r||![r.x,r.y,r.w,r.h].every(Number.isFinite)||r.x<0||r.y<0||r.w<=0||r.h<=0||r.x+r.w>width+1e-7||r.y+r.h>height+1e-7) throw new Error('invalid-segment');
    ids.add(segment.n);
  }
  const areaTolerance=Math.max(1e-7,width*height*1e-9);
  if(Math.abs(g.segments.reduce((area,s)=>area+s.wall.w*s.wall.h,0)-width*height)>areaTolerance) throw new Error('incomplete-wall');
  for(let i=0;i<g.segments.length;i++) for(let j=i+1;j<g.segments.length;j++) {
    const a=g.segments[i].wall,b=g.segments[j].wall,
      overlapX=Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x),
      overlapY=Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y);
    if(overlapX>1e-7&&overlapY>1e-7) throw new Error('overlapping-segments');
  }
  return {width,height};
}

// Native texture U always follows wall.x. Rotation plus flipU identifies its
// world tangent. This is explicit so a screen split at a seam keeps UV order.
function piece(segment,x,w,scale,position,rotation,face,flipU=false) {
  return {screen:segment.n,face,wall:{x,y:segment.wall.y,w,h:segment.wall.h},
    width:w*scale,height:segment.wall.h*scale,position,rotation,flipU};
}
function boundsOf(pieces) {
  const min={x:Infinity,y:Infinity,z:Infinity},max={x:-Infinity,y:-Infinity,z:-Infinity};
  for(const p of pieces) {
    const hx=Math.abs(Math.cos(p.rotation))*p.width/2,hz=Math.abs(Math.sin(p.rotation))*p.width/2;
    for(const [axis,half] of [['x',hx],['y',p.height/2],['z',hz]]) {
      min[axis]=Math.min(min[axis],p.position[axis]-half);
      max[axis]=Math.max(max[axis],p.position[axis]+half);
    }
  }
  return {min,max};
}

// A physical trial never modifies g, atlas metadata or exported files.
// options.formatId permits a realistically sized tablet/counter preview; the
// native aspect and every native screen/pixel are retained at one common scale.
export function displayPlacementForReference(g,referenceId,{formatId}={}) {
  const native=validatedGeometry(g),reference=referenceById(referenceId),
    {room,mount}=reference.definition,ratio=native.width/native.height;
  let width,height;
  if(mount.topology==='four-face-prism-trial') {
    width=Math.min(mount.maxEdge*4,mount.maxHeight*ratio);height=width/ratio;
  } else {
    width=Math.min(mount.maxWidth,mount.maxHeight*ratio);height=width/ratio;
    const counterHeights={'cliente-01':1.55,'cliente-02':.30,'cliente-04':.36,'cliente-07':.27,'cliente-20':.60};
    if(referenceId==='mostrador'&&counterHeights[formatId]) {
      height=Math.min(counterHeights[formatId],mount.maxHeight,mount.maxWidth/ratio);width=height*ratio;
    }
  }
  const scale=width/native.width,top=mount.top??mount.bottom+height,pieces=[];
  const faceCount=mount.topology==='four-face-prism-trial'?4:mount.topology==='corner-90-trial'?2:1,
    facePixels=native.width/faceCount,edge=width/faceCount,
    left=mount.left??mount.centreX-(faceCount===4?edge:width)/2;
  for(const segment of g.segments) {
    const r=segment.wall,edges=[r.x];
    for(let face=1;face<faceCount;face++) {
      const cut=facePixels*face;
      if(cut>r.x&&cut<r.x+r.w) edges.push(cut);
    }
    edges.push(r.x+r.w);
    for(let i=0;i<edges.length-1;i++) {
      const x=edges[i],w=edges[i+1]-x,face=Math.min(faceCount-1,Math.floor((x+1e-8)/facePixels)),
        local=(x-face*facePixels+w/2)*scale,y=top-(r.y+r.h/2)*scale;
      let position,rotation=0,flipU=false;
      if(faceCount===1) position={x:left+(x+w/2)*scale,y,z:mount.front};
      else if(faceCount===2) {
        position=face===0?{x:left+local,y,z:mount.front}:{x:left+edge,y,z:mount.front+local};
        // Concave interior: first face points +Z, return face points -X.
        // Its local U already follows +Z, retaining the continuous wall pixels.
        rotation=face===0?0:-Math.PI/2;
      } else {
        position=[{x:left+local,y,z:mount.front},
          {x:left+edge,y,z:mount.front-local},
          {x:left+edge-local,y,z:mount.front-edge},
          {x:left,y,z:mount.front-edge+local}][face];
        rotation=[0,Math.PI/2,Math.PI,-Math.PI/2][face];
      }
      pieces.push(piece(segment,x,w,scale,position,rotation,face,flipU));
    }
  }
  const bounds=boundsOf(pieces),zone=mount.zone;
  for(const axis of ['x','y','z']) if(bounds.min[axis]<zone.min[axis]-1e-7||bounds.max[axis]>zone.max[axis]+1e-7) throw new Error('placement-outside-zone');
  return {referenceId,reference,trial:true,width,height,pieces,physicalScale:scale,
    roomWidth:room.width,roomDepth:room.depth,roomHeight:room.height,bounds,
    centre:{x:(bounds.min.x+bounds.max.x)/2,y:(bounds.min.y+bounds.max.y)/2,z:(bounds.min.z+bounds.max.z)/2},
    faceCount,folds:Array.from({length:faceCount-1},(_,i)=>facePixels*(i+1)),
    native:{width:native.width,height:native.height,screens:g.segments.length},
    uvConvention:'wall-x-continuous',exportGeometryUnchanged:true,
  };
}
