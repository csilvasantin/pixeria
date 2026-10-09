import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as core from '../adaptaciones/campaign-core.mjs';
import {CREATOR_KEY,newCampaign} from '../adaptaciones/campaign-entry.mjs';
import {campaignComposition} from '../adaptaciones/campaign-composition.mjs';
import {publishAdaptation,PARTS_THRESHOLD} from '../adaptaciones/stock-publish.mjs';

const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const plain=x=>JSON.parse(JSON.stringify(x));
const json=body=>new Response(JSON.stringify(body),{headers:{'Content-Type':'application/json'}});
globalThis.FileReader??=class{
 readAsDataURL(blob){blob.arrayBuffer().then(bytes=>{this.result=`data:${blob.type};base64,${Buffer.from(bytes).toString('base64')}`;this.onload();},error=>{this.error=error;this.onerror();});}
};

// Run the actual workshop handlers and canvas renderer with a small DOM, never a provider.
async function workshop({two=false}={}){
 const published=[],queued=[],elements=[],campaign=plain(core.DEFAULT_CAMPAIGN);
 campaign.headline='CAFÉ CON HIELO · 1,99 €';campaign.cta='DISFRUTA HOY';campaign.price='1,99 €';
 campaign.installations=campaign.installations.slice(0,two?2:1);
 campaign.installations[0].screens[0].rotation=90;
 function element(tag='div'){
  const nodes=new Map(),children=[];
  const e={tagName:tag.toUpperCase(),children,dataset:{},hidden:false,disabled:false,value:'',checked:true,width:300,height:150,
   classList:{add(){},remove(){}},append(...items){children.push(...items);},after(){},before(){},setAttribute(k,v){this[k]=v;},scrollIntoView(){},click(){},
   replaceChildren(...items){children.splice(0,children.length,...items);},
   querySelector(selector){if(!nodes.has(selector))nodes.set(selector,element(selector.includes('canvas')?'canvas':'div'));return nodes.get(selector);},
   querySelectorAll(selector){
    if(e.className!=='campaign-options'||!['[data-field]','input,textarea,select'].includes(selector))return[];
    return e.fields??= ['name','headline','cta','price','background','accent','foreground','seconds'].map(field=>{const input=element('input');input.dataset.field=field;return input;});
   },
   getContext(){return context;},toBlob(callback,type){callback(new Blob([`${e.width}x${e.height}`],{type}));},toDataURL(){return'data:image/png;base64,AA==';}
  };
  const context=new Proxy({measureText(text){const px=Number(this.font?.match(/ (\d+(?:\.\d+)?)px/)?.[1]||20);return{width:[...text].length*px*.5};},createLinearGradient(){return{addColorStop(){}};}},{get:(o,k)=>k in o?o[k]:()=>{}});
  elements.push(e);return e;
 }
 const main=new Map(),document={documentElement:{lang:'es'},body:element(),fonts:{add(){}},createElement:element,querySelector(s){if(!main.has(s))main.set(s,element());return main.get(s);}};
 const context=vm.createContext({...core,CREATOR_KEY,newCampaign,campaignComposition,document,URL,URLSearchParams,Blob,TextEncoder,
  location:{pathname:'/creador/',search:''},window:{history:{replaceState(){}}},
  localStorage:{getItem:key=>key===CREATOR_KEY?JSON.stringify(campaign):null,setItem(){}},
  Image:class{naturalWidth=800;naturalHeight=600;async decode(){}},FontFace:class{async load(){}},Option:class{},
  geometry:()=>assert.fail('no special installation request'),FFLATE:{},setTimeout:callback=>callback(),
  publishAdaptation:(blob,meta,extra)=>publishAdaptation(blob,meta,extra,{fetch:async(url,init)=>{assert.equal(url,'/stock-publish');published.push(JSON.parse(init.body));return json({ok:true,id:'png-'+published.length,num:100+published.length});}})
 });
 vm.runInContext(source('adaptaciones/campaign-render.mjs').replaceAll('export function ','function '),context);
 vm.runInContext(source('adaptaciones/campaign-studio.mjs').replace(/^import .*;\n/gm,'').replace('export function mountCampaign','function mountCampaign'),context);
 context.mountCampaign({t:es=>es,queue:{add:item=>{queued.push(item);return item;},note(){}}});
 await new Promise(resolve=>setImmediate(resolve));
 const root=elements.find(e=>e.id==='campaign-workshop'),options=elements.find(e=>e.className==='campaign-options');
 return{root,options,published,queued,campaign,context,elements};
}

test('manual approved Creator PNG reaches Stock as an image with native rotated dimensions and exact composition',async()=>{
 const w=await workshop(),button=w.root.querySelector('#campaign-publish-png');
 assert.equal(button.disabled,true);assert.equal(w.published.length,0,'opening Creator never publishes');
 await button.onclick();assert.equal(w.published.length,0,'programmatic clicks cannot skip review');
 w.root.querySelector('#campaign-approve').onclick();assert.equal(button.disabled,false);
 await button.onclick();
 assert.equal(w.published.length,1);assert.equal(w.queued.length,0,'PNG publication does not enqueue an MP4');
 const body=w.published[0];
 assert.equal(body.type,'image');assert.equal(body.mime,'image/png');assert.deepEqual(body.dimensions,{width:1080,height:1920});
 assert.equal(Buffer.from(body.base64,'base64').toString(),'1080x1920');
 assert.deepEqual([body.validacion.ancho,body.validacion.alto,body.validacion.duracion],[1080,1920,null]);
 assert.equal(body.composition.mediaType,'image');assert.equal(body.composition.complete,true);
 assert.deepEqual([body.composition.width,body.composition.height],[1080,1920]);
 assert.deepEqual(body.composition.copy.map(x=>x.text),['SNEAKERS','STORE',w.campaign.headline,w.campaign.cta,w.campaign.price]);
 assert.ok(body.tags.includes('campaign:sneakers-store'));assert.match(body.externalRef,/:r1$/);
 assert.equal('poster' in body,false,'PNG uses its image, without video poster extraction');
});

