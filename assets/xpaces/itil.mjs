// Capa ITIL del visor de Xpaces (Cafebrería · Alsea). Solo presenta: no toca el
// inventario, el GLB ni la cámara. El visor de Pixeria tiene un único motor 3D
// (Better); los botones 8/16/32/64 de la barra eligen aquí el ARTE de los
// elementos ITIL, con la misma progresión que XpaceOS: pixel-art 8 bits, sprite
// 16 bits, ilustración 32 bits y render hiperrealista con código verde 64 bits.
// Semáforo: SOLO DEMOSTRACIÓN. Los estados son simulados y se rotulan «DEMO».
// Apagar: ?itil=0 en la URL (se recuerda), comando experto «itil off» o el botón de Avanzado.
import * as T from './engine/premium-three.mjs';
import {loadItilManifest,createItilGlyph,itilKind,ITIL_STATUS_COLOR,ITIL_STATUS_LABEL,ITIL_TIER_LABEL} from './itil-glyphs.mjs?v=itil-2';

export const ITIL_KEY='xpace_itil';
// Solo el Xpacio de la Cafebrería (GLB vigentes con inventario). Otros Xpacios no cambian.
export const ITIL_ASSETS=new Set(['1790375438696-1ladz7','1790370079244-cv7t5i']);
const NIVEL_TIER={'8':'good','16':'better','32':'best','64':'matrix'};
// Estados de DEMOSTRACIÓN por id. Todo lo demás, «Operativo (demo)». No son datos reales.
export const DEMO_STATUS={S2:'warn',A1:'down','pantalla-recogida':'warn','camara-1':'ok'};
/** Estado DEMO: el fijado en DEMO_STATUS; si no, «Operativo (demo)»; si el elemento aún no tiene
 *  dibujo propio (pendiente), «Sin dato». Nunca es un dato real. */
export function demoStatus(id,pendiente=false){return DEMO_STATUS[id]||(pendiente?'unknown':'ok');}
// ─── Fuente ÚNICA de verdad: qué es un elemento ITIL (CI) en el inventario del Xpacio ───
// Cuenta como elemento ITIL todo equipo de TECNOLOGÍA / INFRAESTRUCTURA TI del inventario:
//   · categoría «IoT» (altavoces, aroma, wifi, gateway, router, switch, cámara, alarma, datáfono, impresora, amplificador…)
//   · categoría «Pantallas» (pizarras y pantalla de recogida)
//   · y de «Equipamiento» solo lo que es TI: TPV (pos) y SAI (ups).
// No cuentan mobiliario, iluminación, vegetación, arquitectura ni maquinaria de cocina/clima.
// Los 4 niveles (8/16/32/64) dibujan EXACTAMENTE este conjunto; lo que no tiene dibujo propio
// sale con el icono genérico «pendiente». El total no depende del nivel.
export const ITIL_CI_CATEGORIAS=new Set(['IoT','Pantallas']);
export const ITIL_CI_TIPOS_EQUIPAMIENTO=new Set(['pos','ups']);
export const ITIL_CI_CRITERIO='Equipos de tecnología/infraestructura TI del inventario: categorías IoT y Pantallas, más TPV y SAI de Equipamiento.';
export const ITIL_CI_CRITERIO_EN='IT technology/infrastructure items in the inventory: IoT and Screens categories, plus POS and UPS from Equipment.';
export function isItilCI(e){
  if(!e)return false;
  if(ITIL_CI_CATEGORIAS.has(e.categoria))return true;
  return e.categoria==='Equipamiento'&&ITIL_CI_TIPOS_EQUIPAMIENTO.has(e.tipo);
}
/** Catálogo ITIL del Xpacio: un registro por elemento del inventario que es CI. */
export function itilCatalog(items){
  return (items||[]).filter(isItilCI).map(e=>{
    const own=itilKind({type:e.tipo});
    const pendiente=!own;
    return {e,kind:own||'generico',pendiente,status:demoStatus(e.id,pendiente),en3d:!e.sinGeometria&&e.object!==null};
  });
}
/** Recuento para el panel Avanzado. Sale del catálogo (inventario), nunca de lo dibujado por nivel. */
export function itilCount(items){
  const cat=itilCatalog(items);
  const c={total:cat.length,ok:0,warn:0,down:0,unknown:0,pendiente:0,conDibujo:0,sinPosicion:0};
  for(const x of cat){c[x.status]++;if(x.pendiente)c.pendiente++;else c.conDibujo++;if(x.e.sinGeometria)c.sinPosicion++;}
  return c;
}
const ZOOM={good:.8,better:.58,best:.5,matrix:.46};
const STEM={good:14,better:18,best:22,matrix:26};
const GAP={good:6,better:6,best:8,matrix:14};

