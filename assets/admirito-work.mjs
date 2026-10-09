// Admirito reuses the Admira cloud outline/face from the shared avatar, with local drawing tools.
const ART = `<svg class="admirito-work-art" viewBox="0 0 180 170" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg"><path d="M28 135 Q66 122 111 135" class="admirito-sketch" fill="none" stroke="#689840" stroke-width="3" stroke-linecap="round" stroke-dasharray="86"/><svg x="28" y="21" width="124" height="91" class="admirito-cloud" viewBox="-6 6 289 186" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg"><g class="da-nube-cuerpo"><path d="M213.31,59.13c-1,0-1.9.1-2.85.15a83,83,0,0,0-144,0c-1-.05-1.89-.15-2.85-.15A58.22,58.22,0,1,0,90.81,168.79a82.72,82.72,0,0,0,95.29,0A58.21,58.21,0,1,0,213.31,59.13Z" fill="#f3f9e8"/><path d="M213.31,59.13c-1,0-1.9.1-2.85.15a83,83,0,0,0-144,0c-1-.05-1.89-.15-2.85-.15A58.22,58.22,0,1,0,90.81,168.79a82.72,82.72,0,0,0,95.29,0A58.21,58.21,0,1,0,213.31,59.13Zm0,99.81a41.75,41.75,0,0,1-28.06-11,67.09,67.09,0,0,1-13.39,10.21,65.93,65.93,0,0,1-66.81,0A67.09,67.09,0,0,1,91.66,148,41.56,41.56,0,1,1,59,76a43.33,43.33,0,0,1,4.58-.26A41.39,41.39,0,0,1,76.11,77.7a66.43,66.43,0,0,1,124.69,0,41.39,41.39,0,0,1,12.51-1.93,43.33,43.33,0,0,1,4.58.26,41.58,41.58,0,0,1-4.58,82.91Z" fill="#689840"/><ellipse cx="92" cy="138" rx="15" ry="9" fill="#f5a3a3" opacity=".75"/><ellipse cx="185" cy="138" rx="15" ry="9" fill="#f5a3a3" opacity=".75"/><g class="da-nube-ojos"><ellipse cx="111" cy="110" rx="12.5" ry="17" fill="#1d2b12"/><ellipse cx="166" cy="110" rx="12.5" ry="17" fill="#1d2b12"/><circle cx="115.5" cy="103" r="5" fill="#fff"/><circle cx="170.5" cy="103" r="5" fill="#fff"/></g><path class="da-nube-boca" d="M122,135 Q138.5,153 155,135" fill="none" stroke="#1d2b12" stroke-width="8" stroke-linecap="round"/></g></svg><g class="admirito-pencil-hand"><path d="M48 88 Q23 92 29 119" fill="none" stroke="#689840" stroke-width="7" stroke-linecap="round"/><ellipse cx="30" cy="119" rx="10" ry="9" fill="#f3f9e8" stroke="#689840" stroke-width="3"/><g transform="rotate(-24 35 115)"><path d="M31 83 H40 V130 L35.5 139 31 130Z" fill="#efc35c" stroke="#624b25" stroke-width="2"/><path d="M31 130 H40 L35.5 139Z" fill="#ead5b6"/><path d="M34 136 H37 L35.5 139Z" fill="#263a2b"/></g></g><g class="admirito-eraser-hand"><path d="M136 88 Q161 94 151 121" fill="none" stroke="#689840" stroke-width="7" stroke-linecap="round"/><ellipse cx="149" cy="121" rx="10" ry="9" fill="#f3f9e8" stroke="#689840" stroke-width="3"/><g transform="rotate(18 145 126)"><rect x="132" y="119" width="27" height="18" rx="4" fill="#edaaa8" stroke="#895451" stroke-width="2"/><path d="M148 119 H155 Q159 119 159 123 V133 Q159 137 155 137 H148Z" fill="#f7dfdc"/></g></g></svg>`;

/** A local busy companion. `host` resolves the current preview stage, or a plain container.
 * Call update only from the real job lifecycle. No timers, progress claims or provider calls.
 */
export function mountAdmiritoWork({host,t=(es)=>es}={}){
 const doc=typeof host==='function'?null:host?.ownerDocument;
 const documentRef=doc||globalThis.document;
 if(!documentRef)throw new Error('admirito-document');
 if(!documentRef.querySelector('link[data-admirito-work]')){
  const css=documentRef.createElement('link');css.rel='stylesheet';css.href=new URL('./admirito-work.css?v=admirito-work-1',import.meta.url).href;css.dataset.admiritoWork='';documentRef.head.append(css);
 }
 const node=documentRef.createElement('aside');node.className='admirito-work';node.hidden=true;node.setAttribute('role','status');node.setAttribute('aria-live','polite');node.setAttribute('aria-atomic','true');
 node.innerHTML=ART;
 const label=documentRef.createElement('span');label.className='admirito-work-label';node.append(label);
 let row=null,stage=null,disposed=false;
 function detach(){
  node.remove();
  // Restore the same canvas/stage node; never rebuild a preview or its controls.
  if(row){if(stage?.parentNode===row)row.before(stage);row.remove();row=null;stage=null;}
 }
 function update({busy=false,phase='create'}={}){
  if(disposed)return;
  const target=typeof host==='function'?host():host;
  if(!busy||!target){node.hidden=true;detach();return;}
  if(node.parentNode!==target&&stage!==target){
   detach();
   if(target.matches?.('.stage,.esp-stage')){
    stage=target;row=documentRef.createElement('div');row.className='admirito-preview-row';stage.before(row);row.append(stage,node);
   }else target.append(node);
  }
  const text=phase==='analyze'?t('Admirito está analizando la imagen…','Admirito is analysing the image…'):phase==='recreate'?t('Admirito acompaña la recreación…','Admirito is keeping you company while the image is recreated…'):t('Admirito acompaña la creación…','Admirito is keeping you company while the image is created…');
  if(label.textContent!==text)label.textContent=text;
  node.dataset.phase=phase;node.hidden=false;
 }
 return {update,destroy(){detach();node.hidden=true;disposed=true;}};
}
