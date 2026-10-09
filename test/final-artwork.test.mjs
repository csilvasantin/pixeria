import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {finalArtworkPrompt} from '../assets/final-artwork.mjs';
import {fullPrompts} from '../campanas/creador/creator-ai.mjs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const app=read('app.js');
function appFunction(name){
 const start=app.search(new RegExp('  (?:async )?function '+name+'\\('));assert.ok(start>=0,name);
 const rest=app.slice(start),next=rest.slice(1).search(/\n  (?:async )?function \w+\(/);
 return (next<0?rest:rest.slice(0,next+1)).replace(/\bimport\(/g,'importModule(');
}
function assertArtwork(prompt,brief,video=false){
 assert.equal(typeof prompt,'string');assert.ok(prompt.startsWith(brief));
 assert.ok(prompt.includes(`finished ${video?'video':'image'} itself`));
 assert.match(prompt,/filling the whole requested canvas edge to edge/);
 assert.match(prompt,/Do not present the artwork inside a photographed screen, billboard, frame/);
 assert.match(prompt,/explicitly asks.*preserve that requested subject/);
}
const importModule=async path=>{assert.equal(path,'/assets/final-artwork.mjs?v=artwork-1');return {finalArtworkPrompt};};

test('delivery context preserves the creative brief and an explicitly requested display subject',()=>{
 for(const brief of ['Café con hielo para pantallas de retail','Un café para pantalla 9:16','Fotografía de un anuncio en una pantalla dentro de una tienda','A framed painting on a gallery wall, photographed in its room']){
  assertArtwork(finalArtworkPrompt(brief),brief);
  assertArtwork(finalArtworkPrompt(brief,{video:true}),brief,true);
 }
 const prompts=fullPrompts({seed:'0123456789abcdef',name:'Sneakers Store',accent:'#00DDEE',secondary:'#FFCC00'});
 assertArtwork(prompts.image,'Photorealistic premium sneaker');assertArtwork(prompts.video,'Animate this exact sneaker',true);
 assert.match(prompts.image,/No people, no lettering, no logos/);assert.match(prompts.video,/Preserve the sneaker design/);
});

test('single and comparison image generation receive finished artwork while retaining user style and explicit scene',async()=>{
 for(const motors of [['nano-banana'],['nano-banana','grok-imagine-image-pro']]){
  const received=[],brief='Un café con hielo en una pantalla fotografiada dentro de un bar';
  const context=vm.createContext({importModule,loadStore:()=>({imagenes:{prompt:brief,motors,encuadre:'Horizontal 16:9',realismo:'fotográfico',luz:'luz de tarde',paleta:'turquesa'}}),loadKeys:()=>({}),
   playNanoBanana:async(_s,prompt)=>received.push(prompt),compareSelectedImages:async(_motors,_s,prompt,w,h)=>{assert.equal(w,1024);assert.equal(h,576);received.push(prompt);}});
  await vm.runInContext(appFunction('playImagenes')+'\nplayImagenes();',context);
  assert.equal(received.length,1);assertArtwork(received[0],brief);assert.match(received[0],/fotográfico, luz de tarde, turquesa/);
 }
});

test('all video engines receive a resolved finished-video prompt and retain audio direction',async()=>{
 for(const engine of ['playVeo','playGrokVideo','playPollinationsVideo','compareSelectedVideos']){
  const received=[],s={hook:'Café con hielo',desarrollo:'Giro suave de cámara',cierre:'Playa de Barcelona',cta:'Pruébalo',canal:'Pantalla evento 16:9'};
  const capture=async prompt=>{received.push(prompt);return {ok:false,error:'simulated-stop'};};
  const context=vm.createContext({importModule,loadStore:()=>({imagenes:{paleta:'azul'}}),ASPECT_VEO:{'Pantalla evento 16:9':'16:9'},veoDuration:()=>6,
   parseVeoMotor:id=>({model:id,resolution:'720p',costPerSec:.4,label:'Fixture'}),confirmPro:async()=>true,genVeoRaw:capture,genGrokVideoRaw:capture,
   showPlayer:()=>{},progressHtml:()=>'',startProgress:()=>()=>{},escAttr:s=>s,document:{querySelectorAll:()=>[],querySelector:()=>null},
   AbortController,URLSearchParams,setTimeout:()=>0,clearTimeout:()=>{},ELEVEN_WORKER_URL:'https://fixture.invalid',
   paidFetch:async url=>{received.push(new URL(url).searchParams.get('prompt'));return new Response('simulated-stop',{status:503});}});
  const call=engine==='compareSelectedVideos'?`${engine}(['veo-fixture'],input);`:`${engine}(input);`;context.input=s;
  await vm.runInContext(appFunction('buildVeoPrompt')+appFunction(engine)+'\n'+call,context);
  assert.equal(received.length,1,engine);assertArtwork(received[0],'Café con hielo',true);
  assert.match(received[0],/CTA: Pruébalo/);assert.match(received[0],/appropriate ambient sound and music/);
 }
});

test('image-to-video single and batch routes send finished-video briefs without changing their source',async()=>{
 const nodes=new Map(),listeners=new Map(),sent=[];
 const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',files:[],hidden:true,addEventListener:(event,fn)=>listeners.set(id,fn)});return nodes.get(id);};
 node('clip-prompt').value='Animar el vaso completo';node('clip-stock').value='source-fixture';node('clip-scenes').value='Café en una pantalla fotografiada || stock-a\nCámara sobre la playa || stock-b';
 const context=vm.createContext({importModule,document:{getElementById:node},setTimeout:fn=>fn(),fetch:async(url,options={})=>{
  if(url==='/auth/api-token')return Response.json({token:'fixture'});
  if(options.method==='POST'){const body=JSON.parse(options.body);sent.push(body);return Response.json(body.scenes?{scenes:body.scenes.map((_,i)=>({request_id:'fixture-'+i}))}:{request_id:'fixture'});}
  return Response.json({archived:true,url:'https://fixture.invalid/clip.mp4'});
 }});
 vm.runInContext(read('assets/clip-desde-imagen.js').replace(/\bimport\(/g,'importModule('),context);
 await listeners.get('clip-one')();await listeners.get('clip-batch')();
 assert.equal(sent.length,2);assertArtwork(sent[0].prompt,'Animar el vaso completo',true);assert.equal(sent[0].stock_id,'source-fixture');
 assert.equal(sent[1].scenes.length,2);assertArtwork(sent[1].scenes[0].text,'Café en una pantalla fotografiada',true);assertArtwork(sent[1].scenes[1].text,'Cámara sobre la playa',true);
 assert.equal(sent[1].scenes[0].stock_id,'stock-a');assert.equal(sent[1].scenes[1].stock_id,'stock-b');
});
