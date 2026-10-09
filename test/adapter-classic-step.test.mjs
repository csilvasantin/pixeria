import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {classicTargets,isClassicFormat,extraFormats} from '../adaptaciones/classic-step.mjs';
import {createCatalog,formatFamily,isProjectFormat} from '../adaptaciones/format-catalog.mjs';
import {projectFormats} from '../adaptaciones/proyectos-core.mjs';
import {snapshot,defaults} from '../adaptaciones/adapter-core.mjs';
import {perfilDeSalida} from '../assets/signage-perfiles.js';
import {renderAdvertisement,visualPrompt} from '../adaptaciones/anuncio-core.mjs';
import * as adCore from '../adaptaciones/anuncio-core.mjs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const json=path=>JSON.parse(read(path));
const production=read('adaptaciones/adaptaciones.js');
function block(name){
 const start=production.indexOf('// ['+name+'-START]'),end=production.indexOf('// ['+name+'-END]');
 assert.ok(start>=0&&end>start,name+' production boundaries exist');return production.slice(start,end);
}
const selection=block('CLASSIC-SELECTION'),entry=block('CLASSIC-STEP');
const plain=value=>JSON.parse(JSON.stringify(value));
function realFormats(){
 const own=projectFormats(json('adaptaciones/proyectos/altadis-estancos-bcn.json'),{
  estandar:json('adaptaciones/perfil-cliente-18.json').formats,
  especiales:json('adaptaciones/perfil-cliente-especiales.json').layouts});
 return [...createCatalog(),...own];
}

test('loaded still orientation offers only the opposite destination; a square offers both',()=>{
 const horizontal={kind:'image',ancho:1920,alto:1080};
 assert.deepEqual(classicTargets(horizontal,true),['9:16']);
 assert.deepEqual(classicTargets({...horizontal,ancho:1080,alto:1920},true),['16:9']);
 assert.deepEqual(classicTargets({...horizontal,alto:1920},true),['9:16','16:9']);
 assert.deepEqual(classicTargets(horizontal,false),[]);
 for(const source of [null,{},...['video','anim','audio'].map(kind=>({...horizontal,kind})),
  ...[0,-1,Infinity,NaN,'1920',1920.5].map(ancho=>({...horizontal,ancho})),{...horizontal,alto:0}]){
  assert.deepEqual(classicTargets(source,true),[],JSON.stringify(source));
 }
});

test('image extras exclude only general classic ratios, preserving the full library, projects and walls',()=>{
 const formats=realFormats();formats.push({id:'9:16',proyecto:'fixture'},{id:'16:9',especial:true});
 const before=structuredClone(formats),extras=extraFormats(formats,true);
 assert.equal(createCatalog().length,42);
 assert.equal(extras.length,formats.length-2);
 assert.equal(extras.filter(f=>!f.proyecto&&!f.especial).length,40);
 assert.ok(extras.some(f=>f.proyecto&&f.especial));
 assert.ok(extras.includes(formats.at(-1)));assert.ok(extras.includes(formats.at(-2)));
 assert.equal(extraFormats(formats,false),formats,'video keeps its original array');
 assert.equal(isClassicFormat(null),false);assert.deepEqual(formats,before);
});

