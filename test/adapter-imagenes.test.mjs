// Adaptador · imágenes fijas (Carlos, 5-oct-2026): el índice del Stock con imágenes y vídeos, su orden
// por fecha, el plan FFmpeg imagen → MP4 (dimensiones, 25 fps, duración, sin audio) y, con
// ADAPTER_FFMPEG_TEST=1, FFmpeg nativo + ffprobe sobre JPG y PNG con alfa.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import vm from 'node:vm';
import {exportJob,stillJob,stillSeconds,STILL,STILL_TYPES,STILL_PREP,defaults} from '../adaptaciones/adapter-core.mjs';
import {segmentsJob,atlasJob,geometry} from '../adaptaciones/especiales-core.mjs';
import {stockPayload} from '../adaptaciones/stock-publish.mjs';
import {perfilDeSalida,planificar} from '../assets/signage-perfiles.js';

// stock-fuentes.js es un script clásico: se ejecuta en un contexto vm como en el navegador.
const ctx={};vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('../adaptaciones/stock-fuentes.js',import.meta.url),'utf8'),ctx);
const F=ctx.PixeriaStockFuentes;
const S='https://stock.admira.store/stock/';
// Forma real del índice (la imagen del café es la entrada 1381 de stock/index.json, 5-oct-2026).
const cafe={id:'1791230658801-jnv969',type:'image',motor:'grok-imagine-image',title:'Un anuncio de café humeando, fotografía de alta calidad, sin texto.',mime:'image/jpeg',ext:'jpg',size:199360,thumbnail:null,poster:null,url:`${S}1791230658801-jnv969/asset.jpg?v=199360`,createdAt:'2026-10-05T20:04:18.801Z'};
const items=[
 {id:'v-old',type:'video',url:`${S}v-old/asset.mp4`,createdAt:'2026-10-01T10:00:00Z'},
 cafe,
 {id:'png-ext',type:'image',ext:'png',url:`${S}png-ext/asset.png`,createdAt:'2026-10-03T10:00:00Z'},
 {id:'webp-url',type:'image',url:`${S}webp-url/asset.webp?v=1`,createdAt:'2026-10-02T10:00:00Z'},
 {id:'1791228281962-gdtywe',type:'image',mime:'image/jpeg',url:`${S}gdtywe/asset.jpg`}, // sin createdAt: fecha del id
 {id:'gif',type:'image',mime:'image/gif',ext:'gif',url:`${S}gif/asset.gif`,createdAt:'2026-10-05T23:00:00Z'},
 {id:'bin',type:'image',mime:'text/html; charset=utf-8',ext:'bin',url:`${S}bin/asset.bin`,createdAt:'2026-10-05T23:00:00Z'},
 {id:'svg',type:'image',url:`${S}svg/asset.svg`,createdAt:'2026-10-05T23:00:00Z'},
 {id:'http',type:'image',mime:'image/png',url:'http://example.com/a.png',createdAt:'2026-10-05T23:00:00Z'},
 {id:'audio',type:'audio',mime:'audio/mpeg',url:`${S}audio/asset.mp3`,createdAt:'2026-10-05T23:00:00Z'},
 {id:'capsula',type:'capsula',url:`${S}capsula/asset.mp4`,createdAt:'2026-10-05T23:00:00Z'},
 {id:'v-new',type:'video',mediaUrl:`${S}v-new/asset.mp4`,createdAt:'2026-10-05T19:13:26.723Z'},
 {id:'v-tie',type:'video',url:`${S}v-tie/asset.mp4`,createdAt:'2026-10-03T10:00:00Z'},
];

// Desde «formatos de entrada» (5-oct-2026) GIF y SVG también entran (ver adapter-formatos.test.mjs).
test('index filter: videos plus JPG/PNG/WebP/GIF/SVG images with https URLs; non-images, unknown formats and http stay out',()=>{
 const ids=F.fuentes(items).map(it=>it.id).sort();
 assert.deepEqual(ids,['1791228281962-gdtywe','1791230658801-jnv969','gif','png-ext','svg','v-new','v-old','v-tie','webp-url']);
 assert.equal(F.tipo(cafe),'image');assert.equal(F.tipo(items[0]),'video');assert.equal(F.tipo(items.find(i=>i.id==='gif')),'image');assert.equal(F.tipo(items.find(i=>i.id==='bin')),null);
 assert.deepEqual(['1791230658801-jnv969','png-ext','webp-url','gif','bin'].map(id=>F.extension(items.find(i=>i.id===id))),['jpg','png','webp','gif',null]);
 assert.equal(F.tipo(null),null);assert.equal(F.fuentes(undefined).length,0);
 // Las extensiones que reconoce el índice son las que FFmpeg recibe para la imagen original.
 assert.deepEqual([...new Set(Object.values(STILL_TYPES))].sort(),['avif','gif','heic','jpg','png','svg','webp']);
});

