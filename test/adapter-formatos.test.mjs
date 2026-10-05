// Adaptador · formatos de entrada (Carlos, 5-oct-2026): GIF (estático y animado), SVG, HEIC y AVIF, y fuentes
// pegadas con ⌘V o soltadas. Detección por MIME, extensión y firma; recorrido del GIF; medidas y rasterizado
// del SVG por formato; parseo del portapapeles; plan FFmpeg del GIF animado y, con ADAPTER_FFMPEG_TEST=1,
// FFmpeg nativo + ffprobe (duración y 25 fps). Con ADAPTER_NET_TEST=1 comprueba el SHA-256 de libheif-js.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {exportJob,animJob,animPreviewJob,animFrames,STILL_PREP,defaults} from '../adaptaciones/adapter-core.mjs';
import {segmentsJob} from '../adaptaciones/especiales-core.mjs';
import {LIBHEIF} from '../adaptaciones/fuentes-especiales.mjs';
import {perfilDeSalida,planificar} from '../assets/signage-perfiles.js';

// Scripts clásicos, como en el navegador.
const ctx={URL};vm.createContext(ctx);
for(const f of ['formatos-entrada.js','stock-fuentes.js']) vm.runInContext(readFileSync(new URL(`../adaptaciones/${f}`,import.meta.url),'utf8'),ctx);
const PF=ctx.PixeriaFormatos,SF=ctx.PixeriaStockFuentes;

// GIF mínimo hecho a mano: frames = [{delay (cs), w, h}], netscape = bucles (null = sin bloque).
function gif(frames,{netscape=0,W=2,H=2,truncate=0}={}) {
  const b=[...Buffer.from('GIF89a'),W&255,W>>8,H&255,H>>8,0x80,0,0, 0,0,0, 255,255,255];
  if(netscape!==null) b.push(0x21,0xFF,11,...Buffer.from('NETSCAPE2.0'),3,1,netscape&255,netscape>>8,0);
  for(const f of frames){
    if(f.delay!=null) b.push(0x21,0xF9,4,0,f.delay&255,f.delay>>8,0,0);
    b.push(0x2C,0,0,0,0,W&255,W>>8,H&255,H>>8,0, 2, 2,0x4C,0x01, 0);
  }
  b.push(0x3B);
  return Uint8Array.from(truncate?b.slice(0,b.length-truncate):b);
}

test('detection by MIME, file name and URL: images, video and what stays out',()=>{
 const d=o=>{const r=PF.detectar(o);return r&&`${r.clase}:${r.ext}`;};
 assert.equal(d({mime:'image/gif'}),'imagen:gif');assert.equal(d({mime:'image/svg+xml'}),'imagen:svg');
 assert.equal(d({mime:'image/heif'}),'imagen:heic');assert.equal(d({mime:'image/heic'}),'imagen:heic');assert.equal(d({mime:'image/avif'}),'imagen:avif');
 assert.equal(d({mime:'image/jpeg; charset=binary'}),'imagen:jpg');
 // Finder / Chrome dan a menudo un HEIC sin tipo: manda la extensión.
 assert.equal(d({mime:'',nombre:'IMG_0042.HEIC'}),'imagen:heic');assert.equal(d({mime:'application/octet-stream',nombre:'foto.heif'}),'imagen:heic');
 assert.equal(d({url:'https://stock.admira.store/stock/x/asset.avif?v=1&cors=1'}),'imagen:avif');
 assert.equal(d({url:'https://e.com/logo.SVG#top'}),'imagen:svg');assert.equal(d({ext:'jpeg'}),'imagen:jpg');
 assert.equal(d({mime:'video/mp4'}),'video:mp4');assert.equal(d({nombre:'clip.mov'}),'video:mov');
 assert.equal(d({mime:'image/tiff'}),'imagen:null');assert.equal(d({nombre:'nota.txt'}),null);assert.equal(d({}),null);
});

