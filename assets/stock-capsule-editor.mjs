// Reuse Ainimation's editor in this Stock detail. No iframe, popup, credential transfer or navigation.
export const CAPSULE_ENGINE_URL='https://www.ainimation.studio/assets/capsule-editor.mjs?v=capsule-inline-1';
let enginePromise,engineAttempt=0;
function loadCanonicalEngine(){return enginePromise||(enginePromise=import(CAPSULE_ENGINE_URL+(engineAttempt?'&retry='+engineAttempt:'')).then(engine=>{if(engine.CAPSULE_EDITOR_EMBED_VERSION!==1)throw Error('capsule-editor-not-ready');return engine;}).catch(error=>{enginePromise=null;engineAttempt++;throw error;}));}
export function canEditStockCapsule(item){return /^capsula-url:[a-f0-9]{16}$/.test(item?.externalRef||'');}
export async function openStockCapsuleEditor({item,mediaHost,detailRoot,button,signal,doc=document,win=window,loadEngine=loadCanonicalEngine}){
 if(!canEditStockCapsule(item)||signal?.aborted)return null;
 const en=doc.documentElement.lang.startsWith('en'),t=(es,eng)=>en?eng:es;
 const originalNodes=Array.from(mediaHost.children).map(node=>({node,hidden:node.hidden}));
 const host=doc.createElement('div');host.className='stock-inline-capsule-editor';host.id='stock-capsule-editor-'+String(item.id||'capsule').replace(/[^a-zA-Z0-9-]/g,'');host.setAttribute('role','region');host.setAttribute('aria-label',t('Editar con Ainimation','Edit with Ainimation'));
 const loading=doc.createElement('p');loading.setAttribute('role','status');loading.textContent=t('Abriendo el editor en esta cápsula…','Opening the editor in this capsule…');host.append(loading);
 for(const {node}of originalNodes){node.hidden=true;for(const media of [node,...node.querySelectorAll('video,audio')])if(typeof media.pause==='function')media.pause();}
 mediaHost.prepend(host);detailRoot.classList.add('is-capsule-editing');button.setAttribute('aria-controls',host.id);button.setAttribute('aria-expanded','true');
 let editor,closed=false;
 function close(focus=true){if(closed)return;closed=true;editor?.destroy();host.remove();for(const {node,hidden}of originalNodes)node.hidden=hidden;detailRoot.classList.remove('is-capsule-editing');button.disabled=false;button.setAttribute('aria-expanded','false');button.removeAttribute('aria-controls');signal?.removeEventListener('abort',abort);if(focus&&button.isConnected)button.focus({preventScroll:true});}
 function abort(){close(false);}
 signal?.addEventListener('abort',abort,{once:true});
 try{
  const engine=await loadEngine();if(closed||signal?.aborted){close(false);return null;}
  loading.remove();const params=new URLSearchParams({admiraCapsuleRef:item.externalRef,admiraStockId:item.id||'',admiraStockUrl:item.url||'',admiraStockOrientation:(item.tags||[]).includes('vertical')?'vertical':'horizontal'});
  editor=await engine.mountCapsuleEditor({host,params,doc,win,signal,returnUrl:win.location.href,onClose:()=>close(true)});
  if(closed||signal?.aborted){editor?.destroy();close(false);return null;}
  if(!editor?.element)throw Error('capsule-editor-not-ready');
  button.disabled=false;host.scrollIntoView({block:'start',behavior:'instant'});host.querySelector('h2')?.setAttribute('tabindex','-1');host.querySelector('h2')?.focus({preventScroll:true});
  return {close:()=>close(true)};
 }catch(error){close(false);if(!signal?.aborted)throw error;return null;}
}
