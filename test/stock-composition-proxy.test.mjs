import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequestPost} from '../functions/stock-publish.js';
import {handleAuth,verifyApiToken} from '../functions/_auth.js';
import {COMPOSITION_SCHEMA} from '../assets/content-composition.mjs';
const body=()=>({type:'video',motor:'adaptador',mime:'video/mp4',base64:'QUJD',validacion:{ancho:1920,alto:1080},composition:{schema:COMPOSITION_SCHEMA,producer:'admira.studio',renderer:'campaign-canvas.v1',mediaType:'video',width:1920,height:1080,complete:true,copy:[{role:'headline',text:'CAFÉ 1,99 €',box:[50,50,400,700]}]}});
const request=(value,headers={})=>new Request('https://preview.pixeria.pages.dev/stock-publish',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(value)});
test('composition proxy requires a real signed session and rejects cross-origin writes before publishing',async t=>{
 const env={PIXERIA_SIGNING_KEY:'fixture-composition-key',ADMIRA_AGENT_LOGIN_TOKEN:'x'.repeat(64)};
 const login=await handleAuth(new Request('https://preview.pixeria.pages.dev/auth/agente',{method:'POST',headers:{Authorization:'Bearer '+env.ADMIRA_AGENT_LOGIN_TOKEN}}),env);
 const cookie=login.headers.get('set-cookie').split(';')[0];let calls=0;
 t.mock.method(globalThis,'fetch',async(url,init)=>{calls++;assert.equal(url,'https://api.admira.store/stock/publish');const identity=await verifyApiToken(init.headers.Authorization.slice(7),env);assert.equal(identity.email,'agentes@silicio.admiranext.com');assert.equal(init.headers.Origin,'https://www.pixeria.com');const value=JSON.parse(init.body);assert.equal(value.composition.copy[0].text,'CAFÉ 1,99 €');assert.equal(value.composition.assetHash,undefined);return Response.json({ok:true,id:'composed'});});
 assert.equal((await onRequestPost({request:request(body()),env})).status,401);
 assert.equal((await onRequestPost({request:request(body(),{Cookie:cookie,Origin:'https://external.example'}),env})).status,403);
 assert.equal(calls,0);
 const input={...body(),composition:{...body().composition,assetHash:'f'.repeat(64),verification:'forged'}};
 assert.equal((await onRequestPost({request:request(input,{Cookie:cookie,Origin:'https://preview.pixeria.pages.dev'}),env})).status,200);assert.equal(calls,1);
});
test('invalid declaration cannot publish, and ordinary imports retain their existing proxy path',async t=>{
 let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;return Response.json({ok:true});});
 assert.equal((await onRequestPost({request:request({...body(),composition:{...body().composition,width:1080}}),env:{}})).status,400);assert.equal(calls,0);
 const value=body();delete value.composition;assert.equal((await onRequestPost({request:request(value),env:{}})).status,200);assert.equal(calls,1);
});
