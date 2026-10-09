import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,mkdirSync,writeFileSync,copyFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const runtime=read('adaptaciones/adaptaciones.js');
const ids=html=>[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
const required=new Set([...runtime.matchAll(/\$\(['"]#([A-Za-z0-9_-]+)['"]\)/g)].map(m=>m[1]));
const demo=html=>[...html.matchAll(/<script\b[^>]*\bsrc="\/campanas\/creador\/demo\.mjs\?v=[^"]+"[^>]*><\/script>/g)];

for(const prefix of ['','en/'])test(`${prefix||'ES '}Creator shell satisfies the real shared runtime and binds the classic handlers`,()=>{
 const html=read(prefix+'creador/index.html'),all=ids(html),present=new Set(all);
 assert.equal(all.length,present.size,'no duplicate IDs');
 for(const id of required)assert.ok(present.has(id),'shared runtime requires #'+id);
 assert.deepEqual(new Set(ids(read(prefix+'adaptaciones/index.html'))),present,'Creator retains the complete current Adapter shell');
 assert.match(html,/<body class="adapt-page creator-page">/);
 assert.match(html,/<section id="sec-adapt" class="card" hidden>/);
 assert.equal(demo(html).length,1,'Creator demo entry is loaded exactly once');
 assert.ok(html.indexOf('id="classic-host"')<html.indexOf('id="paso-2"'));
 assert.ok(html.indexOf('id="special-host"')>html.indexOf('id="paso-2"'));
 const nodes=new Map(all.map(id=>[id,{}])),calls=[];
 const bindings=runtime.slice(runtime.indexOf("$('#btn-portrait').onclick="),runtime.indexOf('// [CLASSIC-STEP-END]'));
 assert.ok(bindings.length>0);
 vm.runInNewContext(bindings,{$:selector=>nodes.get(selector.slice(1))||null,document:{querySelectorAll:()=>[]},enterClassic:id=>calls.push(id)});
 for(const id of ['btn-portrait','btn-landscape','btn-adaptar','btn-volver'])assert.equal(typeof nodes.get(id).onclick,'function');
 nodes.get('btn-portrait').onclick();nodes.get('btn-landscape').onclick();assert.deepEqual(calls,['9:16','16:9']);
 if(!prefix){
  const redirect=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(script=>script.includes('location.replace('));
  const destinations=[];
  vm.runInNewContext(redirect,{URLSearchParams,location:{hostname:'www.pixeria.com',pathname:'/creador/',search:'?demo=creador',replace:path=>destinations.push(path)}});
  assert.deepEqual(destinations,['/en/creador/?demo=creador'],'language redirect keeps the Creator route and demo parameters');
 }
});

test('Creator generator rebuilds both languages from the current shell and retains one demo entry on repeat runs',()=>{
 const fixture=mkdtempSync(join(tmpdir(),'pixeria-creator-shell-'));
 try{
  mkdirSync(join(fixture,'scripts'));copyFileSync(new URL('../scripts/preparar-creador.py',import.meta.url),join(fixture,'scripts/preparar-creador.py'));
  for(const prefix of ['','en/']){
   mkdirSync(join(fixture,prefix+'adaptaciones'),{recursive:true});writeFileSync(join(fixture,prefix+'adaptaciones/index.html'),read(prefix+'adaptaciones/index.html'));
   mkdirSync(join(fixture,prefix+'creador'),{recursive:true});writeFileSync(join(fixture,prefix+'creador/index.html'),'<body>stale Creator shell</body>');
  }
  const run=()=>execFileSync('python3',[join(fixture,'scripts/preparar-creador.py')],{encoding:'utf8'});
  run();const first=new Map();
  for(const prefix of ['','en/']){
   const html=readFileSync(join(fixture,prefix+'creador/index.html'),'utf8');first.set(prefix,html);
   assert.equal(html,read(prefix+'creador/index.html'),'checked-in Creator must match its generator');
   assert.equal(demo(html).length,1);assert.ok(ids(html).includes('btn-portrait'));assert.ok(ids(html).includes('classic-host'));
   assert.match(html,/<link rel="canonical" href="https:\/\/www\.pixeria\.com\/(?:en\/)?creador\/">/);
  }
  run();for(const prefix of ['','en/'])assert.equal(readFileSync(join(fixture,prefix+'creador/index.html'),'utf8'),first.get(prefix),'regeneration is deterministic');
 }finally{rmSync(fixture,{recursive:true,force:true});}
});
