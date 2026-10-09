import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {orientationPair} from '../adaptaciones/campaign-entry.mjs';
import {createCreatorCampaign,creatorTwinURL,retainCampaign,CREATOR_HISTORY,STEPS} from '../campanas/creador/creator-core.mjs';
import {newFull} from '../campanas/creador/creator-ai.mjs';
import {drawCreatorCampaign} from '../campanas/creador/creator-render.mjs';
import {INSTALLATIONS} from '../campanas/next-step/render.mjs';

const seed='0123456789abcdef0123456789abcdef';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const plain=x=>JSON.parse(JSON.stringify(x));
function ui({full=false,en=false}={}){
 const drawings=[],workStates=[],storage=new Map(),product={width:800,height:600};
 function element(tag){
  const children=[],context=new Proxy({measureText:text=>({width:[...text].length*20}),createRadialGradient:()=>({addColorStop(){}})},{get:(o,k)=>k in o?o[k]:()=>{}});
  const el={tagName:tag.toUpperCase(),children,childNodes:children,dataset:{},style:{},hidden:false,disabled:false,width:300,height:150,naturalWidth:0,naturalHeight:0,className:'',
   append(...items){for(const x of items){children.push(x);x.parent=this;}},prepend(x){children.unshift(x);x.parent=this;},replaceChildren(...items){children.splice(0);this.append(...items);},remove(){if(this.parent){const i=this.parent.children.indexOf(this);if(i>=0)this.parent.children.splice(i,1);}},
   setAttribute(k,v){this[k]=v;},scrollIntoView(){},getContext:()=>context,
   querySelectorAll(selector){const descendants=[];const visit=node=>{for(const child of node.children||[]){descendants.push(child);visit(child);}};visit(this);return descendants.filter(node=>selector.startsWith('#')?node.id===selector.slice(1):selector==='canvas[data-installation]'?node.tagName==='CANVAS'&&node.dataset.installation:selector.startsWith('.')?String(node.className||'').split(' ').includes(selector.slice(1)):node.tagName===selector.toUpperCase());},
   querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  };
  return el;
 }
 const stage=element('main'),head=element('head'),body=element('body');body.classList={add(){},remove(){}};
 const document={documentElement:{lang:en?'en':'es'},head,body,hidden:false,createElement:element,querySelector:selector=>selector==='.adapt-main'?stage:null};
 const clock=()=>({time:()=>3.25,paused:false,pause(){this.paused=true;},play(){this.paused=false;}});
 const context=vm.createContext({document,URL,URLSearchParams,Blob,Option:class{constructor(text,value){this.textContent=text;this.value=value;}},orientationPair,createCreatorCampaign,creatorTwinURL,retainCampaign,CREATOR_HISTORY,STEPS,INSTALLATIONS,newFull,
  drawCreatorCampaign:(canvas,installation,source,seconds,campaign)=>{drawings.push({canvas,installation,source,seconds,campaign});return drawCreatorCampaign(canvas,installation,source,seconds,campaign);},
  createClock:clock,loadNextStepAssets:async()=>product,startCreatorFull:()=>assert.fail('orientation previews never start AI'),runFull:()=>assert.fail('render never starts the paid pipeline'),saveFull:()=>assert.fail('render never changes a saved job'),
  mountAdmiritoWork:({host})=>({update(state){workStates.push({...state,host:host()});},destroy(){assert.fail('a reusable workshop hides its companion on stop');}}),
  localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},location:{href:'https://admira.studio/creador/',origin:'https://admira.studio',search:''},
  window:{addEventListener(){},history:{replaceState(){}}},setTimeout:()=>1,clearTimeout(){},requestAnimationFrame:()=>1,cancelAnimationFrame(){},
  fetch:()=>assert.fail('previews do not call providers'),fixture:createCreatorCampaign(seed,en)
 });
 const path=full?'campanas/creador/full-demo.mjs':'campanas/creador/demo.mjs';
 const script=read(path).replace(/^import .*;\n/gm,'').replaceAll('import.meta.url',"'https://admira.studio/"+path+"'").replace('export async function startCreatorFull','async function startCreatorFull');
 vm.runInContext(script,context);
 return{context,document,stage,drawings,workStates,storage,product,run:code=>vm.runInContext(code,context)};
}