test('signature of the first bytes: JPEG, PNG, WebP, GIF, SVG, HEIC (heic/mif1) and AVIF (avif wins over mif1)',()=>{
 const ftyp=(major,...compat)=>{const b=Buffer.alloc(16+4*compat.length);b.writeUInt32BE(b.length,0);b.write('ftyp',4);b.write(major,8);compat.forEach((c,i)=>b.write(c,16+4*i));return b;};
 assert.equal(PF.firma(Uint8Array.from([0xFF,0xD8,0xFF,0xE0])),'JPEG');
 assert.equal(PF.firma(Uint8Array.from([0x89,0x50,0x4E,0x47,13,10,26,10])),'PNG');
 assert.equal(PF.firma(Buffer.from('RIFF\0\0\0\0WEBPVP8 ')),'WebP');
 assert.equal(PF.firma(gif([{delay:10}])),'GIF');
 assert.equal(PF.firma(Buffer.from('﻿<?xml version="1.0"?>\n<!-- c -->\n<svg xmlns="http://www.w3.org/2000/svg">')),'SVG');
 assert.equal(PF.firma(ftyp('heic','mif1','heic')),'HEIC');assert.equal(PF.firma(ftyp('mif1','miaf','heic')),'HEIC');
 assert.equal(PF.firma(ftyp('avif','mif1','miaf')),'AVIF');assert.equal(PF.firma(ftyp('mif1','avif')),'AVIF');
 assert.equal(PF.firma(ftyp('isom','iso2','mp41')),null,'an MP4 is not an image');
 assert.equal(PF.firma(Buffer.from('hola')),null);assert.equal(PF.firma(null),null);
 assert.deepEqual(Object.values(PF.FIRMA_EXT).sort(),['avif','gif','heic','jpg','png','svg','webp']);
});

test('GIF walk: animated vs static (more than one frame, or NETSCAPE when the data is truncated), delays and loop',()=>{
 const a=PF.gifInfo(gif([{delay:5},{delay:20},{delay:0},{delay:1},{delay:30}],{W:320,H:180}));
 assert.deepEqual([a.ancho,a.alto,a.fotogramas,a.animado,a.netscape,a.bucles,a.truncado],[320,180,5,true,true,0,false]);
 // 0 y 1 centésima se reproducen a 100 ms, como en los navegadores y en el demuxer de FFmpeg.
 assert.deepEqual([...a.retardos],[50,200,100,100,300]);assert.equal(a.duracionMs,750);
 const s=PF.gifInfo(gif([{delay:0}],{netscape:null}));assert.deepEqual([s.fotogramas,s.animado,s.netscape],[1,false,false]);
 // Un solo fotograma con bloque NETSCAPE se ve estático: imagen.
 assert.equal(PF.gifInfo(gif([{delay:10}])).animado,false);
 assert.equal(PF.gifInfo(gif([{delay:10},{delay:10}],{netscape:null})).animado,true,'two frames without NETSCAPE still animate');
 assert.equal(PF.gifInfo(gif([{delay:10},{delay:10}],{netscape:3})).bucles,3);
 const t=PF.gifInfo(gif([{delay:10},{delay:10}],{truncate:20}));assert(t.truncado);assert.equal(t.animado,true,'truncated with NETSCAPE');
 assert.equal(PF.gifInfo(Buffer.from('GIF87')),null);assert.equal(PF.gifInfo(Buffer.from('PNG...')),null);
 // Fotograma visible en el instante t, en bucle.
 assert.deepEqual([0,49,50,249,250,749,750,800].map(ms=>PF.gifFotogramaEn(a.retardos,ms)),[0,0,1,1,2,4,0,1]);
 assert.equal(PF.gifFotogramaEn([],100),0);
});

test('SVG size: absolute width/height, units, viewBox, one side from the viewBox, 300×150 default',()=>{
 const m=s=>{const r=PF.svgMedidas(s);return r&&[r.ancho,r.alto,r.origen];};
 assert.deepEqual(m('<svg width="320" height="200px">'),[320,200,'atributos']);
 assert.deepEqual(m('<svg width="10cm" height="1in">'),[378,96,'atributos']);
 assert.deepEqual(m('<?xml version="1.0"?><!-- <svg width="1"> --><svg viewBox="0 0 160 90">'),[160,90,'viewBox'],'an <svg> inside a comment is not the root');
 assert.deepEqual(m('<svg viewBox="0,0,160,90">'),[160,90,'viewBox']);
 assert.deepEqual(m('<svg width="100%" height="100%" viewBox="0 0 1600 900">'),[1600,900,'viewBox']);
 assert.deepEqual(m('<svg width="400" viewBox="0 0 160 90">'),[400,225,'atributos']);
 assert.deepEqual(m('<svg height="90" viewBox="0 0 160 90">'),[160,90,'atributos']);
 assert.deepEqual(m('<svg>'),[300,150,'defecto']);assert.equal(PF.svgMedidas('<html></html>'),null);
 assert.deepEqual([...PF.svgMedidas('<svg viewBox="0 0 160 90">').viewBox],[0,0,160,90]);
});

