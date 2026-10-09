import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {canEnterPortrait,portraitEntryPlan,selectPortraitEntry,portraitDimensions} from '../adaptaciones/portrait-entry.mjs';
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
