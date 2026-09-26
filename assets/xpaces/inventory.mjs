import {mountReplacements} from '../furniture/replacements.mjs';
import * as T from './engine/premium-three.mjs';
import {fichaDe, accion, semaforoEstado, semaforoGarantia, urlUnidad} from './ci.mjs';
const sources={'1790375438696-1ladz7':'alsea-4380','1790370079244-cv7t5i':'alsea-4380','1790370139269-2ty118':'xtanco-4380','1790364696893-14ykfy':'alsea','1790365002072-l9tpjw':'xtanco'};
const fields=['id','nombre','tipo','categoria','cantidad','medidas','pantalla','fabricante','modelo','garantia','origen','variant'];
export function exportRows(entries){return entries.filter(e=>e.visible).map(e=>Object.fromEntries(fields.map(k=>[k,e[k]??''])));}
export function toCSV(rows){
 const columns=['id','nombre','tipo','categoria','cantidad','ancho','fondo','alto','unidad','pantalla','fabricante','modelo','garantia','origen','variant'];
 const cell=value=>'"'+String(value??'').replace(/^[=+@\-\t\r]/,"'$&").replaceAll('"','""')+'"';
 return '\ufeff'+[columns,...rows.map(r=>columns.map(k=>['ancho','fondo','alto','unidad'].includes(k)?r.medidas?.[k]:r[k]))].map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n';
}
export function readView(url){try{return new URL(url).searchParams.get('ver')||null;}catch{return null;}}
export function readHidden(url,assetId){try{const x=JSON.parse(new URL(url).searchParams.get('xhide-'+assetId)||'[]');return new Set(Array.isArray(x)?x.filter(v=>typeof v==='string'):[]);}catch{return new Set();}}
export function selectionURL(url,assetId,entries,ver){const u=new URL(url);if(typeof ver==='string'&&ver)u.searchParams.set('ver',ver);else if(ver===null)u.searchParams.delete('ver');u.searchParams.set('type','xpaces');u.searchParams.set('highlight',assetId);const hidden=entries.filter(e=>!e.visible).map(e=>e.id);if(hidden.length)u.searchParams.set('xhide-'+assetId,JSON.stringify(hidden));else u.searchParams.delete('xhide-'+assetId);return u;}
export async function bindInventory(gltf,item,bytes,signal){
 const slug=sources[item.id];let manifest;
 if(slug){
  const r=await fetch(new URL(`./inventory/${slug}.json?v=ci-4441`,import.meta.url),{signal});if(!r.ok)throw Error('Inventario: HTTP '+r.status);manifest=await r.json();
  const sha=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
  const allowed=[].concat(manifest.glbSha256||[]);
  if(!allowed.includes(sha))throw Error('El modelo ha cambiado: hay que actualizar su inventario');
 }else manifest={slug:'xpace',measuredCount:0,items:gltf.scene.children.map((n,i)=>({id:n.userData.admira_id||`glb:${n.name||i}`,nombre:n.userData.admira_nombre||n.name||`Objeto ${i+1}`,tipo:n.userData.admira_tipo||'objeto-3d',categoria:n.userData.categoria||'Sin categoría',cantidad:1,origen:'glb',object:n}))};
 const nodes=new Map();gltf.scene.traverse(n=>{const index=gltf.parser.associations.get(n)?.nodes;if(index!==undefined)nodes.set(index,n);});
 // Muebles añadidos en el visor (#4397): se construyen en tiempo de ejecución junto a un elemento medido.
 const hasRuntime=manifest.items.some(r=>r.runtime||r.contenido);const capsulasModule=hasRuntime?await import('./capsulas.mjs?v=tele-admira-4438-audio'):null;
 function runtimeObject(row){
  if(row.runtime.builder!=='estanteria-libros'||!capsulasModule)return null;
  const material=name=>{let found;gltf.scene.traverse(o=>{for(const m of [o.material].flat())if(!found&&m?.name===name)found=m;});return found;};
  const shelf=capsulasModule.buildShelf(row,{nogal:material('MAT_nogal'),laton:material('MAT_laton')});
  const anchor=nodes.get(manifest.items.find(r=>r.id===row.runtime.junto)?.node);if(!anchor)return null;
  gltf.scene.updateMatrixWorld(true);const box=new T.Box3().setFromObject(anchor);
  shelf.position.set((box.min.x+box.max.x)/2+(row.runtime.desplazamientoX||0),box.min.y+(row.runtime.alturaSuelo||0),box.min.z+.012);shelf.updateMatrixWorld(true);gltf.scene.attach(shelf);return shelf;
 }
 const entries=manifest.items.map(row=>{
  const object=row.object||(row.runtime?runtimeObject(row):row.sinGeometria?null:nodes.get(row.node));
  if(!object&&!row.sinGeometria)throw Error('Elemento sin geometría: '+row.id);
  if(object&&row.id==='pizarra-2')componerPizarraVertical(object);
  const e={...row,object,visible:true,ficha:fichaDe(row)};
  if(!e.medidas&&object){const size=new T.Box3().setFromObject(object).getSize(new T.Vector3());e.medidas={ancho:+size.x.toFixed(4),fondo:+size.z.toFixed(4),alto:+size.y.toFixed(4),unidad:'m'};e.medidasFuente='envolvente-glb';}
  if(!e.medidas)e.medidas={ancho:'pendiente',fondo:'pendiente',alto:'pendiente',unidad:'m'};
  if(object)object.userData.item={id:e.id};return e;
 });
 const capsulas=capsulasModule&&!signal?.aborted?capsulasModule.mountCapsulas({scene:gltf.scene,entries,signal}):null;
 return {manifest,entries,capsulas};
}
// La pizarra de bollería pasa a vertical sin girar la textura horizontal: el marco
// cambia de proporción y el menú se vuelve a componer, con todas las líneas.
function componerPizarraVertical(object){
 object.updateMatrixWorld(true);
 const box=new T.Box3().setFromObject(object),size=box.getSize(new T.Vector3());
 if(size.x>size.y&&size.y>0){object.scale.x*=size.y/size.x;object.scale.y*=size.x/size.y;object.updateMatrixWorld(true);}
 const canvas=document.createElement('canvas');canvas.width=720;canvas.height=1280;
 const g=canvas.getContext('2d');
 g.fillStyle='#1c2a24';g.fillRect(0,0,720,1280);
 g.fillStyle='#d6b15a';g.font='bold 88px Georgia, serif';g.fillText('Horno',56,150);
 g.fillRect(56,180,608,6);
 const lineas=[['Croissant','1,90'],['Napolitana','2,20'],['Cookie','2,10'],['Banana bread','2,80'],['Tostada','3,50']];
 lineas.forEach(([nombre,precio],i)=>{
  const y=340+i*170;
  g.fillStyle=i%2?'#1c2a24':'#24332c';g.fillRect(0,y-70,720,150);
  g.font='46px Georgia, serif';g.fillStyle='#f3efe2';g.textAlign='left';g.fillText(nombre,56,y);
  g.fillStyle='#d6b15a';g.textAlign='right';g.fillText(precio,664,y);
 });
 const tex=new T.CanvasTexture(canvas);tex.flipY=false;if('colorSpace' in tex && T.SRGBColorSpace)tex.colorSpace=T.SRGBColorSpace;
 tex.needsUpdate=true;
 object.traverse(node=>{for(const material of [node.material].flat())if(material?.name==='PANTALLA_pizarra-2'){material.map=tex;material.emissiveMap=tex;material.needsUpdate=true;}});
}
const labels={Iluminacion:'Iluminación',Vegetacion:'Vegetación'};
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const eye='<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><path d="M12 5C6.5 5 2.7 9.4 1.5 12c1.2 2.6 5 7 10.5 7s9.3-4.4 10.5-7C21.3 9.4 17.5 5 12 5zm0 11.5A4.5 4.5 0 1 1 12 7.5a4.5 4.5 0 0 1 0 9zm0-2.3a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4z" fill="currentColor"/></svg>';
// Ficha: checkbox (visibilidad) · botón de selección · botón «Ver» en 3D (hermanos: pulsar «Ver» nunca cambia el checkbox).
const icono=e=>e.sinGeometria?'<span class="xpace-ci-icon" aria-hidden="true">▣</span> ':'';
export function rowMarkup(e,en=false){return `<input type="checkbox" aria-label="${en?'Show':'Mostrar'} ${escape(e.nombre)}"><button type="button" class="xpace-item" aria-pressed="false"><strong>${icono(e)}${escape(e.nombre)}</strong><small>${escape(e.id)} · ${escape(labels[e.categoria]||e.categoria)} · ×${e.cantidad}</small><small>${e.medidas.ancho} × ${e.medidas.fondo} × ${e.medidas.alto} m${e.pantalla?' · '+escape(e.pantalla):''}</small></button><button type="button" class="xpace-ver" data-ver="${escape(e.id)}" aria-label="${en?'View':'Ver'} ${escape(e.nombre)} ${en?'in 3D':'en 3D'}" title="${en?'View in 3D viewer':'Ver en el visor 3D'}">${eye}<span>${en?'View':'Ver'}</span></button>`;}
function fichaMarkup(e,en=false){
 const f=e.ficha||fichaDe(e), boton=accion(f);
 const luz=(nombre,tono)=>`<p class="xpace-ci-luz ${tono}"><span>${nombre}</span><b>${tono==='verde'?'En regla':tono==='rojo'?'Atención':'Pendiente'}</b></p>`;
 return `<header><button type="button" data-ci-back>← ${en?'Inventory':'Inventario'}</button><h3>${escape(f.nombre)}</h3><button type="button" data-ci-close aria-label="Cerrar ficha">×</button></header><p class="xpace-ci-id">${escape(f.id)}</p><div class="xpace-ci-luces">${luz('Estado',semaforoEstado(f.estado))}${luz('Garantía',semaforoGarantia(f))}</div><dl><dt>Categoría</dt><dd>${escape(f.categoria)}</dd><dt>Fabricante</dt><dd>${escape(f.fabricante)}</dd><dt>Modelo</dt><dd>${escape(f.modelo)}</dd><dt>Nº de serie</dt><dd>${escape(f.serie)}</dd><dt>Ubicación</dt><dd>${escape(f.ubicacion)}</dd><dt>Responsable</dt><dd>${escape(f.responsable)}</dd>${f.red?`<dt>Red</dt><dd>IP ${escape(f.red.ip)} · MAC ${escape(f.red.mac)} · firmware ${escape(f.red.firmware)}</dd>`:''}</dl><a class="xpace-ci-accion" href="${escape(boton.href)}" target="_blank" rel="noopener">${escape(boton.etiqueta)}</a>${boton.provisional?'<p class="xpace-ci-nota">Enlace provisional.</p>':''}<a class="xpace-ci-qr" href="${escape(urlUnidad(f.unidad))}">Ficha y QR</a>`;
}
export function mountInventory(host,item,{manifest,entries,capsulas},viewer,on,signal){
 const en=document.documentElement.lang==='en',hidden=readHidden(location.href,item.id);let selected=null,outline,viewed,flash=null;// viewed: undefined = no tocar &ver del enlace; null = quitarlo
 const panel=document.createElement('section');panel.className='xpace-inventory';panel.setAttribute('aria-label',en?'Inventory':'Inventario');
 const sinModelo=entries.filter(e=>e.sinGeometria).length,delModelo=entries.filter(e=>!e.sinGeometria&&e.origen!=='json-medidas').length;
 panel.innerHTML=`<header><h3>${en?'Inventory':'Inventario'}</h3><span class="xpace-count" aria-live="polite"></span></header><p>${manifest.measuredCount} ${en?'items from measurement JSON':'elementos del JSON de medidas'} · ${delModelo} ${en?'additional model objects':'objetos adicionales del modelo'} · ${sinModelo} ${en?'without a 3D model':'sin modelo 3D'}. ${en?'Dimensions: width × depth × height (m). One unit per ID.':'Medidas: ancho × fondo × alto (m). Una unidad por ID.'}</p><div class="xpace-inventory-actions"><button data-all="yes">${en?'All':'Todo'}</button><button data-all="no">${en?'None':'Nada'}</button><button data-export="json">↓ JSON</button><button data-export="csv">↓ CSV</button><button data-save>${en?'Save JSON + CSV to Stock':'Guardar JSON + CSV en Stock'}</button><button data-share>${en?'Copy view link':'Copiar enlace de la vista'}</button></div><p class="xpace-inventory-message" role="status"></p><div class="xpace-inventory-list"></div>`;
 const dock=host.querySelector('.xpace-rail-right .xpace-rail-body')||host;dock.append(panel);const ficha=document.createElement('aside');ficha.className='xpace-ci';ficha.hidden=true;ficha.setAttribute('aria-label','Ficha del elemento');panel.append(ficha);const list=panel.querySelector('.xpace-inventory-list'),message=panel.querySelector('[role=status]'),groups=new Map();
 const bloques=[
  {titulo:en?'Measurement inventory':'Inventario de medidas',filtro:e=>e.origen==='json-medidas',abierto:true},
  {titulo:en?'Additional model objects · GLB dimensions':'Objetos adicionales · medidas del GLB',filtro:e=>!e.sinGeometria&&e.origen!=='json-medidas',abierto:false},
  {titulo:en?'No 3D model':'Sin modelo 3D',filtro:e=>!!e.sinGeometria,abierto:true},
 ];
 for(const bloque of bloques){
  const section=document.createElement('details');section.open=bloque.abierto;section.innerHTML=`<summary>${bloque.titulo}</summary>`;list.append(section);
  for(const category of [...new Set(entries.filter(bloque.filtro).map(e=>e.categoria))]){
   const rows=entries.filter(e=>e.categoria===category&&bloque.filtro(e)),group=document.createElement('div');group.className='xpace-inventory-group';
   group.innerHTML=`<label class="xpace-category"><input type="checkbox" data-category="${escape(category)}"> ${escape(labels[category]||category)} <small>(${rows.length})</small></label>`;section.append(group);
   groups.set(group.querySelector('input'),rows);
   for(const e of rows){const row=document.createElement('div');row.className='xpace-inventory-row';row.dataset.id=e.id;row.innerHTML=rowMarkup(e,en);group.append(row);e.row=row;e.checkbox=row.querySelector('input');e.button=row.querySelector('.xpace-item');e.ver=row.querySelector('.xpace-ver');on(e.checkbox,'change',()=>{e.visible=e.checkbox.checked;apply();});on(e.button,'click',()=>focus(e));on(e.ver,'click',event=>{event.preventDefault();event.stopPropagation();view(e);});}
  }
 }
 function writeURL(){history.replaceState(history.state,'',selectionURL(location.href,item.id,entries,viewed));}
 function openFicha(e){const rail=panel.closest('.xpace-rail-right');if(!e){ficha.hidden=true;ficha.innerHTML='';rail?.classList.remove('is-ficha');return;}host.xpaceChrome?.open('right');rail?.classList.add('is-ficha');ficha.hidden=false;ficha.innerHTML=fichaMarkup(e,en);const close=ficha.querySelector('[data-ci-close]'),back=ficha.querySelector('[data-ci-back]');if(close)on(close,'click',()=>openFicha(null));if(back)on(back,'click',()=>openFicha(null));}
 function apply(){for(const e of entries){if(e.object)e.object.visible=e.visible;e.checkbox.checked=e.visible;}for(const [checkbox,rows] of groups){const count=rows.filter(e=>e.visible).length;checkbox.checked=count===rows.length;checkbox.indeterminate=count>0&&count<rows.length;}const countLabel=`${entries.filter(e=>e.visible).length}/${entries.length} ${en?'visible':'visibles'}`;for(const el of host.querySelectorAll('.xpace-count'))el.textContent=countLabel;if(selected&&!selected.visible)focus(null);viewer.invalidateShadows();writeURL();}
 function clearOutline(){if(outline){outline.removeFromParent();outline.geometry.dispose();outline.material.dispose();outline=null;}}
 function focus(e,scroll=false){clearOutline();selected=e;openFicha(e);if(viewed&&e?.id!==viewed){viewed=null;writeURL();}for(const row of entries)row.button.setAttribute('aria-pressed',String(e===row));if(e?.visible&&e.object){outline=new T.BoxHelper(e.object,0xffd766);outline.material.depthTest=false;outline.renderOrder=1000;let scene=e.object;while(scene.parent)scene=scene.parent;scene.add(outline);}if(scroll&&e){for(let p=e.row.parentElement;p&&p!==panel;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;e.row.scrollIntoView({block:'nearest',behavior:'smooth'});}}
 function stopFlash(){if(flash){cancelAnimationFrame(flash.frame);flash.mesh.removeFromParent();flash.mesh.geometry.dispose();flash.mesh.material.dispose();flash=null;}}
 // Resalte temporal (~2,4 s): caja amarilla translúcida que parpadea + contorno de selección que parpadea a la vez.
 function pulse(e){stopFlash();let scene=e.object;while(scene.parent)scene=scene.parent;scene.updateMatrixWorld(true);const box=new T.Box3().setFromObject(e.object);if(box.isEmpty())return;const size=box.getSize(new T.Vector3()).addScalar(.02),mesh=new T.Mesh(new T.BoxGeometry(size.x,size.y,size.z),new T.MeshBasicMaterial({color:0xffe14d,transparent:true,opacity:0,depthTest:false,depthWrite:false}));mesh.position.copy(box.getCenter(new T.Vector3()));mesh.renderOrder=999;scene.add(mesh);const start=performance.now(),state={mesh,frame:0,id:e.id};flash=state;const step=now=>{if(flash!==state)return;const t=(now-start)/2400;if(t>=1){if(outline)outline.visible=true;stopFlash();return;}const wave=.5-.5*Math.cos(t*Math.PI*6);mesh.material.opacity=.55*wave*(1-t*.4);if(outline)outline.visible=wave>.25;state.frame=requestAnimationFrame(step);};state.frame=requestAnimationFrame(step);}
 function view(e,{scroll=true}={}){if(!e)return;if(!e.visible){e.visible=true;apply();}focus(e);viewed=e.id;writeURL();if(!e.object)return;if(scroll)host.querySelector('.xpace-stage')?.scrollIntoView({block:'nearest',behavior:'smooth'});
  // Estantería de libros: zoom frontal y modo detalle con libros seleccionables (capsulas.mjs).
  if(capsulas&&e.id===capsulas.shelfId&&capsulas.enterDetail()){pulse(e);return;}
  const fromDetail=capsulas?.exitDetail({reset:false});viewer.frameObject?.(e.object,fromDetail?{angle:Math.PI/4}:{});pulse(e);}
 for(const [checkbox,rows] of groups)on(checkbox,'change',()=>{rows.forEach(e=>e.visible=checkbox.checked);apply();});
 for(const b of panel.querySelectorAll('[data-all]'))on(b,'click',()=>{entries.forEach(e=>e.visible=b.dataset.all==='yes');apply();});
 function documentData(){return {schema:'admira.xpacio.itil-inventory/1',xpace:item.id,nombre:item.title,source:manifest.source||item.url,unidades:'m',vista:selectionURL('https://www.pixeria.com/stock',item.id,entries,viewed).href,items:exportRows(entries)};}
 function content(ext,data){return ext==='json'?JSON.stringify(data,null,2)+'\n':toCSV(data.items);}
 for(const b of panel.querySelectorAll('[data-export]'))on(b,'click',()=>{const ext=b.dataset.export,url=URL.createObjectURL(new Blob([content(ext,documentData())],{type:ext==='json'?'application/json':'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=`${manifest.slug}-inventario.${ext}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
 on(panel.querySelector('[data-share]'),'click',async()=>{writeURL();try{await navigator.clipboard.writeText(location.href);message.textContent=en?'View link copied.':'Enlace de la vista copiado.';}catch{message.textContent=location.href;}});
 const saved=new Map();
 on(panel.querySelector('[data-save]'),'click',async event=>{const button=event.currentTarget;button.disabled=true;const data=documentData();message.textContent=en?'Saving…':'Guardando…';try{const results=[];for(const ext of ['json','csv']){message.textContent=(en?'Saving ':'Guardando ')+ext.toUpperCase()+(en?' to Stock…':' en Stock…');const text=content(ext,data),key=ext+text;if(saved.has(key)){results.push(saved.get(key));continue;}const bytes=new TextEncoder().encode(text);let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);const response=await fetch('https://api.admira.store/stock/publish',{method:'POST',headers:{'Content-Type':'application/json'},signal,body:JSON.stringify({type:'digital-twin',mime:ext==='json'?'application/json':'text/csv',base64:btoa(binary),title:`Inventario ITIL ${manifest.slug} · ${data.items.length} elementos · ${ext.toUpperCase()}`,motor:'Pixeria Xpaces · TrinityMacMini',tags:['3d','inventario',manifest.slug],externalRef:`xpace-inventory:${item.id}`,comment:`${data.items.length} elementos seleccionados. Medidas en metros. Fabricante, modelo y garantía vacíos cuando no constan.`})});const result=await response.json();if(!response.ok)throw Error(result.error||'HTTP '+response.status);if(result.ok===false||!result.id)throw Error(result.error||'Stock no ha confirmado el archivo');saved.set(key,result.id);results.push(result.id);}message.replaceChildren(document.createTextNode(en?'Saved to Stock: ':'Guardados en Stock: '));results.forEach((id,i)=>{const a=document.createElement('a');a.href=`/stock?highlight=${encodeURIComponent(id)}`;a.textContent=i?' CSV':'JSON';a.target='_blank';a.rel='noopener';message.append(a);});}catch(error){message.textContent=(en?'Could not finish saving. Retry: ':'No se ha completado el guardado. Reintenta: ')+error.message;}finally{button.disabled=false;}});
 const restore=()=>{const ids=readHidden(location.href,item.id);for(const e of entries)e.visible=!ids.has(e.id);apply();};
 on(window,'popstate',restore);for(const e of entries)e.visible=!hidden.has(e.id);apply();
 const ready=mountReplacements({item,bound:{manifest,entries},viewer,on,signal,host:panel,refresh:()=>{if(selected)focus(selected);}}).catch(e=>{if(!signal?.aborted)message.textContent='No se pudieron cargar las variantes: '+e.message;});
 const openFromURL=()=>{const id=readView(location.href),e=id&&entries.find(x=>x.id===id);if(e)view(e);else if(id){viewed=null;writeURL();}};
 const dispose=()=>{stopFlash();clearOutline();if(viewed){try{const u=new URL(location.href);u.searchParams.delete('ver');history.replaceState(history.state,'',u);}catch{}}};
 function showToken(token,visible){const t=String(token||'').trim().toLowerCase();const byId=entries.filter(e=>e.id.toLowerCase()===t);const byCat=entries.filter(e=>String(e.categoria).toLowerCase()===t||String(labels[e.categoria]||e.categoria).toLowerCase()===t);const hits=byId.length?byId:byCat;if(!hits.length)return 0;for(const e of hits)e.visible=visible;apply();return hits.length;}
 return {ready,select:id=>{if(capsulas?.state.detail)return;focus(entries.find(e=>e.id===id)||null,true);},view:id=>view(entries.find(e=>e.id===id)||null),showToken,openFromURL,dispose,state:()=>({selected:selected?.id||null,viewed:viewed||null,flashing:flash?.id||null,items:entries.map(e=>{const box=e.object?new T.Box3().setFromObject(e.object):null;return {id:e.id,visible:e.visible,objectVisible:!!e.object?.visible,bounds:box?box.min.toArray().concat(box.max.toArray()):null,variant:e.variant||null,core:e.origen==='json-medidas'};})}),export:documentData};
}
