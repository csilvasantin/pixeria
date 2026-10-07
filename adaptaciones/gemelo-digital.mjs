import {twinGeometry,previewSize,screenCrop} from './gemelo-core.mjs';

// Read-only local preview: source media never leaves the editor. One master
// frame supplies every screen, sharing the editor's video/GIF clock and AI fill.
export function mountTwin(h){
  const t=h.t,modal=document.createElement('dialog');modal.className='adapter-twin';
  modal.setAttribute('aria-labelledby','twin-title');
  modal.innerHTML=`<header><div><h2 id="twin-title">${t('Gemelo digital · Estanco','Digital twin · Shop')}</h2><p id="twin-format"></p></div><button type="button" class="pill twin-close" aria-label="${t('Cerrar gemelo digital','Close digital twin')}">✕</button></header>
  <div class="twin-tools"><label>${t('Estanco','Shop')} <select id="twin-shop"></select></label><button type="button" class="pill twin-reset">${t('Vista inicial','Reset view')}</button><button type="button" class="pill twin-front">${t('De frente','Front view')}</button><button type="button" class="pill twin-near" aria-label="${t('Acercar','Zoom in')}">＋</button><button type="button" class="pill twin-far" aria-label="${t('Alejar','Zoom out')}">−</button></div>
  <div class="twin-stage" tabindex="0" role="img" aria-label="${t('Estanco virtual con el formato adaptado en sus pantallas','Virtual shop with adapted content on its screens')}"></div>
  <p class="twin-status" role="status" aria-live="polite"></p><footer>${t('Arrastra para girar · rueda o botones para acercar · flechas para girar · Esc para volver al editor','Drag to rotate · wheel or buttons to zoom · arrow keys to rotate · Esc to return to the editor')}<br>${t('Simulación de distribución; instalación real pendiente de confirmar.','Layout simulation; real installation requires confirmation.')}</footer>`;
  document.body.append(modal);
  const $=s=>modal.querySelector(s),stage=$('.twin-stage'),shop=$('#twin-shop'),status=$('.twin-status');
  let T,pending,renderer,scene,camera,active=null,panels=[],master=null,geometry=null,yaw=.22,pitch=.12,zoom=1,revision=0,last=0,focus=null,sign=null;
  const resourceSet=new Set();
  function clean(){for(const r of resourceSet)r.dispose?.();resourceSet.clear();panels=[];master=null;sign=null;scene=null;geometry=null;active=null;}
  function close(){revision++;h.end?.();if(modal.open)modal.close();}
  modal.addEventListener('close',()=>{revision++;h.end?.();clean();if(renderer){renderer.dispose();renderer.forceContextLoss();renderer=null;}stage.replaceChildren();focus?.focus();});
  $('.twin-close').onclick=close;modal.addEventListener('cancel',()=>h.end?.());
  function cameraPose(){if(!camera)return;camera.position.set(Math.sin(yaw)*11*zoom,2.9+pitch*8,Math.cos(yaw)*11*zoom);camera.lookAt(0,2.5,-1.9);}
  $('.twin-reset').onclick=()=>{yaw=.22;pitch=.12;zoom=1;cameraPose();draw(true);};
  $('.twin-front').onclick=()=>{yaw=0;pitch=0;zoom=.86;cameraPose();draw(true);};
  function zoomBy(v){zoom=Math.max(.58,Math.min(1.5,zoom*v));cameraPose();draw(true);}
  $('.twin-near').onclick=()=>zoomBy(.9);$('.twin-far').onclick=()=>zoomBy(1.1);
  stage.onwheel=e=>{e.preventDefault();zoomBy(e.deltaY>0?1.05:.95);};
  let pointer=null;
  stage.onpointerdown=e=>{pointer={id:e.pointerId,x:e.clientX,y:e.clientY};stage.setPointerCapture(e.pointerId);stage.focus();};
  stage.onpointermove=e=>{if(!pointer||pointer.id!==e.pointerId)return;yaw=Math.max(-.55,Math.min(.55,yaw+(e.clientX-pointer.x)*.004));pitch=Math.max(-.05,Math.min(.35,pitch+(e.clientY-pointer.y)*.002));pointer.x=e.clientX;pointer.y=e.clientY;cameraPose();draw(true);};
  stage.onpointerup=stage.onpointercancel=()=>{pointer=null;};
  stage.onkeydown=e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();yaw=Math.max(-.55,Math.min(.55,yaw+(e.key==='ArrowLeft'?-.05:.05)));cameraPose();draw(true);}};
  const observer=new ResizeObserver(()=>{if(!renderer||!camera||!modal.open)return;const {width,height}=stage.getBoundingClientRect();if(width<=0||height<=0)return;renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();draw(true);});observer.observe(stage);
  shop.onchange=()=>{h.selectShop?.(shop.value);draw(true);};
  function box(w,height,d,x,y,z,color){const geo=new T.BoxGeometry(w,height,d),mat=new T.MeshStandardMaterial({color,roughness:.8});resourceSet.add(geo);resourceSet.add(mat);const m=new T.Mesh(geo,mat);m.position.set(x,y,z);m.receiveShadow=true;m.castShadow=true;scene.add(m);return m;}
  function build(f){
    clean();active=f;geometry=twinGeometry(f,h.destino(f));master=document.createElement('canvas');const sz=previewSize(geometry);master.width=sz.ancho;master.height=sz.alto;
    scene=new T.Scene();scene.background=new T.Color('#101b1d');
    camera=new T.PerspectiveCamera(40,1,.1,60);
    scene.add(new T.HemisphereLight(0xf1fff9,0x615744,2));const light=new T.DirectionalLight(0xffead2,2.5);light.position.set(2,7,7);scene.add(light);
    box(8,.12,7,0,-.06,-.5,0x947b5b);box(8,4.7,.15,0,2.35,-3.1,0xe5dcc8);
    box(.12,4.7,7,-4,2.35,-.5,0xc4bda9);box(.12,4.7,7,4,2.35,-.5,0xc4bda9);
    // Counter and neutral retail shelving, not a claimed scan of the real shop.
    box(5,1.05,.85,0,.53,-.7,0x735039);box(5.15,.12,.96,0,1.12,-.7,0xe6d9bd);
    for(const side of [-1,1]){
      box(.12,2.3,2,side*3.85,1.15,-1.5,0x4d3c2a);
      for(let r=0;r<4;r++){box(.82,.06,2.05,side*3.48,.4+r*.48,-1.5,0xb79969);for(let c=0;c<5;c++)box(.3,.32,.23,side*3.48,.6+r*.48,-2.3+c*.37,[0xb9674c,0xd3be77,0x50786d,0xddd3be][(r+c)%4]);}
    }
    const signCanvas=document.createElement('canvas');signCanvas.width=1024;signCanvas.height=96;const signTexture=new T.CanvasTexture(signCanvas);signTexture.colorSpace=T.SRGBColorSpace;resourceSet.add(signTexture);const signGeo=new T.PlaneGeometry(6,.56),signMat=new T.MeshBasicMaterial({map:signTexture,toneMapped:false});resourceSet.add(signGeo);resourceSet.add(signMat);const signMesh=new T.Mesh(signGeo,signMat);signMesh.position.set(0,4.3,-2.98);scene.add(signMesh);sign={cv:signCanvas,texture:signTexture,name:null};
    const wall=geometry.pared,k=Math.min(6.5/wall.ancho,2.5/wall.alto),W=wall.ancho*k,H=wall.alto*k,centreY=3.0;
    box(W+.14,H+.14,.08,0,centreY,-2.95,0x142022);
    for(const seg of geometry.segments){
      const s=seg.wall,cv=document.createElement('canvas'),crop=screenCrop(s,wall,sz);cv.width=Math.max(1,crop.w);cv.height=Math.max(1,crop.h);
      const texture=new T.CanvasTexture(cv);texture.colorSpace=T.SRGBColorSpace;texture.minFilter=T.LinearFilter;texture.generateMipmaps=false;resourceSet.add(texture);
      const geo=new T.PlaneGeometry(s.w*k*.987,s.h*k*.987),mat=new T.MeshBasicMaterial({map:texture,toneMapped:false});resourceSet.add(geo);resourceSet.add(mat);
      const screen=new T.Mesh(geo,mat);screen.position.set(-W/2+(s.x+s.w/2)*k,centreY+H/2-(s.y+s.h/2)*k,-2.896);scene.add(screen);panels.push({cv,crop,texture});
    }
    yaw=.22;pitch=.12;zoom=1;cameraPose();
    $('#twin-format').textContent=`${f.nombre} · ${wall.ancho}×${wall.alto} · ${panels.length} ${panels.length===1?t('pantalla','screen'):t('pantallas','screens')}`;
    status.textContent=geometry.warnings.length?geometry.warnings.join(' '):t('Mismo contenido adaptado · distribución virtual','Same adapted content · virtual layout');
    stage.dataset.format=f.id;stage.dataset.screens=String(panels.length);
  }
  function draw(force=false){if(!modal.open||!renderer||!active||!scene)return;const now=performance.now();if(!force&&now-last<40)return;last=now;
    const name=shop.selectedOptions[0]?.textContent||'ESTANC';if(sign&&sign.name!==name){sign.name=name;const ctx=sign.cv.getContext('2d');ctx.fillStyle='#18362b';ctx.fillRect(0,0,1024,96);ctx.fillStyle='#fff5e6';ctx.font='600 36px sans-serif';ctx.textAlign='center';ctx.fillText(`ESTANC · ${name}`,512,61,980);sign.texture.needsUpdate=true;}
    h.draw(master,active,h.background(active)?.el);
    for(const {cv,crop,texture} of panels){const ctx=cv.getContext('2d');ctx.clearRect(0,0,cv.width,cv.height);ctx.drawImage(master,crop.x,crop.y,crop.w,crop.h,0,0,cv.width,cv.height);texture.needsUpdate=true;}
    renderer.render(scene,camera);
  }
  async function open(f){if(!h.ready())return;const mine=++revision;focus=document.activeElement;modal.showModal();h.start?.(f);stage.replaceChildren();status.textContent=t('Abriendo estanco…','Opening shop…');
    const shops=h.shops()||[];shop.replaceChildren(...(shops.length?shops:[{id:'studio-demo',nombre:t('Estanco · demo','Shop · demo')}]).map(s=>new Option(s.nombre,s.id)));
    if(shops.some(s=>s.id===h.shop()))shop.value=h.shop();shop.disabled=shops.length<2;
    try{T=await(pending||=import('./vendor/three-r160.mjs'));if(mine!==revision||!modal.open)return;
      renderer=new T.WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=T.SRGBColorSpace;stage.append(renderer.domElement);
      build(f);const {width,height}=stage.getBoundingClientRect();renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();draw(true);$('.twin-close').focus();
    }catch(e){if(mine!==revision)return;h.end?.();clean();renderer?.dispose();renderer=null;stage.replaceChildren();status.textContent=t('No se pudo abrir el gemelo. Comprueba que WebGL está disponible y vuelve a intentarlo.','Could not open the twin. Check WebGL is available and try again.');console.error('Studio twin:',e);}
  }
  function button(f){const b=document.createElement('button');b.type='button';b.className='pill view-twin';b.textContent=`▣ ${t('Ver en gemelo digital','View in digital twin')}`;b.setAttribute('aria-label',`${t('Ver en gemelo digital','View in digital twin')}: ${f.nombre}`);b.disabled=!h.ready();b.onclick=e=>{e.stopPropagation();open(f);};return b;}
  return {button,draw,close,sync:()=>{document.querySelectorAll('.view-twin').forEach(b=>b.disabled=!h.ready());}};
}
