import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,mkdtempSync,rmSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {geometry,segmentFilename,atlasFilename,segmentKbps,segmentsJob,atlasJob,FPS} from '../adaptaciones/especiales-core.mjs';
import {restore,snapshot,defaults} from '../adaptaciones/adapter-core.mjs';
import {matchingFormats} from '../adaptaciones/format-catalog.mjs';

const read=file=>JSON.parse(readFileSync(new URL(`../adaptaciones/${file}`,import.meta.url),'utf8'));
const especiales=read('perfil-cliente-especiales.json'),cliente=read('perfil-cliente-18.json');
const PDF='/Users/csilvasantin/Downloads/Telegram Desktop/Resoluciones y formatos especiales .pdf';
const area=r=>r.w*r.h;
const overlaps=(a,b)=>a.x<b.x+b.w&&b.x<a.x+a.w&&a.y<b.y+b.h&&b.y<a.y+a.h;
const tiles=(rects,W,H)=>{
 for(let i=0;i<rects.length;i++){const r=rects[i];assert(r.x>=0&&r.y>=0&&r.x+r.w<=W&&r.y+r.h<=H,'inside canvas');
  for(let j=i+1;j<rects.length;j++)assert(!overlaps(r,rects[j]),`no overlap ${i}/${j}`);}
 assert.equal(rects.reduce((n,r)=>n+area(r),0),W*H,'no gaps');
};

test('the five ESPECIAL rows of page 3 are transcribed from the same PDF as the Altadis client profile',()=>{
 assert.equal(especiales.source.sha256,cliente.source.sha256);
 assert.equal(especiales.source.sha256,'16a17b2f81c5713d5d0fc676a02d2192fb95ad07ecb13e29dbec1b09da5239f7');
 if(existsSync(PDF))assert.equal(createHash('sha256').update(readFileSync(PDF)).digest('hex'),especiales.source.sha256);
 const L=especiales.layouts;
 assert.deepEqual(L.map(l=>l.tabla),[
  'VIDEOWALL 5x1 H (1280 X 1080) - ESPECIAL','VIDEOWALL 6x1 H (1280 X 1080) - ESPECIAL',
  'VIDEOWALL 9x1 H (2880 X 1620) - ESPECIAL','CORDOBA-098 (3840 X 2160) - ESPECIAL',
  'VIDEOWALL 13x1 V (2160 X 3840) - ESPECIAL']);
 assert.deepEqual(L.map(l=>l.row),[18,19,20,21,22]);
 assert.equal(cliente.formats.length,24); // 18 Altadis estándar + 6 MyBlu únicos
 assert.equal(cliente.formats.length+L.length,29); // categoría Altadis completa
 for(const l of L){
  assert.equal(l.observaciones,'Formato especial');
  const [,w,h]=l.tabla.match(/\((\d+) X (\d+)\)/);assert.deepEqual(l.entrega,[+w,+h]);
  assert(!cliente.formats.some(f=>f.nombre===l.nombre),'not duplicated in the flat client profile');
 }
 assert.deepEqual(L.map(l=>l.pantallas),[5,6,11,15,13]);
 // Ambiguities stay documented instead of silently resolved.
 assert.match(L[2].ambiguedades[0],/11x1 H/);assert.match(L[0].ambiguedades[0],/640x540/);
 assert.equal(L[3].pared.inferida,true);
});

test('cells tile the delivery file and screens tile the physical wall without gaps or overlaps',()=>{
 for(const l of especiales.layouts){
  const g=geometry(l);
  tiles([...g.segments.map(s=>s.atlas),...g.unused],g.entrega.ancho,g.entrega.alto);
  assert.equal(g.segments.length,l.pantallas);
  assert.equal(g.unused.length,l.celdasSinUso.length);
  tiles(g.segments.map(s=>s.wall),g.pared.ancho,g.pared.alto);
  assert.equal(g.pared.ancho,l.pantallas*l.celda[0]);assert.equal(g.pared.alto,l.celda[1]);
  // Reading order: screen n+1 sits right of screen n on the wall, and later in the grid.
  g.segments.slice(1).forEach((s,i)=>{const p=g.segments[i];assert.equal(s.wall.x,p.wall.x+p.wall.w);assert(s.cell>p.cell);});
  for(const s of g.segments)for(const v of Object.values(s.wall))assert.equal(v%2,0,'chroma-aligned');
 }
 const vw5=geometry(especiales.layouts[0]);assert.deepEqual(vw5.unused.map(c=>[c.x,c.y]),[[640,720]]);
 const v13=geometry(especiales.layouts[4]);assert.deepEqual(v13.unused.map(c=>c.index),[14,15,16]);
});

test('file names are explicit and unique per screen',()=>{
 const all=especiales.layouts.flatMap(l=>geometry(l).segments.map(s=>segmentFilename(l,s.n)));
 assert.equal(new Set(all).size,all.length);
 assert.equal(segmentFilename(especiales.layouts[0],3),'videowall-5x1-h-3de5-640x360.mp4');
 assert.equal(segmentFilename(especiales.layouts[4],13),'videowall-13x1-v-13de13-540x960.mp4');
 assert.equal(atlasFilename(especiales.layouts[3]),'cordoba-098-entrega-3840x2160.mp4');
 for(const name of all)assert.match(name,/^[a-z0-9-]+-\d+de\d+-\d+x\d+\.mp4$/);
});