function uiWorld({en=false,reduced=false,source={ancho:1920,alto:1080},kind='image',profile='proyecto'}={}){
 const formats=realFormats(),calls=[],nodes=new Map();
 for(const f of formats)f.on=f.proyecto?true:!isClassicFormat(f);
 const state={src:{...source},profile,compat:'fhd',sel:'cliente-01',modoGlobal:'auto',proyecto:'altadis-estancos-bcn',
  fmt:Object.fromEntries(formats.map(f=>[f.id,{...defaults(),fx:.3,fy:.7}]))};
 function node(selector){
  if(!nodes.has(selector))nodes.set(selector,{hidden:false,disabled:false,textContent:'',value:'',dataset:{},
   append(child){child.parentNode=this;},setAttribute(k,v){this[k]=v;},removeAttribute(k){delete this[k];}});
  return nodes.get(selector);
 }
 const workspace={},steps=[1,2].map(n=>({...node('step'+n),dataset:{go:String(n)}}));
 const cards=['9:16','16:9'].map(id=>({dataset:{f:id},tabIndex:0,
  focus:options=>calls.push(['focus',id,options]),scrollIntoView:options=>calls.push(['scroll',id,options])}));
 let ready=true,busy=false;
 const advertisement={busy:()=>busy,enabled:()=>kind==='image',analyze:()=>{calls.push(['analyze']);return Promise.resolve(null);},clear:()=>calls.push(['clear'])};
 const context=vm.createContext({state,FORMATOS:formats,srcKind:kind,FICHA:{id:state.proyecto},classicTargets,isClassicFormat,extraFormats,formatFamily,isProjectFormat,
  $:node,t:(es,english)=>en?english:es,isImage:()=>context.srcKind==='image',mediaReady:()=>ready,advertisement,
  buildGrid:()=>calls.push(['grid']),pausePaso1:()=>calls.push(['pause']),
  document:{body:{dataset:{},classList:{toggle:(...args)=>calls.push(['class',...args])}},
   querySelector:s=>{assert.equal(s,'.adapter-variants');return workspace;},
   querySelectorAll:s=>{if(s==='.steps .step')return steps;if(s==='#grid [data-f]')return cards;assert.fail('unexpected selector '+s);}},
  window:{matchMedia:()=>({matches:reduced}),scrollTo:options=>calls.push(['page-scroll',options])},
  perfilDeSalida,fetch:()=>assert.fail('no provider calls during classic entry'),saveSettings:()=>assert.fail('entry never saves preferences')});
 vm.runInContext(selection+'\n'+production.slice(production.indexOf('const syncCompat ='),production.indexOf('// Persistence is separated')),context);
 vm.runInContext(production.slice(production.indexOf('function perfil(f)'),production.indexOf('function plan(f)'))+
  '\nfunction destino(f){const p=perfil(f);return {ancho:p.ancho,alto:p.alto};}\n'+entry,context);
 node('#special-host').append(workspace);
 return {state,formats,calls,nodes,cards,workspace,context,node,advertisement,setReady:v=>ready=v,setBusy:v=>busy=v,
  run:code=>vm.runInContext(code,context),selected:()=>vm.runInContext('selectedFormats()',context)};
}

for(const en of [false,true])test('production '+(en?'EN':'ES')+' classic entry reuses one workspace and preserves the saved project snapshot',()=>{
 const w=uiWorld({en}),before=snapshot(w.state,w.formats),formatsBefore=structuredClone(w.formats);
 w.context.syncClassicEntry();
 assert.equal(w.node('#btn-portrait').textContent,en?'Landscape → portrait':'Horizontal → vertical');
 assert.equal(w.node('#btn-portrait').hidden,false);assert.equal(w.node('#btn-landscape').hidden,true);
 assert.deepEqual(snapshot(w.state,w.formats),before);
 w.node('#btn-portrait').onclick();
 assert.equal(w.workspace.parentNode,w.node('#classic-host'));
 assert.equal(w.node('#classic-host').hidden,false);assert.equal(w.context.document.body.dataset.paso,'1');
 assert.equal(w.state.profile,'proyecto');assert.equal(w.state.sel,'9:16');
 assert.equal(w.selected().length,1);assert.equal(w.selected()[0],w.formats.find(f=>isClassicFormat(f)&&f.id==='9:16'));
 assert.equal(w.selected()[0].on,false,'temporary destination does not need an on flag');
 assert.equal(w.run('currentSelected()'),w.selected()[0]);
 assert.deepEqual(snapshot(w.state,w.formats),before);assert.deepEqual(w.formats,formatsBefore);
 assert.equal(w.node('#compat').disabled,false);
 assert.match(w.node('#export-status').textContent,/1080×1920/);
 assert.match(w.node('#export-status').textContent,en?/Review copy and product.*approving/:/Revisa texto y producto.*aprobar/);
 assert.equal(w.calls.filter(x=>x[0]==='analyze').length,1);assert.equal(w.calls.filter(x=>x[0]==='grid').length,1);
 assert.equal(w.cards[0].tabIndex,0);assert.equal(w.calls.find(x=>x[0]==='scroll')[2].behavior,'smooth');
});