test('SVG resized as text only: new width/height, viewBox and xmlns added when missing, the rest untouched',()=>{
 const src='<?xml version="1.0"?>\n<svg width="160" height="90" style="x"><path stroke-width="2" d="M0 0"/><use xlink:href="#a"/></svg>';
 const out=PF.svgConTamano(src,1280,720);
 assert.match(out,/^<\?xml version="1.0"\?>\n<svg width="1280" height="720" viewBox="0 0 160 90" xmlns="http:\/\/www.w3.org\/2000\/svg" xmlns:xlink="http:\/\/www.w3.org\/1999\/xlink" style="x">/);
 assert.match(out,/stroke-width="2"/);assert.equal((out.match(/width=/g)||[]).length,2);
 const keep=PF.svgConTamano('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 9"><script>x()</script></svg>',32,18);
 assert.equal(keep,'<svg width="32" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 9"><script>x()</script></svg>');
 assert.equal(PF.svgMedidas(out).ancho,1280);assert.equal(PF.svgConTamano('<p>',1,1),null);
});

test('SVG raster per output format: crop takes the larger scale, contain/expand the smaller, zoom on top, capped',()=>{
 const m={ancho:160,alto:90},r=(W,H,mode,s,o)=>{const x=PF.svgRaster(m,W,H,mode,s,o);return [x.ancho,x.alto];};
 assert.deepEqual(r(1080,1920,'cover',defaults()),[3414,1920]);
 assert.deepEqual(r(1080,1920,'contain',defaults()),[1080,608]);
 assert.deepEqual(r(1080,1920,'blur',{zoom:1.5}),[1620,912]);
 assert.deepEqual(r(300,250,'cover',defaults()),[445,250]);
 assert.deepEqual(r(1920,1080,'cover',{zoom:2}),[3840,2160]);
 assert.deepEqual(r(2362,3543,'contain',defaults()),[2362,1329]);
 // Paredes enormes (CORDOBA-098 14400×540) y 4K con zoom: se limita a 4096×4096 px conservando el aspecto.
 const big=PF.svgRaster(m,14400,540,'cover',{zoom:2},{maxLado:8192,maxPx:4096*4096});
 assert(big.limitado&&big.ancho<=8192&&big.ancho*big.alto<=4096*4096);assert(Math.abs(big.ancho/big.alto-160/90)<.01);
 // Previo: escalas a saltos de √2 para reutilizar la caché.
 const k=x=>PF.svgRaster(m,x,x,'contain',defaults(),{paso:true}).escala;
 assert.equal(k(160),1);assert(Math.abs(k(170)-Math.SQRT2)<.01);assert(Math.abs(k(300)-2)<.01);
 assert.deepEqual(r(16,16,'contain',defaults()),[16,9]);
});

test('clipboard: screenshot, copied image, Finder file, video, unsupported file, URLs and nothing',()=>{
 const F=(name,type)=>new File([new Uint8Array([1,2,3])],name,{type});
 const dt=({files=[],items=[],data={}})=>({files,items,getData:t=>data[t]||''});
 let r=PF.portapapeles(dt({files:[F('image.png','image/png')]}));assert.equal(r.archivo.name,'image.png');assert.equal(r.ext,'png');assert.equal(r.clase,'imagen');
 // Copiar una imagen de otra web: items de tipo archivo (y HTML que se ignora porque hay archivo).
 r=PF.portapapeles(dt({items:[{kind:'string',type:'text/html'},{kind:'file',type:'image/png',getAsFile:()=>F('image.png','image/png')}],data:{'text/html':'<img src="https://e.com/a.jpg">'}}));
 assert.equal(r.archivo.type,'image/png');
 assert.equal(PF.portapapeles(dt({files:[F('IMG_1.HEIC','')]})).ext,'heic');
 assert.equal(PF.portapapeles(dt({files:[F('notas.txt','text/plain'),F('clip.mp4','video/mp4')]})).clase,'video','first usable file wins');
 r=PF.portapapeles(dt({files:[F('doc.pdf','application/pdf')]}));assert.deepEqual([r.ignorado,r.nombre],['tipo','doc.pdf']);
 const url=data=>{const x=PF.portapapeles(dt({data}));return x&&[x.url,x.destino,x.origen];};
 assert.deepEqual(url({'text/plain':'mira https://stock.admira.store/stock/a/asset.gif?v=2.'}),['https://stock.admira.store/stock/a/asset.gif?v=2','imagen','texto']);
 assert.deepEqual(url({'text/uri-list':'# comentario\nhttps://e.com/v/clip.webm\n'}),['https://e.com/v/clip.webm','video','texto']);
 assert.deepEqual(url({'text/plain':'https://youtu.be/abc'}),['https://youtu.be/abc','importar','texto']);
 assert.deepEqual(url({'text/plain':'https://www.instagram.com/reel/x/'}),['https://www.instagram.com/reel/x/','importar','texto']);
 assert.deepEqual(url({'text/plain':'https://e.com/pagina'}),['https://e.com/pagina','importar','texto']);
 assert.deepEqual(url({'text/html':'<p><img alt="" src="https://e.com/a.avif?w=1&amp;h=2"></p>'}),['https://e.com/a.avif?w=1&h=2','imagen','html']);
 assert.equal(PF.portapapeles(dt({data:{'text/plain':'solo texto'}})),null);assert.equal(PF.portapapeles(null),null);
 assert.equal(PF.clasificarURL('ftp://e.com/a.png'),null);assert.equal(PF.clasificarURL('no es url'),null);
 // Nombres: una captura «image.png» pasa a pegado-AAAAMMDD-HHMMSS.png; un nombre real se conserva.
 const when=new Date(2026,9,5,23,4,5);
 assert.equal(PF.nombrePegado(F('image.png','image/png'),when),'pegado-20261005-230405.png');
 assert.equal(PF.nombrePegado(F('blob','image/webp'),when),'pegado-20261005-230405.webp');
 assert.equal(PF.nombrePegado(F('logo.svg','image/svg+xml'),when),'logo.svg');
});

