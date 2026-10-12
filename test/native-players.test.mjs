import test from 'node:test';import assert from 'node:assert/strict';
import {parseAndroid,runAndroid} from '../suite/demo-android.mjs';
import {parseIOS} from '../suite/demo-ios.mjs';
test('exact Android commands, case and optional selector',()=>{
 assert.equal(parseAndroid('/demo android').device,'both');assert.equal(parseAndroid('/demo android Fold8').device,'fold');assert.equal(parseAndroid('/demo Android WATCH').device,'watch');
 assert.deepEqual(parseAndroid('/demo android Fold8 #música #retail').selector,{kind:'tags',tags:['música','retail']});
 assert.deepEqual(parseAndroid('/demo android watch "Starbucks Audio"').selector,{kind:'playlist',name:'Starbucks Audio'});
});
test('reject cross platform and multiple device selectors',()=>{for(const s of ['Fold8 watch','watch Fold8','iphone','ios'])assert.throws(()=>parseAndroid('/demo android '+s));});
test('iOS commands preserved and Android never intercepted by iOS',()=>{assert.equal(parseIOS('/demo ios watch').device,'watch');assert.equal(parseIOS('/demo android'),null);assert.equal(parseAndroid('/demo ios'),null);});
test('project is mandatory, no global playlist substitution',async()=>{
 const root={location:{href:'https://www.admira.biz/'},document:{querySelector:()=>null}};
 await assert.rejects(runAndroid('/demo android',root),/proyecto/);
});
test('dispatch declarative Android URL with real project context',async()=>{
 let assigned;const root={location:{href:'https://www.admira.biz/?project=starbucks',assign:v=>assigned=v},document:{querySelector:()=>null}};
 const result=await runAndroid('/demo android Fold8',root);assert.equal(result.project,'starbucks');
 const req=JSON.parse(Buffer.from(new URL(assigned).searchParams.get('request'),'base64url').toString());
 assert.equal(new URL(assigned).protocol,'admira-android-demo:');assert.equal(req.model,'Fold8');assert.equal(req.platform,'android');assert.equal(req.device,'fold');
});
test('shared active project provider wins over URL context',async()=>{
 let assigned;const root={location:{href:'https://www.admira.biz/?project=old',assign:v=>assigned=v},document:{querySelector:()=>null},AdmiraAndroidDemoContext:()=>({project:'active',playlistIds:['one']})};
 assert.equal((await runAndroid('/demo android watch',root)).project,'active');
 assert.deepEqual(JSON.parse(Buffer.from(new URL(assigned).searchParams.get('request'),'base64url')).playlistIds,['one']);
});

import {readFileSync} from 'node:fs';
import {onRequest} from '../functions/_middleware.js';
test('actual Pixeria loader uses the local shared engine, not a second parser',()=>{
 const source=readFileSync(new URL('../assets/site-nav.js',import.meta.url),'utf8');
 assert.ok(source.includes("ax.src = '/suite/experto.js?v=20261012-native-demo-r1'"));
 assert.ok(!source.includes('https://www.admiranext.com/suite/experto.js'));
 const cli=readFileSync(new URL('../assets/expert-cli.js',import.meta.url),'utf8');
 assert.ok(cli.includes('window.AdmiraExperto.exec(command,log)'));
});
test('Help, MCP and native guide retain server-side session protection even for curl',async()=>{
 for(const path of ['/help/?project=starbucks','/mcp/?project=starbucks','/creador/?project=starbucks','/docs/native-players.md']){
  const response=await onRequest({request:new Request('https://www.pixeria.com'+path),env:{},next:async()=>new Response('must not render')});
  assert.equal(response.status,302,path);assert.match(response.headers.get('location'),/^\/auth\/login\?/);
 }
});
test('query cannot override the actual selected project and general never falls back',async()=>{
 const root={location:{href:'https://www.pixeria.com/?project=starbucks',assign:()=>{}},document:{querySelector:()=>({value:'actual-project'})}};
 assert.equal((await runAndroid('/demo android',root)).project,'actual-project');
 root.document.querySelector=()=>({value:'general'});
 await assert.rejects(runAndroid('/demo android',root),/proyecto/);
});
