import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {canEnterPortrait,portraitEntryPlan,selectPortraitEntry,portraitDimensions} from '../adaptaciones/portrait-entry.mjs';
import {perfilDeSalida} from '../assets/signage-perfiles.js';
import {projectFormats} from '../adaptaciones/proyectos-core.mjs';

const read = path => readFileSync(new URL('../' + path, import.meta.url),'utf8');
const json = path => JSON.parse(read(path));
const landscape = {kind:'image',ancho:1920,alto:1080};
const standard = () => [{id:'16:9',nombre:'Horizontal',on:true},{id:'1:1',nombre:'Square',on:true},
  {id:'4:5',nombre:'Social',on:false},{id:'9:16',nombre:'Vertical',on:false}];
const plan = (formats, profile = 'standard', source = landscape, ready = true) => portraitEntryPlan({source,ready,formats,profile});
const withoutFlags = formats => formats.map(({on,...rest}) => rest);
function deepFreeze(value) { if(value && typeof value === 'object'){Object.freeze(value);Object.values(value).forEach(deepFreeze);}return value; }

test('entry requires a loaded horizontal still image; invalid dimensions and other media never enter', () => {
  assert.equal(canEnterPortrait(landscape,true),true);
  assert.equal(canEnterPortrait(landscape,false),false);
  for(const source of [null,{}, {...landscape,kind:'video'},{...landscape,kind:'anim'},
    {...landscape,kind:'audio'},{...landscape,ancho:1080,alto:1920},{...landscape,ancho:1080,alto:1080},
    {...landscape,alto:0},{...landscape,alto:-1},{...landscape,ancho:Infinity},
    {...landscape,ancho:1920.5},{...landscape,ancho:'1920'}]) {
    assert.equal(canEnterPortrait(source,true),false,JSON.stringify(source));
    assert.equal(plan(standard(),'standard',source),null);
  }
});

test('planning selects exact 9:16 without changing selections, formats, or saved project settings', () => {
  const formats=deepFreeze(standard()), before=JSON.stringify(formats);
  assert.deepEqual(plan(formats),{profile:'standard',id:'9:16',ancho:1080,alto:1920});
  assert.equal(JSON.stringify(formats),before);
  assert.equal(plan(formats,'standard',landscape,false),null);
  assert.equal(plan(formats,'unknown'),null);
  assert.equal(portraitEntryPlan({source:landscape,ready:true,formats:null,profile:'standard'}),null);
});

test('closest portrait ratio wins, equal-ratio candidates retain catalogue order, and generic custom sizes participate', () => {
  const formats=[{id:'first',custom:[720,1280]},{id:'second',custom:[1080,1920]},
    {id:'third',custom:[500,900]},{id:'wide',custom:[1920,1080]}];
  assert.equal(plan(formats).id,'first');
  assert.equal(plan(formats.slice(1)).id,'second');
  assert.equal(plan(formats.slice(2)).id,'third');
  assert.equal(plan([{id:'square',custom:[600,600]},{id:'bad',custom:[0,900]}]),null);
});

test('real Altadis formats stay in their project and changing selection touches only on flags in that family', () => {
  const ficha=json('adaptaciones/proyectos/altadis-estancos-bcn.json');
  const own=projectFormats(ficha,{estandar:json('adaptaciones/perfil-cliente-18.json').formats,
    especiales:json('adaptaciones/perfil-cliente-especiales.json').layouts});
  own.filter(f=>f.especial).forEach(f=>f.on=true);
  const formats=[...standard(),...own], before=structuredClone(formats), savedFicha=JSON.stringify(ficha);
  const entry=plan(formats,'proyecto');
  assert.deepEqual(entry,{profile:'proyecto',id:'cliente-01',ancho:1080,alto:1920});
  assert.deepEqual(formats,before,'planning does not mutate');
  assert.equal(selectPortraitEntry(formats,entry),true);
  assert.deepEqual(formats.filter(f=>f.proyecto&&f.on).map(f=>f.id),['cliente-01']);
  assert.deepEqual(formats.filter(f=>!f.proyecto),before.filter(f=>!f.proyecto));
  assert.deepEqual(withoutFlags(formats),withoutFlags(before));
  assert.equal(JSON.stringify(ficha),savedFicha);
});

