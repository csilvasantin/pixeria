// Estantería de libros + «libro del día» del Xpace Cafetería Alsea (encargo #4397 · FLT-101048).
// Fuente viva: índice público del Stock de Pixeria (type=capsula con etiqueta o enlace Blinkist).
// La rutina diaria publica cápsulas nuevas; aquí se relee el índice cada 5 min y al volver a la pestaña.
// Libro del día = la cápsula Blinkist más reciente (createdAt). Nunca se inventan títulos: solo datos del Stock.
import * as T from './engine/premium-three.mjs';
import {GLTFLoader} from './engine/vendor/GLTFLoader.mjs';

export const STOCK_INDEX='https://stock.admira.store/stock/index.json';
// Ficha de la estantería (#4397/#4399): portadas reales de Blinkist en espejo, ISBN, medidas y formato de modelos.
export const SHELF_META=new URL('./libros/estanteria-libros.json?v=libros-4418',import.meta.url).href;
// Portadas de verdad (Carlos, 26-sep 01:26): la imagen de la ficha de Casa del Libro, copiada al despliegue (CORS).
// La de Blinkist queda como respaldo si falta la de Casa del Libro.
export function coverPath(m){if(!m)return null;if(m.portada_local)return m.portada_local;if(m.portada_espejo)return `portadas/${m.slug}.jpg`;return null;}
export function coverURL(m){const p=coverPath(m);return p?new URL(p,SHELF_META).href:null;}
// Recorte centrado (sin deformar) de una portada de proporción img (alto/ancho) sobre una cara de proporción face.
export function coverCrop(img,face){if(!(img>0)||!(face>0))return {repeat:[1,1],offset:[0,0]};if(img>face){const r=face/img;return {repeat:[1,r],offset:[0,(1-r)/2]};}const r=img/face;return {repeat:[r,1],offset:[(1-r)/2,0]};}
const REFRESH_MS=5*60*1000, PAGE_MS=9000;
// Respaldo para cápsulas antiguas sin línea «Fuente:» (datos de capsulas-blinkist/usados.json).
const USADOS={
 'creative-confidence-en':{libro:'Creative Confidence',autor:'Tom Kelley, David Kelley'},
 'creatividad-sa-es':{libro:'Creatividad, S.A.',autor:'Ed Catmull'},
 'understanding-comics-en':{libro:'Understanding Comics',autor:'Scott McCloud'},
 'co-intelligence-en':{libro:'Co-Intelligence: Living and Working with AI',autor:'Ethan Mollick'},
 'the-impossible-factory-en':{libro:'The Impossible Factory',autor:'Josh Dean'},
 'sapiens-en':{libro:'Sapiens: A Brief History of Humankind',autor:'Yuval Noah Harari'},
 'the-hero-with-a-thousand-faces-en':{libro:'The Hero with a Thousand Faces',autor:'Joseph Campbell'}
};
const CONSEJEROS={waltdisney:['Walt Disney','#16407a','#f3e7c9'],georgelucas:['George Lucas','#1d1d1f','#d9b25a'],stevejobs:['Steve Jobs','#ece8df','#1d1d1f'],stevewozniak:['Steve Wozniak','#7d2525','#f4e9d8'],howardschultz:['Howard Schultz','#0b5d3f','#f4efe2'],warrenbuffett:['Warren Buffett','#3d4a2b','#efe6cf'],timcook:['Tim Cook','#44546a','#f2f2f2'],dieterrams:['Dieter Rams','#c8691c','#fff6e8'],elonmusk:['Elon Musk','#262a33','#e6e6e6']};
const PALETA=[['#6b2d3a','#f2e6d0'],['#24495e','#f1e8d4'],['#3f5a36','#f3ecd8'],['#8a5a1f','#fbf2de'],['#2f2f4f','#e9dcc0'],['#5b3b2a','#f0e2c7']];
const hash=s=>{let h=2166136261;for(const c of String(s)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;};

export function parseCapsula(x){
 const comment=String(x.comment||''),prompt=String(x.prompt||'');
 const slug=(prompt.match(/blinkist\.com\/(?:[a-z]{2}\/)?(?:app\/)?books\/([a-z0-9-]+)/i)||[])[1]||'';
 const fuente=comment.match(/Fuente:\s*(.+?),\s+de\s+(.+?)\s*\(/);
 const fb=USADOS[slug]||{};
 const libro=(fuente&&fuente[1].trim())||fb.libro||String(x.title||'').split(/[:·]/)[0].trim();
 const autor=(fuente&&fuente[2].trim())||fb.autor||'';
 const tags=(x.tags||[]).map(String),key=tags.find(t=>CONSEJEROS[t]);
 const [consejero,color,tinta]=key?CONSEJEROS[key]:['Consejo de Silicio',...PALETA[hash(slug||libro)%PALETA.length]];
 const sec=name=>{const m=comment.match(new RegExp(name+'\\s*\\n([\\s\\S]*?)(?=\\n\\s*\\n(?:PARA CARBONO|PARA SILICIO|APLICACI[ÓO]N|Fuente:)|$)'));return m?m[1].trim():'';};
 let secciones=[['Para carbono',sec('PARA CARBONO')],['Para silicio',sec('PARA SILICIO')],['Aplicación',sec('APLICACI[ÓO]N')]].filter(s=>s[1]);
 if(!secciones.length)secciones=[['La cápsula',comment.replace(/\s+/g,' ').trim()]];
 return {id:x.id,slug:slug||libro.toLowerCase(),libro,autor,consejero,consejeroId:key||'',color,tinta,capsula:String(x.title||''),createdAt:x.createdAt,secciones,blinkist:prompt};
}
export function selectBooks(items){
 const capsulas=(Array.isArray(items)?items:items?.items||[]).filter(x=>x&&x.type==='capsula'&&((x.tags||[]).includes('blinkist')||/blinkist\.com/i.test(x.prompt||'')));
 capsulas.sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
 const seen=new Set(),books=[];
 for(const x of capsulas){const b=parseCapsula(x);if(!b.libro||seen.has(b.slug))continue;seen.add(b.slug);books.push(b);}
 return books; // más reciente primero
}
// Medios de la cápsula (#ver-mueble): vídeo y/o locución publicados en el Stock. Primero un vínculo explícito
// (externalRef «capsula:<id>»); si no, el mismo título exacto que la cápsula (así publica el generador de vídeo).
// Nunca se inventa: si no hay coincidencia, no hay medio.
const norm=v=>String(v||'').normalize('NFC').replace(/\s+/g,' ').trim().toLowerCase();
export function mediaFor(b,items){
 const list=(Array.isArray(items)?items:items?.items||[]).filter(x=>x&&x.url&&x.id!==b.id);
 const linked=x=>x.externalRef==='capsula:'+b.id,same=x=>!!b.capsula&&norm(x.title)===norm(b.capsula);
 const newest=a=>a.sort((p,q)=>String(q.createdAt).localeCompare(String(p.createdAt)))[0]||null;
 const isVideo=x=>x.type==='video'&&/^video\//.test(x.mime||''),isAudio=x=>['audio','locucion'].includes(x.type)&&/^audio\//.test(x.mime||'');
 const find=test=>newest(list.filter(x=>test(x)&&linked(x)))||newest(list.filter(x=>test(x)&&same(x)));
 const out=x=>x?{id:x.id,url:x.url,title:x.title||'',createdAt:x.createdAt||null,orientacion:orientation(x)}:null;
 // Norma de Carlos: cada cápsula puede tener versión vertical 9:16 y horizontal 16:9.
 const video=find(isVideo),vertical=find(x=>isVideo(x)&&orientation(x)==='vertical'),horizontal=find(x=>isVideo(x)&&orientation(x)==='horizontal');
 return {video:out(video),videos:{vertical:out(vertical),horizontal:out(horizontal)},audio:out(find(isAudio))};
}
export function orientation(x){
 const o=norm(x.orientacion),tags=(x.tags||[]).map(norm);
 if(/vertical|portrait|9:16/.test(o)||tags.some(t=>['vertical','9:16','9x16'].includes(t)))return 'vertical';
 if(/horizontal|landscape|16:9/.test(o)||tags.some(t=>['horizontal','16:9','16x9'].includes(t)))return 'horizontal';
 if(x.ancho>0&&x.alto>0)return x.ancho>=x.alto?'horizontal':'vertical';
 return null;
}
export function pickVideo(media,portrait){const v=media?.videos||{};return (portrait?v.vertical||v.horizontal:v.horizontal||v.vertical)||media?.video||null;}

// Comprar / Vender (#comprar-vender): enlaces directos, sin afiliación y sin precios.
export const WALLAPOP_UPLOAD='https://es.wallapop.com/app/catalog/upload';
export function compraURL(b){const m=b?.meta||{};return m.casadellibro_url||'https://www.casadellibro.com/?query='+encodeURIComponent(m.titulo||b?.libro||m.isbn||'');}
export function anuncioTexto(b){const m=b?.meta||{},titulo=m.titulo||b?.libro||'',autor=m.autor||b?.autor||'';return [`Libro: ${titulo}`,autor&&`Autor: ${autor}`,m.isbn&&`ISBN: ${m.isbn}`].filter(Boolean).join('\n');}
export function speechText(b){return [b.libro+(b.autor?', de '+b.autor:'')+'.',b.capsula?b.capsula+'.':'',...(b.secciones||[]).map(([name,body])=>name+'. '+body)].filter(Boolean).join('\n\n');}
let metaCache=null;
async function loadMeta(signal){if(metaCache)return metaCache;try{const r=await fetch(SHELF_META,{signal});metaCache=r.ok?await r.json():{libros:[]};}catch{metaCache={libros:[]};}return metaCache;}
const imageCache=new Map();
function loadImage(url){if(!url)return Promise.resolve(null);if(!imageCache.has(url))imageCache.set(url,new Promise(res=>{const i=new Image();i.crossOrigin='anonymous';i.onload=()=>res(i);i.onerror=()=>res(null);i.src=url;}));return imageCache.get(url);}
function sampleColor(img){const c=document.createElement('canvas');c.width=8;c.height=32;const x=c.getContext('2d');x.drawImage(img,0,0,Math.max(1,img.width*.1),img.height,0,0,8,32);const d=x.getImageData(0,0,8,32).data;let r=0,g=0,b=0;for(let i=0;i<d.length;i+=4){r+=d[i];g+=d[i+1];b+=d[i+2];}const n=d.length/4;r/=n;g/=n;b/=n;const hex='#'+[r,g,b].map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');return [hex,(.299*r+.587*g+.114*b)>150?'#1d1d1f':'#f6efdc'];}
export async function loadBooks(signal){
 const r=await fetch(STOCK_INDEX+'?t='+Math.floor(Date.now()/60000),{signal,cache:'no-store'});if(!r.ok)throw Error('Stock: HTTP '+r.status);
 const index=await r.json(),items=Array.isArray(index)?index:index.items||[],books=selectBooks(items),meta=await loadMeta(signal);
 await Promise.all(books.map(async b=>{
  const m=(meta.libros||[]).find(x=>x.slug===b.slug);b.meta=m||null;b.media=mediaFor(b,items);
  b.resumenAudio=m?.audio_resumen?.url?new URL(m.audio_resumen.url,SHELF_META).href:b.media.audio?.url||null;
  b.authorPhoto=await loadImage(m?.foto_autor?.url?new URL(m.foto_autor.url,SHELF_META).href:null);
  if(m?.medidas_cm?.alto)b.medidas={L:m.medidas_cm.alto/100,D:(m.medidas_cm.ancho||15)/100,th:(m.medidas_cm.grueso||0)/100||null};
  b.cover=await loadImage(coverURL(m));
  if(b.cover){const [c,t]=sampleColor(b.cover);b.color=c;b.tinta=t;}
  // Modelo definitivo de Trinity (#4399): GLB en Stock con externalRef estanteria-libros:<slug>.
  const glb=items.filter(x=>x.externalRef==='estanteria-libros:'+b.slug&&(String(x.mime).startsWith('model/gltf')||/\.glb/i.test(x.url||'')||x.ext==='glb')).sort((a,c)=>String(c.createdAt).localeCompare(String(a.createdAt)))[0];
  b.glb=glb?.url||(m?.modelo_glb?.url?new URL(m.modelo_glb.url,SHELF_META).href:null);
 }));
 return books;
}

// ---------- dibujo en canvas ----------
function wrap(ctx,text,maxWidth){const lines=[];for(const para of String(text).split('\n')){let line='';for(const word of para.split(/\s+/).filter(Boolean)){const t=line?line+' '+word:word;if(ctx.measureText(t).width>maxWidth&&line){lines.push(line);line=word;}else line=t;}lines.push(line);}return lines;}
function fitLines(ctx,text,font,size,maxWidth,maxLines,min=10){let s=size,lines;do{ctx.font=font.replace('%',s+'px');lines=wrap(ctx,text,maxWidth);s-=2;}while(lines.length>maxLines&&s>=min);if(lines.length>maxLines){lines=lines.slice(0,maxLines);lines[maxLines-1]=lines[maxLines-1].replace(/\s*\S*$/,'')+'…';}return {lines,size:s+2};}
function texture(canvas){const t=new T.CanvasTexture(canvas);t.colorSpace=T.SRGBColorSpace;t.anisotropy=8;return t;}
function drawCover(ctx,b,x,y,w,h,{ribbon=false}={}){
 if(b.cover){ctx.save();ctx.drawImage(b.cover,x,y,w,h);if(ribbon){ctx.fillStyle='#d9b25a';ctx.fillRect(x,y+h*.9,w,h*.07);ctx.fillStyle='#1d1d1f';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`800 ${Math.round(w*.06)}px "Helvetica Neue", Arial, sans-serif`;ctx.fillText('EL LIBRO DEL DÍA',x+w/2,y+h*.935);}ctx.restore();return;}
 ctx.save();ctx.fillStyle=b.color;ctx.fillRect(x,y,w,h);
 const g=ctx.createLinearGradient(x,0,x+w,0);g.addColorStop(0,'rgba(0,0,0,.28)');g.addColorStop(.06,'rgba(255,255,255,.08)');g.addColorStop(.1,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(0,0,0,.12)');ctx.fillStyle=g;ctx.fillRect(x,y,w,h);
 ctx.strokeStyle=b.tinta;ctx.globalAlpha=.55;ctx.lineWidth=Math.max(2,w*.008);ctx.strokeRect(x+w*.07,y+h*.05,w*.86,h*.9);ctx.globalAlpha=1;
 ctx.fillStyle=b.tinta;ctx.textAlign='center';ctx.textBaseline='top';
 const t=fitLines(ctx,b.libro,'700 % Georgia, "Times New Roman", serif',Math.round(w*.13),w*.76,5,Math.round(w*.05));
 let cy=y+h*.17;for(const l of t.lines){ctx.fillText(l,x+w/2,cy);cy+=t.size*1.12;}
 ctx.fillRect(x+w*.4,cy+h*.03,w*.2,Math.max(2,h*.004));
 const a=fitLines(ctx,b.autor,'400 % Georgia, serif',Math.round(w*.065),w*.76,2,Math.round(w*.035));cy+=h*.07;for(const l of a.lines){ctx.fillText(l,x+w/2,cy);cy+=a.size*1.2;}
 ctx.font=`600 ${Math.round(w*.042)}px "Helvetica Neue", Arial, sans-serif`;ctx.globalAlpha=.85;ctx.fillText('CÁPSULA BLINKIST · ADMIRANEXT',x+w/2,y+h*.84);ctx.fillText('Consejero: '+b.consejero,x+w/2,y+h*.84+w*.06);ctx.globalAlpha=1;
 if(ribbon){ctx.fillStyle='#d9b25a';ctx.fillRect(x,y+h*.66,w,h*.075);ctx.fillStyle='#1d1d1f';ctx.font=`800 ${Math.round(w*.06)}px "Helvetica Neue", Arial, sans-serif`;ctx.textBaseline='middle';ctx.fillText('EL LIBRO DEL DÍA',x+w/2,y+h*.6975);}
 ctx.restore();
}
function spineTexture(b,L,th){
 const W=1024,H=Math.max(96,Math.round(W*th/L)),c=document.createElement('canvas');c.width=W;c.height=H;const ctx=c.getContext('2d');
 ctx.fillStyle=b.color;ctx.fillRect(0,0,W,H);
 const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'rgba(0,0,0,.35)');g.addColorStop(.2,'rgba(255,255,255,.10)');g.addColorStop(.5,'rgba(255,255,255,0)');g.addColorStop(1,'rgba(0,0,0,.35)');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
 ctx.fillStyle=b.tinta;ctx.fillRect(40,0,6,H);ctx.fillRect(W-46,0,6,H);
 ctx.textBaseline='middle';ctx.textAlign='left';
 const title=fitLines(ctx,b.libro,'700 % Georgia, serif',Math.round(H*.42),W*.62,1,Math.round(H*.2));ctx.font=`700 ${title.size}px Georgia, serif`;ctx.fillText(title.lines[0],70,H/2);
 ctx.textAlign='right';const au=(b.autor||'').split(',')[0];const a=fitLines(ctx,au,'400 % Georgia, serif',Math.round(H*.3),W*.22,1,Math.round(H*.16));ctx.font=`400 ${a.size}px Georgia, serif`;ctx.globalAlpha=.9;ctx.fillText(a.lines[0],W-70,H/2);ctx.globalAlpha=1;
 return texture(c);
}
function coverTexture(b,ribbon){const c=document.createElement('canvas');c.width=600;c.height=b.cover?Math.round(600*b.cover.height/b.cover.width):860;drawCover(c.getContext('2d'),b,0,0,c.width,c.height,{ribbon});return texture(c);}
export const coverAspect=b=>b?.cover?.width>0?b.cover.height/b.cover.width:(b?.meta?.portada_px?.ancho>0?b.meta.portada_px.alto/b.meta.portada_px.ancho:null);
let pagesTex;function pages(){if(pagesTex)return pagesTex;const c=document.createElement('canvas');c.width=64;c.height=256;const x=c.getContext('2d');x.fillStyle='#efe6cf';x.fillRect(0,0,64,256);x.strokeStyle='rgba(120,100,70,.25)';for(let i=0;i<64;i+=3){x.beginPath();x.moveTo(i,0);x.lineTo(i,256);x.stroke();}pagesTex=texture(c);return pagesTex;}

// ---------- libro 3D ----------
function bookMesh(b,{L,th,D,cover=false}){
 const pageMat=new T.MeshStandardMaterial({map:pages(),roughness:.9});
 const tapa=new T.MeshStandardMaterial({color:b.color,roughness:.55});
 let mats,geo;
 if(cover){ // de cara: ancho D, alto L, grosor th; portada en +z
  geo=new T.BoxGeometry(D,L,th);const front=new T.MeshStandardMaterial({map:coverTexture(b,true),roughness:.45});
  mats=[pageMat,tapa,pageMat,pageMat,front,tapa];
 }else{ // largo L en x, grosor th en y, fondo D en z; lomo en +z
  geo=new T.BoxGeometry(L,th,D);const spine=new T.MeshStandardMaterial({map:spineTexture(b,L,th),roughness:.5});
  const front=b.cover?new T.MeshStandardMaterial({map:coverTexture(b,false),roughness:.45}):tapa;if(front.map){front.map.center.set(.5,.5);front.map.rotation=-Math.PI/2;}
  mats=[pageMat,pageMat,front,tapa,spine,pageMat];
 }
 const m=new T.Mesh(geo,mats);m.castShadow=true;m.receiveShadow=true;m.userData.capsula=b.id;m.name='libro:'+b.slug;return m;
}
export function dims(b){const h=hash(b.slug),m=b.medidas||{},L=Math.min(.3,m.L||.215+(h%7)*.011),a=coverAspect(b);return {L,th:m.th||.028+((h>>3)%6)*.0055,D:Math.min(.22,a?L/a:(m.D||.15+((h>>6)%4)*.01))};}
// En los GLB de Trinity la cara «portada_real_Blinkist» lleva la de Blinkist estirada: se cambia por la de Casa del Libro con recorte centrado.
function applyCover(obj,b){if(!b.cover)return;obj.traverse(n=>{if(!n.isMesh)return;const mat=[n.material].flat()[0];if(!/portada/i.test(mat?.name||'')&&!/portada/i.test(n.name))return;if(!n.geometry.boundingBox)n.geometry.computeBoundingBox();const e=n.geometry.boundingBox.getSize(new T.Vector3()),[w,h]=[e.x,e.y,e.z].sort((p,q)=>q-p).slice(0,2).reverse();const tex=new T.Texture(b.cover);tex.flipY=false;tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=8;const c=coverCrop(b.cover.height/b.cover.width,h/w);tex.repeat.set(...c.repeat);tex.offset.set(...c.offset);tex.needsUpdate=true;const next=mat.clone();next.map=tex;next.name=mat.name;n.material=next;n.userData.portada='casadellibro';});}
const gltfCache=new Map();
function loadGLB(url){if(!gltfCache.has(url))gltfCache.set(url,new GLTFLoader().loadAsync(url).then(g=>g.scene).catch(()=>null));return gltfCache.get(url);}

// ---------- estantería ----------
export function buildShelf(row,{nogal,laton}={}){
 const {ancho:W,fondo:D,alto:H}=row.medidas,t=.025,rows=3,gap=(H-t)/rows;
 const group=new T.Group();group.name=row.nodeName||row.id;
 const wood=nogal||new T.MeshStandardMaterial({color:'#5a3a24',roughness:.46});
 const back=new T.MeshStandardMaterial({color:'#8a6446',roughness:.6});
 const box=(w,h,d,x,y,z,mat)=>{const m=new T.Mesh(new T.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;group.add(m);return m;};
 box(t,H,D,-W/2+t/2,H/2,D/2,wood);box(t,H,D,W/2-t/2,H/2,D/2,wood);
 for(let i=0;i<=rows;i++)box(W,t,D,0,Math.min(i*gap,H-t)+t/2,D/2,wood);
 box(W-2*t,H-t,.012,0,H/2,.006,back);
 const brass=laton||new T.MeshStandardMaterial({color:'#b98b2e',metalness:.8,roughness:.3});
 box(W*.98,.012,.012,0,H+.03,D*.6,brass); // listón de latón
 const books=new T.Group();books.name='libros-capsulas';group.add(books);
 group.userData.shelf={W,D,H,t,gap,rows,books};
 return group;
}
function deco(group,x,y,z){ // taza y planta pequeña para el hueco, sin texto
 const cup=new T.Mesh(new T.CylinderGeometry(.045,.038,.1,24),new T.MeshStandardMaterial({color:'#f4f1ea',roughness:.3}));cup.position.set(x,y+.05,z);cup.castShadow=true;group.add(cup);
 const band=new T.Mesh(new T.CylinderGeometry(.0455,.043,.03,24),new T.MeshStandardMaterial({color:'#0b5d3f',roughness:.5}));band.position.set(x,y+.05,z);group.add(band);
}
function plant(group,x,y,z){
 const pot=new T.Mesh(new T.CylinderGeometry(.06,.05,.11,20),new T.MeshStandardMaterial({color:'#c9b8a0',roughness:.8}));pot.position.set(x,y+.055,z);pot.castShadow=true;group.add(pot);
 const leafMat=new T.MeshStandardMaterial({color:'#2f6b3a',roughness:.7});
 for(let i=0;i<7;i++){const leaf=new T.Mesh(new T.SphereGeometry(.045,10,8),leafMat);const a=i/7*Math.PI*2;leaf.scale.set(.6,1.4,.35);leaf.position.set(x+Math.cos(a)*.04,y+.16+(i%3)*.02,z+Math.sin(a)*.03);leaf.rotation.set(Math.sin(a)*.5,a,Math.cos(a)*.5);leaf.castShadow=true;group.add(leaf);}
}
function disposeTree(o){o.traverse(n=>{if(n.geometry)n.geometry.dispose();for(const m of [n.material].flat().filter(Boolean)){if(m.map&&m.map!==pagesTex)m.map.dispose();m.dispose();}});}
export async function fillShelf(shelf,books,featuredId){
 // Sólo colocación de libros: la geometría de la estantería y pizarra-3 pertenecen a George.
 const models=new Map(await Promise.all(books.filter(b=>b.glb).map(async b=>[b.id,await loadGLB(b.glb)])));
 const s=shelf.userData.shelf,g=s.books;
 for(const child of [...g.children]){g.remove(child);if(!child.name.startsWith('libro-glb:'))disposeTree(child);}
 const left=-s.W/2+s.t+.03,right=s.W/2-s.t-.03,floor=row=>row*s.gap+s.t+.002;
 const featured=books.find(b=>b.id===featuredId)||books[0];
 const rest=books.filter(b=>b!==featured).slice(0,60);
 const copy=b=>{const src=models.get(b.id);if(!src)return null;const obj=src.clone(true);applyCover(obj,b);obj.name='libro-glb:'+b.slug;obj.userData.capsula=b.id;obj.traverse(n=>{if(n.isMesh){n.castShadow=true;n.receiveShadow=true;}});return obj;};
 const size=o=>new T.Box3().setFromObject(o).getSize(new T.Vector3());
 const face=(b,x,row)=>{let o=copy(b);if(!o){const d=dims(b);o=bookMesh(b,{L:d.L,th:d.th,D:d.D,cover:true});o.position.set(x,floor(row)+d.L/2,s.D-d.th/2-.015);g.add(o);return;}
  const d=size(o);o.rotation.y=-Math.PI/2;o.position.set(x,floor(row),s.D-d.x/2-.015);g.add(o);};
 const spine=(b,x,row)=>{let o=copy(b);if(!o){const d=dims(b);o=bookMesh(b,{L:d.L,th:d.th,D:d.D,cover:false});o.rotation.z=Math.PI/2;o.position.set(x+d.th/2,floor(row)+d.L/2,s.D-d.D/2-.014);g.add(o);return d.th;}
  const d=size(o);o.position.set(x+d.x/2,floor(row),s.D-d.z/2-.014);g.add(o);return d.x;};
 const stack=(b,x,row,rise)=>{let o=copy(b);if(!o){const d=dims(b);o=bookMesh(b,{L:d.L,th:d.th,D:d.D,cover:true});o.rotation.z=Math.PI/2;o.position.set(x,floor(row)+rise+d.th/2,s.D-d.D/2-.02);g.add(o);return d.th;}
  const d=size(o);o.rotation.z=Math.PI/2;o.position.set(x,floor(row)+rise+d.x/2,s.D-d.z/2-.02);g.add(o);return d.x;};
 if(featured)face(featured,left+.2,1);
 // Tres lomos, una portada y una pequeña pila: composición distinta por balda.
 let x=left+.11;for(const b of rest.slice(0,3)){x+=spine(b,x,2)+.007;}
 if(rest[3])face(rest[3],left+.49,0);
 let rise=0;for(const b of rest.slice(4,6))rise+=stack(b,right-.08,0,rise)+.002;
 for(const b of rest.slice(6)){if(x+.07>right)break;x+=spine(b,x,2)+.007;}
 if(rest.length<4)plant(g,left+.53,floor(0),s.D*.5);
 return {featured,books};
}

// ---------- pantalla «libro del día» ----------
export function drawScreen(canvas,b,page=0,total=0){
 const ctx=canvas.getContext('2d'),W=canvas.width,H=canvas.height;
 ctx.fillStyle='#0d3b2c';ctx.fillRect(0,0,W,H);const g=ctx.createRadialGradient(W*.3,H*.2,50,W*.5,H*.5,W*.8);g.addColorStop(0,'rgba(255,255,255,.08)');g.addColorStop(1,'rgba(0,0,0,.25)');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
 const pad=W*.045;ctx.textBaseline='top';ctx.textAlign='left';
 if(!b){ctx.fillStyle='#f3ead3';ctx.font=`700 ${W*.04}px Georgia, serif`;ctx.fillText('El libro del día',pad,pad);ctx.font=`400 ${W*.022}px Georgia, serif`;ctx.fillText('Cargando las cápsulas del Stock…',pad,pad+W*.07);return;}
 const ar=coverAspect(b)||1.43,ch0=H*.62*1.43,cw=ch0/ar,ch=ch0,cx=pad,cy=(H-ch)/2+H*.02;ctx.save();ctx.shadowColor='rgba(0,0,0,.5)';ctx.shadowBlur=30;ctx.shadowOffsetY=12;ctx.fillStyle='#000';ctx.fillRect(cx,cy,cw,ch);ctx.restore();drawCover(ctx,b,cx,cy,cw,ch);
 const x=cx+cw+pad,w=W-x-pad;let y=pad*.9;
 ctx.fillStyle='#d9b25a';ctx.font=`800 ${Math.round(W*.02)}px "Helvetica Neue", Arial, sans-serif`;ctx.fillText('☕  EL LIBRO DEL DÍA',x,y);y+=W*.036;
 ctx.fillStyle='#f6efdc';let t=fitLines(ctx,b.libro,'700 % Georgia, serif',Math.round(W*.046),w,2,Math.round(W*.028));for(const l of t.lines){ctx.fillText(l,x,y);y+=t.size*1.08;}
 ctx.fillStyle='#e6d9b8';ctx.font=`400 ${Math.round(W*.024)}px Georgia, serif`;if(b.autor){ctx.fillText('de '+b.autor,x,y+4);y+=W*.034;}
 const fecha=b.createdAt?new Date(b.createdAt).toLocaleDateString('es-ES',{day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Madrid'}):'';
 ctx.font=`600 ${Math.round(W*.0165)}px "Helvetica Neue", Arial, sans-serif`;ctx.fillStyle='#9fd1b8';ctx.fillText(`Consejero: ${b.consejero}${fecha?'  ·  cápsula del '+fecha:''}`,x,y);y+=W*.03;
 ctx.fillStyle='#f6efdc';t=fitLines(ctx,'«'+b.capsula+'»','italic 400 % Georgia, serif',Math.round(W*.022),w,2,14);for(const l of t.lines){ctx.fillText(l,x,y);y+=t.size*1.2;}
 y+=W*.012;ctx.fillStyle='rgba(217,178,90,.6)';ctx.fillRect(x,y,w,2);y+=W*.016;
 const [name,body]=b.secciones[page%b.secciones.length];
 ctx.fillStyle='#d9b25a';ctx.font=`800 ${Math.round(W*.016)}px "Helvetica Neue", Arial, sans-serif`;ctx.fillText(name.toUpperCase(),x,y);y+=W*.026;
 ctx.fillStyle='#f3ead3';const room=H-y-pad*1.3;let size=Math.round(W*.02),lines;do{ctx.font=`400 ${size}px Georgia, serif`;lines=wrap(ctx,body,w);size--;}while(lines.length*(size+1)*1.28>room&&size>11);
 for(const l of lines){if(y>H-pad*1.4)break;ctx.fillText(l,x,y);y+=(size+1)*1.28;}
 ctx.font=`500 ${Math.round(W*.0125)}px "Helvetica Neue", Arial, sans-serif`;ctx.fillStyle='rgba(243,234,211,.7)';ctx.fillText(`Pixeria Stock · cápsulas Blinkist de AdmiraNeXT · ${total} libros en la estantería · se actualiza con cada cápsula nueva`,x,H-pad*.95);
 for(let i=0;i<b.secciones.length;i++){ctx.fillStyle=i===page%b.secciones.length?'#d9b25a':'rgba(243,234,211,.3)';ctx.beginPath();ctx.arc(W-pad-(b.secciones.length-1-i)*26,H-pad*.95+9,7,0,Math.PI*2);ctx.fill();}
}
export function drawPlayingScreen(canvas,b){
 const ctx=canvas.getContext('2d'),W=canvas.width,H=canvas.height,pad=W*.045;
 ctx.fillStyle='#0d3b2c';ctx.fillRect(0,0,W,H);
 ctx.fillStyle='#d9b25a';ctx.font=`800 ${Math.round(W*.021)}px Arial,sans-serif`;ctx.fillText('▶  RESUMEN EN REPRODUCCIÓN',pad,pad*1.2);
 const ar=coverAspect(b)||1.5,ch=H*.66,cw=ch/ar,cy=H*.16;drawCover(ctx,b,pad,cy,cw,ch);
 const x=pad*2+cw,w=W-x-pad;let y=H*.18;
 ctx.fillStyle='#f6efdc';ctx.textBaseline='top';const title=fitLines(ctx,b.libro,'700 % Georgia,serif',W*.044,w*.72,2,W*.025);for(const line of title.lines){ctx.fillText(line,x,y);y+=title.size*1.1;}
 ctx.font=`400 ${Math.round(W*.022)}px Georgia,serif`;ctx.fillStyle='#e6d9b8';ctx.fillText(b.autor||'',x,y+8);y+=W*.065;
 if(b.authorPhoto){const pw=w*.22,ph=Math.min(H*.34,pw*1.1);ctx.drawImage(b.authorPhoto,W-pad-pw,H*.15,pw,ph);}
 ctx.font=`italic 400 ${Math.round(W*.024)}px Georgia,serif`;ctx.fillStyle='#f6efdc';for(const line of wrap(ctx,b.capsula,w*.85).slice(0,3)){ctx.fillText(line,x,y);y+=W*.033;}
 const body=b.secciones?.[0]?.[1]||'';ctx.font=`400 ${Math.round(W*.018)}px Georgia,serif`;y+=W*.01;for(const line of wrap(ctx,body,w).slice(0,5)){ctx.fillText(line,x,y);y+=W*.025;}
 const by=H-pad-W*.055;ctx.fillStyle='#d9b25a';ctx.fillRect(x,by,w*.68,W*.048);ctx.fillStyle='#142522';ctx.font=`800 ${Math.round(W*.019)}px Arial,sans-serif`;ctx.textBaseline='middle';ctx.fillText('Comprar en Casa del Libro ↗',x+W*.012,by+W*.024);
 if(b.meta?.foto_autor){ctx.fillStyle='#d9e6d8';ctx.font=`400 ${Math.round(W*.011)}px Arial,sans-serif`;ctx.textBaseline='top';ctx.fillText(`Foto: ${b.meta.foto_autor.autor_foto} · ${b.meta.foto_autor.licencia} · Wikimedia Commons`,x,by+W*.054);}
}
export function screenOverlay(screenObject){
 screenObject.updateWorldMatrix(true,true);let panel=null;screenObject.traverse(n=>{if(!panel&&n.isMesh&&[n.material].flat().some(m=>/^PANTALLA_/.test(m?.name||'')))panel=n;});
 const box=new T.Box3().setFromObject(panel||screenObject),size=box.getSize(new T.Vector3()),center=box.getCenter(new T.Vector3());
 const canvas=document.createElement('canvas');canvas.width=1536;canvas.height=Math.round(1536*size.y/size.x);
 const tex=texture(canvas),mat=new T.MeshBasicMaterial({map:tex,toneMapped:false});
 const mesh=new T.Mesh(new T.PlaneGeometry(size.x*.985,size.y*.975),mat);mesh.name='libro-del-dia';mesh.position.set(center.x,center.y,box.max.z+.002);mesh.renderOrder=2;
 screenObject.attach(mesh);return {canvas,tex,mesh};
}

// ---------- montaje en el Xpace ----------
export function mountCapsulas({scene,entries,signal}){
 const byId=id=>entries.find(e=>e.id===id);let viewer=null,books=[],page=0,timer=0,pager=0;
 const shelfEntry=entries.find(e=>e.runtime?.builder==='estanteria-libros'),screenEntry=entries.find(e=>e.contenido?.tipo==='libro-del-dia');
 const screen=screenEntry?screenOverlay(screenEntry.object):null;
 const forced=new URL(location.href).searchParams.get('libro');
 const state={books:[],libroDelDia:null,updatedAt:null,error:null,detail:false,libroAbierto:null,medio:null};
 // ---------- modo detalle de la estantería (#ver-mueble) ----------
 let ui=null,chosen=null,panel=null,bar=null,down=null,playing=null;
 const en=document.documentElement.lang==='en',esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function attachUI({stage,canvas,on}){
  if(!shelfEntry)return;ui={stage,canvas,on};
  bar=document.createElement('div');bar.className='xpace-detalle-bar';bar.hidden=true;bar.innerHTML=`<span>${en?'Detail · tap a book':'Modo detalle · toca un libro'}</span><button type="button" data-salir>${en?'Exit detail':'Salir del modo detalle'}</button>`;stage.append(bar);
  on(bar.querySelector('[data-salir]'),'click',()=>exitDetail());
  on(canvas,'pointerdown',e=>{down={x:e.clientX,y:e.clientY};});
  on(canvas,'pointerup',e=>{if(!down||Math.hypot(e.clientX-down.x,e.clientY-down.y)>8)return;down=null;if(playing&&screenEntry&&viewer.pick(e.clientX,e.clientY,[screenEntry.object]).length){window.open(compraURL(playing),'_blank','noopener');return;}if(!state.detail)return;const hit=viewer.pick(e.clientX,e.clientY,[shelfEntry.object.userData.shelf.books])[0];let node=hit?.object;while(node&&!node.userData.capsula)node=node.parent;const b=node&&books.find(x=>x.id===node.userData.capsula);if(b)openBook(b,node);});
 }
 function enterDetail(){if(!shelfEntry||!viewer||!ui)return false;state.detail=true;if(bar)bar.hidden=false;viewer.frameObject(shelfEntry.object,{angle:Math.PI/2,elevation:.04,margin:1.08,clip:true});return true;}
 function exitDetail({reset=true}={}){closeBook();const was=state.detail;state.detail=false;if(bar)bar.hidden=true;viewer?.clearClip();if(was&&reset)viewer.preset('home');return was;}
 function restoreBook(){if(!chosen)return;chosen.node.position.z=chosen.z;chosen.helper.removeFromParent();chosen.helper.geometry.dispose();chosen.helper.material.dispose();chosen=null;viewer?.invalidateShadows();}
 function closeBook(){if(panel){panel.querySelector('video,audio')?.pause();panel.remove();panel=null;}try{globalThis.speechSynthesis?.cancel();}catch{}playing=null;restoreBook();state.libroAbierto=null;state.medio=null;paint();}
 function speak(b,status){const synth=globalThis.speechSynthesis;if(!synth||typeof SpeechSynthesisUtterance==='undefined'){status.textContent=en?'This browser cannot read aloud.':'Este navegador no puede leer en voz alta.';return false;}synth.cancel();const u=new SpeechSynthesisUtterance(speechText(b));u.lang='es-ES';const voice=synth.getVoices().find(v=>/^es(-|_)ES/i.test(v.lang))||synth.getVoices().find(v=>/^es/i.test(v.lang));if(voice)u.voice=voice;u.rate=1;synth.speak(u);return true;}
 function openBook(b,node){
  closeBook();
  // Resalte: el libro sale 4 cm de la balda y lleva un contorno amarillo.
  let scene=node;while(scene.parent)scene=scene.parent;const helper=new T.BoxHelper(node,0xffd766);helper.material.depthTest=false;helper.renderOrder=1001;chosen={node,z:node.position.z,helper,id:b.id};node.position.z+=.04;node.updateMatrixWorld(true);helper.update();scene.add(helper);viewer?.invalidateShadows();
  const cover=b.cover?.src||coverURL(b.meta)||'';
  const kind=b.resumenAudio?'audio':'voz';state.libroAbierto=b.id;state.medio=kind;state.video=null;
  panel=document.createElement('div');panel.className='xpace-libro';panel.setAttribute('role','dialog');panel.setAttribute('aria-label',(en?'Capsule: ':'Cápsula: ')+b.libro);panel.dataset.medio=kind;
  const media=(cover?`<img src="${esc(cover)}" alt="${esc(b.libro)}">`:'')+(kind==='audio'?`<audio src="${esc(b.resumenAudio)}" preload="auto"></audio>`:'');
  const nota=kind==='audio'?(en?'Pixeria voice-over in Spanish.':'Locución propia de Pixeria en español.'):(en?'This capsule is read by the browser voice (es-ES).':'Esta cápsula la lee la voz del navegador (es-ES).');
  panel.innerHTML=`<div class="xpace-libro-top"><button type="button" data-cerrar>← ${en?'Back to shelf':'Volver a la estantería'}</button><button type="button" data-salir>${en?'Exit detail':'Salir del modo detalle'}</button></div><div class="xpace-libro-media">${media}</div><div class="xpace-libro-texto"><div class="xpace-libro-compra"><a data-comprar href="${esc(compraURL(b))}" target="_blank" rel="noopener">${en?'Buy at Casa del Libro':'Comprar en Casa del Libro'}</a><a data-vender href="${WALLAPOP_UPLOAD}" target="_blank" rel="noopener">${en?'Sell':'Vender'}</a></div><p class="xpace-libro-kicker">${en?'Pixeria capsule':'Cápsula Pixeria'} · ${esc(b.consejero)}</p><h4>${esc(b.libro)}</h4>${b.autor?`<p class="xpace-libro-autor">${en?'by':'de'} ${esc(b.autor)}</p>`:''}<p class="xpace-libro-capsula">«${esc(b.capsula)}»</p><p class="xpace-libro-nota" data-kind="${kind}">${nota}</p><p class="xpace-libro-estado" role="status"></p><div class="xpace-libro-acciones"><button type="button" data-leer>🔊 ${en?'Play summary':'Escuchar resumen'}</button><button type="button" data-parar>${en?'Stop':'Parar'}</button></div>${b.secciones.map(([name,body])=>`<section><h5>${esc(name)}</h5><p>${esc(body)}</p></section>`).join('')}</div>`;
  ui.stage.append(panel);const status=panel.querySelector('[role=status]');
  ui.on(panel.querySelector('[data-cerrar]'),'click',()=>closeBook());ui.on(panel.querySelector('[data-salir]'),'click',()=>exitDetail());
  ui.on(panel.querySelector('[data-vender]'),'click',e=>{e.stopPropagation();try{navigator.clipboard?.writeText(anuncioTexto(b)).then(()=>{status.textContent=en?'Listing text copied':'Texto del anuncio copiado';},()=>{});}catch{}});
  ui.on(panel.querySelector('[data-comprar]'),'click',e=>e.stopPropagation());
  const player=panel.querySelector('audio');
  function start(){try{globalThis.speechSynthesis?.cancel();}catch{}if(player){player.currentTime=0;player.play().catch(()=>{status.textContent=en?'Press play to listen.':'Pulsa Escuchar resumen para reproducir.';});}else speak(b,status);playing=b;paint();}
  ui.on(panel.querySelector('[data-leer]'),'click',start);
  ui.on(panel.querySelector('[data-parar]'),'click',()=>closeBook());
  if(player){ui.on(player,'ended',()=>{playing=null;paint();status.textContent=en?'Summary finished.':'Resumen terminado.';});ui.on(player,'error',()=>{playing=null;paint();status.textContent=en?'Audio unavailable.':'Audio no disponible.';});}
  start();
  panel.querySelector('[data-cerrar]').focus({preventScroll:true});
 }
 function paint(){if(!screen)return;const f=books.find(b=>b.id===forced)||books[0];if(playing)drawPlayingScreen(screen.canvas,playing);else drawScreen(screen.canvas,f,page,books.length);screen.tex.needsUpdate=true;}
 async function refresh(){
  try{const next=await loadBooks(signal);if(signal?.aborted)return;const sig=next.map(b=>b.id).join();const full=sig+'|'+next.map(b=>b.glb||'').join();if(full!==state.sig){books=next;if(shelfEntry)await fillShelf(shelfEntry.object,books,forced);state.sig=full;page=0;paint();viewer?.invalidateShadows();}
   state.books=books.map(b=>({id:b.id,libro:b.libro,autor:b.autor,consejero:b.consejero,createdAt:b.createdAt,portada:!!b.cover,glb:b.glb,isbn:b.meta?.isbn||null,video:b.media?.video?.id||null,videos:{vertical:b.media?.videos?.vertical?.id||null,horizontal:b.media?.videos?.horizontal?.id||null},audio:b.media?.audio?.id||null}));const f=books.find(b=>b.id===forced)||books[0];state.libroDelDia=f?{id:f.id,libro:f.libro,autor:f.autor,consejero:f.consejero,capsula:f.capsula}:null;state.updatedAt=new Date().toISOString();state.error=null;
   document.documentElement.dataset.libroDelDia=f?.id||'';
  }catch(e){if(!signal?.aborted){state.error=e.message;if(!books.length)paint();}}
 }
 paint();const ready=refresh();
 timer=setInterval(refresh,REFRESH_MS);pager=setInterval(()=>{if(books.length&&!document.hidden&&!playing){page++;paint();}},PAGE_MS);
 const vis=()=>{if(!document.hidden)refresh();};document.addEventListener('visibilitychange',vis);
 signal?.addEventListener('abort',()=>{clearInterval(timer);clearInterval(pager);document.removeEventListener('visibilitychange',vis);closeBook();bar?.remove();},{once:true});
 const bookScreen=id=>{const b=books.find(x=>x.id===id);let node=null;shelfEntry?.object.userData.shelf.books.traverse(n=>{if(!node&&n.userData.capsula===id)node=n;});if(b&&node)openBook(b,node);return !!(b&&node);};
 const bookCenter=id=>{let node=null;shelfEntry?.object.userData.shelf.books.traverse(n=>{if(!node&&n.userData.capsula===id)node=n;});return node?new T.Box3().setFromObject(node).getCenter(new T.Vector3()):null;};
 return {ready,state,bookCenter,setViewer:v=>{viewer=v;v.invalidateShadows();},refresh,attachUI,enterDetail,exitDetail,openBook:bookScreen,shelfId:shelfEntry?.id||null};
}
