import test from 'node:test';
import assert from 'node:assert/strict';
import {isXpace,blendFor,xpacePoster} from '../assets/xpaces/catalog.mjs';
const glb={id:'g',tags:['3D'],mime:'model/gltf-binary',ext:'bin',externalRef:'family'};
test('only tagged GLB assets become Xpaces, including binary Stock storage',()=>{
 assert.equal(isXpace(glb),true);
 for(const item of [{...glb,tags:[]},{...glb,mime:'application/x-blender'},{...glb,mime:'image/png'}])assert.equal(isXpace(item),false);
 assert.equal(isXpace({...glb,mime:'application/octet-stream',ext:'glb'}),true);
});
test('download links require the same explicit family, never another model',()=>{
 const blend={id:'b',mime:'application/x-blender',externalRef:'family'};
 assert.equal(blendFor(glb,[glb,blend]).id,'b');
 assert.equal(blendFor(glb,[{...blend,externalRef:'other'}]),null);
 assert.equal(blendFor(glb,[blend,{...blend,id:'ambiguous'}]),null);
 assert.equal(blendFor({...glb,id:'1790365002072-l9tpjw'},[{...blend,id:'1790365036008-xn4dg1'}]).id,'1790365036008-xn4dg1');
});
test('posters use asset renders and support the verified Xtanco delivery',()=>{
 assert.equal(xpacePoster({...glb,poster:'render.png'},[]),'render.png');
 assert.equal(xpacePoster(glb,[{type:'image',externalRef:'family',title:'Isométrica',url:'iso.png'}]),'iso.png');
 assert.match(xpacePoster({id:'1790365002072-l9tpjw'},[]),/1790364854974-klpanl$/);
});