function wall(id, portrait) {
  return {id,nombre:id,proyecto:'fixture',especial:true,on:true,
    layout:{id,slug:id,entrega:portrait?[1920,1080]:[1080,1920],celda:portrait?[960,540]:[540,960],
      rejilla:{columnas:2,filas:2},celdasSinUso:[],pared:portrait?{columnas:1,filas:4}:{columnas:4,filas:1}}};
}
test('special orientation comes from the physical wall, never the delivery atlas', () => {
  const landscapeWall=wall('wide-wall',false),portraitWall=wall('tall-wall',true);
  assert.deepEqual(portraitDimensions(landscapeWall),{ancho:2160,alto:960});
  assert.deepEqual(portraitDimensions(portraitWall),{ancho:960,alto:2160});
  assert.deepEqual(plan([landscapeWall,portraitWall],'especiales'),{profile:'especiales',id:'tall-wall',ancho:960,alto:2160});
  assert.equal(plan([landscapeWall],'especiales'),null);
});

test('project scope includes its special walls; special-only scope preserves ordinary project selections', () => {
  const formats=[...standard(),{id:'project-wide',custom:[1920,1080],proyecto:'fixture',on:true},wall('tall-wall',true),wall('wide-wall',false)];
  assert.equal(plan(formats,'proyecto').id,'tall-wall');
  const before=structuredClone(formats),entry=plan(formats,'especiales');
  assert.equal(selectPortraitEntry(formats,entry),true);
  assert.deepEqual(formats.filter(f=>!f.especial),before.filter(f=>!f.especial));
  assert.deepEqual(formats.filter(f=>f.especial&&f.on).map(f=>f.id),['tall-wall']);
  assert.deepEqual(withoutFlags(formats),withoutFlags(before));
});

test('a project without portrait sizes falls back to the existing general 9:16 and preserves every project selection', () => {
  const formats=[...standard(),{id:'project-wide',custom:[3840,540],proyecto:'fixture',on:true},wall('wide-wall',false)];
  const before=structuredClone(formats),entry=plan(formats,'proyecto');
  assert.deepEqual(entry,{profile:'standard',id:'9:16',ancho:1080,alto:1920});
  assert.equal(selectPortraitEntry(formats,entry),true);
  assert.deepEqual(formats.filter(f=>f.proyecto),before.filter(f=>f.proyecto));
  assert.deepEqual(formats.filter(f=>!f.proyecto&&f.on).map(f=>f.id),['9:16']);
  assert.equal(selectPortraitEntry(formats,null),false);
  const unchanged=structuredClone(formats);
  assert.equal(selectPortraitEntry(formats,{profile:'proyecto',id:'missing'}),false);
  assert.deepEqual(formats,unchanged);
});

test('fallback must itself have valid portrait dimensions, even when the stored ID is 9:16', () => {
  for(const custom of [[1920,1080],[1080,1080],[0,1920],[1080,0],[1080,1920.5]]) {
    assert.equal(plan([{id:'project-wide',proyecto:'fixture',custom:[1920,1080]},
      {id:'9:16',custom}],'proyecto'),null);
  }
});

const production=read('adaptaciones/adaptaciones.js');
const begin=production.indexOf('// [PORTRAIT-ENTRY-START]'),end=production.indexOf('// [PORTRAIT-ENTRY-END]');
assert.ok(begin>=0&&end>begin,'production entry boundaries exist');
const entrySource=production.slice(begin,end);
function uiWorld(en=false, reducedMotion=false) {
  const formats=standard(),calls=[],button={hidden:false,disabled:false},status={textContent:''},profile={value:'standard'};
  const state={src:{ancho:1920,alto:1080},profile:'standard',compat:'fhd',sel:'16:9',fmt:{'9:16':{modo:'contain',fx:.3,fy:.7,zoom:1}},proyecto:'fixture'};
  const card={dataset:{f:'9:16'},tabIndex:0,focus:options=>calls.push(['focus',options]),scrollIntoView:options=>calls.push(['scroll',options])};
  const nodes={'#btn-portrait':button,'#export-status':status,'#format-profile':profile};
  let ready=true;
  const context=vm.createContext({state,srcKind:'image',FORMATOS:formats,canEnterPortrait,portraitEntryPlan,selectPortraitEntry,
    $:selector=>{assert.ok(nodes[selector],'unexpected DOM lookup '+selector);return nodes[selector];},
    t:(es,english)=>en?english:es,mediaReady:()=>ready,
    destino:format=>{assert.equal(state.profile,'standard');return perfilDeSalida({formato:format.id,compatibilidad:state.compat});},
    window:{matchMedia:query=>{assert.equal(query,'(prefers-reduced-motion: reduce)');return {matches:reducedMotion};}},
    document:{querySelectorAll:selector=>{assert.equal(selector,'#grid [data-f]');return [card];}},
    syncCompat:()=>calls.push(['compat']),buildGrid:()=>calls.push(['grid']),goStep:n=>calls.push(['step',n]),
    fetch:()=>assert.fail('entry must not request APIs'),save:()=>assert.fail('entry must not write preferences')});
  vm.runInContext(entrySource,context);
  return {context,state,formats,calls,button,status,profile,card,setReady:value=>ready=value};
}

