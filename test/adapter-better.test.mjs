import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {twinGeometry,previewSize,screenCrop} from '../adaptaciones/gemelo-core.mjs';
import {displayPlacement,observerPoint,TWIN_REFERENCE} from '../adaptaciones/gemelo-reference.mjs';
import {normalizeObservation} from '../assets/xpaces/engine/life-observation.mjs';
const layouts=JSON.parse(fs.readFileSync(new URL('../adaptaciones/perfil-cliente-especiales.json',import.meta.url))).layouts;
test('Better reference retains the published Xtanco ID and exact inventory hash',()=>{const inventory=JSON.parse(fs.readFileSync(new URL('../assets/xpaces/inventory/xtanco-4380.json',import.meta.url)));assert.equal(TWIN_REFERENCE.assetId,inventory.assetId);assert.equal(TWIN_REFERENCE.sha256,inventory.glbSha256);});
test('flat and folded walls preserve native pixels, individual screen IDs and physical aspect',()=>{
 for(const layout of layouts){const g=twinGeometry({layout},{}),before=JSON.stringify(g),sz=previewSize(g);
  for(const corner of [false,true]){const p=displayPlacement(g,corner);assert.ok(p.width<=5.1);assert.ok(p.height<=1.8+1e-9);assert.ok(Math.abs(p.width/p.height-g.pared.ancho/g.pared.alto)<1e-9);
   assert.equal(p.pieces.reduce((sum,x)=>sum+x.wall.w*x.wall.h,0),g.pared.ancho*g.pared.alto);
   for(const s of g.segments){const parts=p.pieces.filter(x=>x.screen===s.n).map(x=>screenCrop(x.wall,g.pared,sz));for(let i=1;i<parts.length;i++)assert.equal(parts[i-1].x+parts[i-1].w,parts[i].x);assert.equal(parts.reduce((a,x)=>a+x.w*x.h,0),screenCrop(s.wall,g.pared,sz).w*screenCrop(s.wall,g.pared,sz).h);}
   for(const x of p.pieces)if(x.rotation){assert.equal(x.rotation,Math.PI/2);assert.equal(x.flipU,true);}
  }assert.equal(JSON.stringify(g),before);
 }
});
test('single surface can fold without duplicating pixels or changing the source format',()=>{const g=twinGeometry({nombre:'custom'},{ancho:1920,alto:1080}),p=displayPlacement(g,true);assert.equal(p.pieces.length,2);assert.equal(p.pieces[0].screen,p.pieces[1].screen);assert.equal(p.pieces[0].wall.x+p.pieces[0].wall.w,p.pieces[1].wall.x);assert.equal(p.pieces[0].position.x+p.pieces[0].width/2,p.pieces[1].position.x);assert.equal(p.pieces[1].position.z-p.pieces[1].width/2,p.pieces[0].position.z);});
test('human-eye point is fixed in metres; invalid calibration is rejected',()=>{const p=displayPlacement(twinGeometry({nombre:'custom'},{ancho:1920,alto:1080}));const v=normalizeObservation(observerPoint(p));assert.equal(v.position.y,1.65);assert.equal(v.position.z-v.target.z,3);assert.equal(v.fov,55);assert.equal(normalizeObservation(null),null);for(const raw of [{height:NaN},{distance:0},{lateral:3}])assert.throws(()=>observerPoint(p,raw));assert.throws(()=>normalizeObservation({...v,target:v.position}));});