test('step navigation returns the same workspace and restores project selection including videowalls',()=>{
 const w=uiWorld(),before=snapshot(w.state,w.formats),expected=w.selected().map(f=>f.id);
 w.context.enterClassic('9:16');w.context.goStep(2);
 assert.equal(w.workspace.parentNode,w.node('#special-host'));assert.equal(w.state.sel,'cliente-01');
 assert.deepEqual(w.selected().map(f=>f.id),expected);assert.ok(w.selected().some(f=>f.especial));
 assert.equal(w.node('#compat').disabled,true);assert.equal(w.node('#paso-2').hidden,false);
 w.context.goStep(1);
 assert.equal(w.workspace.parentNode,w.node('#classic-host'));assert.equal(w.state.sel,'9:16');
 assert.equal(w.selected().length,1);assert.equal(w.node('#paso-1').hidden,false);
 assert.deepEqual(snapshot(w.state,w.formats),before);
});

test('subsequent round trips restore the latest special card and do not force a manually chosen profile',()=>{
 const w=uiWorld();w.context.enterClassic('9:16');w.context.goStep(2);
 const wall=w.selected().find(f=>f.especial);assert.ok(wall);w.state.sel=wall.id;
 w.context.goStep(1);assert.equal(w.state.sel,'9:16');w.context.goStep(2);assert.equal(w.state.sel,wall.id);
 w.state.profile='standard';w.state.sel='1:1';w.context.goStep(1);w.context.goStep(2);
 assert.equal(w.state.profile,'standard');assert.equal(w.state.sel,'1:1');
 assert.ok(w.selected().every(f=>!isClassicFormat(f)));
});

test('the real project switch keeps step two and the analysis while clearing the temporary target',async()=>{
 const w=uiWorld();w.context.enterClassic('9:16');w.context.goStep(2);
 const before=w.calls.filter(c=>c[0]==='clear').length,saved=[];
 Object.assign(w.context,{INDEX:[{id:'new-project'}],CAMPAIGNS:[],projectCampaigns:()=>[],
  loadFicha:async()=>({ficha:{id:'new-project'},lists:{},estancos:null}),saveSettings:()=>saved.push(snapshot(w.state,w.formats)),
  restoreSettings:()=>{},setEstancos:()=>{},renderProfiles:()=>{},renderCampaigns:()=>{},renderProjects:()=>{},renderProjectStatus:()=>{},syncURL:()=>{}});
 vm.runInContext(production.slice(production.indexOf('let switching ='),production.indexOf("$('#adapter-project').onchange")),w.context);
 await w.context.switchProject('new-project');
 assert.equal(w.state.proyecto,'new-project');assert.equal(w.run('currentStep'),2);assert.equal(w.run('classicTargetId'),'');
 assert.equal(w.node('#paso-2').hidden,false);assert.equal(w.workspace.parentNode,w.node('#special-host'));
 assert.equal(w.calls.filter(c=>c[0]==='clear').length,before);assert.equal(saved.length,1);
 assert.equal(w.state.sel,'cliente-01');
});

test('vertical and square source buttons choose the correct ephemeral format, with reduced-motion focus',()=>{
 const portrait=uiWorld({source:{ancho:1080,alto:1920},reduced:true});portrait.context.syncClassicEntry();
 assert.equal(portrait.node('#btn-portrait').hidden,true);assert.equal(portrait.node('#btn-landscape').hidden,false);
 portrait.node('#btn-landscape').onclick();assert.equal(portrait.state.sel,'16:9');
 assert.match(portrait.node('#export-status').textContent,/1920×1080/);
 assert.equal(portrait.calls.find(x=>x[0]==='scroll')[2].behavior,'instant');assert.equal(portrait.cards[1].tabIndex,0);
 const square=uiWorld({source:{ancho:1200,alto:1200}});square.context.syncClassicEntry();
 for(const id of ['#btn-portrait','#btn-landscape'])assert.equal(square.node(id).hidden,false);
 assert.match(square.node('#btn-portrait').textContent,/9:16/);assert.match(square.node('#btn-landscape').textContent,/16:9/);
 square.node('#btn-portrait').onclick();square.node('#btn-landscape').onclick();square.context.goStep(2);
 assert.equal(square.state.sel,'cliente-01','switching the temporary target must not replace the saved project card');
});