test('Stock list: GIF, SVG, HEIC/HEIF and AVIF images enter (index MIME or extension); unknown formats stay out',()=>{
 const S='https://stock.admira.store/stock/';
 const items=[
  {id:'gif',type:'image',mime:'image/gif',ext:'gif',url:`${S}gif/asset.gif?v=542051`,createdAt:'2026-10-05T10:00:00Z'},
  {id:'svg',type:'image',url:`${S}svg/asset.svg`,createdAt:'2026-10-05T09:00:00Z'},
  {id:'heif',type:'image',mime:'image/heif',url:`${S}heif/asset.bin`,createdAt:'2026-10-05T08:00:00Z'},
  {id:'avif',type:'image',ext:'avif',url:`${S}avif/asset.bin`,createdAt:'2026-10-05T07:00:00Z'},
  {id:'bin',type:'image',mime:'text/html; charset=utf-8',ext:'bin',url:`${S}bin/asset.bin`,createdAt:'2026-10-05T11:00:00Z'},
  {id:'tif',type:'image',mime:'image/tiff',url:`${S}tif/asset.tif`,createdAt:'2026-10-05T11:00:00Z'}];
 assert.deepEqual([...SF.fuentes(items).map(i=>i.id)],['gif','svg','heif','avif']);
 assert.deepEqual([...SF.fuentes(items).map(SF.extension)],['gif','svg','heic','avif']);
});

const src={ancho:320,alto:180,fps:25,bitrateKbps:0};
const profile=perfilDeSalida({formato:'custom',ancho:1080,alto:1920,compatibilidad:'fhd'}),tech=planificar(src,profile);
const arg=(args,k)=>args[args.indexOf(k)+1];

test('animated GIF plan: the GIF read once, flattened, one loop cut at round(duration×25) frames, 25 fps, no audio',()=>{
 const base=exportJob(src,profile,tech,'cover',defaults(),'anim','9:16'),job=animJob(base,0.9,'input.gif');
 assert.deepEqual(job.args.slice(0,4),['-ignore_loop','1','-i','input.gif']);
 const f=arg(job.args,'-filter_complex');
 assert(f.startsWith(`[0:v]${STILL_PREP},tpad=stop_mode=clone:stop_duration=1,fps=25,trim=end_frame=23,setpts=PTS-STARTPTS,`),f);
 // Mismo reencuadre que el vídeo: el resto del grafo es idéntico.
 assert.equal(f.split('setpts=PTS-STARTPTS,')[1],arg(base.args,'-filter_complex').replace('[0:v]',''));
 assert.equal(arg(job.args,'-r'),'25');assert.equal(arg(job.args,'-color_range'),'tv');
 assert(!job.args.includes('0:a?')&&!job.args.includes('-c:a')&&job.args.includes('-an'));assert(!job.args.includes('stillimage'));
 assert.equal(job.input,'input.gif');assert.equal(job.anim,0.92);
 assert.deepEqual([0.01,0.9,2.4,10].map(animFrames),[1,23,60,250]);
 const seg=animJob(segmentsJob(src,JSON.parse(readFileSync(new URL('../adaptaciones/perfil-cliente-especiales.json',import.meta.url),'utf8')).layouts[0],'cover',defaults(),{bitrateKbps:8000,segmentPerfil:'high',segmentNivel:'4.0'}),2);
 assert(arg(seg.args,'-filter_complex').startsWith(`[0:v]${STILL_PREP},tpad`));assert.equal(arg(seg.args,'-i'),'input.gif');
 const prev=animPreviewJob(0.9,321,181);assert.deepEqual([prev.W,prev.H,prev.input],[322,182,'input.gif']);assert.match(arg(prev.args,'-filter_complex'),/scale=322:182/);
});

