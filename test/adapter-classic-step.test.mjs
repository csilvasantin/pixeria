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
 const advertisement={busy:()=>busy,enabled:()=>kind==='image',analyze:()=>{calls.push(['analyze']);return Promise.resolve(null);},
  prepareClassic:f=>{calls.push(['prepareClassic',f.id]);return Promise.resolve(false);},clear:()=>calls.push(['clear'])};
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
 assert.deepEqual(w.calls.filter(x=>x[0]==='prepareClassic'),[['prepareClassic','9:16']]);
 assert.equal(w.calls.filter(x=>x[0]==='analyze').length,0);assert.equal(w.calls.filter(x=>x[0]==='grid').length,1);
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
function advertisementWorld({extract,make,doc,classicId=null,classicTarget,formats:providedFormats}={}){
 const globals=new Map(),nodes=[],calls=[],noCopy={texts:[],subjects:[{label:'product',box:[100,100,900,900]}],scene:'package',uncertain:false};
 function element(tag='section'){
  const children=new Map(),el={tagName:tag.toUpperCase(),hidden:false,value:'',dataset:{},textContent:'',width:0,height:0,
   append(){},before(){},replaceChildren(){},removeAttribute(name){delete this[name];},
   querySelector(selector){if(!children.has(selector))children.set(selector,element());return children.get(selector);},
   querySelectorAll:()=>[],getContext:()=>({drawImage(){},measureText:()=>({width:0})}),toDataURL:()=> 'data:image/png;base64,fixture'};
  nodes.push(el);return el;
 }
 const get=selector=>{if(!globals.has(selector))globals.set(selector,element());return globals.get(selector);};
 let activeClassicId=classicId;
 const formats=providedFormats||[{id:'9:16',nombre:'Vertical',on:false}],context=vm.createContext({...adCore,
  document:{createElement:element,querySelector:get,querySelectorAll:()=>[]},AbortController,setTimeout,clearTimeout,
  Image:class {naturalWidth=1080;naturalHeight=1920;async decode(){}},
  extractAdvertisement:async(...args)=>{calls.push(['extract',...args]);return extract?extract(...args):structuredClone(doc||noCopy);},loadDocumentFonts:async()=>{},
  makeVisual:async(...args)=>{calls.push(['visual',...args]);return make?make(...args):{url:'data:image/png;base64,fixture',verification:{protectedSubjects:noCopy.subjects}};},
  renderAdvertisement:()=>({valid:true}),fetch:()=>assert.fail('mock engine never calls providers')});
 const source=read('adaptaciones/anuncio-studio.mjs');
 vm.runInContext(source.slice(source.indexOf('export function mountAdvertisement')).replace('export function','function'),context);
 const api=context.mountAdvertisement({t:es=>es,source:()=>({kind:'image',image:{},src:{ancho:1920,alto:1080}}),classicTarget:classicTarget||(()=>activeClassicId),
  destino:()=>({ancho:1080,alto:1920}),selected:()=>formats,formats:()=>formats,seconds:()=>6,
  changed:()=>calls.push(['changed']),textZone:()=>{assert.ok((doc?.texts?.length||0)>0,'text-free media never requests a copy zone');return null;}});
 const root=nodes.find(n=>n.id==='advertisement-studio');assert.ok(root);
 return {api,formats,calls,noCopy,root,nodes,context,setClassic:id=>activeClassicId=id,status:()=>root.querySelector('#ad-status').textContent};
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

async function until(predicate){for(let i=0;i<80;i++){if(predicate())return;await Promise.resolve();}assert.ok(predicate(),'expected async stage was not reached');}
const uncertainCopy=()=>({texts:[{role:'headline',text:'UNCONFIRMED OCR',confidence:.2}],
 subjects:[{label:'product',box:[200,400,900,900]}],scene:'package on table',uncertain:true,
 packageLabels:[{text:'SOL',box:[400,500,500,600]}]});

test('production classic click performs OCR and full-canvas reconstruction automatically without export',async()=>{
 const ui=uiWorld(),f=ui.formats.find(f=>isClassicFormat(f)&&f.id==='9:16'),before=snapshot(ui.state,ui.formats);
 const w=advertisementWorld({formats:ui.formats,classicTarget:()=>ui.run('classicActive()?classicTargetId:null')});
 Object.assign(ui.advertisement,w.api);
 ui.node('#btn-portrait').onclick();
 await until(()=>!!w.api.entry(f));
 assert.deepEqual(w.calls.filter(c=>['extract','visual'].includes(c[0])).map(c=>c[0]),['extract','visual']);
 const visual=w.calls.find(c=>c[0]==='visual');assert.equal(visual[3],'reconstruct');
 assert.deepEqual(plain(visual[4]),{w:1080,h:1920});assert.equal(visual[5].textZone,null);
 assert.equal(w.api.entry(f).approved,false);assert.equal(w.api.ready(f),false);
 assert.deepEqual(snapshot(ui.state,ui.formats),before,'automatic generation does not select a saved project format');
 assert.equal(ui.workspace.parentNode,ui.node('#classic-host'));
});

test('uncertain OCR pauses the automatic flow, and human confirmation resumes the same active classic target',async()=>{
 const w=advertisementWorld({doc:uncertainCopy(),classicId:'9:16'}),f=w.formats[0];
 await w.api.prepareClassic(f);assert.equal(w.calls.filter(c=>c[0]==='visual').length,0);
 assert.equal(w.api.entry(f),undefined);assert.equal(w.root.querySelector('#ad-copy-wrap').hidden,false);
 w.root.querySelector('#ad-copy').value='HUMAN VERIFIED COPY';w.root.querySelector('#ad-confirm-copy').onclick();
 await until(()=>!!w.api.entry(f));
 assert.equal(w.calls.filter(c=>c[0]==='extract').length,1);assert.equal(w.calls.filter(c=>c[0]==='visual').length,1);
 const request=w.calls.find(c=>c[0]==='visual');assert.equal(request[3],'reconstruct');
 assert.deepEqual(plain(request[2].texts.map(t=>t.text)),['HUMAN VERIFIED COPY']);
 assert.deepEqual(plain(request[2].packageLabels),uncertainCopy().packageLabels);assert.equal(w.api.ready(f),false);
});

test('high-confidence classic OCR still requires an explicit human copy decision before any visual request',async()=>{
 for(const decision of ['confirm','no-copy']){
  const doc={...uncertainCopy(),texts:[{role:'brand',text:'BIGODIN',confidence:.99}],uncertain:false};
  const w=advertisementWorld({doc,classicId:'9:16'}),f=w.formats[0];
  await w.api.prepareClassic(f);
  assert.equal(w.calls.filter(c=>c[0]==='visual').length,0,'provider confidence is not human confirmation');
  assert.equal(w.api.entry(f),undefined);assert.equal(w.root.querySelector('#ad-copy-wrap').hidden,false);
  assert.match(w.status(),/Revisa y confirma el texto/);
  await w.api.prepare([f]);
  assert.equal(w.calls.filter(c=>c[0]==='visual').length,0,'manual create/export cannot bypass classic copy review');
  w.root.querySelector(decision==='confirm'?'#ad-confirm-copy':'#ad-no-copy').onclick();
  await until(()=>!!w.api.entry(f));
  const request=w.calls.find(c=>c[0]==='visual');
  assert.deepEqual(plain(request[2].texts.map(t=>t.text)),decision==='confirm'?['BIGODIN']:[]);
  assert.equal(w.calls.filter(c=>c[0]==='extract').length,1);assert.equal(w.calls.filter(c=>c[0]==='visual').length,1);
  assert.equal(w.api.ready(f),false,'copy confirmation never approves the generated piece');
 }
});

test('high-confidence special-format copy retains the existing preparation flow',async()=>{
 const doc={...uncertainCopy(),texts:[{role:'headline',text:'RETAIL CAMPAIGN',confidence:.99}],uncertain:false};
 const w=advertisementWorld({doc});
 await w.api.prepare(w.formats);
 assert.equal(w.calls.filter(c=>c[0]==='visual').length,1);
 assert.ok(w.api.entry(w.formats[0]));assert.equal(w.api.ready(w.formats[0]),false);
});

test('confirming copy after leaving or changing the target cannot generate the old pending classic',async()=>{
 for(const next of [null,'16:9']){
  const w=advertisementWorld({doc:uncertainCopy(),classicId:'9:16'}),f=w.formats[0];
  await w.api.prepareClassic(f);w.setClassic(next);
  w.root.querySelector('#ad-copy').value='VERIFIED COPY';w.root.querySelector('#ad-confirm-copy').onclick();
  for(let i=0;i<30;i++)await Promise.resolve();
  assert.equal(w.calls.filter(c=>c[0]==='visual').length,0);assert.equal(w.api.entry(f),undefined);
 }
});

test('same classic request while OCR is pending is deduplicated into one visual',async()=>{
 const pending=deferred(),w=advertisementWorld({classicId:'9:16',extract:()=>pending.promise}),f=w.formats[0];
 const first=w.api.prepareClassic(f),second=w.api.prepareClassic(f);
 assert.equal(w.calls.filter(c=>c[0]==='extract').length,1);
 pending.resolve(structuredClone(w.noCopy));await Promise.all([first,second]);
 await until(()=>!!w.api.entry(f));assert.equal(w.calls.filter(c=>c[0]==='visual').length,1);
 assert.equal(w.api.entry(f).approved,false);
 await w.api.prepareClassic(f);assert.equal(w.calls.filter(c=>c[0]==='visual').length,1,'another click does not regenerate an existing unapproved piece');
});

test('leaving the classic view during OCR never starts generation for its late response',async()=>{
 const pending=deferred(),w=advertisementWorld({classicId:'9:16',extract:()=>pending.promise}),f=w.formats[0];
 const job=w.api.prepareClassic(f);w.setClassic(null);pending.resolve(structuredClone(w.noCopy));await job;
 assert.equal(w.calls.filter(c=>c[0]==='visual').length,0);assert.equal(w.api.entry(f),undefined);assert.equal(w.api.ready(f),false);
});

for(const cancel of ['clear','cancel-button'])test(cancel+' during automatic OCR prevents generation when OCR resolves late',async()=>{
 const pending=deferred();let signal;
 const w=advertisementWorld({classicId:'9:16',extract:(_image,options)=>{signal=options.signal;return pending.promise;}}),f=w.formats[0];
 const job=w.api.prepareClassic(f);assert.ok(signal);
 if(cancel==='clear')w.api.clear();else w.root.querySelector('#ad-cancel').onclick();
 assert.equal(signal.aborted,true);const status=w.status();pending.resolve(structuredClone(w.noCopy));await job;
 assert.equal(w.calls.filter(c=>c[0]==='visual').length,0);assert.equal(w.api.entry(f),undefined);assert.equal(w.status(),status);
});

test('a reconstruction already started may finish unapproved without changing the special selection after leaving',async()=>{
 const ui=uiWorld(),pending=deferred(),f=ui.formats.find(f=>isClassicFormat(f)&&f.id==='9:16');
 const before=snapshot(ui.state,ui.formats),w=advertisementWorld({formats:ui.formats,make:()=>pending.promise,
  classicTarget:()=>ui.run('classicActive()?classicTargetId:null')});
 Object.assign(ui.advertisement,w.api);ui.node('#btn-portrait').onclick();await until(()=>w.calls.some(c=>c[0]==='visual'));
 ui.context.goStep(2);pending.resolve({url:'data:image/png;base64,background',verification:{protectedSubjects:[]}});
 await until(()=>!!w.api.entry(f));assert.equal(w.api.entry(f).approved,false);assert.equal(w.api.ready(f),false);
 assert.equal(ui.state.sel,'cliente-01');assert.ok(ui.selected().every(f=>f.proyecto));assert.equal(ui.workspace.parentNode,ui.node('#special-host'));
 assert.deepEqual(snapshot(ui.state,ui.formats),before);assert.equal(w.calls.filter(c=>c[0]==='visual').length,1);
});

test('the no-copy button reclassifies detected markings and resumes the active target while retaining package labels',async()=>{
 const doc=uncertainCopy(),before=structuredClone(doc),w=advertisementWorld({doc,classicId:'9:16'}),f=w.formats[0];
 await w.api.prepareClassic(f);assert.equal(w.calls.filter(c=>c[0]==='visual').length,0);
 w.root.querySelector('#ad-no-copy').onclick();await until(()=>!!w.api.entry(f));
 const request=w.calls.find(c=>c[0]==='visual');assert.equal(request[3],'reconstruct');
 assert.deepEqual(plain(request[2].texts),[]);assert.equal(request[2].uncertain,false);
 assert.deepEqual(plain(request[2].packageLabels.slice(0,before.packageLabels.length)),before.packageLabels);
 assert.deepEqual(plain(request[2].packageLabels.at(-1)),{...before.texts[0],kind:'scene-marking'});assert.deepEqual(doc,before);
 assert.equal(request[5].textZone,null);assert.deepEqual(plain(w.api.entry(f).copy),[]);assert.equal(w.api.ready(f),false);
 assert.equal(w.root.querySelector('#ad-copy').value,'');assert.match(w.root.querySelector('#ad-type-status').textContent,/indicación tuya/);
});

test('no-copy after changing the classic target cannot generate an abandoned pending target',async()=>{
 const w=advertisementWorld({doc:uncertainCopy(),classicId:'9:16'}),f=w.formats[0];
 await w.api.prepareClassic(f);w.setClassic(null);w.root.querySelector('#ad-no-copy').onclick();
 for(let i=0;i<30;i++)await Promise.resolve();assert.equal(w.calls.filter(c=>c[0]==='visual').length,0);assert.equal(w.api.entry(f),undefined);
});

for(const cancel of ['clear','cancel-button'])test(cancel+' during automatic reconstruction discards its late visual',async()=>{
 const pending=deferred();let signal;
 const w=advertisementWorld({classicId:'9:16',make:(_image,_doc,_action,_region,options)=>{signal=options.signal;return pending.promise;}}),f=w.formats[0];
 const job=w.api.prepareClassic(f);await until(()=>!!signal);
 if(cancel==='clear')w.api.clear();else w.root.querySelector('#ad-cancel').onclick();
 assert.equal(signal.aborted,true);const status=w.status();pending.resolve({url:'data:image/png;base64,stale',verification:{protectedSubjects:[]}});await job;
 assert.equal(w.api.entry(f),undefined);assert.equal(w.api.ready(f),false);assert.equal(w.status(),status);
});

test('without advertising copy is an explicit immutable transformation that retains the package identity',()=>{
 const original=uncertainCopy(),before=structuredClone(original);Object.freeze(original);Object.freeze(original.texts);
 const clean=adCore.withoutAdvertisingCopy(original);
 assert.deepEqual(clean.texts,[]);assert.equal(clean.uncertain,false);
 assert.deepEqual(clean.packageLabels.slice(0,before.packageLabels.length),before.packageLabels);
 assert.deepEqual(clean.packageLabels.at(-1),{...before.texts[0],kind:'scene-marking'});
 assert.deepEqual(clean.subjects,before.subjects);assert.equal(clean.scene,before.scene);assert.deepEqual(original,before);
 const prompt=visualPrompt('reconstruct',clean,{w:1080,h:1920},{textZone:null});assert.match(prompt,/SOL/);
 assert.match(prompt,/UNCONFIRMED OCR/);assert.match(prompt,/Preserve actual product markings, signs and graffiti/);
 assert.doesNotMatch(prompt,/Remove all advertising typography/);assert.match(prompt,/packaging/);assert.match(prompt,/brand/);
 assert.match(prompt,/Return only the extended photograph, without added advertising overlays/);
 assert.doesNotMatch(prompt,/text-free visual|Exact original copy will be added/);
 const duplicated={...before,texts:[{text:' SOL '},{text:' MURAL '},{text:'MURAL'},{text:'  '}]};
 const once=adCore.withoutAdvertisingCopy(duplicated);
 assert.deepEqual(once.packageLabels.map(x=>x.text),['SOL','MURAL']);assert.equal(once.packageLabels.at(-1).kind,'scene-marking');
});

test('reanalysis resumes an uncertain pending classic, while an independent analysis does not autogenerate',async()=>{
 for(const pending of [false,true]){
  let count=0;const w=advertisementWorld({classicId:'9:16',extract:async()=>++count===1?uncertainCopy():structuredClone(w.noCopy)}),f=w.formats[0];
  if(pending)await w.api.prepareClassic(f);else await w.api.analyze();
  w.root.querySelector('#ad-analyze').onclick();
  if(pending){await until(()=>!!w.api.entry(f));assert.equal(w.calls.filter(c=>c[0]==='visual').length,1);}
  else{for(let i=0;i<30;i++)await Promise.resolve();assert.equal(w.calls.filter(c=>c[0]==='visual').length,0);assert.equal(w.api.entry(f),undefined);}
  assert.equal(count,2);
 }
});

test('classic full bleed covers a rounded provider ratio proportionally and preserves protected products',()=>{
 const p=adCore.fullBleedPlacement(1920,1080,1344,768,[{box:[100,100,900,900]}]);
 assert.ok(p.x<=0&&p.y<=0);assert.ok(p.x+p.w>=1920&&p.y+p.h>=1080);
 assert.ok(Math.abs(p.w/p.h-1344/768)<1e-10,'the photograph is never stretched');
 assert.throws(()=>adCore.fullBleedPlacement(1920,1080,1080,1920),/visual-ratio/);
 assert.throws(()=>adCore.fullBleedPlacement(1920,1080,1344,768,[{box:[0,0,1000,1000]}]),/visual-product-crop/);
 for(const dims of [[0,1080,1344,768],[1920,1080,Infinity,768]])assert.throws(()=>adCore.fullBleedPlacement(...dims),/visual-ratio/);
 const draws=[],ctx={fillRect(){},drawImage:(_image,...rect)=>draws.push(rect),measureText:()=>({width:0})},doc={texts:[],subjects:[]};
 const canvas={width:1920,height:1080,getContext:()=>ctx},visual={width:1344,height:768};
 renderAdvertisement(canvas,visual,doc);assert.deepEqual(draws.at(-1),[15,0,1890,1080],'ordinary formats keep contain');
 renderAdvertisement(canvas,visual,doc,{immersive:true,fullBleed:true,protectedSubjects:[{box:[100,100,900,900]}]});
 assert.deepEqual(draws.at(-1),[p.x,p.y,p.w,p.h]);
});
