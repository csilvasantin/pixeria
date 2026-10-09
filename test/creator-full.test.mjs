import test from 'node:test';
import assert from 'node:assert/strict';
import {newFull,runFull} from '../campanas/creador/creator-ai.mjs';
import {createCreatorCampaign,creatorTwinURL} from '../campanas/creador/creator-core.mjs';
import {fullMedia,trustedCreatorURL} from '../campanas/creador/creator-media.mjs';
const c=createCreatorCampaign('0123456789abcdef0123456789abcdef');
const options=request=>({request,persist:async()=>{},checkpoint:async()=>{},alive:()=>true,delay:async()=>{},changed:()=>{}});
test('full pipeline uses the newly archived image and only archived video completion',async()=>{
 const job=newFull(c),calls=[];let polls=0;
 await runFull(job,options(async(action,body)=>{calls.push([action,body]);if(action==='image')return {predictions:[{bytesBase64Encoded:'aW1hZ2U=',mimeType:'image/png'}]};if(action==='archive'){assert.equal(body.image,'data:image/png;base64,aW1hZ2U=');return {ok:true,id:'image-123',url:'https://api.admira.store/stock/asset/image-123'};}if(action==='video'){assert.equal(body.stock_id,'image-123');return {request_id:'request-123'};}return ++polls===1?{status:'done',url:'https://provider.example/temporary.mp4'}:{status:'done',archived:true,id:'video-123',url:'https://api.admira.store/stock/asset/video-123'};}));
 assert.equal(job.phase,'media-ready');assert.equal(polls,2);assert.equal(calls.filter(([a])=>a==='image').length,1);assert.equal(calls.filter(([a])=>a==='video').length,1);assert.equal(job.imageData,undefined);
});
test('an unknown paid request is never retried on resume',async()=>{
 const job=newFull(c);job.phase='video-requested';let calls=0;await runFull(job,options(async()=>{calls++;}));assert.equal(calls,0);assert.equal(job.error,'request-result-unknown');
});
test('a lost image response remains uncertain and cannot be rebilled automatically',async()=>{
 const job=newFull(c);let calls=0;const opt=options(async()=>{calls++;throw Error('lost-reply');});await runFull(job,opt);assert.equal(job.phase,'image-requested');await runFull(job,opt);assert.equal(calls,1);
});
test('stopping after video start retains request id and does not poll',async()=>{
 const job=newFull(c);job.phase='image-archived';job.image={id:'image-123'};let alive=true,calls=0;const opt=options(async()=>{calls++;alive=false;return {request_id:'request-123'};});opt.alive=()=>alive;await runFull(job,opt);assert.equal(calls,1);assert.equal(job.phase,'video-pending');assert.equal(job.request_id,'request-123');
});
test('full twin URL uses asset ids and rejects missing media and hostile URLs',()=>{
 const full={...c,mode:'full',image:{id:'image-123'},video:{id:'video-123'}};const u=new URL(creatorTwinURL(full));assert.equal(u.searchParams.get('image'),'image-123');assert.equal(u.searchParams.get('video'),'video-123');assert.throws(()=>creatorTwinURL({...c,mode:'full'}));assert.equal(trustedCreatorURL('https://attacker.example/a'),null);assert.equal(trustedCreatorURL('https://secret@api.admira.store/a'),null);assert.throws(()=>fullMedia({...full,image:{url:'javascript:alert(1)'},video:{url:'https://api.admira.store/stock/asset/video-123'}}));
});
test('a new seed creates a new image and video brief',()=>{const other=newFull(createCreatorCampaign('fedcba9876543210fedcba9876543210'));const first=newFull(c);assert.notEqual(first.prompts.image,other.prompts.image);assert.notEqual(first.prompts.video,other.prompts.video);});