test('stale, unloaded, animated and busy sources do not select a target or start analysis',()=>{
 for(const change of [w=>w.state.src={ancho:1080,alto:1920},w=>w.context.srcKind='video',
  w=>w.context.srcKind='anim',w=>w.setReady(false),w=>w.setBusy(true)]){
  const w=uiWorld();w.context.syncClassicEntry();change(w);
  const before=structuredClone(w.state),formatBefore=structuredClone(w.formats),count=w.calls.length;
  w.node('#btn-portrait').onclick();assert.deepEqual(w.state,before);assert.deepEqual(w.formats,formatBefore);
  assert.equal(w.calls.length,count);assert.equal(w.workspace.parentNode,w.node('#special-host'));
 }
});

for(const [compat,portrait,landscape] of [['universal',[720,1280],[1280,720]],['fhd',[1080,1920],[1920,1080]],['uhd',[2160,3840],[3840,2160]]]){
 test('classic output uses '+compat+' compatibility in both orientations without overwriting framing',()=>{
  for(const [source,id,dims] of [[{ancho:1920,alto:1080},'9:16',portrait],[{ancho:1080,alto:1920},'16:9',landscape]]){
   const w=uiWorld({source});w.state.compat=compat;const before=snapshot(w.state,w.formats);
   w.context.enterClassic(id);assert.ok(w.node('#export-status').textContent.includes(dims.join('×')));
   assert.deepEqual(snapshot(w.state,w.formats),before);
  }
 });
}

test('reset cancels the shared advertisement engine and restores the special workspace and selection',()=>{
 const w=uiWorld(),before=snapshot(w.state,w.formats);w.context.enterClassic('9:16');w.context.resetClassic();
 assert.equal(w.calls.filter(x=>x[0]==='clear').length,1);assert.equal(w.workspace.parentNode,w.node('#special-host'));
 assert.equal(w.state.sel,'cliente-01');assert.equal(w.node('#classic-host').hidden,true);
 assert.equal(w.node('#paso-1').hidden,false);assert.equal(w.node('#paso-2').hidden,true);
 assert.equal(w.run('classicTargetId'), '');assert.deepEqual(snapshot(w.state,w.formats),before);
 // The public source event is also used by imports; it must invalidate before announcing the next source.
 w.context.fuente=null;w.context.document.dispatchEvent=()=>w.calls.push(['source-event']);
 w.context.CustomEvent=class {constructor(type,options){this.type=type;this.detail=options.detail;}};
 w.context.window.PixeriaAdaptador={};
 vm.runInContext(production.slice(production.indexOf('function publicarFuente(fase)'),production.indexOf('let previewEngine')),w.context);
 w.context.enterClassic('9:16');w.context.publicarFuente('inicio');
 assert.equal(w.run('classicTargetId'),'');assert.equal(w.state.sel,'cliente-01');
 assert.equal(w.calls.at(-1)[0],'source-event');
 for(const start of ['function setSource(','function emptySource()']){
  const i=production.indexOf(start),opening=production.indexOf('{',i+start.length);
  assert.match(production.slice(opening,opening+160),/resetClassic\(\)/,start+' invalidates before source processing');
 }
});

