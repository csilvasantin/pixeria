/** Shared browser-only mug demo. No project switch or device write. */
export function runTazaDemo(args,lang='es'){
 const en=lang==='en',a=String(args||'').trim().toLowerCase().split(/\s+/);
 if(a[0]!=='taza'||a.length>2||a[1]&&!['cerrar','close','off'].includes(a[1]))return en?'Use /demo taza or /demo taza close.':'Usa /demo taza o /demo taza cerrar.';
 let box=document.getElementById('suite-taza-camera');
 if(a[1]){box?.remove();return en?'Mug camera closed.':'Cámara de la taza cerrada.';}
 if(box)return en?'Mug camera is already open.':'La cámara de la taza ya está abierta.';
 box=document.createElement('aside');box.id='suite-taza-camera';box.setAttribute('aria-label',en?'Mug camera':'Cámara de la taza');box.style.cssText='position:fixed;right:16px;bottom:16px;z-index:2147483000;width:min(350px,calc(100vw - 32px));background:#10231e;color:#e9fff4;border:1px solid #518774;border-radius:10px;box-shadow:0 12px 40px #0008;overflow:hidden;font:14px system-ui';
 const bar=document.createElement('header');bar.style.cssText='display:flex;justify-content:space-between;align-items:center;padding:9px 12px';
 const title=document.createElement('strong');title.textContent=en?'Mug · live camera':'Taza · cámara en directo';
 const close=document.createElement('button');close.textContent='×';close.setAttribute('aria-label',en?'Close mug camera':'Cerrar cámara de la taza');close.style.cssText='color:white;background:#245142;border:1px solid #659280;border-radius:5px;padding:5px 12px;font:18px system-ui;cursor:pointer';close.onclick=()=>box.remove();
 const frame=document.createElement('iframe');frame.title=en?'PlayerTaza camera':'Cámara PlayerTaza';frame.allow='camera; autoplay';frame.src='https://ainimation.studio/taza/camera';frame.style.cssText='display:block;width:100%;height:255px;border:0;background:black';bar.append(title,close);box.append(bar,frame);document.body.append(box);
 return en?'Mug camera opened in the corner. Allow camera access if prompted. Close with × or /demo taza close.':'Cámara de la taza abierta en la esquina. Permite la cámara si se solicita. Cierra con × o /demo taza cerrar.';
}