for(const en of [false,true]) test('production '+(en?'EN':'ES')+' button selects portrait once and shows review guidance without media/API work', () => {
  const world=uiWorld(en),before=structuredClone(world.state),formatsBefore=structuredClone(world.formats);
  world.context.syncPortraitEntry();
  assert.equal(world.button.textContent,en?'Landscape → portrait':'Horizontal → vertical');
  assert.equal(world.button.hidden,false);assert.equal(world.button.disabled,false);
  assert.deepEqual(world.state,before);assert.deepEqual(world.formats,formatsBefore);assert.equal(world.calls.length,0);
  world.button.onclick();
  assert.equal(world.state.profile,'standard');assert.equal(world.state.sel,'9:16');assert.equal(world.profile.value,'standard');
  assert.deepEqual(world.calls.filter(x=>x[0]==='step'),[['step',2]]);
  assert.equal(world.calls.filter(x=>x[0]==='grid').length,1);
  assert.match(world.status.textContent,/Vertical.*1080×1920/);
  assert.match(world.status.textContent,en?/Review copy and product.*approving/:/Revisa texto y producto.*aprobar/);
  assert.deepEqual(world.state.fmt,before.fmt);assert.equal(world.state.proyecto,before.proyecto);
  assert.deepEqual(world.formats.filter(f=>f.on).map(f=>f.id),['9:16']);
  assert.equal(world.card.tabIndex,0);assert.equal(world.calls.filter(x=>x[0]==='focus').length,1);
  assert.equal(world.calls.find(x=>x[0]==='scroll')[1].behavior,'smooth');
});

test('reduced motion uses instant scroll and preserves the existing card keyboard focusability', () => {
  const world=uiWorld(false,true);world.button.onclick();
  assert.equal(world.card.tabIndex,0);
  assert.equal(world.calls.find(x=>x[0]==='scroll')[1].behavior,'instant');
  assert.equal(world.calls.filter(x=>x[0]==='step').length,1);
});

test('a source changed or unloaded after showing the button cannot select a destination or advance', () => {
  for(const stale of ['portrait','video','not-ready']) {
    const world=uiWorld();world.context.syncPortraitEntry();
    if(stale==='portrait')world.state.src={ancho:1080,alto:1920};
    if(stale==='video')world.context.srcKind='video';
    if(stale==='not-ready')world.setReady(false);
    const before=structuredClone(world.state),formatsBefore=structuredClone(world.formats);
    world.button.onclick();
    assert.deepEqual(world.state,before);assert.deepEqual(world.formats,formatsBefore);assert.equal(world.calls.length,0);assert.equal(world.status.textContent,'');
    world.context.syncPortraitEntry();assert.equal(world.button.hidden,true);assert.equal(world.button.disabled,true);
  }
});

for (const [compat,width,height] of [['universal',720,1280],['uhd',2160,3840]]) test('entry status reports effective '+compat+' output without changing compatibility or framing', () => {
  const world=uiWorld();world.state.compat=compat;const before=structuredClone(world.state);
  world.button.onclick();
  assert.ok(world.status.textContent.includes(width+'×'+height));
  assert.equal(world.state.compat,compat);assert.deepEqual(world.state.fmt,before.fmt);
  assert.equal(world.state.proyecto,before.proyecto);
  assert.deepEqual(world.calls.filter(x=>x[0]==='step'),[['step',2]]);
});