test('special family persists its own selection and settings and filters separately',()=>{
 const formats=[{id:'16:9',on:true},{id:'cliente-01',proyecto:'altadis-estancos-bcn',on:true},...especiales.layouts.map((l,i)=>({id:l.id,especial:true,proyecto:'altadis-estancos-bcn',custom:l.entrega,nombre:l.nombre,on:i===0}))];
 const fmt=Object.fromEntries(formats.map(f=>[f.id,defaults()]));fmt['cliente-esp-4']={modo:'blur',fx:.2,fy:.8,zoom:1.5};
 const saved=snapshot({profile:'especiales',compat:'fhd',modoGlobal:'auto',fmt},formats);
 const back=restore(JSON.parse(JSON.stringify(saved)),formats);
 assert.equal(back.profile,'especiales');assert.deepEqual(back.fmt['cliente-esp-4'],{modo:'blur',fx:.2,fy:.8,zoom:1.5});
 assert.deepEqual(back.selected,['16:9','cliente-01','cliente-esp-1']);
 assert.equal(restore({version:1,profile:'especiales'},formats.filter(f=>!f.especial)).profile,'standard');
 assert.deepEqual(restore({version:1},formats).selected,['16:9']);
 assert.deepEqual(matchingFormats(formats,{profile:'especiales'}).map(f=>f.id),especiales.layouts.map(l=>l.id));
 // Altadis category includes flat client sizes AND ESPECIAL videowalls.
 assert.deepEqual(matchingFormats(formats,{profile:'proyecto'}).map(f=>f.id),['cliente-01',...especiales.layouts.map(l=>l.id)]);
 assert.equal(matchingFormats(formats,{profile:'especiales',query:'2880x1620'}).length,1);
});

test('jobs cut every screen from one master and share the delivery bitrate',()=>{
 const source={ancho:1920,alto:1080},tech={bitrateKbps:20000,h264Perfil:'high',h264Nivel:'5.1',segmentPerfil:'high',segmentNivel:'4.0'};
 for(const l of especiales.layouts){
  const g=geometry(l),seg=segmentsJob(source,l,'cover',defaults(),tech),atlas=atlasJob(source,l,'blur',defaults(),tech);
  assert.equal(seg.outputs.length,l.pantallas);assert.equal(seg.args.filter(a=>a==='-an').length,l.pantallas);
  assert.deepEqual(seg.args.flatMap((a,i)=>a==='-r'?[seg.args[i+1]]:[]),Array(l.pantallas).fill(String(FPS)));
  const filter=seg.args[seg.args.indexOf('-filter_complex')+1];
  assert.equal((filter.match(/\[0:v\]/g)||[]).length,1,'single master composition');assert.match(filter,/^\[0:v\]fps=25\[src\]/);
  assert.match(filter,new RegExp(`scale=${g.pared.ancho}:${g.pared.alto}`));
  assert(seg.bitrateKbps<=tech.bitrateKbps);assert.equal(segmentKbps(l,20000)*l.pantallas,seg.bitrateKbps);
  assert.equal(atlas.filename,atlasFilename(l));assert.match(atlas.args[atlas.args.indexOf('-filter_complex')+1],new RegExp(`pad=${l.entrega[0]}:${l.entrega[1]}`));
 }
});

test('real FFmpeg: a 2 s master becomes N H.264 25 fps screens of identical duration plus the delivery file',{skip:!process.env.ADAPTER_FFMPEG_TEST},()=>{
 const dir=mkdtempSync(tmpdir()+'/especiales-');
 const run=args=>{const r=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y',...args],{encoding:'utf8',cwd:dir});assert.equal(r.status,0,r.stderr);};
 const probe=file=>{const r=spawnSync('ffprobe',['-v','error','-count_frames','-show_streams','-show_format','-of','json',file],{encoding:'utf8',cwd:dir});assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);};
 const tech={bitrateKbps:8000,h264Perfil:'high',h264Nivel:'5.1',segmentPerfil:'high',segmentNivel:'4.0'};
 try {
  run(['-f','lavfi','-i','testsrc2=size=640x360:rate=30','-f','lavfi','-i','sine=frequency=440:sample_rate=48000','-t','2','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','source.mp4']);
  const source={ancho:640,alto:360,fps:30};
  for(const [i,mode] of [[0,'cover'],[2,'blur'],[4,'contain']]){
   const l=especiales.layouts[i],g=geometry(l),job=segmentsJob(source,l,mode,{fx:.3,fy:.6,zoom:1.2},tech);
   run(job.args.map(a=>a==='input'?'source.mp4':a));
   const frames=new Set(),durations=new Set();
   for(const out of job.outputs){
    const d=probe(out.file),v=d.streams.find(s=>s.codec_type==='video');
    assert.equal(v.codec_name,'h264');assert.equal(v.width,out.W);assert.equal(v.height,out.H);assert.equal(v.r_frame_rate,'25/1');
    assert.equal(v.pix_fmt,'yuv420p');assert(!d.streams.some(s=>s.codec_type==='audio'),'screens are silent');
    frames.add(v.nb_read_frames);durations.add(d.format.duration);
   }
   assert.equal(job.outputs.length,g.segments.length);
   assert.equal(frames.size,1,`same frame count (${[...frames]})`);assert.equal(durations.size,1,`same duration (${[...durations]})`);
   assert.equal(+[...frames][0],50);assert(Math.abs(+[...durations][0]-2)<.05);
   const atlas=atlasJob(source,l,mode,{fx:.3,fy:.6,zoom:1.2},tech);run(atlas.args.map(a=>a==='input'?'source.mp4':a));
   const d=probe('output.mp4'),v=d.streams.find(s=>s.codec_type==='video');
   assert.deepEqual([v.codec_name,v.width,v.height,v.r_frame_rate,v.nb_read_frames],['h264',...l.entrega,'25/1','50']);
   assert.equal(d.streams.find(s=>s.codec_type==='audio')?.codec_name,'aac');
  }
 } finally {rmSync(dir,{recursive:true,force:true});}
});
