// The Studio adapter invokes one assistant surface; it never opens a media workshop.
let panel,frame,loaded=false,waiting=[],previousFocus;
export function openCreative(text='',language='es'){
 if(!panel){
  previousFocus=document.activeElement;panel=document.createElement('dialog');panel.setAttribute('aria-label','El Creativo');
  Object.assign(panel.style,{position:'fixed',inset:'auto 20px 52px auto',padding:'0',margin:'0',width:'min(480px, calc(100vw - 24px))',height:'min(820px, calc(100dvh - 70px))',border:'1px solid #36535b',borderRadius:'18px',background:'#080c12',color:'#e5f5ef',overflow:'hidden',zIndex:'2147483000',boxShadow:'0 24px 100px #000a'});
  frame=document.createElement('iframe');frame.title='El Creativo · Admirito';frame.src=(language==='en'?'/en/creativo/':'/creativo/')+'?embed=1&lang='+language;Object.assign(frame.style,{border:'0',width:'100%',height:'100%',display:'block'});panel.append(frame);document.body.append(panel);
  window.addEventListener('message',event=>{if(event.origin!==location.origin||event.source!==frame.contentWindow)return;if(event.data?.type==='admira:creative:close'){panel.close();previousFocus?.focus();}if(event.data?.type==='admira:creative:ready'){loaded=true;waiting.splice(0).forEach(command=>send(command));}});
 }
 if(!panel.open){previousFocus=document.activeElement;panel.show();}
 function send(command){frame.contentWindow.postMessage({type:'admira:creative:command',text:command},location.origin);}
 if(text){if(loaded)send(text);else waiting.push(text);}frame.focus();
 return language==='en'?'El Creativo is open.':'El Creativo está abierto.';
}