for(const en of [false,true])test(`${en?'EN':'ES'} local Creator demo starts with both orientations from one product, copy and clock`,async()=>{
 const w=ui({en});await w.context.window.CreatorDemo.run('restore '+seed);
 const pair=w.stage.querySelector('.creator-orientation-pair'),canvases=pair.querySelectorAll('canvas[data-installation]');
 assert.deepEqual(canvases.map(cv=>cv.dataset.installation),['landscape','portrait']);
 assert.ok(canvases.every(cv=>!cv.hidden));assert.ok(canvases[0].height<canvases[0].width);assert.ok(canvases[1].height>canvases[1].width);
 const draws=w.drawings.slice(-2);assert.ok(draws.every(d=>d.source===w.product&&d.seconds===3.25));assert.equal(draws[0].campaign,draws[1].campaign);
 assert.equal(draws[0].campaign.seed,seed);assert.equal(draws[0].campaign.headline,w.context.fixture.headline);
 assert.equal(w.context.window.CreatorDemo.active,true);
});

test('full Creator renders the orientation pair before media and reuses the single received image for both drafts',()=>{
 const w=ui({full:true});
 w.run("job=newFull(fixture);active=true;step=0;mount();root.hidden=false;render();");
 let pair=w.stage.querySelector('.creator-orientation-pair');assert.ok(pair);
 assert.deepEqual(pair.querySelectorAll('canvas[data-installation]').map(cv=>cv.dataset.installation),['landscape','portrait']);
 const original=plain(w.run('job'));
 assert.equal(w.workStates.at(-1).busy,false,'brief previews do not pretend a provider is working');
 w.run("job.image={id:'image-123',url:'https://api.admira.store/stock/asset/image-123'};job.phase='image-archived';step=2;render();");
 const source=w.stage.querySelector('#creator-full-source');source.naturalWidth=1280;source.naturalHeight=720;source.onload();
 pair=w.stage.querySelector('.creator-orientation-pair');
 assert.equal(pair.querySelectorAll('canvas[data-installation]').length,2);
 const draws=w.drawings.slice(-2);assert.ok(draws.every(d=>d.source===source&&d.seconds===3.25));
 assert.ok(draws.every(d=>d.campaign.seed===original.seed&&d.campaign.headline===original.campaign.headline));
 assert.equal(w.run('job.events.length'),0,'rendering both drafts adds no provider requests or job transitions');
 assert.deepEqual(plain(w.run('job.prompts')),original.prompts);
});

test('full Creator companion follows actual image/video jobs and hides on errors, completion and stop',()=>{
 const w=ui({full:true});w.run('job=newFull(fixture);active=true;step=2;mount();root.hidden=false;');
 for(const phase of ['image-requested','video-requested','video-pending']){
  w.context.phase=phase;w.run('job.phase=phase;busy=true;render();');
  assert.equal(w.workStates.at(-1).busy,true);assert.equal(w.workStates.at(-1).phase,'create');
  assert.equal(w.workStates.at(-1).host,w.stage.querySelector('.creator-full-work'));
 }
 w.run("job.error='request-result-unknown';paintStatus();");assert.equal(w.workStates.at(-1).busy,false);
 w.run("job.error=null;job.phase='media-ready';paintStatus();");assert.equal(w.workStates.at(-1).busy,false);
 w.run("job.phase='video-pending';busy=false;paintStatus();");assert.equal(w.workStates.at(-1).busy,false);
 w.run("busy=true;paintStatus();");assert.equal(w.workStates.at(-1).busy,true);
 w.context.window.CreatorFull.stop();assert.equal(w.workStates.at(-1).busy,false);
});
