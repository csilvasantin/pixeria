// Representación gráfica de los elementos ITIL de un Xpacio en los 4 niveles visuales.
// 8 bits (Good) · 16 bits (Better) · 32 bits (Best) · 64 bits (Matrix).
// Solo presenta: no toca simulación, inventario ni cámara. Los datos de estado ITIL
// llegan de fuera (item.itil.status o window.__xpaceItilStatus); si no hay dato se
// muestra «Sin dato» en gris. Nunca se inventa un estado: el modo demo va rotulado.
export const ITIL_TIERS=['good','better','best','matrix'];
export const ITIL_TIER_LABEL={good:'8 bits · Good',better:'16 bits · Better',best:'32 bits · Best',matrix:'64 bits · Matrix'};
export const ITIL_STATUS=['ok','warn','down','unknown'];
export const ITIL_STATUS_LABEL={ok:'Operativo',warn:'Aviso',down:'Caído',unknown:'Sin dato'};
// Mismo semáforo en los cuatro niveles. En 8 bits se usa la versión cuantizada (quant8).
export const ITIL_STATUS_COLOR={ok:'#22c55e',warn:'#f59e0b',down:'#ef4444',unknown:'#94a3b8'};
export const ITIL_STATUS_COLOR8={ok:'#00cc66',warn:'#ff9900',down:'#ff3333',unknown:'#999999'};
export const ITIL_KIND_SHORT={pantalla:'PANTALLA',player:'PLAYER',altavoz:'AUDIO',aroma:'AROMA',router:'ROUTER',tpv:'TPV',camara:'CÁMARA','altavoz-techo':'AUDIO TECHO','wifi-techo':'AP WIFI'};
// Orden de presentación (prioridad del pitch de Alsea primero).
export const ITIL_KIND_ORDER=['pantalla','player','altavoz','altavoz-techo','aroma','router','wifi-techo','tpv','camara'];
// Tipo de objeto (inventario Pixeria/Cafebrería o layout Xtanco) → clase ITIL.
export const ITIL_KIND_BY_TYPE={
  counter:'tpv',tpv:'tpv',pos:'tpv',datafono:'tpv',
  led:'pantalla',tft:'pantalla',pizarra:'pantalla',screen:'pantalla',pantalla:'pantalla',turnKiosk:'pantalla',tablet:'pantalla',metahuman:'pantalla',
  player:'player',
  djBooth:'altavoz',altavoz:'altavoz',
  // Ficha IoT de la Cafebrería (src.json · iot[].tipo): S1–S3 altavoces de techo, W1 AP de techo, G1 gateway/players.
  speaker:'altavoz-techo',wifi:'wifi-techo',gateway:'player',
  aroma:'aroma',
  router:'router',ap:'wifi-techo',
  camera:'camara',camara:'camara',cctv:'camara'
};
export function itilKind(item){
  if(!item)return null;
  if(item.itil&&item.itil.kind)return item.itil.kind;
  return ITIL_KIND_BY_TYPE[item.type]||null;
}
export function normalizeStatus(value){
  const v=String(value||'').toLowerCase();
  if(['ok','green','verde','operativo','up','online'].includes(v))return 'ok';
  if(['warn','warning','amber','ambar','ámbar','aviso','degraded','degradado'].includes(v))return 'warn';
  if(['down','red','rojo','caido','caído','offline','error','ko'].includes(v))return 'down';
  return 'unknown';
}
let manifestPromise=null;
// En Pixeria los assets viven junto al módulo: assets/xpaces/itil/ (32 y 64 bits en WebP).
export const ITIL_BASE=new URL('./itil/',import.meta.url).href;
export function loadItilManifest(base=ITIL_BASE){
  if(!manifestPromise)manifestPromise=fetch(base+'manifest.json?v=itil-1').then(r=>{if(!r.ok)throw new Error('manifest ITIL '+r.status);return r.json();})
    .then(json=>fetch(base+'8bit/sprites.json?v=itil-1').then(r=>r.json()).then(s=>{json.sprites8=s;json.base=base;return json;}));
  manifestPromise.catch(()=>{manifestPromise=null;});
  return manifestPromise;
}
// Tamaño visual por nivel (px CSS del lado mayor). Progresión: más detalle, más tamaño.
const SIZE={good:48,better:78,best:104,matrix:124};
function draw8(canvas,grid,palette,status,blinkOn){
  canvas.width=16;canvas.height=16;const cx=canvas.getContext('2d');cx.clearRect(0,0,16,16);
  for(let y=0;y<grid.length;y++)for(let x=0;x<grid[y].length;x++){
    const c=grid[y][x];if(c==='.')continue;
    cx.fillStyle=c==='L'?(blinkOn?ITIL_STATUS_COLOR8[status]:'#333333'):palette[c];cx.fillRect(x,y,1,1);
  }
}
// Crea el nodo de un elemento para un nivel. Devuelve {el,setStatus(status),dispose()}.
export function createItilGlyph(manifest,kind,tier,{status='unknown',label='',demo=false,compact=false,zoom=1}={}){
  const item=manifest.items[kind];if(!item)return null;
  const t=item.tiers[tier];const root=document.createElement('div');
  root.className=`itil-glyph itil-${tier}`;root.dataset.kind=kind;root.dataset.tier=tier;
  const art=document.createElement('div');art.className='itil-art';root.append(art);
  const size=Math.round((compact?SIZE[tier]*.62:SIZE[tier])*zoom);
  const scale=size/Math.max(t.width,t.height);
  const w=Math.round(t.width*scale),h=Math.round(t.height*scale);
  art.style.width=w+'px';art.style.height=h+'px';
  let canvas=null,timer=null,blink=true,current='unknown';
  if(tier==='good'){
    canvas=document.createElement('canvas');canvas.className='itil-img';art.append(canvas);
  }else{
    const img=new Image();img.className='itil-img';img.alt='';img.decoding='async';img.src=manifest.base+t.url;art.append(img);
    if(tier==='matrix'){const code=new Image();code.className='itil-code';code.alt='';code.src=manifest.base+t.code;art.append(code);}
  }
  const led=document.createElement('i');led.className='itil-led';
  led.style.left=(t.led[0]+(tier==='good'?.5:0))*scale+'px';led.style.top=(t.led[1]+(tier==='good'?.5:0))*scale+'px';
  if(tier!=='good')art.append(led);
  const plate=document.createElement('div');plate.className='itil-plate';
  plate.innerHTML=`<span class="itil-lamps"><b data-s="down"></b><b data-s="warn"></b><b data-s="ok"></b></span><span class="itil-name"></span>`;
  plate.querySelector('.itil-name').textContent=(label||ITIL_KIND_SHORT[kind])+(demo?' · DEMO':'');
  root.append(plate);
  const paint=()=>{if(canvas)draw8(canvas,manifest.sprites8.sprites[kind],manifest.sprites8.palette,current,blink);};
  function setStatus(s){
    current=normalizeStatus(s);root.dataset.status=current;
    root.style.setProperty('--itil-c',ITIL_STATUS_COLOR[current]);root.style.setProperty('--itil-c8',ITIL_STATUS_COLOR8[current]);
    root.title=`${item.nombre} · ${item.clase} · ${ITIL_STATUS_LABEL[current]}${demo?' (demo, no es dato real)':''}`;
    clearInterval(timer);timer=null;blink=true;
    // 8 bits: parpadeo a pasos (sin fundidos) para aviso/caído.
    if(canvas&&(current==='warn'||current==='down'))timer=setInterval(()=>{blink=!blink;paint();},current==='down'?300:600);
    paint();
  }
  setStatus(status);
  return {el:root,setStatus,dispose(){clearInterval(timer);root.remove();}};
}
