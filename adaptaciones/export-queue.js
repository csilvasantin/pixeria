// Background export queue (bottom-right, collapsible). One line per format: name, % and
// download when done. It lives on <body>, outside both steps, and every line keeps its
// own copy of the job and the source URL: changing video, sizes or step never touches it.
const ACTIVE=new Set(['queued','running']);
const size=bytes=>bytes<1048576?`${Math.ceil(bytes/1024)} KB`:`${(bytes/1048576).toFixed(1)} MB`;
export function createExportQueue({engine,t,onComplete=()=>{},onRelease=()=>{},onChange=()=>{},onCreate=()=>{}}) {
  const items=[];let seq=0,running=null,collapsed=false;
  const reasons={
    'output-size':t('Supera el límite de memoria; usa un clip más corto.','Over the memory limit; use a shorter clip.'),
    'source-size':t('El vídeo supera 100 MB.','The video exceeds 100 MB.'),
    'source-download':t('No se pudo leer el vídeo de origen.','Could not read the source video.'),
    'engine-download':t('No se pudo descargar el motor de vídeo.','Could not download the video engine.'),
    encoding:t('Falló la codificación.','Encoding failed.')
  };
  const el=document.createElement('aside');el.className='export-queue';el.hidden=true;el.setAttribute('aria-label',t('Exportaciones','Exports'));
  el.innerHTML=`<div class="eq-head"><button type="button" class="eq-toggle" aria-expanded="true"><span class="eq-title">${t('Exportaciones','Exports')}</span> <span class="eq-count"></span> <span class="eq-caret" aria-hidden="true">▾</span></button><button type="button" class="eq-clear" hidden>${t('Vaciar','Clear')}</button></div><ol class="eq-list" aria-live="polite"></ol>`;
  const list=el.querySelector('.eq-list'),toggle=el.querySelector('.eq-toggle'),clearBtn=el.querySelector('.eq-clear');
  toggle.onclick=()=>{collapsed=!collapsed;render();};
  clearBtn.onclick=()=>clear();
  document.body.append(el);
  function summary() {
    const done=items.filter(i=>i.state==='done').length;
    return `${done}/${items.length}`;
  }
  function rowStatus(item) {
    if(item.state==='queued') return t('En cola','Queued');
    if(item.state==='running') return item.phase==='loading'?t('Cargando motor…','Loading engine…'):item.phase==='source'?t('Leyendo vídeo…','Reading video…'):`${Math.floor(item.progress*100)}%`;
    if(item.state==='cancelled') return t('Cancelada','Cancelled');
    if(item.state==='error') return reasons[item.error]||reasons.encoding;
    return '';
  }
  function row(item) {
    const li=document.createElement('li');li.className=`eq-item eq-${item.state}`;li.dataset.id=item.id;
    const name=document.createElement('div');name.className='eq-name';
    const strong=document.createElement('strong');strong.textContent=item.label;
    const sub=document.createElement('small');sub.textContent=item.sub;name.append(strong,sub);
    const side=document.createElement('div');side.className='eq-side';
    if(item.state==='done') for(const f of item.files) {
      const a=document.createElement('a');a.href=f.url;a.download=f.filename;a.className='eq-dl';
      a.textContent=`↓ ${item.files.length>1?f.short+' · ':''}${size(f.size)}`;a.title=`${t('Descargar','Download')} ${f.filename}`;side.append(a);
    } else {const s=document.createElement('span');s.className='eq-pct';s.textContent=rowStatus(item);side.append(s);}
    if(ACTIVE.has(item.state)) {
      const x=document.createElement('button');x.type='button';x.className='eq-cancel';x.textContent='×';x.setAttribute('aria-label',`${t('Cancelar','Cancel')} ${item.label}`);
      x.onclick=()=>cancel(item);side.append(x);
    }
    if(item.note) {const n=document.createElement('small');n.className='eq-note';n.textContent=item.note;name.append(n);}
    li.append(name,side);return li;
  }
  function render() {
    el.hidden=!items.length;el.classList.toggle('eq-collapsed',collapsed);toggle.setAttribute('aria-expanded',String(!collapsed));
    el.querySelector('.eq-count').textContent=summary();
    clearBtn.hidden=!items.some(i=>!ACTIVE.has(i.state));
    list.replaceChildren(...items.map(row));
    onChange(items.map(item => ({ id: item.id, state: item.state })));
  }
  // Progress ticks only touch the % of their own line.
  function tick(item) {
    const pct=list.querySelector(`[data-id="${item.id}"] .eq-pct`);if(pct)pct.textContent=rowStatus(item);
  }
  function release(url) {if(url&&!uses(url))onRelease(url);}
  function uses(url) {return items.some(i=>ACTIVE.has(i.state)&&i.sourceURL===url);}
  function finish(item,state,error) {item.state=state;item.error=error||null;if(running===item)running=null;release(item.sourceURL);render();pump();}
  async function pump() {
    if(running) return;
    const item=items.find(i=>i.state==='queued');if(!item) return;
    running=item;item.state='running';item.phase='loading';item.progress=0;render();
    try {
      await engine.encode(item.sourceURL,item.job,event=>{if(item.state!=='running')return;item.phase=event.phase;if(event.phase==='encoding')item.progress=event.progress;tick(item);},(output,blob)=>{
        item.files.push({url:URL.createObjectURL(blob),blob,filename:output.filename,size:blob.size,short:output.n?`${output.n}/${output.N}`:'',output});
      });
      if(item.state!=='running') return;
      finish(item,'done');
      for(const f of item.files) Promise.resolve().then(()=>onComplete(item,f)).catch(()=>{});
    } catch(error) {
      if(item.state!=='running') return;
      const reason=String(error?.message||error);finish(item,reason==='cancelled'?'cancelled':'error',reason);
    }
  }
  function cancel(item) {
    if(!ACTIVE.has(item.state)) return;
    // Stop the engine first: finishing starts the next line, which must not be hit by this cancel.
    if(item.state==='running') engine.cancel();
    finish(item,'cancelled');
  }
  function clear() {
    for(let i=items.length-1;i>=0;i--) if(!ACTIVE.has(items[i].state)) {items[i].files.forEach(f=>URL.revokeObjectURL(f.url));items.splice(i,1);}
    render();
  }
  return {
    el,uses,
    busy:()=>items.some(i=>ACTIVE.has(i.state)),
    // entry: {label, sub, sourceURL, job, meta}
    add(entry) {const item={...entry,id:++seq,state:'queued',progress:0,files:[]};items.push(item);onCreate(item);collapsed=false;render();pump();return item;},
    // Files produced on the spot (PNG of the current frame) enter the queue already done.
    addReady(entry,files) {
      const item={...entry,id:++seq,state:'done',progress:1,files:files.map(f=>({...f,url:URL.createObjectURL(f.blob),size:f.blob.size,short:''}))};
      items.push(item);onCreate(item);collapsed=false;render();item.files.forEach(f=>Promise.resolve().then(()=>onComplete(item,f)).catch(()=>{}));return item;
    },
    note(item,text) {item.note=text;render();},
    cancelAll() {items.filter(i=>ACTIVE.has(i.state)).forEach(i=>{i.state='cancelled';});running=null;engine.cancel();render();},
    clear
  };
}
