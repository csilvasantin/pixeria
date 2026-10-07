import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {twinGeometry,previewSize,screenCrop} from '../adaptaciones/gemelo-core.mjs';
import {observerPoint} from '../adaptaciones/gemelo-reference.mjs';
import {bestPixelRatio} from '../assets/xpaces/engine/life-best-profile.mjs';
import {TWIN_REFERENCES,FORMAT_REFERENCE_MAP,TRIAL_FIXTURE_POLICY,referenceById,recommendedReferenceId,
  referenceForFormat,displayPlacementForReference} from '../adaptaciones/gemelo-catalog.mjs';
import {TWIN_BEST_REFERENCE} from '../adaptaciones/gemelo-assets.mjs';

const read=name=>JSON.parse(fs.readFileSync(new URL(`../adaptaciones/${name}`,import.meta.url)));
const flat=read('perfil-cliente-18.json').formats;
const special=read('perfil-cliente-especiales.json').layouts.map(layout=>({...layout,layout}));
const formats=[...flat,...special];
const geometry=f=>twinGeometry(f,{ancho:f.custom?.[0],alto:f.custom?.[1]});
const close=(a,b,epsilon=1e-7)=>assert.ok(Math.abs(a-b)<=epsilon,`${a} != ${b}`);
test('corner observer sees both faces from the fold bisector and Best respects a 4K pixel budget',()=>{
  const p=displayPlacementForReference(geometry(formats.find(f=>f.id==='cliente-02')),'esquina');
  const eye=observerPoint(p,{height:1.65,distance:3,lateral:0});
  close(eye.target.x-eye.position.x,eye.position.z-eye.target.z);
  close(Math.hypot(eye.position.x-eye.target.x,eye.position.z-eye.target.z),3);
  close(eye.target.x,p.bounds.max.x);close(eye.target.z,p.bounds.min.z);
  for(const [w,h,dpr] of [[3840,2160,2],[1280,720,2],[7680,4320,3]]){
    const r=bestPixelRatio(w,h,dpr);assert.ok(r>0&&r<=2);assert.ok(w*h*r*r<=2_600_000+1);
  }
});
function endpoint(p,end){
  const direction=p.flipU?-1:1,offset=(end?1:-1)*p.width/2;
  return {x:p.position.x+Math.cos(p.rotation)*direction*offset,
    y:p.position.y,z:p.position.z-Math.sin(p.rotation)*direction*offset};
}

test('29 stable Altadis IDs have one recommended reference and the corner is optional',()=>{
  assert.equal(formats.length,29);
  assert.deepEqual(Object.keys(FORMAT_REFERENCE_MAP).sort(),formats.map(f=>f.id).sort());
  assert.deepEqual(TWIN_REFERENCES.map(r=>r.id),['mostrador','mural','columna','superstretch','cubo','esquina']);
  for(const f of formats){const id=recommendedReferenceId(f);assert.equal(id,recommendedReferenceId(f.id));assert.equal(referenceForFormat(f).id,id);assert.notEqual(id,'esquina');}
  assert.equal(recommendedReferenceId('cliente-07'),'mostrador');
  assert.equal(recommendedReferenceId('cliente-08'),'cubo');
  assert.equal(recommendedReferenceId('cliente-10'),'columna');
  assert.equal(recommendedReferenceId('cliente-18'),'superstretch');
  assert.equal(recommendedReferenceId('cliente-esp-5'),'mural');
  assert.equal(recommendedReferenceId('custom'),'mural');
  assert.throws(()=>referenceById('altadis-bcn-003'),/invalid-reference/);
});

