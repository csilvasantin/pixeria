import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {onRequestPost} from '../functions/stock-publish.js';
const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
test('Stock combines search terms, accents and music aliases without requiring literal adjacent words',()=>{
 const scope=vm.createContext({});vm.runInContext(fs.readFileSync(new URL('../assets/stock-search.js',import.meta.url),'utf8'),scope);const {matches}=scope.AdmiraStockSearch;
 const p={title:'Selección del año',comment:'',tags:['música','1982','canción']};assert.ok(matches(p,'music 1982'));assert.ok(matches(p,'#musica #1982'));assert.ok(matches(p,'songs 1982'));assert.ok(!matches(p,'music 1981'));assert.ok(matches({comment:'music top songs 1982'},'music 1982'));
});
test('import starts in video while an explicit audio choice remains available; description and samples reach publish',()=>{
 assert.match(app,/videoDefault\.checked = true/);assert.match(app,/name="import-fmt"\]:checked'\)\?\.value \|\| 'video'/);
 assert.match(app,/let sourceDescription = '';\s*while \(true\)/);assert.match(app,/description:sourceDescription/);assert.match(app,/payload.analysisFrames = await sampleImportVideo\(meta.url\)/);
 const root=new URL('../',import.meta.url);let copies=0;
 function walk(dir){for(const ent of fs.readdirSync(dir,{withFileTypes:true})){if(['.git','node_modules','.wrangler'].includes(ent.name))continue;const p=new URL(ent.name+(ent.isDirectory()?'/':''),dir);if(ent.isDirectory())walk(p);else if(ent.name.endsWith('.html')){const s=fs.readFileSync(p,'utf8');if(!s.includes('name="import-fmt"'))continue;assert.doesNotMatch(s,/name="import-fmt" value="audio" checked/);assert.match(s,/name="import-fmt" value="video" checked/);copies++;}}}walk(root);assert.equal(copies,18);
});
test('same-domain staged proxy preserves bounded search evidence and rejects non-image samples',async()=>{
 const fetchOriginal=globalThis.fetch;let payload;globalThis.fetch=async(url,options)=>{payload=JSON.parse(options.body);return new Response(JSON.stringify({ok:true,id:'test'}),{headers:{'Content-Type':'application/json'}});};
 try{const body={type:'video',motor:'yt-dlp',mime:'video/mp4',r2Staged:'uploads/abcdef-12345.mp4',comment:'music top songs 1982',searchContext:{version:1,description:'a'.repeat(5000)},analysisFrames:['data:image/jpeg;base64,/9j/AAAA','data:text/html;base64,AAAA','data:image/jpeg;base64,'+'a'.repeat(300000)]};const r=await onRequestPost({request:new Request('https://admira.studio/stock-publish',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),env:{}});assert.equal(r.status,200);assert.equal(payload.searchContext.description.length,4000);assert.equal(payload.analysisFrames.length,1);assert.equal(payload.comment,body.comment);assert.equal(payload.routingTags,undefined);}finally{globalThis.fetch=fetchOriginal;}
});
