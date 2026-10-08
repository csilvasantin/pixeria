import test from 'node:test';
import assert from 'node:assert/strict';
import {readMediaDimensions} from '../assets/content-orientation.mjs';
async function media(type,{width=864,height=1152,fail=false,stall=false}={}){
 const old={Image:globalThis.Image,document:globalThis.document};let cleared=0,loads=0;
 class Element{naturalWidth=width;naturalHeight=height;videoWidth=width;videoHeight=height;set src(value){if(stall)return;queueMicrotask(()=>fail?this.onerror?.():type==='image'?this.onload?.():this.onloadedmetadata?.());}removeAttribute(){cleared++;}load(){loads++;}}
 globalThis.Image=Element;globalThis.document={createElement:()=>new Element()};
 try{const result=await readMediaDimensions('data:fixture',type,{timeout:5});return {result,cleared,loads};}finally{Object.assign(globalThis,old);}
}
test('image dimensions preserve portrait, landscape and square geometry and release the source',async()=>{
 for(const [width,height] of [[864,1152],[1280,720],[1080,1080]]){const r=await media('image',{width,height});assert.deepEqual(r.result,{width,height});assert.equal(r.cleared,1);}
});
test('video uses displayed metadata and cleans up; failures/timeouts never guess',async()=>{
 assert.deepEqual((await media('video',{width:1080,height:1920})).result,{width:1080,height:1920});
 assert.equal((await media('video',{fail:true})).result,null);assert.equal((await media('image',{stall:true})).result,null);
 assert.equal((await media('image',{width:0})).result,null);assert.equal(await readMediaDimensions('audio.mp3','audio'),null);
});