test('reference rooms and reserved mounting zones are metric, immutable and independent of OSM',()=>{
  for(const r of TWIN_REFERENCES){
    const {room,mount,limits}=r.definition;
    assert.ok(r.label.es&&r.label.en);assert.equal(r.trial,true);assert.equal(r.definition.quality,'best');
    assert.deepEqual(room.origin,{x:0,y:0,z:0});assert.equal(room.units,'m');
    assert.equal(room.width,['mural','superstretch'].includes(r.id)?8:6);
    assert.equal(room.depth,4.5);assert.equal(room.height,3);
    assert.equal(mount.clearanceRequired,true);assert.equal(mount.reservedForTrial,true);
    for(const [axis,dimension] of [['x',room.width],['y',room.height],['z',room.depth]]){
      assert.ok(mount.zone.min[axis]>=0&&mount.zone.max[axis]<=dimension);
      assert.ok(mount.zone.max[axis]>mount.zone.min[axis]);
    }
    assert.equal(limits.measuredShop,false);assert.equal(limits.hardwareConfirmed,false);
    assert.equal(limits.exportGeometryUnchanged,true);assert.equal(limits.anamorphicGeneration,false);
    assert.equal(r.definition.fixturePolicy,TRIAL_FIXTURE_POLICY);
    assert.deepEqual(r.definition.fixturePolicy.movableRoots,['planta','taburete-1','taburete-2']);
    assert.equal(r.definition.fixturePolicy.relocation.preserveScale,true);
    assert.ok(Object.isFrozen(r.definition.mount.zone.min));
    assert.throws(()=>{r.definition.room.width=99;},TypeError);
  }
});

test('every format in every reference retains all native pixels, IDs, aspect and room bounds',()=>{
  for(const f of formats){
    const g=geometry(f),before=JSON.stringify(g),size=previewSize(g);
    for(const reference of TWIN_REFERENCES){
      const p=displayPlacementForReference(g,reference.id,{formatId:f.id}),zone=reference.definition.mount.zone;
      close(p.width/p.height,g.pared.ancho/g.pared.alto);
      close(p.pieces.reduce((area,x)=>area+x.wall.w*x.wall.h,0),g.pared.ancho*g.pared.alto,1e-5);
      assert.equal(p.native.screens,g.segments.length);
      assert.deepEqual([...new Set(p.pieces.map(x=>x.screen))].sort((a,b)=>a-b),g.segments.map(x=>x.n));
      for(const x of p.pieces){
        assert.ok([x.width,x.height,x.rotation,...Object.values(x.position)].every(Number.isFinite));
        assert.ok(x.width>0&&x.height>0);
        close(x.width/x.height,x.wall.w/x.wall.h);
        close(x.width/x.wall.w,p.physicalScale);
      }
      for(const s of g.segments){
        const parts=p.pieces.filter(x=>x.screen===s.n).sort((a,b)=>a.wall.x-b.wall.x);
        close(parts[0].wall.x,s.wall.x);close(parts.at(-1).wall.x+parts.at(-1).wall.w,s.wall.x+s.wall.w);
        for(let i=1;i<parts.length;i++)close(parts[i-1].wall.x+parts[i-1].wall.w,parts[i].wall.x);
        const crops=parts.map(x=>screenCrop(x.wall,g.pared,size));
        for(let i=1;i<crops.length;i++)assert.equal(crops[i-1].x+crops[i-1].w,crops[i].x);
        assert.equal(crops.reduce((area,x)=>area+x.w*x.h,0),screenCrop(s.wall,g.pared,size).w*screenCrop(s.wall,g.pared,size).h);
      }
      for(const [axis,dimension] of [['x',p.roomWidth],['y',p.roomHeight],['z',p.roomDepth]]){
        assert.ok(p.bounds.min[axis]>=zone.min[axis]-1e-7&&p.bounds.max[axis]<=zone.max[axis]+1e-7);
        assert.ok(p.bounds.min[axis]>=-1e-7&&p.bounds.max[axis]<=dimension+1e-7);
      }
    }
    assert.equal(JSON.stringify(g),before);
  }
});