test('libheif-js is pinned: version in the URL, LGPL-3.0, size and SHA-256',async()=>{
 assert.equal(LIBHEIF.url,`https://cdn.jsdelivr.net/npm/libheif-js@${LIBHEIF.version}/libheif-wasm/libheif-bundle.mjs`);
 assert.equal(LIBHEIF.licencia,'LGPL-3.0');assert.match(LIBHEIF.sha256,/^[0-9a-f]{64}$/);
 if(!process.env.ADAPTER_NET_TEST) return;
 const code=Buffer.from(await (await fetch(LIBHEIF.url)).arrayBuffer());
 assert.equal(code.length,LIBHEIF.bytes);assert.equal(createHash('sha256').update(code).digest('hex'),LIBHEIF.sha256);
});

test('real FFmpeg: an animated GIF with uneven delays becomes an H.264 25 fps MP4 of its own length',{skip:!process.env.ADAPTER_FFMPEG_TEST},()=>{
 const dir=mkdtempSync(tmpdir()+'/formatos-');
 const run=args=>{const r=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y',...args],{encoding:'utf8',cwd:dir});assert.equal(r.status,0,r.stderr);};
 const probe=file=>{const r=spawnSync('ffprobe',['-v','error','-count_frames','-show_streams','-show_format','-of','json',file],{encoding:'utf8',cwd:dir});assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);};
 try {
  run(['-f','lavfi','-i','testsrc2=size=320x180:rate=10:duration=1.2','-vf','split[a][b];[a]palettegen[p];[b][p]paletteuse','anim.gif']);
  // Retardos desiguales (incluido un 0 que vale 100 ms): 5,20,0,10,30,15,8,12,25,10,10,50 cs.
  const bytes=readFileSync(dir+'/anim.gif'),cs=[5,20,0,10,30,15,8,12,25,10,10,50];let p=0,n=0;
  while((p=bytes.indexOf(Buffer.from([0x21,0xF9,0x04]),p))>=0){bytes.writeUInt16LE(cs[n++],p+4);p+=8;}
  assert.equal(n,12);writeFileSync(dir+'/anim.gif',bytes);
  const info=PF.gifInfo(readFileSync(dir+'/anim.gif'));assert.equal(info.fotogramas,12);assert.equal(info.duracionMs,2050);
  assert(Math.abs(+probe('anim.gif').format.duration-2.05)<.01,'FFmpeg reads the same delays');
  for(const [W,H,mode] of [[1080,1920,'blur'],[300,250,'cover'],[1920,1080,'contain']]) {
   const p2=perfilDeSalida({formato:'custom',ancho:W,alto:H,compatibilidad:'fhd'});
   run(animJob(exportJob(src,p2,planificar(src,p2),mode,{fx:.4,fy:.5,zoom:1.1},'anim','x'),info.duracionMs/1000,'anim.gif').args);
   const d=probe('output.mp4'),v=d.streams.find(s=>s.codec_type==='video');
   assert.deepEqual([v.codec_name,v.width,v.height,v.r_frame_rate,v.pix_fmt],['h264',W,H,'25/1','yuv420p'],`${mode} ${W}x${H}`);
   assert.equal(+v.nb_read_frames,51);assert(Math.abs(+d.format.duration-2.05)<=.04,d.format.duration);
   assert(!d.streams.some(s=>s.codec_type==='audio'));assert.notEqual(v.color_range,'pc');
  }
  // La vista previa intermedia (sin ImageDecoder) dura lo mismo.
  run(animPreviewJob(2.05,320,180).args.map(a=>a==='input.gif'?'anim.gif':a));
  const d=probe('output.mp4');assert(Math.abs(+d.format.duration-2.05)<=.04);assert.equal(d.streams[0].width,320);
 } finally {rmSync(dir,{recursive:true,force:true});}
});
