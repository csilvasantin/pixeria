import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import {restrictCatalog,selectionScreens,onRequest,distributionClients} from '../functions/stock-playlists.js';import {handleAuth} from '../functions/_auth.js';
import {createHmac} from 'node:crypto';
const D=createRequire(import.meta.url)('../assets/stock-destinations.js');
const rows=[{project:'starbucks',projectName:'Starbucks',circuit:'es',circuitName:'España',location:'paseo103',locationName:'Paseo de Gracia 103',screen:'iphone17-mupi',deviceName:'iPhone'},{project:'starbucks',circuit:'es',location:'paseo103',screen:'ipad-admin-mupi'},{project:'starbucks',circuit:'mx',location:'roma',screen:'mx-player'},{project:'sneakerstore',circuit:'es',location:'store1',screen:'sneaker-player'}];
const data={ok:true,rows,assignments:[{id:'default:iphone17-mupi',project:'starbucks',projectName:'Starbucks',name:'starbucks.xpacio.hilomusical',circuit:'es',locationName:'Paseo de Gracia 103',deviceName:'iPhone',screen:'iphone17-mupi',stockIds:['song1']},{id:'default:sneaker-player',project:'sneakerstore',name:'SneakerStore',stockIds:['song1']}]};
test('jerarquía: proyecto → circuito → ubicación → dispositivo; cada cambio limita el conjunto',()=>{
 assert.equal(D.projects(data).length,2);assert.deepEqual(D.circuits(data,{project:'starbucks'}).map(x=>x.id),['es','mx']);
 const s={project:'starbucks',circuit:'es',location:'paseo103',device:'iphone17-mupi'};assert.deepEqual(D.screensFor(data,s),['iphone17-mupi']);assert.deepEqual(selectionScreens(rows,s),['iphone17-mupi']);
 assert.deepEqual(new Set(D.screensFor(data,{project:'starbucks',circuit:'es',location:'paseo103'})),new Set(['iphone17-mupi','ipad-admin-mupi']));
 assert.deepEqual(D.screensFor(data,{}),[]);assert.deepEqual(D.screensFor(data,{project:'starbucks',device:'iphone17-mupi'}),[]);assert.deepEqual(D.screensFor(data,{project:'starbucks',circuit:'mx',location:'paseo103',device:'iphone17-mupi'}),[]);
});
test('cuenta asignada sólo ve proyectos y pertenencias autorizados, aunque el mismo asset sea de varias listas',()=>{
 const d=restrictCatalog(data,['starbucks']);assert.ok(d.rows.every(r=>r.project==='starbucks'));assert.equal(D.memberships(d,'song1').length,1);assert.match(D.membershipText(d,'song1'),/starbucks.xpacio.hilomusical.*Paseo de Gracia 103.*iPhone/);assert.deepEqual(restrictCatalog(data,[]).rows,[]);assert.equal(restrictCatalog(data,null),data);
});
const token='agent-test-token-at-least-32-characters';const env={PIXERIA_SIGNING_KEY:'test-signing-key-with-enough-entropy',ADMIRA_AGENT_LOGIN_TOKEN:token,STOCK_NOTIFY_KEY:'server-only'};
async function cookie(){const r=await handleAuth(new Request('https://www.pixeria.com/auth/agente',{method:'POST',headers:{Authorization:'Bearer '+token,'X-Agente':'TrinityMBP14'}}),env);assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];}
test('proxy requiere sesión, conserva secreto en servidor y deriva destinos sin aceptar pantallas arbitrarias',async t=>{
 let calls=[];t.mock.method(globalThis,'fetch',async(url,init={})=>{calls.push({url,init});return Response.json(init.method==='POST'?{ok:true,results:[{screen:'iphone17-mupi',added:1}]}:data);});
 const base='https://www.pixeria.com/stock-playlists';assert.equal((await onRequest({request:new Request(base),env})).status,401);assert.equal(calls.length,0);
 const c=await cookie();const g=await onRequest({request:new Request(base,{headers:{Cookie:c}}),env});const read=await g.json();assert.equal(read.superuser,true);assert.equal(JSON.stringify(read).includes('server-only'),false);assert.equal(calls[0].init.headers['X-Notify-Key'],'server-only');
 const req=(selection,origin='https://www.pixeria.com')=>new Request(base,{method:'POST',headers:{Cookie:c,Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({selection,stockIds:['song2'],screens:['sneaker-player']})});
 assert.equal((await onRequest({request:req({project:'starbucks',circuit:'es',location:'paseo103',device:'iphone17-mupi'}),env})).status,200);
 const write=calls.find(c=>c.init.method==='POST');assert.deepEqual(JSON.parse(write.init.body).screens,['iphone17-mupi']);
 assert.equal((await onRequest({request:req({project:'starbucks'},'https://evil.example'),env})).status,403);
 assert.equal((await onRequest({request:req({project:'starbucks',circuit:'mx',location:'paseo103'}),env})).status,400);
});
test('distribución exige asignaciones explícitas: un fallo de directorio nunca concede alcance global',async t=>{
 const session={email:'ordinary@example.com'};
 await assert.rejects(()=>distributionClients(session,{}),/permissions_unavailable/);
 const db=keys=>({prepare(sql){return {bind(){return this;},first:async()=>({role:'user',account_kind:'team'}),all:async()=>({results:keys.map(project_key=>({project_key}))})};}});
 assert.deepEqual(await distributionClients(session,{AUTH_DB:db([])}),[]);
 assert.deepEqual(await distributionClients(session,{AUTH_DB:db(['commercial:starbucks'])}),['starbucks']);
 let upstream=0;t.mock.method(globalThis,'fetch',async()=>{upstream++;return Response.json({emails:[session.email]});});
 const now=Math.floor(Date.now()/1000),payload=Buffer.from(JSON.stringify({aud:'pixeria.com',email:session.email,sub:'ordinary-sub',sv:1,iat:now,exp:now+600})).toString('base64url');
 const signed=payload+'.'+createHmac('sha256',env.PIXERIA_SIGNING_KEY).update('px:'+payload).digest('base64url');
 const AUTH_DB={prepare(sql){return {bind(){return this;},run:async()=>({success:true}),first:async()=>{if(sql.includes('SELECT * FROM pixeria_users'))return {email:session.email,status:'active',session_version:1};throw Error('directory down');}};}};
 const r=await onRequest({request:new Request('https://www.pixeria.com/stock-playlists',{method:'POST',headers:{Cookie:'__Host-pixeria_session='+signed,Origin:'https://www.pixeria.com','Content-Type':'application/json'},body:JSON.stringify({selection:{project:'starbucks'},stockIds:['song1']})}),env:{...env,AUTH_DB}});
 assert.equal(r.status,503);assert.equal((await r.json()).error,'permissions_unavailable');assert.equal(upstream,1); // Sólo allowlist de sesión; ninguna llamada a TV.
});