test('cube and corner seams retain pixel-U orientation and meet in physical space',()=>{
  const g=twinGeometry({nombre:'custom'},{ancho:1600,alto:600});
  for(const id of ['cubo','esquina']){
    const p=displayPlacementForReference(g,id),parts=p.pieces;
    assert.equal(parts.length,id==='cubo'?4:2);
    for(let i=1;i<parts.length;i++){
      const a=endpoint(parts[i-1],true),b=endpoint(parts[i],false);
      close(a.x,b.x);close(a.y,b.y);close(a.z,b.z);
    }
    if(id==='cubo'){
      const a=endpoint(parts.at(-1),true),b=endpoint(parts[0],false);
      close(a.x,b.x);close(a.z,b.z);
      assert.deepEqual(parts.map(x=>x.face),[0,1,2,3]);
      assert.equal(p.reference.definition.limits.confirmedNet,false);
      close(parts[0].width/parts[0].height,400/600);
      assert.notEqual(parts[0].width,parts[0].height);
    }else {
      assert.equal(parts[1].rotation,-Math.PI/2);
      assert.equal(parts[1].flipU,false);
    }
  }
});

test('concave corner normals face its interior observer without requiring back-side rendering',()=>{
  const g=twinGeometry({nombre:'HORIZONTAL'},{ancho:1920,alto:1080}),
    p=displayPlacementForReference(g,'esquina'),distance=3/Math.sqrt(2),
    eye={x:p.bounds.max.x-distance,y:1.65,z:p.bounds.min.z+distance};
  assert.equal(p.reference.definition.mount.interior,true);
  assert.equal(p.reference.definition.mount.observationSide,'negative_x_positive_z');
  assert.deepEqual(p.reference.definition.mount.faceNormals,[{x:0,y:0,z:1},{x:-1,y:0,z:0}]);
  for(const piece of p.pieces){
    const normal={x:Math.sin(piece.rotation),z:Math.cos(piece.rotation)},
      toEye={x:eye.x-piece.position.x,z:eye.z-piece.position.z};
    // Positive dot product proves that the front face, not a back-cull
    // workaround, is visible from the interior bisector.
    assert.ok(normal.x*toEye.x+normal.z*toEye.z>0);
    if(piece.face===1){close(normal.x,-1);close(normal.z,0);}
    else {close(normal.x,0);close(normal.z,1);}
  }
  const returnFace=p.pieces.find(piece=>piece.face===1),
    outside={x:p.bounds.max.x+distance,z:p.bounds.min.z+distance},
    normal={x:Math.sin(returnFace.rotation),z:Math.cos(returnFace.rotation)};
  assert.ok(normal.x*(outside.x-returnFace.position.x)+normal.z*(outside.z-returnFace.position.z)<0,
    'an exterior observer sees the back of the return face, which must stay culled');
});

test('counter tablet is compact while vertical display and mural remain properly scaled',()=>{
  const tablet=formats.find(f=>f.id==='cliente-07'),vertical=formats.find(f=>f.id==='cliente-01');
  const t=displayPlacementForReference(geometry(tablet),'mostrador',{formatId:tablet.id});
  const v=displayPlacementForReference(geometry(vertical),'mostrador',{formatId:vertical.id});
  close(t.height,.27);close(t.width,.2025);close(v.height,1.55);assert.ok(v.width<1.2);
  const large=formats.find(f=>f.id==='cliente-esp-4');
  const wall=displayPlacementForReference(geometry(large),'mural',{formatId:large.id});
  close(wall.width,7.3);assert.equal(wall.pieces.length,15);assert.equal(wall.roomWidth,8);
});