test('classic export reaches the existing prepare/approval gate with the temporary format',async()=>{
 const w=uiWorld();w.context.enterClassic('9:16');let allowed=false;const exported=[];
 w.advertisement.prepare=async formats=>{assert.equal(formats[0],w.selected()[0]);return allowed;};
 w.context.exportAdvertisements=async(...args)=>exported.push(args);
 // Include the real full function: if the still/video path is reached, its unmocked dependencies fail.
 vm.runInContext(production.slice(production.indexOf('async function exportFormats('),production.indexOf("$('#export-all').onclick")),w.context);
 await w.context.exportFormats(w.selected(),'both',{fixture:true});assert.equal(exported.length,0);
 allowed=true;await w.context.exportFormats(w.selected(),'both',{fixture:true});
 assert.equal(exported.length,1);assert.equal(exported[0][0][0],w.selected()[0]);
 assert.equal(exported[0][1],'both');assert.deepEqual(exported[0][2],{fixture:true});
 assert.equal((production.match(/advertisement=mountAdvertisement\(/g)||[]).length,1);
 for(const [from,to] of [['function buildCardSettings()','function bindControls'],['function refreshInfo()','function destino('],['function syncCrearSettings(','function pickCard(']]){
  const body=production.slice(production.indexOf(from),production.indexOf(to));
  assert.ok(body.includes('currentSelected()'),from+' accepts temporary selection');
 }
});

test('ES and EN keep one workspace, one control group and no duplicated editor IDs',()=>{
 for(const path of ['adaptaciones/index.html','en/adaptaciones/index.html']){
  const html=read(path),ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(new Set(ids).size,ids.length,path+' duplicate IDs');
  assert.equal((html.match(/class="adapter-variants"/g)||[]).length,1);
 for(const id of ['classic-host','special-host','ad-adjustments','ad-options'])assert.equal(ids.filter(x=>x===id).length,1);
  assert.doesNotMatch(html,/<details\b[^>]*id="ad-adjustments"[^>]*\bopen\b/);
  assert.ok(html.indexOf('id="classic-host"')<html.indexOf('id="paso-2"'));
  assert.ok(html.indexOf('id="special-host"')>html.indexOf('id="paso-2"'));
 }
});

test('a text-free advertisement fills the full canvas instead of reserving an empty copy panel',()=>{
 const doc={texts:[],subjects:[{label:'product',box:[100,100,900,900]}],scene:'package on table'},draws=[],rects=[];
 const ctx={fillRect:(...args)=>rects.push(args),drawImage:(...args)=>draws.push(args),measureText:()=>({width:0}),fillText:()=>assert.fail('no copy to paint')};
 const visual={width:1080,height:1920};renderAdvertisement({width:1080,height:1920,getContext:()=>ctx},visual,doc);
 assert.deepEqual(draws[0].slice(1),[0,0,1080,1920]);
 assert.equal(rects.filter(r=>r[2]>0&&r[3]>0).length,1,'only the base canvas background');
 for(const action of ['recreate','reconstruct']){
  const prompt=visualPrompt(action,doc,{w:1080,h:1920},{textZone:null});
  assert.match(prompt,/no (?:external copy or )?reserved text (?:panel|zone)/);
  assert.doesNotMatch(prompt,/Reserve the rectangle null/);
 }
 const studio=read('adaptaciones/anuncio-studio.mjs');
 assert.match(studio,/zone=doc\.texts\.length\?\(h\.textZone\?\.\(f\)\|\|null\):null/);
 assert.match(studio,/region=a==='reconstruct'\|\|!doc\.texts\.length\?\{w:dst\.ancho,h:dst\.alto\}/);
});

const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
function advertisementWorld({extract,make}={}){
 const globals=new Map(),nodes=[],calls=[],noCopy={texts:[],subjects:[{label:'product',box:[100,100,900,900]}],scene:'package',uncertain:false};
 function element(tag='section'){
  const children=new Map(),el={tagName:tag.toUpperCase(),hidden:false,value:'',dataset:{},textContent:'',width:0,height:0,
   append(){},before(){},replaceChildren(){},removeAttribute(name){delete this[name];},
   querySelector(selector){if(!children.has(selector))children.set(selector,element());return children.get(selector);},
   querySelectorAll:()=>[],getContext:()=>({drawImage(){},measureText:()=>({width:0})}),toDataURL:()=> 'data:image/png;base64,fixture'};
  nodes.push(el);return el;
 }
 const get=selector=>{if(!globals.has(selector))globals.set(selector,element());return globals.get(selector);};
 const formats=[{id:'9:16',nombre:'Vertical',on:false}],context=vm.createContext({...adCore,
  document:{createElement:element,querySelector:get,querySelectorAll:()=>[]},AbortController,setTimeout,clearTimeout,
  Image:class {naturalWidth=1080;naturalHeight=1920;async decode(){}},
  extractAdvertisement:extract||(async()=>structuredClone(noCopy)),loadDocumentFonts:async()=>{},
  makeVisual:make||(async(...args)=>{calls.push(['visual',...args]);return {url:'data:image/png;base64,fixture',verification:{protectedSubjects:[]}};}),
  renderAdvertisement:()=>({valid:true}),fetch:()=>assert.fail('mock engine never calls providers')});
 const source=read('adaptaciones/anuncio-studio.mjs');
 vm.runInContext(source.slice(source.indexOf('export function mountAdvertisement')).replace('export function','function'),context);
 const api=context.mountAdvertisement({t:es=>es,source:()=>({kind:'image',image:{},src:{ancho:1920,alto:1080}}),
  destino:()=>({ancho:1080,alto:1920}),selected:()=>formats,formats:()=>formats,seconds:()=>6,
  changed:()=>calls.push(['changed']),textZone:()=>{assert.fail('text-free media never requests a copy zone');}});
 const root=nodes.find(n=>n.id==='advertisement-studio');assert.ok(root);
 return {api,formats,calls,noCopy,root,status:()=>root.querySelector('#ad-status').textContent};
}

test('real advertisement preparation uses a full text-free region and requires approval before export',async()=>{
 const w=advertisementWorld();assert.deepEqual(plain(await w.api.analyze()),w.noCopy);
 assert.equal(await w.api.prepare(w.formats),false,'a generated piece is not approved');
 const request=w.calls.find(c=>c[0]==='visual');assert.ok(request);
 assert.equal(request[3],'recreate');assert.deepEqual(plain(request[4]),{w:1080,h:1920});assert.equal(request[5].textZone,null);
 const f=w.formats[0],piece=w.api.entry(f);assert.ok(piece);assert.equal(piece.approved,false);assert.equal(w.api.ready(f),false);
 assert.equal(await w.api.prepare(w.formats),false);assert.match(w.status(),/aprueba cada pieza/);
 piece.approved=true;assert.equal(w.api.ready(f),true);assert.equal(await w.api.prepare(w.formats),true);
 w.api.clear();assert.equal(w.api.entry(f),undefined);assert.equal(w.api.ready(f),false);
});

test('clear aborts in-flight OCR and discards a late result without restoring copy or stale status',async()=>{
 const pending=deferred();let signal;
 const w=advertisementWorld({extract:(_ref,options)=>{signal=options.signal;return pending.promise;}});
 const analysis=w.api.analyze();assert.equal(w.api.busy(),true);assert.ok(signal);assert.equal(signal.aborted,false);
 w.api.clear();assert.equal(signal.aborted,true);assert.equal(w.api.busy(),false);assert.equal(w.status(),'');
 const changes=w.calls.filter(c=>c[0]==='changed').length;
 pending.resolve({...w.noCopy,texts:[{role:'headline',text:'STALE RESULT'}]});
 assert.equal(await analysis,null);assert.equal(w.api.action(w.formats[0]).action,'pending');assert.equal(w.api.entry(w.formats[0]),undefined);
 assert.equal(w.root.querySelector('#ad-copy').value,'');assert.equal(w.root.querySelector('#ad-copy-wrap').hidden,true);
 assert.equal(w.status(),'');assert.equal(w.calls.filter(c=>c[0]==='changed').length,changes);
});

test('clear aborts generation and a late visual cannot become a result or approved export',async()=>{
 const pending=deferred();let signal;
 const w=advertisementWorld({make:(_ref,_doc,_action,_region,options)=>{signal=options.signal;return pending.promise;}});
 await w.api.analyze();const preparation=w.api.prepare(w.formats);
 for(let i=0;i<10&&!signal;i++)await Promise.resolve();assert.ok(signal);assert.equal(w.api.busy(),true);
 w.api.clear();assert.equal(signal.aborted,true);assert.equal(w.status(),'');
 const changes=w.calls.filter(c=>c[0]==='changed').length;
 pending.resolve({url:'data:image/png;base64,stale',verification:{protectedSubjects:[]}});
 assert.equal(await preparation,false);assert.equal(w.api.entry(w.formats[0]),undefined);assert.equal(w.api.ready(w.formats[0]),false);
 assert.equal(w.api.action(w.formats[0]).action,'pending');assert.equal(w.status(),'');assert.equal(w.api.busy(),false);
 assert.equal(w.calls.filter(c=>c[0]==='changed').length,changes);
});
