import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../assets/xpaces/engine/premium-three.mjs';
import {rowMarkup,selectionURL,readView} from '../assets/xpaces/inventory.mjs';
import {fitBoxFrame} from '../assets/xpaces/engine/life-camera.mjs';
const e={id:'estanteria-libros',nombre:'Estantería <libros>',categoria:'Mobiliario',cantidad:1,medidas:{ancho:1.2,fondo:.3,alto:1.8}};
test('ficha de inventario: botón «Ver» a la derecha, hermano del checkbox y sin HTML inyectable',()=>{
 const html=rowMarkup(e);
 const iCheck=html.indexOf('type="checkbox"'),iItem=html.indexOf('class="xpace-item"'),iVer=html.indexOf('class="xpace-ver"');
 assert.ok(iCheck>=0&&iCheck<iItem&&iItem<iVer,'orden: checkbox · ficha · Ver');
 assert.match(html,/<button type="button" class="xpace-ver" data-ver="estanteria-libros" aria-label="Ver Estantería &lt;libros&gt; en 3D"/);
 assert.ok(!html.includes('<label'),'la ficha no es un <label>: pulsar «Ver» no alterna el checkbox');
 assert.ok(!html.includes('<libros>'));assert.match(html,/<svg[^>]*aria-hidden="true"/);assert.match(html,/<span>Ver<\/span><\/button>$/);
 assert.match(rowMarkup(e,true),/aria-label="View Estantería &lt;libros&gt; in 3D"[^>]*>.*<span>View<\/span>/);
});
test('enlace de la vista: &ver=<id> se añade, se conserva y se quita',()=>{
 const entries=[{id:'sofa',visible:true},{id:'silla-1',visible:false}];
 const u=selectionURL('https://www.pixeria.com/stock?type=xpaces','alsea',entries,'estanteria-libros');
 assert.equal(readView(u),'estanteria-libros');assert.equal(u.searchParams.get('highlight'),'alsea');assert.equal(u.searchParams.get('xhide-alsea'),'["silla-1"]');
 assert.equal(readView(selectionURL(u,'alsea',entries)),'estanteria-libros','sin argumento se conserva');
 assert.equal(readView(selectionURL(u,'alsea',entries,null)),null,'null lo elimina');
 assert.equal(readView('nota-url'),null);
});
test('encuadre: la caja del objeto queda entera y centrada en la cámara ortográfica',()=>{
 const cam=new T.OrthographicCamera();cam.position.set(20,15,20);cam.lookAt(5,.65,4);cam.updateMatrixWorld(true);
 const ext=pts=>{const r={minX:Infinity,maxX:-Infinity,minY:Infinity,maxY:-Infinity};for(const p of pts){const v=p.clone().applyMatrix4(cam.matrixWorldInverse);r.minX=Math.min(r.minX,v.x);r.maxX=Math.max(r.maxX,v.x);r.minY=Math.min(r.minY,v.y);r.maxY=Math.max(r.maxY,v.y);}return r;};
 const corners=(a,b)=>{const out=[];for(const x of [a.x,b.x])for(const y of [a.y,b.y])for(const z of [a.z,b.z])out.push(new T.Vector3(x,y,z));return out;};
 const room=ext(corners(new T.Vector3(-.8,-.5,-.7),new T.Vector3(12.1,3.5,9.2)));
 for(const aspect of [390/300,1600/820])for(const [a,b] of [[new T.Vector3(1,0,.1),new T.Vector3(2.2,1.8,.4)],[new T.Vector3(8,0,6),new T.Vector3(8.3,.9,6.6)]]){
  const box=ext(corners(a,b)),fit=fitBoxFrame(room,box,aspect,1.4);
  const vertical=Math.max(room.maxY-room.minY,(room.maxX-room.minX)/aspect)*1.06/fit.zoom,horizontal=vertical*aspect;
  const cx=(room.minX+room.maxX)/2+fit.panX,cy=(room.minY+room.maxY)/2+fit.panY;
  assert.ok(box.minX>=cx-horizontal/2&&box.maxX<=cx+horizontal/2&&box.minY>=cy-vertical/2&&box.maxY<=cy+vertical/2,'entera');
  assert.ok(Math.abs((box.minX+box.maxX)/2-cx)<1e-9&&Math.abs((box.minY+box.maxY)/2-cy)<1e-9,'centrada');
  assert.ok(fit.zoom>1,'se acerca');
 }
});
test('visor: el renderer expone frameObject y el inventario lo usa con resalte y &ver',()=>{
 const r=fs.readFileSync(new URL('../assets/xpaces/engine/life-renderer.mjs',import.meta.url),'utf8'),inv=fs.readFileSync(new URL('../assets/xpaces/inventory.mjs',import.meta.url),'utf8'),v=fs.readFileSync(new URL('../assets/xpaces/viewer.mjs',import.meta.url),'utf8');
 assert.match(r,/needsUpdate=true;\},frameObject,pick,clearClip,/);assert.match(inv,/viewer\.frameObject\?\.\(e\.object,fromDetail\?\{angle:Math\.PI\/4\}:\{\}\);pulse\(e\);/);assert.match(inv,/e\.id===capsulas\.shelfId&&capsulas\.enterDetail\(\)/);assert.match(inv,/select:id=>\{if\(capsulas\?\.state\.detail\)return;/);assert.match(inv,/if\(!e\.visible\)\{e\.visible=true;apply\(\);\}/);assert.match(v,/inventory\?\.openFromURL\(\)/);
 const css=fs.readFileSync(new URL('../assets/xpaces/viewer.css',import.meta.url),'utf8');assert.match(css,/\.xpace-ver\{flex:none/);
 for(const page of ['../stock.html','../en/stock.html'])assert.match(fs.readFileSync(new URL(page,import.meta.url),'utf8'),/viewer\.mjs\?v=libros-4418/);
});

test('modo detalle: medios de cada cápsula sin inventar (vínculo explícito, luego título exacto)',async()=>{
 const {mediaFor,speechText}=await import('../assets/xpaces/capsulas.mjs');
 const b={id:'c1',capsula:'Co-Intelligence: la IA como compañera',libro:'Co-Intelligence',autor:'Ethan Mollick',secciones:[['Para carbono','A'],['Aplicación','C']]};
 const items=[{id:'c1',type:'capsula',title:b.capsula,url:'u0'},
  {id:'v-old',type:'video',mime:'video/mp4',title:'Co-Intelligence:  la IA como compañera ',url:'v1',createdAt:'2026-09-25T10:00:00Z'},
  {id:'v-new',type:'video',mime:'video/mp4',title:b.capsula,url:'v2',createdAt:'2026-09-25T12:00:00Z'},
  {id:'otro',type:'video',mime:'video/mp4',title:'Otra cosa',url:'v3'},
  {id:'loc',type:'locucion',mime:'text/markdown',title:b.capsula,url:'g'}];
 let m=mediaFor(b,items);assert.equal(m.video.id,'v-new');assert.equal(m.audio,null,'un guion en texto no es locución');
 m=mediaFor(b,[...items,{id:'v-link',type:'video',mime:'video/mp4',title:'x',externalRef:'capsula:c1',url:'v4',createdAt:'2020-01-01'},{id:'a1',type:'audio',mime:'audio/mpeg',title:b.capsula,url:'a'}]);assert.equal(m.video.id,'v-link');assert.equal(m.audio.id,'a1');
 assert.deepEqual(mediaFor({id:'s',capsula:'Sapiens'},items),{video:null,videos:{vertical:null,horizontal:null},audio:null});
 const t=speechText(b);assert.match(t,/^Co-Intelligence, de Ethan Mollick\./);assert.match(t,/Para carbono\. A/);assert.match(t,/Aplicación\. C$/);
});
test('modo detalle: zoom frontal con recorte, libros seleccionables y panel con cerrar / salir',()=>{
 const c=fs.readFileSync(new URL('../assets/xpaces/capsulas.mjs',import.meta.url),'utf8'),r=fs.readFileSync(new URL('../assets/xpaces/engine/life-renderer.mjs',import.meta.url),'utf8');
 assert.match(c,/frameObject\(shelfEntry\.object,\{angle:Math\.PI\/2,elevation:\.04,margin:2\.4,clip:true\}\)/);
 assert.match(c,/viewer\.pick\(e\.clientX,e\.clientY,\[shelfEntry\.object\.userData\.shelf\.books\]\)/);
 for(const k of ['data-cerrar','data-salir','data-leer','data-parar',"u.lang='es-ES'",'player.play().catch','drawPlayingScreen(screen.canvas,playing)'])assert.ok(c.includes(k),k);
 assert.match(r,/near=Math\.max\(\.1,d-\.06\)/);assert.match(r,/clipBox=clip\?box\.clone\(\)/);
 assert.ok(!/drawScreen|screenOverlay/.test(c.slice(c.indexOf('modo detalle de la estantería'),c.indexOf('function openBook'))),'pizarra-3 no se toca');
});

test('seis resúmenes usan locución propia y terminan devolviendo la pizarra al libro del día',()=>{
 const shelf=JSON.parse(fs.readFileSync(new URL('../assets/xpaces/libros/estanteria-libros.json',import.meta.url)));
 for(const b of shelf.libros){
  assert.match(b.audio_resumen.origen,/Pixeria Stock/);
  assert.match(b.audio_resumen.stock_video_id,/^[\w-]+$/);
  const audio=fs.readFileSync(new URL('../assets/xpaces/libros/'+b.audio_resumen.url,import.meta.url));
  assert.ok(audio.length>50000,`${b.slug}: audio real`);
  assert.ok(audio.subarray(0,3).toString()==='ID3'||audio[0]===0xff,`${b.slug}: MP3`);
 }
 const src=fs.readFileSync(new URL('../assets/xpaces/capsulas.mjs',import.meta.url),'utf8');
 assert.match(src,/ui\.on\(player,'ended',\(\)=>\{playing=null;paint\(\)/);
 assert.match(src,/function closeBook\(\).*playing=null/);
});

test('norma 16:9 / 9:16: vertical en móvil en vertical, horizontal en escritorio, y la que haya si solo existe una',async()=>{
 const {mediaFor,pickVideo,orientation}=await import('../assets/xpaces/capsulas.mjs');
 const b={id:'j',capsula:'Cápsula de Jobs'},v=(id,extra)=>({id,type:'video',mime:'video/mp4',title:b.capsula,url:id,createdAt:'2026-09-26',...extra});
 assert.equal(orientation({tags:['tiktok','vertical']}),'vertical');assert.equal(orientation({orientacion:'16:9'}),'horizontal');assert.equal(orientation({ancho:1920,alto:1080}),'horizontal');assert.equal(orientation({}),null);
 const both=mediaFor(b,[v('ver',{tags:['vertical']}),v('hor',{orientacion:'horizontal'})]);
 assert.equal(pickVideo(both,true).id,'ver');assert.equal(pickVideo(both,false).id,'hor');
 const solo=mediaFor(b,[v('ver',{tags:['vertical']})]);assert.equal(pickVideo(solo,false).id,'ver');assert.equal(pickVideo({video:null,videos:{}},true),null);
});

test('tele ¿Sabías que?: usa solo la cápsula literaria 16:9 del Stock',async()=>{
 const {sabiasQueLiteraria}=await import('../assets/xpaces/capsulas.mjs');
 const video=(id,title,tags)=>({id,title,tags,type:'video',mime:'video/mp4',url:'https://stock.example/'+id,createdAt:id});
 const items=[video('1','El héroe de las mil caras: volver con un don',['horizontal','capsula']),video('2','¿Sabías que? · Joseph Campbell',['vertical','literaria']),video('3','¿Sabías que? · Joseph Campbell',['horizontal','literaria'])];
 assert.equal(sabiasQueLiteraria(items)?.id,'3');
 assert.equal(sabiasQueLiteraria(items.slice(0,2)),null);
});

test('Comprar / Vender: Casa del Libro (o su búsqueda) y Wallapop, en pestaña nueva y sin precios',async()=>{
 const {compraURL,anuncioTexto,WALLAPOP_UPLOAD}=await import('../assets/xpaces/capsulas.mjs');
 const shelf=JSON.parse(fs.readFileSync(new URL('../assets/xpaces/libros/estanteria-libros.json',import.meta.url)));
 const meta=slug=>shelf.libros.find(l=>l.slug===slug);
 const co={libro:'Co-Intelligence',meta:meta('co-intelligence-en')};assert.equal(compraURL(co),'https://www.casadellibro.com/libro-cointeligencia/9788418053214/16155367');
 const imp={libro:'The Impossible Factory',meta:meta('the-impossible-factory-en')};assert.equal(compraURL(imp),'https://www.casadellibro.com/ebook-the-impossible-factory-ebook/9781524745523/17403821');
 assert.equal(compraURL({libro:'Sin ficha',meta:{titulo:'Sin ficha',casadellibro_url:null}}),'https://www.casadellibro.com/?query=Sin%20ficha','sin ficha cae en la búsqueda');
 for(const l of shelf.libros)assert.match(compraURL({libro:l.titulo,meta:l}),/^https:\/\/www\.casadellibro\.com\//);
 const t=anuncioTexto(co);assert.match(t,/^Libro: Co-Intelligence/);assert.match(t,/Autor: Ethan Mollick/);assert.match(t,/ISBN: 9788418053214/);assert.ok(!/€|precio/i.test(t),'sin precios');
 assert.equal(WALLAPOP_UPLOAD,'https://es.wallapop.com/app/catalog/upload');
 const c=fs.readFileSync(new URL('../assets/xpaces/capsulas.mjs',import.meta.url),'utf8');
 const iMedia=c.indexOf('<div class="xpace-libro-media">'),iBuy=c.indexOf('<div class="xpace-libro-compra">'),iKicker=c.indexOf('<p class="xpace-libro-kicker">');
 assert.ok(iMedia<iBuy&&iBuy<iKicker,'debajo del vídeo y encima de «Cápsula Blinkist · consejero»');
 assert.match(c,/data-comprar href="\$\{esc\(compraURL\(b\)\)\}" target="_blank" rel="noopener"/);assert.match(c,/data-vender href="\$\{WALLAPOP_UPLOAD\}" target="_blank" rel="noopener"/);
 assert.match(c,/Texto del anuncio copiado/);
 const css=fs.readFileSync(new URL('../assets/xpaces/viewer.css',import.meta.url),'utf8');assert.match(css,/\.xpace-libro-compra\{display:grid;grid-template-columns:1fr 1fr/);assert.match(css,/\.xpace-libro-compra a\{[^}]*min-width:0/);
});

test('Portadas de Casa del Libro: 6 ficheros en el despliegue, origen imagessl, Blinkist aparte, sin deformar',async()=>{
 const {coverPath,coverURL,coverCrop,dims}=await import('../assets/xpaces/capsulas.mjs');
 const shelf=JSON.parse(fs.readFileSync(new URL('../assets/xpaces/libros/estanteria-libros.json',import.meta.url)));
 assert.equal(shelf.libros.length,6);
 for(const l of shelf.libros){
  assert.match(l.portada_casadellibro,/^https:\/\/imagessl\d?\.casadellibro\.com\/a\/l\/t\d\/\d\d\/97[89]\d{10}\.jpg$/,l.slug);
  assert.match(l.portada_blinkist_url,/images\.blinkist\.io/,'Blinkist se conserva aparte');
  assert.equal(coverPath(l),`portadas/${l.slug}-casadellibro.jpg`);assert.match(coverURL(l),new RegExp(`/libros/portadas/${l.slug}-casadellibro\\.jpg$`));
  const buf=fs.readFileSync(new URL(`../assets/xpaces/libros/${coverPath(l)}`,import.meta.url));assert.equal(buf[0],0xff);assert.equal(buf[1],0xd8,'JPEG');assert.ok(buf.length>20000,'no es un placeholder');
  assert.ok(l.portada_px.alto/l.portada_px.ancho>1.4&&l.portada_px.alto/l.portada_px.ancho<1.7,'portada vertical');
  assert.match(l.casadellibro_url,/^https:\/\/www\.casadellibro\.com\/(libro|ebook)-/,'todas con ficha');
 }
 const tif=shelf.libros.find(l=>l.slug==='the-impossible-factory-en');assert.equal(tif.isbn_ebook,'9781524745523');assert.equal(tif.isbn,'9781524745516');assert.match(tif.portada_casadellibro,/9781524745523/);
 assert.deepEqual(coverCrop(1.5,1.5),{repeat:[1,1],offset:[0,0]});
 let c=coverCrop(1.6,1.5);assert.equal(c.repeat[0],1);assert.ok(Math.abs(c.repeat[1]-1.5/1.6)<1e-9);assert.ok(Math.abs(c.offset[1]-(1-1.5/1.6)/2)<1e-9);
 c=coverCrop(1.4,1.5);assert.ok(Math.abs(c.repeat[0]-1.4/1.5)<1e-9);assert.equal(c.repeat[1],1);
 const d=dims({slug:'x',cover:{width:650,height:1000},medidas:{L:.23}});assert.ok(Math.abs(d.L/d.D-1000/650)<1e-9,'provisional con la proporción de la portada');
 const src=fs.readFileSync(new URL('../assets/xpaces/capsulas.mjs',import.meta.url),'utf8');assert.match(src,/applyCover\(obj,b\)/,'GLB con la portada de Casa del Libro');assert.match(src,/coverAspect\(b\)\|\|1\.43/,'pizarra con la proporción real');
});