test('invalid or incomplete geometry fails instead of losing or duplicating pixels',()=>{
  const g=twinGeometry({nombre:'custom'},{ancho:1600,alto:600});
  assert.throws(()=>displayPlacementForReference({...g,pared:{ancho:NaN,alto:600}},'mural'),/invalid-wall/);
  assert.throws(()=>displayPlacementForReference({...g,segments:[]},'mural'),/invalid-wall/);
  assert.throws(()=>displayPlacementForReference({...g,segments:[{n:1,wall:{x:0,y:0,w:800,h:600}}]},'mural'),/incomplete-wall/);
  assert.throws(()=>displayPlacementForReference({...g,segments:[{n:1,wall:{x:0,y:0,w:800,h:600}},{n:2,wall:{x:0,y:0,w:800,h:600}}]},'mural'),/overlapping-segments/);
  assert.throws(()=>displayPlacementForReference(g,'invalid'),/invalid-reference/);
});

test('corner faces and forward-mounted feet clear the verified Best counter, POS and counter display',()=>{
  // World AABBs measured from the exact published GLB, including all semantic
  // root children, after architectural floor-origin normalization. The test
  // binds this regression evidence to its immutable asset digest.
  assert.equal(TWIN_BEST_REFERENCE.sha256,'77b4f4c7346c0dacf22c3d8573f1d80536d367d3b64874115443c1b420edbb85');
  const fixtures=[
    {name:'mostrador',min:{x:2,y:0,z:1.4000000059604645},max:{x:5,y:1.050000000745058,z:2.1100000189617276}},
    {name:'tpv',min:{x:4.449999898672104,y:1.0499999523162842,z:1.6200000047683716},max:{x:4.749999910593033,y:1.1729999571107328,z:1.8700000047683716}},
    {name:'pantalla-mostrador',min:{x:3.240000009536743,y:1.0499999523162842,z:1.8499999679625034},max:{x:3.759999990463257,y:1.5200000405311584,z:1.9699999652802944}},
  ];
  const intersects=(a,b)=>['x','y','z'].every(axis=>a.min[axis]<=b.max[axis]&&a.max[axis]>=b.min[axis]);
  const centredBox=(position,w,h,d)=>({min:{x:position.x-w/2,y:position.y-h/2,z:position.z-d/2},max:{x:position.x+w/2,y:position.y+h/2,z:position.z+d/2}});
  for(const f of formats){
    const p=displayPlacementForReference(geometry(f),'esquina',{formatId:f.id}),supports=p.reference.definition.supports;
    assert.equal(p.reference.definition.mount.front,2.15);assert.ok(p.width<=4.4);assert.equal(supports.postOffsetZ,.24);
    for(const fixture of fixtures){
      assert.equal(intersects(p.reference.definition.mount.zone,fixture),false,`${f.id} reserved zone / ${fixture.name}`);
      for(const piece of p.pieces){
        const w=piece.width+.022,h=piece.height+.022,d=.06,
          cos=Math.abs(Math.cos(piece.rotation)),sin=Math.abs(Math.sin(piece.rotation)),
          frame=centredBox(piece.position,cos*w+sin*d,h,sin*w+cos*d);
        assert.equal(intersects(frame,fixture),false,`${f.id} display face / ${fixture.name}`);
      }
      const b=p.bounds,c=p.centre,xs=b.max.x-b.min.x<1.5?[c.x]:[b.min.x+.12,b.max.x-.12],z=b.min.z+supports.postOffsetZ;
      for(const x of xs){
        const post=centredBox({x,y:b.min.y/2,z},.07,b.min.y,.07),
          foot=centredBox({x,y:.025,z},.45,.05,supports.footDepth);
        assert.equal(intersects(post,fixture),false,`${f.id} stand / ${fixture.name}`);
        assert.equal(intersects(foot,fixture),false,`${f.id} foot / ${fixture.name}`);
        for(const object of [post,foot])for(const [axis,dimension] of [['x',p.roomWidth],['y',p.roomHeight],['z',p.roomDepth]]){
          assert.ok(object.min[axis]>=0&&object.max[axis]<=dimension,`${f.id} stand remains in room`);
        }
      }
    }
  }
});
