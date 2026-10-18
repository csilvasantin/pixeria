import test from 'node:test';import assert from 'node:assert/strict';
import {parseImportCommand,publicImportURL,importIdentity} from '../assets/creativo-import-core.mjs';
import {importRelay} from '../functions/creativo-import/[action].js';
import {runImport,readImportBlob} from '../assets/creativo-import.mjs';
test('import and raw URL accept literal URL queries and optional audio, without parsing lyrics as commands',async()=>{assert.equal(parseImportCommand('/importar https://www.youtube.com/watch?v=abc&list=xyz').url,'https://www.youtube.com/watch?v=abc&list=xyz');assert.equal(parseImportCommand('https://cdn.example.test/a.mp3').format,'audio');assert.equal(parseImportCommand('/import "https://youtu.be/abc" audio').format,'audio');assert.equal(parseImportCommand('crear locución "https://example.test/a.mp3" chica esp'),null);assert(parseImportCommand('/importar').help);assert.equal(await importIdentity(parseImportCommand('https://example.test/a.mp4#t=2')),await importIdentity(parseImportCommand('/importar https://example.test/a.mp4')));});
test('non-public, credential, unsupported scheme and multiple URL input cannot import',()=>{for(const url of ['file:///tmp/a','javascript:alert(1)','https://user:pass@example.test/a.mp3','http://127.0.0.1/a.mp4','https://localhost/a','https://example.local/a','https://[::1]/a','https://example.test:8000/a'])assert.throws(()=>publicImportURL(url));assert.throws(()=>parseImportCommand('/importar https://a.test/a.mp4 https://b.test/b.mp4'));});
function context(action,body,query='',origin='https://admira.studio'){return {request:new Request('https://admira.studio/creativo-import/'+action+query,{method:body?'POST':'GET',headers:{Origin:origin},...(body?{body:JSON.stringify(body)}:{})}),env:{},params:{action}};}
const allowed=async()=>({email:'user@example.test'});
test('Tube relay requires existing session, validates fixed nodes, methods, origins and job references',async()=>{let calls=0;const fetcher=async()=>{calls++;return Response.json({ok:true});};assert.equal((await importRelay(context('health'),fetcher,async()=>null)).status,401);for(const c of [context('start',{url:'http://127.0.0.1/a',format:'video'}),context('start',{url:'https://example.test/a',format:'video'}),context('status',null,'?id=../secret'),context('get',null,'?node=https://evil.test&id=abc')])assert.equal((await importRelay(c,fetcher,allowed)).status,400);assert.equal((await importRelay(context('start',{url:'https://youtu.be/abc',format:'video'},'','https://evil.test'),fetcher,allowed)).status,403);assert.equal(calls,0);});
test('social import relay forwards one start with exact URL and streams binary get without parsing it as JSON',async()=>{let calls=[];const fetcher=async(url,init)=>{calls.push({url,init});return url.includes('/get?')?new Response('media',{headers:{'Content-Type':'video/mp4','X-Tube-Title':'Test'}}):Response.json({jobId:'job-one'});};await importRelay(context('start',{url:'https://youtu.be/abc',format:'video'},'?node=1'),fetcher,allowed);assert.equal(calls[0].url,'https://macbook-pro-16.tail48b61c.ts.net/admira/tube/start');assert.deepEqual(JSON.parse(calls[0].init.body),{url:'https://youtu.be/abc',format:'video'});assert(!calls[0].init.headers.Authorization);const binary=await importRelay(context('get',null,'?id=job-one'),fetcher,allowed);assert.equal(await binary.text(),'media');assert.equal(binary.headers.get('Content-Type'),'video/mp4');});
function memory(job){let saved={...job},blob;return {async get(){return {...saved};},async move(id,states,patch,media){if(!states.includes(saved.state))return null;saved={...saved,...patch};if(media)blob=media;return {...saved};},async media(){return blob;}};}
const prepared={id:'url-one',url:'https://cdn.example.test/test.png',format:'video',direct:true,state:'prepared'};
test('parallel import runners publish once; completed imports reuse Stock result on reload',async()=>{const repository=memory(prepared);let posts=0;const options={fetcher:async(url)=>{if(url==='/stock-publish'){posts++;return Response.json({ok:true,id:'stock-one'});}return new Response('png-bytes',{headers:{'Content-Type':'image/png'}});},dimensions:async()=>null,source:async()=>({ok:true,fields:{base64:'bytes'}})};await Promise.all([runImport(prepared,repository,options),runImport(prepared,repository,options)]);const saved=await repository.get();assert.equal(saved.state,'complete');await runImport(saved,repository,options);assert.equal(posts,1);});
test('uncertain publication never automatically retries and HTML cannot be published as media',async()=>{const repository=memory(prepared);let posts=0;const opts={fetcher:async(url)=>{if(url==='/stock-publish'){posts++;throw Error('lost-response');}return new Response('image',{headers:{'Content-Type':'image/png'}});},dimensions:async()=>null,source:async()=>({ok:true,fields:{base64:'bytes'}})};await runImport(prepared,repository,opts);const saved=await repository.get();assert.equal(saved.state,'unknown');await runImport(saved,repository,opts);assert.equal(posts,1);const other=memory(prepared);await runImport(prepared,other,{...opts,fetcher:async()=>new Response('<html>',{headers:{'Content-Type':'text/html'}})});assert.equal((await other.get()).state,'failed');});
test('streaming reader enforces upload limit before consuming a large response',async()=>{await assert.rejects(readImportBlob(new Response('large',{headers:{'Content-Length':'100000001'}})),/too-large/);});
function socialFetch({crash=false,losePublish=false}={}){
 const calls=[];let misses=0;
 const fetcher=async(url,init={})=>{
  calls.push({url,method:init.method||'GET'});const node=new URL(url,'https://studio.test').searchParams.get('node');
  if(url.includes('/health'))return Response.json({ok:true});
  if(url.includes('/start'))return Response.json({jobId:'job-'+node});
  if(url.includes('/status')){if(crash&&node==='2'&&++misses<=3)throw Error('primary connection lost');return Response.json({state:'done',title:'Original'});}
  if(url.includes('/get'))return new Response('video',{headers:{'Content-Type':'video/mp4'}});
  if(url==='/stock-publish'){if(losePublish)throw Error('lost acknowledgement');return Response.json({ok:true,id:'one-stock-result'});}
  throw Error('unexpected request');
 };
 return {calls,options:{fetcher,wait:async()=>{},dimensions:async()=>null,sample:async()=>[],source:async()=>({ok:true,fields:{base64:'video'}})}};
}
test('mid-download failover publishes once and reloading the finished job makes no requests',async()=>{
 const job={...prepared,direct:false,url:'https://youtu.be/abc'},repository=memory(job),h=socialFetch({crash:true});
 await runImport(job,repository,h.options);const saved=await repository.get();assert.equal(saved.state,'complete');assert.equal(saved.node,0);assert.equal(saved.stockId,'one-stock-result');
 assert.deepEqual(h.calls.filter(c=>c.url.includes('/start')).map(c=>c.url),['/creativo-import/start?node=2','/creativo-import/start?node=0']);assert.equal(h.calls.filter(c=>c.url==='/stock-publish').length,1);
 const count=h.calls.length;await runImport(saved,repository,h.options);assert.equal(h.calls.length,count);
});
test('reload during download keeps the saved node and only polls that job',async()=>{
 const job={...prepared,direct:false,url:'https://youtu.be/abc',state:'downloading',node:1,jobId:'old-portable-job'},repository=memory(job),h=socialFetch();
 await runImport(job,repository,h.options);assert.equal((await repository.get()).state,'complete');assert(!h.calls.some(c=>c.url.includes('/start')||c.url.includes('/health')));assert(h.calls.filter(c=>c.url.includes('/status')||c.url.includes('/get')).every(c=>c.url.includes('node=1')));
});
test('uncertain Stock publication after failover is never retried automatically',async()=>{
 const job={...prepared,direct:false,url:'https://youtu.be/abc'},repository=memory(job),h=socialFetch({crash:true,losePublish:true});
 await runImport(job,repository,h.options);const saved=await repository.get();assert.equal(saved.state,'unknown');const count=h.calls.length;await runImport(saved,repository,h.options);assert.equal(h.calls.length,count);assert.equal(h.calls.filter(c=>c.url==='/stock-publish').length,1);
});
test('lost download start can fall back, while legacy unknown jobs remain untouched',async()=>{
 const job={...prepared,direct:false,url:'https://youtu.be/abc'},repository=memory(job),h=socialFetch(),fetcher=async(u,i)=>{if(u==='/creativo-import/start?node=2')throw Error('lost start reply');return h.options.fetcher(u,i);};
 await runImport(job,repository,{...h.options,fetcher});assert.equal((await repository.get()).state,'complete');assert.equal((await repository.get()).node,0);
 const legacy=memory({...job,state:'unknown'});const count=h.calls.length;await runImport(await legacy.get(),legacy,h.options);assert.equal(h.calls.length,count);
});
test('relay preserves old node numbers and adds Studio without arbitrary hosts',async()=>{
 const nodes=['macmini','macbook-pro-16','macstudio'];
 for(let n=0;n<3;n++){let seen;const response=await importRelay(context('health',null,'?node='+n),async u=>{seen=u;return Response.json({ok:true});},allowed);assert.equal(response.status,200);assert.equal(seen,'https://'+nodes[n]+'.tail48b61c.ts.net/admira/tube/health');}
 assert.equal((await importRelay(context('health',null,'?node=3'),async()=>{throw Error('must not fetch');},allowed)).status,400);
});
