import {referenceSize,generateBackground} from './ia-core.mjs';
import {formatContract} from './aplicaciones-core.mjs';
export function mountStudio(h) {
  const t=h.t,root=document.createElement('section');root.className='studio-adaptaciones';root.id='studio-adaptaciones';
  root.innerHTML=`<h3>${t('Adaptación IA · aplicar en Estancos','AI adaptation · apply in Shops')}</h3>
  <div class="studio-controls"><label>${t('Formato','Format')}<select id="studio-formato"></select></label><label>${t('Estanco','Shop')}<select id="studio-estanco"></select></label></div>
  <label class="studio-brief">${t('Ambiente para el fondo IA','AI background atmosphere')}<input id="studio-brief" maxlength="1200" placeholder="${t('Ej. luz cálida, madera y tonos verdes','E.g. warm light, wood and green tones')}"></label>
  <div class="studio-actions"><button id="studio-ia" type="button" class="pill accent">✦ ${t('Generar fondo IA','Generate AI background')}</button><button id="studio-cancel" type="button" class="pill" hidden>${t('Cancelar','Cancel')}</button><button id="studio-original" type="button" class="pill" hidden>${t('Quitar fondo IA','Remove AI background')}</button><button id="studio-aplicar" type="button" class="pill">▣ ${t('Aplicar demo al estanco','Apply shop demo')}</button><button id="studio-retirar" type="button" class="pill" hidden>${t('Retirar demo','Remove demo')}</button><button id="studio-guardar" type="button" class="pill">↓ ${t('Guardar formatos y aplicaciones','Save formats and placements')}</button><a id="studio-download" class="pill" hidden download="studio-fondo-ia.png">↓ ${t('Guardar fondo IA','Save AI background')}</a></div>
  <p class="muted">${t('La IA genera un fondo estático. El original completo se conserva delante (sin zoom); los cortes del videowall salen de una pared continua. La generación usa el motor de imagen con tu sesión.','AI generates a static background. The entire original stays in front (no zoom); video wall cuts come from one continuous wall. Generation uses the image engine with your session.')}</p>
  <p id="studio-status" role="status" aria-live="polite"></p>
  <figure class="studio-shop"><figcaption id="studio-shop-name"></figcaption><div class="studio-shop-room"><div class="studio-shop-sign">ESTANC</div><div class="studio-shop-wall"><canvas id="studio-preview"></canvas></div><div class="studio-shop-counter"></div></div><figcaption id="studio-size"></figcaption></figure>`;
  document.querySelector('#grid').before(root);
  const $=s=>root.querySelector(s),sel=$('#studio-formato'),shop=$('#studio-estanco'),status=$('#studio-status');
  let signature='',ctl=null,turn=0,docURL=null,appliedName='';
  const format=()=>h.formats().find(f=>f.id===sel.value),backgrounds=new Map();
  const release=()=>{turn++;ctl?.abort();ctl=null;backgrounds.clear();sync();};
  const redraw=()=>{
    const f=format();if(!f||root.hidden||document.querySelector('#paso-2').hidden)return;
    const d=h.destino(f),cv=$('#studio-preview');const k=Math.min(1,1600/d.ancho,600/d.alto);
    const w=Math.max(2,Math.round(d.ancho*k)),height=Math.max(2,Math.round(d.alto*k));
    if(cv.width!==w||cv.height!==height){cv.width=w;cv.height=height;}
    h.draw(cv,f,backgrounds.get(f.id)?.el);
    const g=f.layout?h.geometry(f.layout):null;
    if(g){const ctx=cv.getContext('2d');ctx.strokeStyle='#71f4dc';ctx.lineWidth=1;for(const seg of g.segments){ctx.strokeRect(seg.wall.x*k,seg.wall.y*k,seg.wall.w*k,seg.wall.h*k);}}
    $('#studio-shop-name').textContent=`${shop.selectedOptions[0]?.textContent||''} · ${t('Vista virtual','Virtual view')}${appliedName===`${shop.value}:${f.id}`?t(' · guardada',' · saved'):''}`;
    $('#studio-size').textContent=`${f.nombre} · ${t('pared','wall')} ${d.ancho}×${d.alto}${g?` · ${g.segments.length} ${t('pantallas','screens')} · ${t('entrega','delivery')} ${f.layout.entrega.join('×')}`:''} · ${t('Demo, instalación pendiente de confirmar','Demo, installation pending confirmation')}${f.layout?.ambiguedades?.length?` · ${t('Geometría pendiente de confirmar: ','Geometry requires confirmation: ')}${f.layout.ambiguedades.join(' ')}`:''}`;
  };
  function sync(){
    const formats=h.formats(),doc=h.doc(),sig=JSON.stringify([formats.map(f=>f.id),doc?.proyecto]);
    root.hidden=!formats.length;
    if(sig!==signature){signature=sig;const old=sel.value;sel.replaceChildren(...formats.map(f=>new Option(`${f.nombre} · ${f.layout?t('videowall','video wall'):f.custom.join('×')}`,f.id)));if(formats.some(f=>f.id===old))sel.value=old;else sel.value=formats.find(f=>f.id==='cliente-esp-2')?.id||formats[0]?.id;shop.replaceChildren(...(doc?.estancos||[]).map(e=>new Option(e.nombre,e.id)));}
    const f=format(),bg=backgrounds.get(f?.id),apps=h.applications();
    appliedName=apps.some(x=>x.estanco===shop.value&&x.formato===f?.id)?`${shop.value}:${f.id}`:'';
    $('#studio-aplicar').disabled=!doc||!shop.value||!!appliedName;
    $('#studio-retirar').hidden=!appliedName;shop.disabled=!doc;
    $('#studio-guardar').disabled=!h.ficha();
    $('#studio-ia').disabled=!h.ready()||!!ctl;
    $('#studio-cancel').hidden=!ctl;$('#studio-original').hidden=!bg;
    $('#studio-download').hidden=!bg;if(bg)$('#studio-download').href=bg.url;else $('#studio-download').removeAttribute('href');
    redraw();
  }
  sel.onchange=()=>{status.textContent='';sync();};shop.onchange=sync;
  $('#studio-aplicar').onclick=()=>{try{h.apply(shop.value,sel.value,true);}catch(_){status.textContent=t('El navegador no permite guardar la aplicación.','Browser cannot save this placement.');return;}status.textContent=t('Demo guardada en este navegador y añadida al paquete del estanco.','Demo saved in this browser and added to the shop package.');sync();};
  $('#studio-retirar').onclick=()=>{try{h.apply(shop.value,sel.value,false);}catch(_){status.textContent=t('No se pudo retirar la demo guardada.','Could not remove the saved demo.');return;}status.textContent=t('Demo retirada; las pantallas originales se conservan.','Demo removed; original screens are preserved.');sync();};
  $('#studio-guardar').onclick=()=>{
    try {const contract=formatContract(h.ficha(),h.formats(),h.baseDoc(),h.applications(),h.settings());
    if(docURL)URL.revokeObjectURL(docURL);docURL=URL.createObjectURL(new Blob([JSON.stringify(contract,null,2)],{type:'application/json'}));
    const a=document.createElement('a');a.href=docURL;a.download=`${contract.proyecto}-formatos-aplicaciones.json`;a.click();status.textContent=t('Contrato guardado: formatos, geometrías, ajustes y aplicaciones de demo.','Contract saved: formats, geometries, settings and demo placements.');}catch(_){status.textContent=t('No se pudo guardar el contrato.','Could not save the contract.');}
  };
  $('#studio-original').onclick=()=>{backgrounds.delete(sel.value);h.changed();sync();};
  $('#studio-cancel').onclick=()=>{turn++;ctl?.abort();ctl=null;status.textContent=t('Generación cancelada; el original se conserva.','Generation cancelled; original preserved.');sync();};
  $('#studio-ia').onclick=async()=>{
    const f=format(),d=h.destino(f),mine=++turn;ctl=new AbortController();const active=ctl;const timer=setTimeout(()=>active.abort(),90000);
    status.textContent=t('Generando fondo IA… el contenido original se conserva.','Generating AI background… original content is preserved.');sync();
    try{
      const size=referenceSize(d),cv=document.createElement('canvas');cv.width=size.ancho;cv.height=size.alto;h.reference(cv,f);
      const reference=cv.toDataURL('image/jpeg',0.85);cv.width=cv.height=0;
      const url=await generateBackground(reference,d,$('#studio-brief').value,{signal:ctl.signal});
      const el=new Image();el.src=url;await el.decode();if(mine!==turn)return;
      backgrounds.set(f.id,{el,url});f.on=true;h.changed();status.textContent=t('Fondo IA listo. Revisa la vista del estanco y exporta a resolución nativa. Guarda el fondo para conservarlo.','AI background ready. Review the shop view and export at native resolution. Save the background to keep it.');
    }catch(e){if(mine===turn)status.textContent=e.message==='session'?t('Inicia sesión de nuevo para generar.','Sign in again to generate.'):e.name==='AbortError'?t('Tiempo agotado; puedes reintentar.','Timed out; you can retry.'):t(`No se generó el fondo (${e.message}). El original sigue disponible.`,`Background not generated (${e.message}). Original remains available.`);}
    finally{clearTimeout(timer);if(mine===turn){ctl=null;sync();}}
  };
  sync();return{sync,draw:redraw,background:f=>backgrounds.get(f.id),clear:release};
}