test('order by date: most recent first whatever the type, id stamp when createdAt is missing, stable ties',()=>{
 const order=F.fuentes(items).map(it=>it.id);
 assert.deepEqual(order,['gif','svg','1791230658801-jnv969','1791228281962-gdtywe','v-new','png-ext','v-tie','webp-url','v-old']);
 // «Elegir el último contenido generado»: la imagen del café va primera aunque el índice venga desordenado.
 assert.equal(F.fuentes([...items].reverse().filter(i=>!['gif','svg'].includes(i.id)))[0].id,'1791230658801-jnv969');
 assert.equal(F.fecha({id:'1791228281962-gdtywe'}),1791228281962);
 assert.deepEqual(F.ordenar([{id:'a',createdAt:'x'},{id:'b'},{id:'c',createdAt:'x'}]).map(i=>i.id),['a','b','c']);
});

test('the real Stock index, when saved locally, lists the coffee image first (STOCK_INDEX=/path/index.json)',{skip:!process.env.STOCK_INDEX},()=>{
 const list=F.fuentes(JSON.parse(readFileSync(process.env.STOCK_INDEX,'utf8')).items);
 assert(list.some(it=>it.type==='image')&&list.some(it=>it.type==='video'));
 for(let i=1;i<list.length;i++)assert(F.fecha(list[i-1])>=F.fecha(list[i]));
});

const src={ancho:1280,alto:720,fps:25,bitrateKbps:0};
const profile=perfilDeSalida({formato:'custom',ancho:1080,alto:1920,compatibilidad:'fhd'}),tech=planificar(src,profile);
const arg=(args,k)=>args[args.indexOf(k)+1];

test('still-image plan: -loop 1 at 25 fps for N seconds, same reframing and encoder settings, no audio',()=>{
 for(const mode of ['cover','contain','blur']){
  const base=exportJob(src,profile,tech,mode,{fx:.2,fy:.8,zoom:1.3},'cafe.jpg','9:16'),job=stillJob(base,10,'input.png');
  assert.deepEqual(job.args.slice(0,8),['-loop','1','-framerate','25','-t','10','-i','input.png']);
  assert.equal(arg(job.args,'-filter_complex'),arg(base.args,'-filter_complex').replace('[0:v]',`[0:v]${STILL_PREP},`),'same reframing as the video, after flattening to RGB');
  assert.match(arg(job.args,'-filter_complex'),/scale=1080:1920|overlay=/);
  assert.equal(arg(job.args,'-r'),'25');assert.equal(arg(stillJob({...base,args:base.args.map((x,i)=>base.args[i-1]==='-r'?'30':x)},10).args,'-r'),'25','always 25 fps');assert.equal(arg(job.args,'-b:v'),arg(base.args,'-b:v'));assert.equal(arg(job.args,'-tune'),'stillimage');assert.equal(arg(job.args,'-color_range'),'tv');
  assert(!job.args.includes('0:a?')&&!job.args.includes('-c:a')&&!job.args.includes('aac'),'no audio mapping');
  assert.equal(job.args[job.args.indexOf('[out]')+1],'-an');
  assert.equal(job.args.at(-1),'output.mp4');assert.equal(job.filename,'cafe-9x16-1080x1920.mp4');
  assert.deepEqual([job.W,job.H,job.still,job.input],[1080,1920,10,'input.png']);
  assert.equal(base.input,undefined,'the video job is untouched');
 }
 assert.equal(arg(stillJob(exportJob(src,profile,tech,'cover',defaults(),'x','1:1'),3,'input.webp').args,'-i'),'input.webp');
});

test('MP4 length: 10 s by default, whole seconds from 1 to 60',()=>{
 assert.equal(STILL.default,10);assert.equal(STILL.fps,25);
 assert.deepEqual([undefined,null,'',0,-5,'abc',NaN].map(stillSeconds),[10,10,10,10,10,10,10]);
 assert.deepEqual([1,'7',1.4,59.6,60,61,600].map(stillSeconds),[1,7,1,60,60,60,60]);
 assert.equal(arg(stillJob(exportJob(src,profile,tech,'cover',defaults(),'x','9:16'),999).args,'-t'),'60');
});

test('special layouts from an image: one silent delivery and N silent screens at 25 fps',()=>{
 const layouts=JSON.parse(readFileSync(new URL('../adaptaciones/perfil-cliente-especiales.json',import.meta.url),'utf8')).layouts;
 const t={bitrateKbps:8000,h264Perfil:'high',h264Nivel:'5.1',segmentPerfil:'high',segmentNivel:'4.0'};
 const l=layouts[0],atlas=stillJob(atlasJob(src,l,'blur',defaults(),t),5),seg=stillJob(segmentsJob(src,l,'cover',defaults(),t),5);
 for(const job of [atlas,seg]){assert.deepEqual(job.args.slice(0,8),['-loop','1','-framerate','25','-t','5','-i','input.png']);assert(!job.args.includes('0:a?')&&!job.args.includes('-c:a'));assert(arg(job.args,'-filter_complex').startsWith(`[0:v]${STILL_PREP},fps=25[src]`));}
 assert.equal(seg.outputs.length,geometry(l).segments.length);assert.equal(seg.args.filter(a=>a==='-an').length,seg.outputs.length);
 assert.equal(seg.args.filter(a=>a==='stillimage').length,seg.outputs.length);
});