/** Decide si la capa arranca encendida: por defecto sí en la Cafebrería; ?itil=0|1 manda y se recuerda. */
export function itilEnabled(assetId,url,storage){
  if(!ITIL_ASSETS.has(assetId))return false;
  let q=null;try{q=new URL(url).searchParams.get('itil');}catch{}
  if(q!==null){const on=!['0','off','no'].includes(q.toLowerCase());try{storage?.setItem?.(ITIL_KEY,on?'1':'0');}catch{}return on;}
  try{if(storage?.getItem?.(ITIL_KEY)==='0')return false;}catch{}
  return true;
}
/** Elementos que la capa dibuja: los del inventario con clase ITIL. Con y sin modelo 3D. */
export function itilEntries(entries){return itilCatalog(entries);}

function ensureCss(){
  if(document.querySelector('link[data-itil-css]'))return;
  const link=document.createElement('link');link.rel='stylesheet';link.href=new URL('./itil.css?v=itil-2',import.meta.url).href;link.dataset.itilCss='';document.head.append(link);
}
export function mountItil({host,stage,entries,viewer,inventory,assetId,on,signal,en=false,storage}){
  ensureCss();
  const store=storage||(()=>{try{return localStorage;}catch{return null;}})();
  let enabled=itilEnabled(assetId,location.href,store),manifest=null,tier=currentTier(),pins=[],tray=null,frame=0,lastDeclutter=0,disposed=false;
  const layer=document.createElement('div');layer.className='itil-layer';layer.setAttribute('aria-label','Capa ITIL');
  const banner=document.createElement('p');banner.className='itil-demo-banner';banner.setAttribute('role','note');
  stage.append(layer,banner);
  const items=itilCatalog(entries);const count=itilCount(entries);
  function currentTier(){const b=host.querySelector('[data-nivel][aria-pressed="true"]');return NIVEL_TIER[b?.dataset.nivel]||'better';}
  function paintBanner(){
    banner.hidden=!enabled;
    banner.innerHTML=`SEMÁFORO ITIL · DEMO<small>${en?'Simulated statuses, not real data':'Estados simulados, no son datos reales'} · ${ITIL_TIER_LABEL[tier]}</small>`;
  }
  const note=host.querySelector('.xpace-nivel-nota');const noteOriginal=()=>note?.dataset.itilOriginal;
  function paintNote(){
    if(!note)return;
    if(enabled&&tier!=='better'){if(!note.dataset.itilOriginal)note.dataset.itilOriginal=note.textContent;note.textContent=`${ITIL_TIER_LABEL[tier]} · ${en?'ITIL layer · 3D soon':'capa ITIL · 3D próximamente'}`;}
    else if(noteOriginal()!==undefined){note.textContent=note.dataset.itilOriginal;delete note.dataset.itilOriginal;}
  }
  function clear(){for(const p of pins)p.dispose();pins=[];tray?.remove();tray=null;}
  function build(){
    clear();if(!enabled||!manifest)return;
    const loose=[];
    for(const {e,kind,pendiente,status} of items){
      const opts={status,label:e.id+(pendiente?(en?' · pending':' · pendiente'):''),demo:true,zoom:e.object?ZOOM[tier]:ZOOM[tier]*.55};
      // Nunca desaparece un elemento: si falta su arte en este nivel, icono genérico «pendiente».
      const g=createItilGlyph(manifest,kind,tier,opts)||createItilGlyph(manifest,'generico',tier,{...opts,label:e.id+(en?' · pending':' · pendiente')});if(!g)continue;
      g.el.dataset.itilId=e.id;if(pendiente)g.el.dataset.pendiente='';
      g.el.title=`${e.id} · ${e.nombre} · ${ITIL_STATUS_LABEL[status]} (DEMO, ${en?'not real':'no es dato real'})${pendiente?(en?' · generic icon, own drawing pending':' · icono genérico, dibujo propio pendiente'):''}`;
      g.el.addEventListener('click',()=>inventory?.select?.(e.id));
      if(!e.object){loose.push({e,g});continue;}
      const pin=document.createElement('div');pin.className=`itil-pin tier-${tier}`;pin.dataset.itilId=e.id;
      pin.style.setProperty('--itil-c',ITIL_STATUS_COLOR[status]);pin.style.setProperty('--stem',STEM[tier]+'px');
      const stem=document.createElement('i');stem.className='itil-stem';const halo=document.createElement('i');halo.className='itil-halo';
      pin.append(g.el,stem,halo);layer.append(pin);
      pins.push({e,pin,g,anchor:null,dispose(){g.dispose();pin.remove();}});
    }
    if(loose.length){
      tray=document.createElement('div');tray.className='itil-tray';
      tray.innerHTML=`<span>${en?'No 3D position':'Sin posición en el 3D'}</span>`;
      for(const {g} of loose)tray.append(g.el);
      stage.append(tray);pins.push({dispose(){},loose:true});
    }
    lastDeclutter=0;
  }
  function anchorOf(p){
    if(!p.anchor){const box=new T.Box3().setFromObject(p.e.object);if(box.isEmpty())return null;const c=box.getCenter(new T.Vector3());p.anchor=new T.Vector3(c.x,box.max.y,c.z);}
    return p.anchor;
  }
  function tick(now){
    if(disposed)return;frame=requestAnimationFrame(tick);
    if(!enabled||!pins.length||document.hidden)return;
    const S=stage.getBoundingClientRect();
    for(const p of pins){
      if(p.loose)continue;
      const a=p.e.visible!==false&&p.e.object?.visible!==false?anchorOf(p):null;
      if(!a){p.pin.hidden=true;continue;}
      const q=viewer.project(a),x=q.x-S.left,y=q.y-S.top;
      const inside=x>-40&&x<S.width+40&&y>-40&&y<S.height+60;
      p.pin.hidden=!inside;if(!inside)continue;
      p.pin.style.left=Math.round(x)+'px';p.pin.style.top=Math.round(y)+'px';p.pin.style.zIndex=String(Math.round(y));
    }
    if(now-lastDeclutter>250){lastDeclutter=now;declutter(S);}
  }
  function declutter(L){
    const list=pins.filter(p=>!p.loose&&!p.pin.hidden);
    for(const p of list){p.pin.style.setProperty('--stem',STEM[tier]+'px');p.pin.firstElementChild.style.translate='';p.pin.classList.remove('flip');}
    for(const p of list){const r=p.pin.firstElementChild.getBoundingClientRect();if(r.top<L.top+2)p.pin.classList.add('flip');}
    const boxes=list.map(p=>({p,r:p.pin.firstElementChild.getBoundingClientRect(),y:parseFloat(p.pin.style.top)||0})).sort((a,b)=>b.y-a.y);
    const placed=[];const bn=banner&&!banner.hidden&&banner.getBoundingClientRect();if(bn&&bn.width)placed.push({left:bn.left,right:bn.right,top:bn.top,bottom:bn.bottom});const gap=GAP[tier]||6;const hitOf=r=>placed.find(q=>r.left<q.right+gap-2&&r.right>q.left-gap+2&&r.top<q.bottom+2&&r.bottom>q.top-2);
    for(const b of boxes){
      let r={left:b.r.left,right:b.r.right,top:b.r.top,bottom:b.r.bottom},extra=0,dx=0;
      if(r.left<L.left+4)dx=L.left+4-r.left;else if(r.right>L.right-4)dx=L.right-4-r.right;
      r={...r,left:r.left+dx,right:r.right+dx};
      for(let guard=0;guard<8;guard++){
        const hit=hitOf(r);if(!hit)break;const d=r.bottom-hit.top+4;
        if(b.p.pin.classList.contains('flip')||r.top-d<L.top+4||extra+d>140){const side=(r.left+r.right)/2>=(hit.left+hit.right)/2?hit.right-r.left+gap:hit.left-r.right-gap;dx+=side;r={...r,left:r.left+side,right:r.right+side};continue;}
        extra+=d;r={...r,top:r.top-d,bottom:r.bottom-d};
      }
      // Nunca debajo del rótulo DEMO: si aún lo pisa, se aparta a su izquierda.
      if(bn&&bn.width&&r.left<bn.right&&r.right>bn.left&&r.top<bn.bottom&&r.bottom>bn.top){const k=bn.left-gap-r.right;dx+=k;r={...r,left:r.left+k,right:r.right+k};}
      if(r.right>L.right-4){const k=L.right-4-r.right;dx+=k;r={...r,left:r.left+k,right:r.right+k};}
      if(r.left<L.left+4){const k=L.left+4-r.left;dx+=k;r={...r,left:r.left+k,right:r.right+k};}
      if(extra)b.p.pin.style.setProperty('--stem',(STEM[tier]+extra)+'px');
      if(dx)b.p.pin.firstElementChild.style.translate=Math.round(dx)+'px 0';
      placed.push(r);
    }
  }
  // Botón en Avanzado
  const panel=document.createElement('div');panel.className='itil-panel';
  const inventorySlug=(typeof inventory?.slug==='string'&&inventory.slug)||'alsea-4380';
  const esc=v=>String(v).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const ITIL_STATUS_LABEL_EN_ES=s=>en?{ok:'Operational',warn:'Warning',down:'Down',unknown:'No data'}[s]:ITIL_STATUS_LABEL[s];
  const rail=host.querySelector('.xpace-rail-right .xpace-rail-body');
  function paintPanel(){
    panel.innerHTML=`<p class="xpace-rail-title">${en?'ITIL layer':'Capa ITIL'} · DEMO</p><button type="button" data-itil-toggle aria-pressed="${enabled}">${enabled?(en?'Hide ITIL layer':'Ocultar capa ITIL'):(en?'Show ITIL layer':'Mostrar capa ITIL')}</button><div class="itil-count" data-itil-total="${count.total}"><b>${count.total}</b> ${en?'ITIL items in this space':'elementos ITIL en el espacio'}<span class="itil-count-src">${en?'Inventory':'Inventario'} ${esc(inventorySlug)} · ${en?'same total at 8/16/32/64 bits':'mismo total en 8/16/32/64 bits'}</span></div><ul class="itil-count-sem" aria-label="${en?'By status (DEMO)':'Por estado (DEMO)'}">${['ok','warn','down','unknown'].map(s=>`<li data-s="${s}"><i style="background:${ITIL_STATUS_COLOR[s]}"></i>${ITIL_STATUS_LABEL_EN_ES(s)}<b>${count[s]}</b></li>`).join('')}</ul><small class="itil-count-demo">${en?'Statuses: DEMO (simulated, not real data).':'Estados: DEMO (simulados, no son datos reales).'}</small><small class="itil-count-det">${en?`${count.total-count.sinPosicion} in 3D · ${count.sinPosicion} without 3D position · ${count.pendiente} with generic «pending» icon`:`${count.total-count.sinPosicion} en el 3D · ${count.sinPosicion} sin posición 3D · ${count.pendiente} con icono genérico «pendiente»`}</small><details class="itil-count-crit"><summary>${en?'What counts as ITIL?':'¿Qué cuenta como ITIL?'}</summary>${en?ITIL_CI_CRITERIO_EN:ITIL_CI_CRITERIO}</details>`;
    panel.querySelector('[data-itil-toggle]').addEventListener('click',()=>set(!enabled));
  }
  if(rail){rail.prepend(panel);paintPanel();}
  function set(next){
    enabled=!!next;try{store?.setItem?.(ITIL_KEY,enabled?'1':'0');}catch{}
    layer.hidden=!enabled;paintBanner();paintNote();paintPanel();build();
    return enabled;
  }
  const levelObserver=new MutationObserver(()=>{const next=currentTier();if(next!==tier){tier=next;paintBanner();paintNote();build();}});
  for(const b of host.querySelectorAll('[data-nivel]'))levelObserver.observe(b,{attributes:true,attributeFilter:['aria-pressed']});
  layer.hidden=!enabled;paintBanner();paintNote();
  const ready=loadItilManifest().then(m=>{if(disposed)return;manifest=m;build();}).catch(error=>{banner.hidden=true;console.warn('[itil]',error);});
  frame=requestAnimationFrame(tick);
  function dispose(){if(disposed)return;disposed=true;cancelAnimationFrame(frame);levelObserver.disconnect();clear();layer.remove();banner.remove();panel.remove();if(noteOriginal()!==undefined){note.textContent=note.dataset.itilOriginal;delete note.dataset.itilOriginal;}}
  signal?.addEventListener('abort',dispose,{once:true});
  return {
    ready,dispose,set,
    get enabled(){return enabled;},
    command(arg){
      const a=String(arg||'').trim().toLowerCase();
      if(['on','si','sí','1'].includes(a))set(true);else if(['off','no','0'].includes(a))set(false);else if(!a)set(!enabled);
      else if(!['estado','status'].includes(a))return 'itil on|off|estado';
      const n=pins.filter(p=>!p.loose).length+(tray?tray.querySelectorAll('.itil-glyph').length:0);
      return enabled?`capa ITIL activa · ${ITIL_TIER_LABEL[tier]} · ${count.total} elementos ITIL (dibujados ${n}) · semáforo DEMO (estados simulados)`:'capa ITIL apagada';
    },
    state:()=>({enabled,tier,count:{...count},drawn:layer.querySelectorAll('.itil-glyph').length+(tray?tray.querySelectorAll('.itil-glyph').length:0),pins:pins.filter(p=>!p.loose).map(p=>({id:p.e.id,hidden:p.pin.hidden,status:p.g.el.dataset.status})),tray:tray?[...tray.querySelectorAll('.itil-glyph')].map(g=>g.querySelector('.itil-name')?.textContent):[]}),
  };
}
