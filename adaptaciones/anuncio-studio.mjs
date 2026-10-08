import {extractAdvertisement,makeVisual,semanticAction,editCopy,adRegions,renderAdvertisement,textLayout,fontFor} from './anuncio-core.mjs?v=semantic-ad-3';
export function mountAdvertisement(h){
 const t=h.t,root=document.createElement('section');root.id='advertisement-studio';root.className='advertisement-studio';root.hidden=true;
 root.innerHTML=`<h3>${t('Anuncio · textos y composición','Advertisement · copy and composition')}</h3><p>${t('Extraemos el texto completo y lo recomponemos para cada tamaño. Si el original no permite un anuncio válido, recreamos la imagen. Revisa el texto y el producto antes de aprobar cada pieza.','We extract the complete copy and recompose it for each size. When the original cannot make a usable ad, we recreate the visual. Review the copy and product before approving each piece.')}</p><button type="button" class="pill" id="ad-analyze">${t('Analizar anuncio','Analyze advertisement')}</button> <button type="button" class="pill" id="ad-cancel" hidden>${t('Cancelar','Cancel')}</button><progress id="ad-progress" hidden></progress><p id="ad-status" role="status" aria-live="polite"></p><div id="ad-copy-wrap" hidden><label>${t('Texto extraído · separa los bloques con una línea en blanco','Extracted copy · separate blocks with a blank line')}<textarea id="ad-copy" rows="4" maxlength="20000"></textarea></label><button type="button" id="ad-confirm-copy" class="pill">${t('Confirmar texto completo','Confirm complete copy')}</button><p class="muted">${t('La IA puede equivocarse al leer. No traducimos ni inventamos precios o mensajes. Cambiar el texto invalida las piezas anteriores.','AI can misread text. We do not translate or invent prices or claims. Editing the copy invalidates previous pieces.')}</p></div>`;
 document.querySelector('#grid').before(root);
 const advanced=document.createElement('section');advanced.className='ad-reconstruction';advanced.hidden=true;
 advanced.innerHTML=`<h3>${t('Recrear con IA','Recreate with AI')}</h3><label>${t('Tratamiento de la imagen','Image treatment')}<select id="ad-treatment"><option value="adapt">${t('Adaptar · recomponer el anuncio','Adapt · recompose the advertisement')}</option><option value="reconstruct">${t('Recrear · generar el espacio que falta','Recreate · generate missing surroundings')}</option></select></label><div id="ad-reconstruct-options" hidden><label>${t('Elementos importantes que conservar','Important elements to preserve')}<textarea id="ad-important" rows="3" maxlength="1000"></textarea></label><label>${t('Dirección de la recreación (opcional)','Recreation direction (optional)')}<textarea id="ad-brief" rows="3" maxlength="1000" placeholder="${t('Ampliar la playa y conservar el vaso completo…','Extend the beach and keep the entire glass…')}"></textarea></label><p>${t('Genera una escena completa para cada formato. El texto se recompone por separado y se reserva espacio para no tapar el producto. Puede inventar detalles: revisa cada pieza. Se usa tu sesión de generación.','Generates a complete scene for each format. Copy is typeset separately with reserved space to avoid covering the product. Details may be invented: review every piece. Uses your generation session.')}</p></div>`;
 document.querySelector('#card-settings').before(advanced);
 const advancedField=id=>advanced.querySelector(id),reconstruct=()=>advancedField('#ad-treatment').value==='reconstruct';

 const $=s=>root.querySelector(s),entries=new Map(),forces=new Map();let doc=null,copyConfirmed=false,version=0,turn=0,controller=null,analysisPromise=null,message='';
 const enabled=()=>h.source().kind==='image'&&h.source().src.ancho>0;
 const key=f=>{const d=h.destino(f);return `${f.id}:${d.ancho}x${d.alto}:${version}:${reconstruct()?'reconstruct':forces.get(f.id)||'auto'}`;};
 const entry=f=>entries.get(key(f));
 const action=f=>semanticAction(doc,h.source().src,h.destino(f),reconstruct()?'reconstruct':forces.get(f.id));
 const say=s=>{message=s;$('#ad-status').textContent=s;};
 const changed=()=>{sync();h.changed();};
 function clear(){turn++;controller?.abort();controller=null;analysisPromise=null;doc=null;copyConfirmed=false;version++;entries.clear();forces.clear();$('#ad-copy-wrap').hidden=true;$('#ad-copy').value='';advancedField('#ad-important').value='';advancedField('#ad-brief').value='';say('');sync();}
 function invalidate(){turn++;controller?.abort();controller=null;entries.clear();version++;copyConfirmed=false;changed();}
 function sync(){
  root.hidden=!enabled();advanced.hidden=!enabled();advancedField('#ad-reconstruct-options').hidden=!reconstruct();advanced.querySelectorAll('input,select,textarea').forEach(x=>x.disabled=!!controller);$('#ad-analyze').disabled=!!controller||!enabled();$('#ad-analyze').textContent=doc?t('Volver a analizar','Analyze again'):t('Analizar anuncio','Analyze advertisement');$('#ad-cancel').hidden=!controller;$('#ad-progress').hidden=!controller;
  $('#ad-copy-wrap').hidden=!doc;$('#ad-confirm-copy').disabled=!!controller||!doc;$('#ad-copy').disabled=!!controller;
  if(doc&&!controller&&doc.uncertain)say(t('Hay texto dudoso o incompleto: corrígelo y confirma la copia antes de crear.','Some copy is uncertain or incomplete: correct and confirm it before creating.'));
  if(enabled()){const all=document.querySelector('#export-all'),formats=h.selected();all.disabled=!!controller||!formats.length;all.textContent=formats.length&&formats.every(f=>entry(f)?.approved)?t(`Exportar anuncios · ${formats.length}`,`Export advertisements · ${formats.length}`):reconstruct()?t(`Recrear con IA · ${formats.length}`,`Recreate with AI · ${formats.length}`):t(`Crear anuncios · ${formats.length}`,`Create advertisements · ${formats.length}`);}
  document.querySelectorAll('#grid .fmt[data-f]').forEach(el=>{
   const f=h.formats().find(x=>x.id===el.dataset.f);if(!f)return;
   const old=el.querySelector('.crear-ctl');if(old)old.hidden=enabled();
   let controls=el.querySelector('.ad-card');if(!enabled()){controls?.remove();return;}
   if(!controls){controls=document.createElement('div');controls.className='ad-card';controls.innerHTML=`<p class="ad-card-status" role="status"></p><button class="pill ad-approve" type="button">${t('Aprobar pieza','Approve piece')}</button> <button class="pill ad-recreate" type="button">${t('Recrear de nuevo','Recreate again')}</button> <a class="pill ad-png" download hidden>↓ PNG</a>`;el.querySelector('.stage,.esp-stage')?.after(controls);if(!controls.isConnected)el.append(controls);
    controls.querySelector('.ad-approve').onclick=e=>{e.stopPropagation();const a=entry(f);if(a){a.approved=true;say(t('Pieza aprobada. Ya puedes exportarla.','Piece approved. You can now export it.'));changed();}};
    controls.querySelector('.ad-recreate').onclick=e=>{e.stopPropagation();forces.set(f.id,'recreate');entries.delete(key(f));void prepare([f]);};
   }
   const a=entry(f),act=action(f),label=a?(['recreate','reconstruct'].includes(a.action)?t('Recreación','Recreation'):t('Texto recompuesto','Copy recomposed')):['recreate','reconstruct'].includes(act.action)?t('Requiere recreación','Recreation required'):t('Recomposición pendiente','Recomposition pending');
   controls.querySelector('.ad-card-status').textContent=a?`${label} · ${a.approved?t('aprobada','approved'):t('revisa texto y producto','review copy and product')}`:label;
   const approve=controls.querySelector('.ad-approve');approve.hidden=!a;approve.disabled=!!controller||!!a?.approved;
   const again=controls.querySelector('.ad-recreate');again.hidden=!doc;again.disabled=!!controller||!copyConfirmed;
   const png=controls.querySelector('.ad-png');png.hidden=!a?.approved;if(a){png.href=a.url;png.download=`${f.id}-${a.action}-${a.canvas.width}x${a.canvas.height}.png`;}
   const tag=el.querySelector('.accion-tag');if(tag){tag.hidden=false;tag.textContent=label;tag.title=t('El texto se compone como capas completas; no se recorta.','Copy is typeset as complete layers; it is not cropped.');}
   el.classList.remove('fmt-crear');
   const exp=el.querySelector('.export-one:not(.export-jpg)');if(exp){exp.textContent=!a?(reconstruct()?t('Recrear con IA','Recreate with AI'):t('Crear anuncio','Create advertisement')):!a.approved?t('Revisar pieza','Review piece'):f.output==='png'?t('Exportar PNG','Export PNG'):`${t('Exportar MP4','Export MP4')} · ${h.seconds()} s`;exp.disabled=!!controller;}
  });
 }
 function reference(){const s=h.source(),c=document.createElement('canvas'),k=Math.min(1,1600/s.src.ancho,1600/s.src.alto);c.width=Math.round(s.src.ancho*k);c.height=Math.round(s.src.alto*k);c.getContext('2d').drawImage(s.image,0,0,c.width,c.height);const url=c.toDataURL('image/jpeg',.94);c.width=c.height=0;return url;}
 async function analyze(force=false){
  if(doc&&!force)return doc;
  if(analysisPromise)return analysisPromise;
  if(!enabled())return null;
  const mine=++turn;controller?.abort();controller=new AbortController();const active=controller,timer=setTimeout(()=>active.abort(),60000);
  say(t('Leyendo texto, producto y composición…','Reading copy, product and composition…'));sync();
  analysisPromise=(async()=>{try{const result=await extractAdvertisement(reference(),{signal:active.signal});if(mine!==turn)return null;doc=result;advancedField('#ad-important').value=doc.subjects.map(x=>x.label).join(', ');copyConfirmed=!doc.uncertain;entries.clear();version++;$('#ad-copy').value=doc.texts.map(x=>x.text).join('\n\n');say(doc.texts.length?t(`Extraídos ${doc.texts.length} bloques. Revisa que la copia esté completa; después crea las piezas.`,`Extracted ${doc.texts.length} blocks. Check that the copy is complete, then create the pieces.`):t('Sin texto publicitario detectado. Revisa el producto antes de aprobar las piezas.','No advertising copy detected. Review the product before approving pieces.'));return doc;}catch(e){if(mine===turn)say(errorText(e));return null;}finally{clearTimeout(timer);if(mine===turn){controller=null;analysisPromise=null;changed();}}})();return analysisPromise;
 }
 function errorText(e){return e.message==='session'?t('Inicia sesión de nuevo para analizar o crear.','Sign in again to analyze or create.'):e.name==='AbortError'?t('Operación cancelada o tiempo agotado. No se exportó ningún recorte.','Cancelled or timed out. No crop was exported.'):e.message==='text-overflow'?t('El texto completo no cabe con un tamaño legible. Revisa la copia o el formato; la exportación está bloqueada.','The complete copy cannot fit at a readable size. Review the copy or format; export is blocked.'):e.message==='visual-review-failed'?t('La comprobación visual detectó texto residual o un producto incompleto. Recrea la pieza; no se exportará este resultado.','Visual checks detected residual text or an incomplete product. Recreate the piece; this result cannot be exported.'):t(`No se pudo completar el anuncio (${e.message}). Conservamos el original.`,`Could not complete the advertisement (${e.message}). Original retained.`);}
 async function prepare(formats){
  if(controller)return false;
  if(!doc&&!(await analyze()))return false;
  if(!copyConfirmed||doc.uncertain){say(t('Corrige y confirma el texto extraído antes de crear.','Correct and confirm the extracted copy before creating.'));return false;}
  const todo=formats.filter(f=>!entry(f));if(!todo.length){const ready=formats.every(f=>entry(f)?.approved);if(!ready)say(t('Revisa texto y producto y aprueba cada pieza antes de exportar.','Review copy and product and approve each piece before exporting.'));return ready;}
  const mine=++turn;controller=new AbortController();const active=controller;$('#ad-progress').max=todo.length;$('#ad-progress').value=0;sync();
  const ref=reference(),source=h.source().src;let clean=null;const failures=[];
  try{for(let i=0;i<todo.length;i++){
   const f=todo[i];try{const dst=h.destino(f),zone=h.textZone?.(f)||null,cv=document.createElement('canvas');cv.width=dst.ancho;cv.height=dst.alto;
   if(cv.width*cv.height>16777216)throw Error('canvas-budget');
   const measure=(text,size,role)=>{const ctx=cv.getContext('2d');ctx.font=fontFor(size,role);return ctx.measureText(text).width;};if(!textLayout(doc,cv.width,cv.height,measure,zone).valid)throw Error('text-overflow');
   let a=action(f).action;
   say(`${i+1}/${todo.length} · ${f.nombre} · ${['recreate','reconstruct'].includes(a)?t('recreando la escena','recreating the scene'):t('separando texto y fotografía','separating copy and photograph')}…`);
   const regions=adRegions(dst.ancho,dst.alto,zone),region=a==='reconstruct'?{w:dst.ancho,h:dst.alto}:regions.hero,visualOptions={signal:active.signal,textZone:doc.texts.length?regions.panel:null,important:advancedField('#ad-important').value,brief:advancedField('#ad-brief').value};
   const timer=setTimeout(()=>active.abort(),155000);let visual;
   try{try{visual=a==='recompose'&&clean?clean:await makeVisual(ref,doc,a,a==='recompose'?{w:source.ancho,h:source.alto}:region,visualOptions);if(a==='recompose')clean=visual;}catch(e){if(e.message!=='visual-review-failed'||a!=='recompose')throw e;a='recreate';say(`${f.nombre} · ${t('la adaptación no es válida; recreando','adaptation is not usable; recreating')}…`);visual=await makeVisual(ref,doc,a,region,{signal:active.signal});}}finally{clearTimeout(timer);}
   if(mine!==turn)return false;
   const image=new Image();image.src=visual.url;await image.decode();if(mine!==turn)return false;
   const layout=renderAdvertisement(cv,image,doc,{textZone:zone,immersive:a==='reconstruct'}),url=cv.toDataURL('image/png');entries.set(key(f),{canvas:cv,url,action:a,approved:false,layout,copy:doc.texts.map(x=>x.text),verification:visual.verification});$('#ad-progress').value=i+1;changed();
   }catch(e){if(active.signal.aborted||mine!==turn)throw e;failures.push(`${f.nombre}: ${errorText(e)}`);$('#ad-progress').value=i+1;}
  }if(failures.length){say(failures.join(' · '));return false;}say(t('Piezas listas para revisar. Comprueba texto y producto y pulsa Aprobar pieza en cada formato.','Pieces ready for review. Check the copy and product, then click Approve piece on each format.'));return false;
  }catch(e){if(mine===turn)say(errorText(e));return false;}finally{if(mine===turn){controller=null;changed();}}
 }
 advancedField('#ad-treatment').onchange=()=>{invalidate();copyConfirmed=!!doc&&!doc.uncertain;say(t('Tratamiento cambiado. Crea de nuevo y revisa las piezas.','Treatment changed. Generate again and review the pieces.'));changed();};
 for(const id of ['#ad-important','#ad-brief'])advancedField(id).oninput=()=>{invalidate();copyConfirmed=!!doc&&!doc.uncertain;say(t('Recreación modificada. Genera de nuevo.','Recreation changed. Generate again.'));changed();};
 $('#ad-analyze').onclick=()=>void analyze(true);$('#ad-cancel').onclick=()=>{turn++;controller?.abort();controller=null;analysisPromise=null;say(t('Cancelado; conservamos el original.','Cancelled; original retained.'));changed();};
 $('#ad-copy').oninput=()=>{invalidate();say(t('Copia modificada: confírmala para crear de nuevo.','Copy changed: confirm it to create again.'));};
 $('#ad-confirm-copy').onclick=()=>{try{doc=editCopy(doc,$('#ad-copy').value);copyConfirmed=true;say(t('Copia confirmada. Crea los formatos seleccionados.','Copy confirmed. Create the selected sizes.'));changed();}catch{say(t('Conserva el número de bloques; separa cada uno con una línea en blanco.','Keep the block count; separate each one with a blank line.'));}};
 function draw(canvas,f){if(!enabled())return false;const a=entry(f),ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);if(a)ctx.drawImage(a.canvas,0,0,canvas.width,canvas.height);else{const s=h.source(),k=Math.min(canvas.width/s.src.ancho,canvas.height/s.src.alto);ctx.fillStyle='#161e1c';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(s.image,(canvas.width-s.src.ancho*k)/2,(canvas.height-s.src.alto*k)/2,s.src.ancho*k,s.src.alto*k);}return true;}
 return{enabled,clear,sync,analyze,prepare,entry,draw,action,ready:f=>!!entry(f)?.approved,busy:()=>!!controller,description:f=>{const a=entry(f);return a?(['recreate','reconstruct'].includes(a.action)?t('Recreación · texto completo en capas','Recreation · complete typeset copy'):t('Recomposición · texto completo en capas','Recomposition · complete typeset copy')):t('Anuncio pendiente de recomposición; el original se muestra completo.','Advertisement awaiting recomposition; the entire original is shown.');}};
}