test('Stock payload of an MP4 made from an image: video with the imagen-fija tag and its length',()=>{
 const p=stockPayload({base64:'AA==',size:1,title:'Café · 9:16',originId:cafe.id,client:null,format:'9:16',width:1080,height:1920,duration:10,still:true});
 assert.equal(p.type,'video');assert.equal(p.mime,'video/mp4');assert.deepEqual(p.tags,['adaptación','9:16','imagen-fija']);
 assert.match(p.prompt,/origen 1791230658801-jnv969 · imagen fija · 10 s · formato 9:16 · 1080×1920/);assert.equal(p.validacion.duracion,10);
});

test('real FFmpeg: JPG and PNG with alpha become H.264 25 fps MP4s of the chosen length, without audio',{skip:!process.env.ADAPTER_FFMPEG_TEST},()=>{
 const dir=mkdtempSync(tmpdir()+'/imagenes-');
 const run=args=>{const r=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y',...args],{encoding:'utf8',cwd:dir});assert.equal(r.status,0,r.stderr);};
 const probe=file=>{const r=spawnSync('ffprobe',['-v','error','-count_frames','-show_streams','-show_format','-of','json',file],{encoding:'utf8',cwd:dir});assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);};
 try {
  run(['-f','lavfi','-i','testsrc2=size=1280x720','-frames:v','1','-q:v','3','input.jpg']);
  run(['-f','lavfi','-i','testsrc2=size=641x361','-vf','format=rgba,geq=r=r(X\\,Y):g=g(X\\,Y):b=b(X\\,Y):a=if(lt(X\\,320)\\,0\\,255)','-frames:v','1','input.png']);
  const cases=[['input.jpg',{ancho:1280,alto:720},'cover',3],['input.jpg',{ancho:1280,alto:720},'blur',2],['input.png',{ancho:641,alto:361},'contain',1]];
  for(const [input,source,mode,seconds] of cases) for(const [W,H] of [[1080,1920],[300,250]]) {
   const p=perfilDeSalida({formato:'custom',ancho:W,alto:H,compatibilidad:'fhd'});
   const job=stillJob(exportJob({...source,fps:25,bitrateKbps:0},p,planificar(source,p),mode,{fx:.3,fy:.6,zoom:1.2},'cafe','x'),seconds,input);
   run(job.args);
   const d=probe('output.mp4'),v=d.streams.find(s=>s.codec_type==='video');
   assert.deepEqual([v.codec_name,v.width,v.height,v.r_frame_rate,v.pix_fmt],['h264',W,H,'25/1','yuv420p'],`${input} ${mode} ${W}x${H}`);
   assert.equal(+v.nb_read_frames,seconds*25);assert(Math.abs(+d.format.duration-seconds)<.05,d.format.duration);
   assert(!d.streams.some(s=>s.codec_type==='audio'),'silent');assert.notEqual(v.color_range,'pc','limited range');
  }
  // The transparent left half of the PNG comes out black, as in the canvas preview.
  {const p=perfilDeSalida({formato:'custom',ancho:640,alto:360,compatibilidad:'fhd'}),s={ancho:641,alto:361,fps:25,bitrateKbps:0};
   run(stillJob(exportJob(s,p,planificar(s,p),'cover',defaults(),'alfa','x'),1,'input.png').args);
   run(['-i','output.mp4','-frames:v','1','-vf','crop=100:100:100:130,scale=1:1:flags=area','-f','rawvideo','-pix_fmt','rgb24','px.rgb']);
   const px=readFileSync(dir+'/px.rgb');assert(Math.max(...px)<24,`black under transparency (${[...px]})`);}
  // Per-screen batch from the image: same frames and length on every screen.
  const l=JSON.parse(readFileSync(new URL('../adaptaciones/perfil-cliente-especiales.json',import.meta.url),'utf8')).layouts[0];
  const seg=stillJob(segmentsJob({ancho:1280,alto:720},l,'cover',defaults(),{bitrateKbps:8000,segmentPerfil:'high',segmentNivel:'4.0'}),2,'input.jpg');
  run(seg.args);
  for(const out of seg.outputs){const d=probe(out.file),v=d.streams.find(s=>s.codec_type==='video');assert.deepEqual([v.width,v.height,v.r_frame_rate,+v.nb_read_frames],[out.W,out.H,'25/1',50]);}
 } finally {rmSync(dir,{recursive:true,force:true});}
});