test('every included piece needs review before any PNG is uploaded; a changed revision invalidates that approval',async()=>{
 const w=await workshop({two:true}),button=w.root.querySelector('#campaign-publish-png');
 w.root.querySelector('#campaign-approve').onclick();await button.onclick();assert.equal(w.published.length,0,'second included piece has not been reviewed');
 w.root.querySelector('.campaign-destinations').children[1].onclick();w.root.querySelector('#campaign-approve').onclick();assert.equal(button.disabled,false);
 // Changing inclusion uses the same changed() revision/reset path as text, assets and maps.
 w.root.querySelector('#campaign-include').onchange({target:{checked:false}});
 assert.equal(button.disabled,true);await button.onclick();assert.equal(w.published.length,0,'old approval cannot publish the new revision');
 w.root.querySelector('.campaign-destinations').children[0].onclick();w.root.querySelector('#campaign-approve').onclick();
 await button.onclick();assert.equal(w.published.length,1);assert.match(w.published[0].externalRef,/:r2$/);
});

test('editing authored copy invalidates PNG approval and the next approved revision publishes the revised exact text',async()=>{
 const w=await workshop(),button=w.root.querySelector('#campaign-publish-png');
 w.root.querySelector('#campaign-approve').onclick();assert.equal(button.disabled,false);
 const headline=w.options.querySelectorAll('[data-field]').find(e=>e.dataset.field==='headline');
 headline.value='NUEVO CAFÉ · 2,49 €';headline.oninput();
 assert.equal(button.disabled,true);await button.onclick();assert.equal(w.published.length,0);
 w.root.querySelector('#campaign-approve').onclick();await button.onclick();
 assert.equal(w.published.length,1);assert.match(w.published[0].externalRef,/:r2$/);
 assert.ok(w.published[0].composition.copy.some(x=>x.text==='NUEVO CAFÉ · 2,49 €'));
 assert.ok(w.published[0].composition.copy.every(x=>x.text!==w.campaign.headline));
});

test('the existing MP4 queue and publication retain video type, frame clock and video composition',async()=>{
 const w=await workshop();w.root.querySelector('#campaign-approve').onclick();
 w.root.querySelector('#campaign-mp4').onclick();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(w.published.length,0);assert.equal(w.queued.length,1);
 const item=w.queued[0];assert.deepEqual([item.job.W,item.job.H],[1080,1920]);
 assert.equal(item.job.args[item.job.args.indexOf('-r')+1],'25');
 item.state='done';item.files=[{blob:new Blob(['mp4'],{type:'video/mp4'}),output:{W:1080,H:1920}}];
 await w.root.querySelector('#campaign-publish').onclick();
 assert.equal(w.published.length,1);assert.equal(w.published[0].type,'video');assert.equal(w.published[0].mime,'video/mp4');
 assert.equal(w.published[0].composition.mediaType,'video');assert.equal(w.published[0].validacion.duracion,10);
});

test('the ZIP path retains per-panel PNGs and the portable campaign without publishing',async()=>{
 const w=await workshop(),packages=[];
 w.context.loadZip=async()=>({zipSync:files=>{packages.push(files);return new Uint8Array([1]);}});
 w.root.querySelector('#campaign-approve').onclick();w.root.querySelector('#campaign-zip').onclick();
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(w.published.length,0);assert.equal(w.queued.length,0);assert.equal(packages.length,1);
 const files=packages[0],name=Object.keys(files).find(k=>k.endsWith('.png'));
 assert.match(name,/-1080x1920\.png$/);assert.equal(new TextDecoder().decode(files[name]),'1080x1920');
 assert.equal(JSON.parse(new TextDecoder().decode(files['campaign.json'])).campaign.headline,w.campaign.headline);
});

test('large PNG uses image/png for multipart staging as well as the final Stock body',async()=>{
 const calls=[],key='uploads/creator-native.png',blob=new Blob([new Uint8Array(PARTS_THRESHOLD+1)],{type:'image/png'});
 const fetch=async(url,init)=>{
  const action=new URL(url,'https://example.test').pathname;
  if(action==='/stock-upload/part')return json({etag:'png-etag',partNumber:1});
  const body=JSON.parse(init.body);calls.push({action,body});
  if(action==='/stock-upload/start')return json({ok:true,key,uploadId:'test-upload',partSize:blob.size});
  return json({ok:true,key,size:blob.size,id:'large-png'});
 };
 const result=await publishAdaptation(blob,{type:'image',title:'Creator PNG',format:'portrait',width:1080,height:1920},null,{fetch});
 assert.equal(result.ok,true);assert.deepEqual(calls[0].body,{type:'image',mime:'image/png',motor:'adaptador',size:blob.size});
 const body=calls.at(-1).body;assert.equal(body.type,'image');assert.equal(body.mime,'image/png');assert.equal(body.r2Staged,key);assert.equal('base64' in body,false);
});
