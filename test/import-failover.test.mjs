import test from 'node:test';
import assert from 'node:assert/strict';
import {downloadWithFailover,readImportMedia} from '../assets/import-failover.mjs';
const nodes=[{id:2,kind:'studio',base:'https://studio.test/tube'},{id:0,kind:'mini',base:'https://mini.test/tube'}];
const media=()=>new Response('complete-video',{headers:{'Content-Type':'video/mp4','Content-Length':'14'}});
function harness(fault=()=>{}){
 const calls=[],saves=[],events=[];
 const fetcher=async(url,init={})=>{
  const u=new URL(url),action=u.pathname.split('/').pop();calls.push({host:u.hostname,action,method:init.method||'GET'});
  const injected=await fault({url:u,action,init,calls});if(injected)return injected;
  if(action==='health')return Response.json({ok:true});
  if(action==='start')return Response.json({jobId:u.hostname.split('.')[0]+'-job'});
  if(action==='status')return Response.json({state:'done',title:'Same original'});
  if(action==='get')return media();throw Error('unexpected request');
 };
 return {calls,saves,events,options:{url:'https://youtu.be/example',nodes,fetcher,save:async x=>saves.push(x),onProgress:x=>events.push(x),wait:async()=>{},pollMs:1,healthMs:100,requestMs:100,idleMs:100}};
}
test('an unavailable first node hands over in either direction, with one complete result',async()=>{
 for(const ordered of [nodes,[...nodes].reverse()]){
  const first=new URL(ordered[0].base).hostname;
  const h=harness(({url})=>{if(url.hostname===first)throw TypeError('network offline');});
  const out=await downloadWithFailover({...h.options,nodes:ordered});assert.equal(out.node,ordered[1].id);assert.equal(await out.blob.text(),'complete-video');
  assert.equal(h.calls.filter(c=>c.action==='start').length,1);assert(h.events.some(e=>e.phase==='switching'));
 }
});
test('crash after start and loss of its reply can restart only the download elsewhere',async()=>{
 for(const failure of ['lost-start','poll-crash','remote-error','missing-job']){
  const h=harness(({url,action})=>{
   if(url.hostname!=='studio.test')return;
   if(action==='start'&&failure==='lost-start')throw TypeError('reply lost');
   if(action==='status'){
    if(failure==='poll-crash')throw TypeError('connection reset');
    if(failure==='remote-error')return Response.json({state:'error',error:'downloader failed'});
    if(failure==='missing-job')return new Response('',{status:404});
   }
  });
  const out=await downloadWithFailover(h.options);assert.equal(out.node,0);assert.equal(h.calls.filter(c=>c.action==='start').length,2);
  assert(h.saves.some(s=>s.node===2&&s.jobId==='studio-job')||failure==='lost-start');assert(h.saves.some(s=>s.failedNodes.includes(2)));
 }
});
test('one lost status request does not switch machines or restart the job',async()=>{
 let misses=0;const h=harness(({action})=>{if(action==='status'&&++misses===1)throw TypeError('one packet lost');});
 const out=await downloadWithFailover(h.options);assert.equal(out.node,2);assert.equal(h.calls.filter(c=>c.action==='start').length,1);assert(!h.events.some(e=>e.phase==='switching'));
});
test('a saved job is polled on its original machine after reload without another start',async()=>{
 const h=harness();const out=await downloadWithFailover({...h.options,resume:{node:0,jobId:'saved-mini-job'}});
 assert.equal(out.node,0);assert.deepEqual(h.calls.map(c=>c.action),['status','get']);assert(h.calls.every(c=>c.host==='mini.test'));
});
test('after reload a recovered node can take over even if it failed in an earlier attempt',async()=>{
 const h=harness(({url})=>{if(url.hostname==='mini.test')throw TypeError('mini now offline');});
 const out=await downloadWithFailover({...h.options,resume:{node:0,jobId:'old-mini-job',failedNodes:[2]}});
 assert.equal(out.node,2);assert.equal(h.calls.filter(c=>c.action==='start').length,1);
});
test('a broken or truncated media stream is discarded and replaced by a complete backup',async()=>{
 for(const truncated of [true,false]){
  const h=harness(({url,action})=>{
   if(url.hostname!=='studio.test'||action!=='get')return;
   if(truncated)return new Response('partial',{headers:{'Content-Type':'video/mp4','Content-Length':'14'}});
   let reads=0;return new Response(new ReadableStream({pull(c){if(++reads===1)c.enqueue(new TextEncoder().encode('partial'));else c.error(Error('socket closed'));}}),{headers:{'Content-Type':'video/mp4'}});
  });
  const out=await downloadWithFailover(h.options);assert.equal(out.node,0);assert.equal(await out.blob.text(),'complete-video');
 }
});
test('a stalled status or media stream has a bounded wait before switching',async()=>{
 for(const action of ['status','get']){
  const h=harness(({url,action:current})=>{if(url.hostname==='studio.test'&&current===action){if(action==='status')return new Promise(()=>{});return new Response(new ReadableStream({pull(){return new Promise(()=>{});}}),{headers:{'Content-Type':'video/mp4'}});}});
  const out=await downloadWithFailover({...h.options,requestMs:5,idleMs:5,statusFailures:1});assert.equal(out.node,0);
 }
});
test('invalid input, lost storage, authentication and oversize files never enter a fallback loop',async()=>{
 const bad=harness(({action})=>action==='start'?new Response('',{status:400}):null);
 await assert.rejects(downloadWithFailover(bad.options),/http-400/);assert(bad.calls.every(c=>c.host==='studio.test'));
 const auth=harness(({action})=>action==='health'?new Response('',{status:401}):null);
 await assert.rejects(downloadWithFailover(auth.options),/http-401/);assert.equal(auth.calls.length,1);
 const storage=harness();await assert.rejects(downloadWithFailover({...storage.options,save:async()=>{throw Error('disk full');}}),/storage/);assert(!storage.calls.some(c=>c.action==='start'));
 const large=harness();await assert.rejects(downloadWithFailover({...large.options,maxBytes:5}),/too-large/);assert.equal(large.calls.filter(c=>c.action==='start').length,1);
});
test('all nodes down leaves a recoverable journal; an explicit retry can use them again',async()=>{
 const h=harness(()=>{throw TypeError('offline');});await assert.rejects(downloadWithFailover(h.options),/offline/);
 const last=h.saves.at(-1);assert(last.exhausted);assert.deepEqual(last.failedNodes,[2,0]);
 const healthy=harness();const out=await downloadWithFailover({...healthy.options,resume:last});assert.equal(out.node,2);
});
test('HTML, empty and incomplete files cannot be returned as successful media',async()=>{
 await assert.rejects(readImportMedia(new Response('<html>',{headers:{'Content-Type':'text/html'}})),/not-media/);
 await assert.rejects(readImportMedia(new Response('',{headers:{'Content-Type':'video/mp4'}})),/truncated/);
});
