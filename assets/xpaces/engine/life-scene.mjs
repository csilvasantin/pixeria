import * as T from './premium-three.mjs';
import {FOOTPRINTS,normalizeSnapshot} from './premium-model.mjs';
import {buildCustomerNavigation} from './customer-navigation.mjs?v=customer-motion-1';
import {createCustomerMotion} from './customer-motion.mjs?v=customer-motion-1';

// Keep the live game's appearance and selection metadata while reusing the
// existing numeric boundary checks. The legacy normalizer alone drops these.
function normalizeLifeSnapshot(raw={}){
  raw=raw||{};const normalized=normalizeSnapshot(raw);
  const sourceLayout=(Array.isArray(raw.layout)?raw.layout:[]).slice(0,300).filter(Boolean);
  const sourceActors=(Array.isArray(raw.actors)?raw.actors:[]).slice(0,200).filter(Boolean);
  return {...raw,...normalized,
    layout:normalized.layout.map((item,i)=>({...sourceLayout[i],...item})),
    actors:normalized.actors.map((actor,i)=>({...sourceActors[i],...actor,
      scale:Number.isFinite(Number(sourceActors[i]?.scale))?Math.max(.3,Math.min(2,Number(sourceActors[i].scale))):1
    }))
  };
}

// A presentation of Xtanco's live snapshot. This module owns neither a clock,
// simulation, media player nor animation loop. All dimensions are grid units.
export function createLifeScene(rawSnapshot,{canvasFactory=()=>document.createElement('canvas'),inventory=false,loadCounter=null,loadFurniture=null,assetQuality='better',loadPerson=null}={}){
  let snapshot=normalizeLifeSnapshot(rawSnapshot),signature='',lighting='day',disposed=false,lastAnimationTime=null;
  let customerNavigation=buildCustomerNavigation(snapshot,{allowOutside:true});
  const scene=new T.Scene(),world=new T.Group(),actors=new T.Group();
  world.name='life:world';actors.name='life:actors';scene.add(world,actors);
  const geometry=new Set(),materials=new Set(),textures=new Set(),actorMap=new Map();
  const worldResources=new Set(),fixtureLights=[],doors=[];
  const sharedResources=new Set();
  const own=(resource,scope=sharedResources)=>{scope.add(resource);if(resource.isBufferGeometry)geometry.add(resource);else if(resource.isMaterial)materials.add(resource);else if(resource.isTexture)textures.add(resource);return resource;};
  const release=scope=>{for(const resource of scope){resource.dispose();geometry.delete(resource);materials.delete(resource);textures.delete(resource);}scope.clear();};
  const material=(color,extra={},scope=sharedResources)=>own(new T.MeshStandardMaterial({color,roughness:.72,metalness:0,...extra}),scope);
  const basic=(extra,scope=worldResources)=>own(new T.MeshBasicMaterial({toneMapped:false,...extra}),scope);
  const colorSeed=value=>{let hash=0;for(const char of String(value))hash=(hash*31+char.charCodeAt(0))>>>0;return hash;};

  function texture(width,height,draw,scope=sharedResources){
    const canvas=canvasFactory();if(!canvas)return null;
    canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d');if(!ctx)return null;
    draw(ctx,width,height);
    const map=own(new T.CanvasTexture(canvas),scope);map.colorSpace=T.SRGBColorSpace;map.anisotropy=4;return map;
  }
  // Deterministic grain: reconnecting a snapshot never changes the shop's finish.
  const woodMap=texture(512,512,(c,w,h)=>{
    c.fillStyle='#bb8b59';c.fillRect(0,0,w,h);
    for(let i=0;i<320;i++){const y=(i*71.23)%h;c.strokeStyle=i%3?'#a1734740':'#ebc29055';c.lineWidth=.6+(i%3)*.5;c.beginPath();c.moveTo(0,y);c.bezierCurveTo(120,y+Math.sin(i)*6,300,y+Math.cos(i)*9,w,y+Math.sin(i*3)*4);c.stroke();}
  });
  const plasterMap=texture(256,256,(c,w,h)=>{
    c.fillStyle='#f8f3e7';c.fillRect(0,0,w,h);for(let i=0;i<1900;i++){c.fillStyle=i%2?'#8b817510':'#ffffff44';c.fillRect((i*41.71)%w,(i*73.31)%h,1+(i%3),1);}
  });
  const stoneMap=texture(256,256,(c,w,h)=>{
    c.fillStyle='#ede8db';c.fillRect(0,0,w,h);for(let i=0;i<900;i++){c.fillStyle=['#c3bcb077','#f9f5ee','#a9a09344'][i%3];c.beginPath();c.ellipse((i*57.13)%w,(i*37.41)%h,1+(i%4),1+(i%2),i,0,Math.PI*2);c.fill();}
  });
  const palette={
    plaster:material('#ffffff',{map:plasterMap}),cream:material('#f0e7d6'),chalk:material('#fff9ed'),
    stone:material('#ffffff',{map:stoneMap,roughness:.88}),oak:material('#ffffff',{map:woodMap}),
    walnut:material('#765135',{map:woodMap}),woodEdge:material('#a5784a'),darkWood:material('#49382b'),
    teal:material('#275c59'),sage:material('#81917a'),mint:material('#acc9b4'),
    brass:material('#be9451',{roughness:.3,metalness:.72}),black:material('#17272a',{roughness:.43}),
    steel:material('#415052',{roughness:.35,metalness:.6}),glass:material('#c5e6de',{roughness:.13,metalness:.13,transparent:true,opacity:.2,depthWrite:false}),
    leaf:material('#416744'),leafLight:material('#6e8b4d'),leafDark:material('#294d3d'),soil:material('#3b3028'),
    terracotta:material('#bf7654'),coral:material('#c97559'),blue:material('#56849c'),mustard:material('#d7ad59'),
    paper:material('#f6edd7'),wine:material('#365342',{roughness:.28}),denim:material('#34475a'),
    light:material('#ffe6ab',{emissive:'#ffc66f',emissiveIntensity:.65,roughness:.35}),
    led:material('#e4fff1',{emissive:'#97ead3',emissiveIntensity:.85}),pavement:material('#b9c1b6',{roughness:.95})
  };

  // A shared rounded cube gives every cabinet, screen bezel and shoe a soft edge
  // while allowing all repeated pieces to be instanced by geometry and material.
  const roundedGeometry=own(new T.BoxGeometry(1,1,1,4,4,4));
  const position=roundedGeometry.attributes.position,normal=roundedGeometry.attributes.normal;
  const point=new T.Vector3(),core=new T.Vector3(),direction=new T.Vector3();
  for(let i=0;i<position.count;i++){
    point.fromBufferAttribute(position,i);core.copy(point).clampScalar(-.40,.40);direction.copy(point).sub(core).normalize();point.copy(core).addScaledVector(direction,.1);
    position.setXYZ(i,point.x,point.y,point.z);normal.setXYZ(i,direction.x,direction.y,direction.z);
  }
  roundedGeometry.computeBoundingSphere();
  const cubeGeometry=own(new T.BoxGeometry(1,1,1));
  const sphereGeometry=own(new T.SphereGeometry(1,16,12));
  const cylinderGeometry=own(new T.CylinderGeometry(1,1,1,20));
  const capsuleGeometry=own(new T.CapsuleGeometry(.5,1,5,10));
  const potGeometry=own(new T.CylinderGeometry(.87,.65,1,20));
  const coneGeometry=own(new T.CylinderGeometry(.25,1,1,24));
  const discGeometry=own(new T.CircleGeometry(1,32));
  const planeGeometry=own(new T.PlaneGeometry(1,1));
  const hairGeometry=own(new T.SphereGeometry(1,16,10,0,Math.PI*2,0,Math.PI*.54));

  const groundMaterial=material('#e1e8de',{roughness:1});
  const ground=new T.Mesh(planeGeometry,groundMaterial);ground.name='life:ground';ground.rotation.x=-Math.PI/2;ground.position.y=-.565;ground.receiveShadow=true;scene.add(ground);

  function mesh(parent,g,m,x,y,z,sx=1,sy=1,sz=1){
    const object=new T.Mesh(g,m);object.position.set(x,y,z);object.scale.set(sx,sy,sz);object.castShadow=true;object.receiveShadow=true;parent.add(object);return object;
  }
  const box=(p,x,y,z,w,h,d,m=palette.oak,rounded=true)=>mesh(p,rounded?roundedGeometry:cubeGeometry,m,x,y,z,w,h,d);
  const cylinder=(p,x,y,z,r,h,m=palette.brass)=>mesh(p,cylinderGeometry,m,x,y,z,r,h,r);
  const ellipsoid=(p,x,y,z,rx,ry,rz,m)=>mesh(p,sphereGeometry,m,x,y,z,rx,ry,rz);
  const group=(p,x=0,y=0,z=0)=>{const g=new T.Group();g.position.set(x,y,z);p.add(g);return g;};
  function surface(p,map,x,y,z,w,h,rotation=0,m=null){
    const o=mesh(p,planeGeometry,m||basic({map,side:T.DoubleSide}),x,y,z,w,h,1);o.rotation.y=rotation;o.castShadow=false;return o;
  }
  function label(p,text,x,y,z,w,h,{bg='#214f4c',fg='#f1e3bc',font=48,rotation=0,subtitle=''}={}){
    const map=texture(512,160,(c,cw,ch)=>{
      c.fillStyle=bg;c.fillRect(0,0,cw,ch);c.fillStyle=fg;c.textAlign='center';c.textBaseline='middle';c.font=`600 ${font}px sans-serif`;c.fillText(text,cw/2,subtitle?ch*.39:ch/2,cw-32);
      if(subtitle){c.font='22px sans-serif';c.fillText(subtitle,cw/2,ch*.76,cw-34);}
    },worldResources);
    return surface(p,map,x,y,z,w,h,rotation,map?null:palette.teal);
  }

  // All physical screens reference this one canvas and only the supplied draw()
  // method. Canvas textures for wood and print are static, never media players.
  const mediaCanvas=canvasFactory();let mediaContext=null,mediaTexture=null;
  if(mediaCanvas){mediaCanvas.width=512;mediaCanvas.height=768;mediaContext=mediaCanvas.getContext('2d');if(mediaContext){mediaTexture=own(new T.CanvasTexture(mediaCanvas));mediaTexture.colorSpace=T.SRGBColorSpace;mediaTexture.minFilter=T.LinearFilter;}}
  const mediaMaterial=mediaTexture?basic({map:mediaTexture,side:T.DoubleSide},sharedResources):palette.black;
  function screen(p,x,y,z,w,h,rotation=0){
    const root=group(p,x,y,z);root.rotation.y=rotation;
    box(root,0,0,0,w+.14,h+.14,.13,palette.black);box(root,0,0,-.047,w+.2,h+.2,.035,palette.brass);
    surface(root,null,0,0,.071,w,h,0,mediaMaterial).userData.liveMedia=true;
    cylinder(root,w*.36,-h/2-.042,.073,.013,.012,palette.led).rotation.x=Math.PI/2;
    return root;
  }
  function art(p,x,y,z,w,h,rotation=0,variant=0){
    const root=group(p,x,y,z);root.rotation.y=rotation;box(root,0,0,0,w+.1,h+.1,.07,palette.oak);
    const map=texture(320,400,(c,cw,ch)=>{
      c.fillStyle='#f6edda';c.fillRect(0,0,cw,ch);c.fillStyle=variant?'#ca8062':'#d2ad64';c.beginPath();c.arc(cw*.61,ch*.31,67,0,Math.PI*2);c.fill();
      c.fillStyle='#2e6156';c.beginPath();c.moveTo(42,310);c.bezierCurveTo(70,156,210,165,275,310);c.fill();c.fillStyle='#799374';c.beginPath();c.ellipse(99,263,43,112,-.45,0,Math.PI*2);c.fill();
      c.fillStyle='#294b47';c.font='600 17px sans-serif';c.textAlign='center';c.fillText(variant?'RITUAL COTIDIANO':'UN PEQUEÑO UNIVERSO',cw/2,361);
    },worldResources);
    surface(root,map,0,0,.04,w,h,0,map?null:palette.sage);return root;
  }

  function plant(p,x=.5,z=.5,size=1){
    const root=group(p,x,0,z);
    mesh(root,potGeometry,palette.terracotta,0,.23*size,0,.3*size,.46*size,.3*size);
    cylinder(root,0,.44*size,0,.25*size,.045*size,palette.woodEdge);cylinder(root,0,.454*size,0,.232*size,.012*size,palette.soil);
    for(let i=0;i<11;i++){
      const a=i*2.39996,reach=(.25+(i%3)*.095)*size,y=(.76+(i%5)*.13)*size;
      const stem=cylinder(root,Math.cos(a)*reach*.45,(y+.43*size)/2,Math.sin(a)*reach*.45,.012*size,y-.43*size,palette.leafDark);
      stem.rotation.z=-Math.cos(a)*.33;stem.rotation.x=Math.sin(a)*.33;
      const leaf=ellipsoid(root,Math.cos(a)*reach,y,Math.sin(a)*reach,.12*size,.30*size,.055*size,[palette.leaf,palette.leafLight,palette.leafDark][i%3]);leaf.rotation.set(Math.sin(a)*.8,a,-Math.cos(a)*.75);
    }
    return root;
  }
  function cabinet(p,w,d,h,{finish=palette.teal,fluted=true}={}){
    box(p,w/2,.09,d/2,w-.09,.18,d-.09,palette.darkWood);box(p,w/2,h/2+.055,d/2,w,h-.11,d,finish);
    box(p,w/2,h+.035,d/2,w+.1,.115,d+.12,palette.stone);box(p,w/2,.16,d+.013,w-.08,.033,.025,palette.brass);
    if(fluted)for(let x=.08;x<w-.04;x+=.105)box(p,x,h*.49,d+.017,.022,h*.66,.021,finish===palette.teal?palette.sage:palette.woodEdge);
  }
  function bottle(p,x,y,z,color=palette.wine,size=1){
    cylinder(p,x,y+.13*size,z,.058*size,.26*size,color);ellipsoid(p,x,y+.263*size,z,.057*size,.055*size,.057*size,color);
    cylinder(p,x,y+.33*size,z,.025*size,.13*size,color);cylinder(p,x,y+.4*size,z,.028*size,.045*size,palette.brass);
    box(p,x,y+.16*size,z+.055*size,.09*size,.1*size,.009*size,palette.paper);
  }
  function shelf(p,w,d){
    const h=2.18;box(p,w/2,h/2,.055,w,h,.11,palette.teal);box(p,w/2,.06,d/2,w+.07,.12,d+.045,palette.darkWood);
    for(const x of [.036,w-.036])box(p,x,h/2,d/2,.072,h,d,palette.oak);
    for(let tier=0;tier<5;tier++){
      const y=.14+tier*.41;box(p,w/2,y,d/2,w,.07,d,palette.oak);box(p,w/2,y-.046,d-.045,w-.14,.013,.018,palette.light);
      const count=Math.max(3,Math.floor(w/.17));
      for(let j=0;j<count;j++){
        const x=.12+j*(w-.24)/Math.max(1,count-1),z=d-.18,color=[palette.paper,palette.coral,palette.teal,palette.mustard,palette.blue][(tier+j)%5];
        if(tier===0&&j%2===0)bottle(p,x,y+.04,z,palette.wine,.74);
        else{box(p,x,y+.195,z,.12,.30,.22,color);box(p,x,y+.20,z+.114,.084,.06,.008,palette.paper);box(p,x,y+.29,z+.113,.077,.016,.008,palette.brass);}
      }
    }
    box(p,w/2,2.17,d/2,w+.07,.13,d+.025,palette.teal);label(p,'SELECCIÓN',w/2,2.17,d+.023,w*.8,.09,{font:45});
  }
  function terminal(p,x,y,z,w=.48,h=.3){
    box(p,x,y,z,w*.63,.035,.31,palette.black);cylinder(p,x,y+.13,z-.04,.028,.23,palette.brass);
    const root=group(p,x,y+.29,z-.04);root.rotation.x=-.13;box(root,0,0,0,w,h,.055,palette.black);
    label(root,'ADMIRA',0,0,.031,w*.88,h*.79,{bg:'#255c5b',fg:'#f4e4bd',font:54});
  }
  function fixture(p,x,y,z,{size=.44,pendant=true}={}){
    if(pendant)cylinder(p,x,y+.42,z,.012,.78,palette.black);
    mesh(p,coneGeometry,palette.brass,x,y,z,size,.23,size);
    const glow=mesh(p,discGeometry,palette.light,x,y-.116,z,size*.93,size*.93,1);glow.rotation.x=-Math.PI/2;glow.castShadow=false;
    const light=new T.PointLight('#ffce91',0,5,2);light.position.set(x,y-.21,z);light.userData.dayIntensity=.16;light.userData.nightIntensity=2.8;fixtureLights.push(light);p.add(light);
  }

  // Merge repeated static parts per selectable object; ray hits still ascend to
  // the original layout parent, and actor limbs stay independently articulated.
  function batch(root){
    root.updateWorldMatrix(true,true);const inverse=root.matrixWorld.clone().invert(),buckets=new Map();
    root.traverse(o=>{
      if(!o.isMesh||o.isInstancedMesh||o.userData.dynamic)return;
      const key=`${o.geometry.uuid}:${o.material.uuid}:${o.castShadow}:${o.receiveShadow}`;
      if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(o);
    });
    for(const list of buckets.values()){
      if(list.length<3)continue;
      const first=list[0],combined=new T.InstancedMesh(first.geometry,first.material,list.length);
      combined.castShadow=first.castShadow;combined.receiveShadow=first.receiveShadow;
      for(let i=0;i<list.length;i++){combined.setMatrixAt(i,new T.Matrix4().multiplyMatrices(inverse,list[i].matrixWorld));list[i].removeFromParent();}
      combined.instanceMatrix.needsUpdate=true;combined.computeBoundingSphere();root.add(combined);
    }
  }

  function furniture(item){
    const root=group(world,item.col,0,item.row);root.name=`furniture:${item.id}`;
    root.userData={layoutId:item.id,item,type:item.type,label:item.label,selectable:true};
    root.scale.set((item.flipX?-1:1)*item.sx,item.sy,item.sx);root.rotation.y=-item.rot*Math.PI/2;
    const [w,d]=item.fp||FOOTPRINTS[item.type]||[1,1];
    switch(item.type){
      case 'counter':{
        cabinet(root,w,d,.95);terminal(root,w*.5,1.02,d*.29,.56,.34);
        box(root,w*.5,1.024,d*.68,w*.57,.028,.27,palette.black);box(root,w*.7,1.07,d*.85,.18,.12,.2,palette.steel).rotation.x=-.2;
        box(root,w*.2,1.08,d*.60,.2,.13,.26,palette.paper);box(root,w*.2,1.151,d*.60,.15,.009,.2,palette.teal);
        label(root,'XTANCO',w/2,.64,d+.034,w*.71,.15,{bg:'#275c59',font:55});break;
      }
      case 'shelves':{
        // A 1×2 legacy footprint is a long retail aisle: expose its long face
        // to the room while keeping the exact occupied grid rectangle.
        if(d>w){const aisle=group(root,0,0,d);aisle.rotation.y=Math.PI/2;shelf(aisle,d,w);}
        else shelf(root,w,d);break;
      }
      case 'wineRack':{
        cabinet(root,w,d,.4,{finish:palette.oak,fluted:false});
        for(const x of [.035,w-.035])box(root,x,1.05,d/2,.07,1.55,d,palette.teal);
        for(let tier=0;tier<3;tier++){const y=.49+tier*.44;box(root,w/2,y,d/2,w,.065,d,palette.oak);for(let j=0;j<6;j++)bottle(root,.15+j*(w-.3)/5,y+.035,d*.64,j%3?palette.wine:palette.coral,.88);}
        label(root,'BODEGA',w/2,1.91,d*.8,w*.73,.14,{bg:'#f0e7d6',fg:'#275c59'});break;
      }
      case 'lottery':{
        cabinet(root,w,d,.81,{finish:palette.oak});
        const display=group(root,w/2,1.13,d*.26);display.rotation.x=-.13;box(display,0,0,0,.86,.51,.12,palette.teal);
        label(display,'LOTERÍAS',0,.07,.068,.76,.16,{bg:'#275c59',font:48});label(display,'ILUSIÓN CADA DÍA',0,-.11,.068,.76,.13,{bg:'#f0e7d6',fg:'#275c59',font:29});
        for(let i=0;i<5;i++){const ticket=box(root,.19+i*(w-.38)/4,.898,d*.72,.25,.037,.3,[palette.paper,palette.mustard,palette.mint][i%3]);ticket.rotation.y=(i-2)*.025;box(root,.19+i*(w-.38)/4,.92,d*.68,.18,.005,.022,palette.coral);}
        break;
      }
      case 'magazines':{
        box(root,w/2,.065,d/2,w,.13,d,palette.teal);
        for(const x of [.045,w-.045])box(root,x,.55,d*.38,.09,1.05,.1,palette.brass);
        for(let tier=0;tier<3;tier++){
          const y=.23+tier*.32,z=d-.16-tier*.23;box(root,w/2,y,z,w,.065,.35,palette.oak);
          for(let j=0;j<5;j++){
            const cover=group(root,.2+j*(w-.4)/4,y+.18,z-.025);cover.rotation.x=-.2;const color=[palette.blue,palette.coral,palette.paper,palette.teal,palette.mustard][(j+tier)%5];
            box(cover,0,0,0,.29,.36,.03,color);box(cover,0,.12,.018,.23,.032,.007,palette.paper);ellipsoid(cover,0,-.006,.022,.063,.085,.009,palette.sage);box(cover,0,-.117,.019,.2,.008,.006,palette.paper);
          }
          box(root,w/2,y+.036,z+.16,w-.1,.04,.025,palette.brass);
        }
        label(root,'PRENSA · CULTURA',w/2,1.24,d*.25,w*.87,.12,{bg:'#f0e7d6',fg:'#275c59',font:40});break;
      }
      case 'vending':{
        box(root,w/2,1.04,d/2,w,2.08,d,palette.teal);box(root,w*.40,1.12,d+.012,w*.65,1.55,.033,palette.black);
        for(let tier=0;tier<4;tier++){
          const y=.56+tier*.34;box(root,w*.4,y-.035,d+.025,w*.58,.035,.02,palette.steel);
          for(let j=0;j<3;j++){const x=w*.19+j*w*.21;cylinder(root,x,y+.115,d+.065,.061,.23,[palette.coral,palette.mustard,palette.mint][j]);box(root,x,y+.11,d+.126,.085,.055,.006,palette.paper);}
        }
        box(root,w*.86,1.19,d+.035,.115,.31,.025,palette.steel);box(root,w*.86,1.25,d+.05,.077,.095,.012,palette.led);
        box(root,w*.40,.19,d+.04,w*.53,.16,.034,palette.black);label(root,'PAUSA',w/2,1.95,d+.052,w*.76,.1,{font:50});break;
      }
      case 'manager':{
        for(const x of [.1,w-.1])for(const z of [.1,d-.1]){const leg=box(root,x,.43,z,.065,.85,.065,palette.teal);leg.rotation.z=x<w/2?.035:-.035;}
        box(root,w/2,.89,d/2,w+.05,.09,d+.04,palette.oak);box(root,w*.82,.73,d/2,w*.27,.23,d*.85,palette.cream);
        box(root,w*.82,.74,d*.93,.20,.018,.025,palette.brass);terminal(root,w*.45,.952,d*.27,.63,.39);
        box(root,w*.42,.958,d*.67,.51,.019,.20,palette.black);box(root,w*.76,.96,d*.63,.22,.025,.28,palette.paper);
        cylinder(root,w*.12,1.027,d*.72,.065,.145,palette.cream);cylinder(root,w*.12,1.102,d*.72,.052,.003,palette.darkWood);
        // The upholstered task chair stays within the same desk object footprint.
        cylinder(root,w*.48,.13,d*.89,.3,.045,palette.steel);cylinder(root,w*.48,.32,d*.89,.033,.4,palette.steel);
        box(root,w*.48,.51,d*.89,.49,.12,.40,palette.teal);box(root,w*.48,.76,d+ .05,.48,.47,.10,palette.teal).rotation.x=.09;break;
      }
      case 'djBooth':{
        cabinet(root,w,d,.86,{finish:palette.walnut});box(root,w/2,.958,d*.51,w*.89,.09,d*.78,palette.black);
        for(const x of [w*.25,w*.75]){cylinder(root,x,1.011,d*.55,.22,.027,palette.steel);cylinder(root,x,1.028,d*.55,.172,.012,palette.black);cylinder(root,x,1.038,d*.55,.056,.013,palette.mustard);box(root,x+.2,1.048,d*.40,.022,.025,.28,palette.brass).rotation.y=-.4;}
        for(let i=0;i<4;i++){box(root,w*.5,1.019,d*.30+i*.1,.22,.035,.023,palette.steel);cylinder(root,w*.49+(i%2)*.055,1.048,d*.30+i*.1,.022,.034,palette.paper);}
        for(const x of [.105,w-.105]){box(root,x,1.10,d*.10,.23,.38,.21,palette.black);const driver=cylinder(root,x,1.08,d*.212,.069,.014,palette.steel);driver.rotation.x=Math.PI/2;}
        label(root,'XTANCO SESSIONS',w/2,.58,d+.034,w*.77,.14,{bg:'#49382b',font:41});break;
      }
      case 'plant':plant(root,w/2,d/2,Math.min(w,d)*1.08);break;
      case 'floorLamp':{
        cylinder(root,w/2,.045,d/2,.29,.09,palette.stone);cylinder(root,w/2,1.05,d/2,.023,2.03,palette.brass);
        fixture(root,w/2,1.94,d/2,{size:.38,pendant:false});break;
      }
      case 'tablet':case 'turnKiosk':{
        cylinder(root,w/2,.045,d/2,.3,.09,palette.stone);box(root,w/2,.57,d/2,.095,1.05,.12,palette.brass);
        const display=group(root,w/2,1.14,d/2);display.rotation.x=-.18;box(display,0,0,0,.66,.62,.12,palette.teal);
        label(display,item.type==='tablet'?'¿QUÉ TAL?':'TU TURNO',0,.09,.068,.57,.24,{bg:'#f0e7d6',fg:'#275c59',font:44});
        label(display,item.type==='tablet'?'★  ★  ★  ★  ★':'BIENVENIDO',0,-.16,.068,.57,.16,{bg:'#f0e7d6',fg:'#8f703e',font:34});break;
      }
      case 'metahuman':{
        box(root,w/2,.07,d/2,.81,.14,.61,palette.stone);box(root,w/2,.29,d/2,.10,.35,.15,palette.brass);
        screen(root,w/2,1.12,d/2,.71,1.55);label(root,'ASISTENTE',w/2,.12,d*.83,.58,.085,{bg:'#ede8db',fg:'#275c59',font:38});break;
      }
      case 'aroma':{
        root.position.set(item.col,item.wallY,.06);root.scale.set(1,1,1);root.rotation.set(0,0,0);
        box(root,.38,0,.13,.66,Math.min(.75,item.ph),.25,palette.chalk);
        for(let i=0;i<5;i++)box(root,.38,-.11+i*.043,.263,.42,.009,.012,palette.sage);ellipsoid(root,.58,.14,.267,.017,.017,.009,palette.led);break;
      }
      case 'tft':{
        root.position.set(item.col,item.wallY,.12);root.scale.set(1,1,1);root.rotation.set(0,0,0);
        const height=Math.max(.55,item.ph),width=Math.min(snapshot.cols*.45,height*16/9);
        screen(root,Math.min(width/2,Math.max(0,snapshot.cols-item.col-width/2)),0,0,width,height);break;
      }
      case 'led':{
        root.position.set(item.col,snapshot.wallHeight-.28,.13);root.scale.set(item.sx,item.sy,item.sx);root.rotation.set(0,0,0);
        const width=Math.min(5.5,snapshot.cols-item.col-.18);box(root,width/2,0,0,width,.29,.08,palette.teal);
        label(root,'XTANCO  /  ADMIRA',width/2,0,.049,width-.15,.22,{bg:'#214f4c',fg:'#f7e8b6',font:38});break;
      }
      case 'rug':{
        box(root,w/2,.012,d/2,w,.024,d,palette.sage);box(root,w/2,.027,d/2,w-.13,.009,d-.13,palette.cream);box(root,w/2,.034,d/2,w-.22,.008,d-.22,palette.teal);
        for(let i=0;i<8;i++)box(root,w/2,.04,d*.22+i*d*.08,w*.61,.005,.022,palette.sage);break;
      }
      case 'door':{
        for(const x of [.07,w-.07])box(root,x,1.19,.025,.10,2.38,.12,palette.oak);box(root,w/2,2.36,.025,w,.10,.12,palette.oak);
        const leaf=group(root,.08,0,.025);leaf.name=`door:${item.id}`;doors.push(leaf);
        box(leaf,(w-.16)/2,1.18,0,w-.16,2.25,.045,palette.glass);box(leaf,w-.28,1.06,.047,.035,.3,.035,palette.brass);
        break;
      }
      default:{
        cabinet(root,w,d,Math.max(.3,item.ph),{finish:palette.oak});
        if(item.label)label(root,item.label,w/2,item.ph*.65,d+.029,w*.83,.17,{bg:'#bb8b59',fg:'#284a42',font:37});
      }
    }
    if(item.type!=='door')batch(root);
    const loader=loadFurniture?()=>loadFurniture(item):item.type==='counter'?loadCounter:null;
    if(loader){
      root.userData.assetStatus='loading';
      Promise.resolve().then(loader).then(asset=>{
        if(disposed||root.parent!==world)return;
        if(!asset){root.userData.assetStatus='unregistered';return;}
        const retiredDoors=new Set();root.traverse(o=>{if(doors.includes(o))retiredDoors.add(o);});
        for(let i=doors.length-1;i>=0;i--)if(retiredDoors.has(doors[i]))doors.splice(i,1);
        asset.traverse(o=>{if(o.userData.doorHinge){o.rotation.y=-snapshot.doorOpen*Math.PI*.48;doors.push(o);}});
        asset.traverse(o=>{if(o.isMesh&&o.userData.mediaSurface==='existing_shared_player')o.material=mediaMaterial;});
        root.traverse(o=>{if(o.isInstancedMesh)o.dispose();});root.clear();root.add(asset);root.userData.assetStatus='ready';root.userData.assetSource='Blender';
      }).catch(()=>{if(!disposed&&root.parent===world)root.userData.assetStatus='fallback';});
    }
    return root;
  }

  function architecture(){
    const {cols:c,rows:r,wallHeight:h}=snapshot;
    const architectureRoot=group(world);architectureRoot.name='life:architecture';
    const floorMap=texture(768,768,(ctx,w,height)=>{
      ctx.fillStyle='#906c48';ctx.fillRect(0,0,w,height);
      const plankWidth=48,plankLength=256,colors=['#c39b6d','#caa475','#c09869','#d1ad7c','#bd9364'];
      for(let row=0;row<16;row++)for(let col=-1;col<4;col++){
        const x=col*plankLength+(row%3)*plankLength/3,y=row*plankWidth;ctx.fillStyle=colors[(row*7+col+5)%colors.length];ctx.fillRect(x+1,y+1,plankLength-2,plankWidth-2);
        for(let g=0;g<7;g++){ctx.strokeStyle=g%2?'#f1d3a436':'#83634024';ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(x+3,y+5+g*6);ctx.bezierCurveTo(x+70,y+3+g*6,x+170,y+8+g*6,x+plankLength-4,y+5+g*6);ctx.stroke();}
      }
    },worldResources);
    if(floorMap){floorMap.wrapS=floorMap.wrapT=T.RepeatWrapping;floorMap.repeat.set(c/4,r/4);}
    const floorMaterial=material('#fff5e4',{map:floorMap,roughness:.74},worldResources);
    box(architectureRoot,c/2,-.30,r/2,c+.70,.52,r+.7,palette.cream);
    box(architectureRoot,c/2,-.087,r/2,c+.10,.15,r+.1,palette.walnut);
    const floor=mesh(architectureRoot,planeGeometry,floorMaterial,c/2,.002,r/2,c,r,1);floor.rotation.x=-Math.PI/2;floor.castShadow=false;
    // The exposed plinth edge and thin brass seam make the room a tangible model.
    box(architectureRoot,c/2,-.058,r+.055,c+.14,.018,.018,palette.brass);box(architectureRoot,c+.055,-.058,r/2,.018,.018,r+.14,palette.brass);
    box(architectureRoot,c/2,h/2,-.13,c+.38,h,.26,palette.plaster,false);
    box(architectureRoot,-.13,h/2,r/2,.26,h,r+.38,palette.teal,false);
    box(architectureRoot,c/2,.1,.027,c,.20,.075,palette.chalk);box(architectureRoot,.026,.1,r/2,.075,.20,r,palette.sage);
    box(architectureRoot,c/2,h+.015,-.13,c+.42,.09,.33,palette.chalk);box(architectureRoot,-.13,h+.015,r/2,.33,.09,r+.4,palette.cream);
    box(architectureRoot,c/2,h-.13,.019,c+.09,.085,.045,palette.cream);box(architectureRoot,.019,h-.13,r/2,.045,.085,r+.09,palette.sage);
    box(architectureRoot,c/2,h-.24,.041,c-.15,.018,.022,palette.light);
    // Shallow panel moldings on the teal cutaway wall.
    for(let z=.6;z<r-.4;z+=1.55){
      for(const zz of [z-.45,z+.45])box(architectureRoot,.018,.66,zz,.024,.84,.018,palette.sage);
      for(const y of [.24,1.08])box(architectureRoot,.018,y,z,.024,.018,.92,palette.sage);
    }
    // Back-wall windows sit in cream reveals; daylight panes remain readable
    // without external environment images or an additional renderer.
    for(const x of [c*.25,c*.61]){
      const windowWidth=Math.min(1.72,c*.16),windowHeight=Math.min(1.48,h*.47),cy=h*.60;
      box(architectureRoot,x,cy,.021,windowWidth+.18,windowHeight+.18,.1,palette.woodEdge);
      box(architectureRoot,x,cy,.079,windowWidth,windowHeight,.025,palette.mint);
      box(architectureRoot,x,cy,.108,.035,windowHeight+.02,.039,palette.cream);box(architectureRoot,x,cy,.109,windowWidth,.034,.04,palette.cream);
      box(architectureRoot,x,cy-windowHeight/2-.08,.14,windowWidth+.30,.085,.35,palette.stone);
      box(architectureRoot,x-.40,cy+.23,.103,.21,.47,.004,palette.cream);box(architectureRoot,x+.30,cy+.23,.103,.10,.47,.004,palette.cream);
    }
    if(!snapshot.moving){
      const screenHeight=Math.min(1.62,h*.52),screenY=Math.min(h*.61,h-screenHeight/2-.4);
      screen(architectureRoot,.092,screenY,r*.27,1.06,screenHeight,Math.PI/2);
      screen(architectureRoot,.092,screenY,r*.70,1.06,screenHeight,Math.PI/2);
      if(c>8)art(architectureRoot,c*.84,h*.58,.11,1.1,1.42,0,1);
      // Small pools of light accent the retail fixtures, with cables kept at the
      // back of the cutaway so the orthographic view remains unobstructed.
      for(const x of [c*.18,c*.48,c*.79])fixture(architectureRoot,x,h-.51,1.45,{size:.34});
    }
    // A paved edge accommodates the actual passerby actors from the snapshot.
    box(architectureRoot,c+1.05,-.22,r/2,1.45,.22,r+.7,palette.pavement);
    for(let z=.1;z<r+.2;z+=.8)box(architectureRoot,c+1.05,-.105,z,1.41,.008,.016,palette.cream);
    box(architectureRoot,c+1.80,-.16,r/2,.055,.1,r+.7,palette.stone);
    for(const z of [.3,r-.3]){cylinder(architectureRoot,c+1.63,.18,z,.047,.58,palette.teal);cylinder(architectureRoot,c+1.63,.48,z,.054,.024,palette.brass);}
    // A single open shopfront detail signals the entrance without hiding people.
    if(!snapshot.moving){
      const entrance=group(world,c+.08,0,2.06);entrance.name='life:entrance';
      for(const z of [0,1.18])box(entrance,0,1.12,z,.07,2.24,.07,palette.brass);
      box(entrance,0,2.27,.59,.10,.12,1.3,palette.teal);
      const door=group(entrance,0,0,1.14);door.name='architectural:door';doors.push(door);
      box(door,0,1.10,-.54,.03,2.13,1.05,palette.glass);box(door,.037,1.01,-.92,.038,.32,.038,palette.brass);
    }
    batch(architectureRoot);
  }

  function createActor(actor){
    // The shared profile changes only presentation. Keep the source actor on the
    // selectable root so snapshots, routing and counters retain their identity.
    const sourceActor=actor,style=['customer','passerby'].includes(actor.kind)&&!actor.robot&&actor.visitorProfileId?actor.visitorStyle:null;
    if(style)actor={...actor,...style.palette,accessory:0,
      gender:actor.gender||(['m','male','f','female'].includes(style.gender)?style.gender:null),
      age:actor.age||(['adult','adulto','senior','child','nino'].includes(style.age)?style.age:null)};
    const root=group(actors),resources=new Set(),seed=colorSeed(actor.id),cloth=material(actor.color,{roughness:.94},resources),skin=material(actor.skin,{roughness:.82},resources);
    const hair=material(actor.hair||['#3c3028','#69432c','#b17e47','#272e30'][seed%4],{roughness:.92},resources);
    const trousers=material(actor.pants||['#344651','#625649','#66746b','#333d3d'][seed%4],{roughness:.92},resources);
    const shoes=actor.shoes?material(actor.shoes,{roughness:.75},resources):palette.cream;
    root.name=`actor:${actor.id}`;root.userData={actorId:actor.id,actor:sourceActor,kind:actor.kind,selectable:true,resources,legs:[],arms:[],seed,visitorProfileId:style?actor.visitorProfileId:null};
    const body=group(root);root.userData.body=body;
    const dimension=(value,min,max)=>Number.isFinite(value)?Math.max(min,Math.min(max,value)):1;
    if(style)body.scale.set(dimension(style.width,.87,1.16),dimension(style.height,.94,1.07),Math.sqrt(dimension(style.width,.87,1.16)));
    const outfit=style?.outfit||'shirt',accessory=style?.accessory;
    // Hip and shoulder pivots make a real alternating gait, including the knees
    // and elbows. Nothing here advances the actor's simulation coordinates.
    for(const side of [-1,1]){
      const hip=group(body,side*.108,.68,0);root.userData.legs.push(hip);
      mesh(hip,capsuleGeometry,trousers,0,-.145,0,.13,.17,.14);
      const knee=group(hip,0,-.31,0);hip.userData.knee=knee;mesh(knee,capsuleGeometry,trousers,0,-.135,0,.113,.16,.12);
      box(knee,0,-.313,.054,.15,.095,.27,shoes);box(knee,0,-.356,.055,.151,.028,.268,palette.darkWood);
      const shoulder=group(body,side*.242,1.14,0);root.userData.arms.push(shoulder);shoulder.rotation.z=-side*.075;
      shoulder.userData.restPosition=shoulder.position.clone();
      mesh(shoulder,capsuleGeometry,cloth,0,-.096,0,.142,.105,.155);
      const elbow=group(shoulder,0,-.204,0);shoulder.userData.elbow=elbow;mesh(elbow,capsuleGeometry,['jacket','knit'].includes(outfit)?cloth:skin,0,-.085,0,.095,.092,.105);
      ellipsoid(elbow,0,-.195,.008,.059,.075,.050,skin);
    }
    box(body,0,.95,0,.41,.48,.265,cloth);ellipsoid(body,0,.745,0,.192,.107,.129,trousers);
    cylinder(body,0,1.232,0,.077,.16,skin);
    const head=group(body,0,1.424,0);root.userData.head=head;
    ellipsoid(head,0,0,0,.179,.217,.163,skin);
    for(const side of [-1,1]){
      ellipsoid(head,side*.174,-.01,0,.035,.049,.033,skin);
      ellipsoid(head,side*.061,.022,.148,.020,.025,.010,palette.chalk);
      ellipsoid(head,side*.060,.02,.159,.010,.015,.007,palette.black);
      const brow=box(head,side*.061,.063,.145,.047,.012,.01,hair);brow.rotation.z=side*.07;
    }
    ellipsoid(head,0,-.022,.167,.027,.038,.033,skin);box(head,0,-.080,.147,.064,.009,.012,palette.terracotta);
    const hairstyle=style?.hairstyle||((actor.gender==='f'||actor.gender==='female'||seed%3===0)?'long':'short');
    head.userData.hairstyle=hairstyle;
    if(hairstyle!=='bald'){
      mesh(head,hairGeometry,hair,0,.034,-.018,hairstyle==='curly'?.208:.184,hairstyle==='curly'?.235:.211,.17);
      const fringe=ellipsoid(head,-.044,.132,.103,.136,.067,.055,hair);fringe.rotation.z=.18;
      if(hairstyle==='bob'||hairstyle==='long'){
        for(const side of [-1,1])ellipsoid(head,side*.142,hairstyle==='long'?-.075:.005,-.055,.067,hairstyle==='long'?.235:.154,.126,hair);
        ellipsoid(head,0,hairstyle==='long'?-.075:.015,-.15,.151,hairstyle==='long'?.215:.14,.066,hair);
      }
      if(hairstyle==='curly')for(let i=0;i<12;i++){
        const angle=i*Math.PI*2/12;ellipsoid(head,Math.cos(angle)*.17,.09+Math.sin(i*2.4)*.06,Math.sin(angle)*.14-.016,.060,.072,.060,hair);
      }
    }
    if(actor.hat||accessory==='cap'||(actor.accessory===2&&!actor.isDJ)){
      const hat=material(actor.hatColor||(actor.accessory===2?'#cc3333':'#384f4a'),{roughness:.85},resources);
      if(actor.hat==='top-hat'){cylinder(head,0,.27,0,.155,.26,hat);cylinder(head,0,.156,0,.235,.025,hat);cylinder(head,0,.192,0,.158,.047,palette.coral);}
      else if(actor.hat==='beanie')ellipsoid(head,0,.15,-.014,.202,.119,.184,hat);
      else if(actor.hat==='tricorn'){box(head,0,.192,0,.40,.12,.27,hat);box(head,0,.145,0,.45,.032,.31,hat);}
      else{ellipsoid(head,0,.185,-.015,.20,.095,.176,hat);box(head,0,.175,.12,.29,.033,.22,hat);if(actor.hat==='hardhat')box(head,0,.254,0,.038,.035,.24,hat);}
    }
    if(accessory==='glasses'||actor.accessory===1||actor.accessory==='glasses'||actor.accessory==='gafas'){
      for(const side of [-1,1]){box(head,side*.062,.025,.168,.091,.07,.012,palette.black);box(head,side*.062,.025,.176,.068,.047,.009,palette.glass);}
      box(head,0,.029,.177,.043,.013,.015,palette.black);
    }
    // Collar, seams and a pocket remain visible at the store's normal zoom.
    if(outfit==='shirt'||outfit==='jacket'){
      for(const side of [-1,1]){const collar=box(body,side*.067,1.177,.13,.08,.048,.025,actor.kind==='staff'?palette.paper:cloth);collar.rotation.z=side*.35;}
      box(body,-.112,1.019,.139,.081,.082,.011,actor.kind==='staff'?palette.teal:cloth);box(body,-.112,1.06,.145,.082,.011,.008,palette.paper);
      if(style&&outfit==='shirt')for(let i=0;i<4;i++)ellipsoid(body,0,.90+i*.075,.142,.009,.009,.006,palette.paper);
    }
    if(style&&outfit==='jacket'){
      box(body,0,1.019,.14,.112,.335,.015,palette.paper);
      for(const side of [-1,1])box(body,side*.076,1.076,.15,.039,.213,.020,cloth).rotation.z=side*.20;
      box(body,0,.748,0,.439,.071,.292,cloth);
    }
    if(style&&outfit==='knit'){
      cylinder(body,0,1.205,0,.089,.059,cloth);
      for(const y of [.79,.87,.95])box(body,0,y,.139,.385,.015,.008,palette.cream);
    }
    body.userData.outfit=outfit;body.userData.accessory=accessory||'legacy';
    if(actor.kind==='staff'){
      box(body,0,.891,.142,.32,.39,.027,palette.teal);box(body,0,1.056,.144,.19,.17,.026,palette.teal);
      for(const x of [-.098,.098])box(body,x,1.13,.135,.028,.21,.022,palette.sage);
      box(body,0,.88,.159,.22,.12,.011,palette.sage);box(body,.11,1.095,.142,.055,.035,.014,palette.brass);
    }else if(actor.bag){
      // Clothing accessories are decoration, never inventory or customer state.
      box(body,.26,.66,-.025,.17,.30,.23,palette.terracotta);box(body,.25,.90,-.005,.024,.65,.03,palette.darkWood).rotation.z=-.14;
    }
    if(actor.skirt)mesh(body,coneGeometry,trousers,0,.66,0,.29,.37,.21);
    if(accessory==='backpack'){
      box(body,0,1.01,-.19,.31,.38,.17,trousers);box(body,0,.96,-.287,.23,.14,.035,cloth);
      for(const side of [-1,1])box(body,side*.13,1.055,.143,.027,.315,.023,trousers);
    }
    if(accessory==='headphones'||actor.isDJ||actor.accessory===3){
      for(const side of [-1,1])ellipsoid(head,side*.195,.02,0,.033,.07,.059,palette.black);
      box(head,0,.233,-.022,.35,.031,.08,palette.black);
    }
    if(accessory==='scarf'||actor.accessory===4){box(body,0,1.205,.12,.23,.067,.057,palette.coral);box(body,.07,1.10,.15,.065,.18,.035,palette.coral).rotation.z=.15;}
    if(actor.robot){
      // The live Unitree remains the same actor; a visor, joint shells and chest
      // panel distinguish its physical representation from human visitors.
      box(head,0,.025,.148,.29,.13,.075,palette.black);box(head,0,.025,.190,.16,.019,.009,palette.led);
      box(body,0,1.035,.154,.27,.26,.06,palette.steel);box(body,0,1.082,.189,.10,.022,.01,palette.led);
      for(const side of [-1,1])ellipsoid(body,side*.242,1.14,0,.097,.10,.10,palette.steel);
    }
    batch(head);
    actorMap.set(actor.id,root);
    if(assetQuality==='best'&&typeof loadPerson==='function'&&!actor.robot){
      root.userData.personAssetStatus='loading';
      // The async asset owns only its visual resources. The stable selectable
      // actor root continues to follow the one live game snapshot and clock.
      const isCurrent=()=>!disposed&&actorMap.get(actor.id)===root&&root.parent===actors;
      Promise.resolve().then(()=>isCurrent()?loadPerson(actor):null).then(asset=>{
        if(!asset){if(isCurrent())root.userData.personAssetStatus='fallback';return;}
        if(!isCurrent()){asset.dispose?.();return;}
        if(!asset.scene?.isObject3D||typeof asset.animate!=='function'||typeof asset.dispose!=='function'){
          asset.dispose?.();root.userData.personAssetStatus='fallback';return;
        }
        const fallback=root.userData.body;
        fallback.traverse(o=>{if(o.isInstancedMesh)o.dispose();});fallback.removeFromParent();release(root.userData.resources);
        root.userData.body=null;root.userData.head=null;root.userData.legs=[];root.userData.arms=[];
        root.add(asset.scene);root.userData.personAsset=asset;root.userData.personAssetStatus='ready';
      }).catch(()=>{if(isCurrent())root.userData.personAssetStatus='fallback';});
    }
    return root;
  }
  function removeActor(root){
    const asset=root.userData.personAsset;
    if(asset){root.userData.personAsset=null;asset.scene.removeFromParent();asset.dispose();}
    root.traverse(o=>{if(o.isInstancedMesh)o.dispose();});release(root.userData.resources);root.removeFromParent();
  }
  const armBounds=new T.Box3(),armWorld=new T.Vector3(),armShifted=new T.Vector3();
  function keepArmsClear(root){
    const {actor,arms,body}=root.userData;
    if(!body||actor.kind!=='customer'||!arms.length)return;
    // A visitor gently brings the offending arm towards their body when a
    // cabinet is close. Keep the original anatomy and free-space arm swing;
    // only adjust the shoulder pose, never the customer's floor coordinates.
    for(const arm of arms)arm.position.copy(arm.userData.restPosition);
    const reach=.8*root.scale.x;
    const furniture=customerNavigation.obstacles.filter(box=>root.position.x>=box.minCol-reach&&root.position.x<=box.maxCol+reach&&root.position.z>=box.minRow-reach&&root.position.z<=box.maxRow+reach);
    if(!furniture.length)return;
    root.updateWorldMatrix(true,true);
    const margin=.018,limit=.25;
    const intersects=(bounds,box,dx=0,dz=0)=>bounds.max.x+dx>box.minCol-margin&&bounds.min.x+dx<box.maxCol+margin&&bounds.max.z+dz>box.minRow-margin&&bounds.min.z+dz<box.maxRow+margin;
    for(const arm of arms){
      armBounds.setFromObject(arm);
      const nearby=furniture.filter(box=>intersects(armBounds,box));
      if(!nearby.length)continue;
      const candidates=[];
      for(const box of nearby){
        const left=box.minCol-margin-armBounds.max.x,right=box.maxCol+margin-armBounds.min.x;
        const back=box.minRow-margin-armBounds.max.z,front=box.maxRow+margin-armBounds.min.z;
        candidates.push([left,0],[right,0],[0,back],[0,front],[left,back],[left,front],[right,back],[right,front]);
      }
      candidates.sort((a,b)=>Math.hypot(...a)-Math.hypot(...b));
      const centerX=(armBounds.min.x+armBounds.max.x)/2-root.position.x,centerZ=(armBounds.min.z+armBounds.max.z)/2-root.position.z;
      const distanceFromBody=Math.hypot(centerX,centerZ);
      const shift=candidates.find(([dx,dz])=>Math.hypot(dx,dz)<=limit&&Math.hypot(centerX+dx,centerZ+dz)<=distanceFromBody+.015&&!furniture.some(box=>intersects(armBounds,box,dx,dz)));
      if(!shift)continue;
      arm.getWorldPosition(armWorld);armShifted.copy(armWorld);armShifted.x+=shift[0];armShifted.z+=shift[1];
      body.worldToLocal(armShifted);arm.position.copy(armShifted);arm.updateWorldMatrix(false,true);
    }
  }
  function updateActors(){
    const ids=new Set(snapshot.actors.map(a=>a.id));
    for(const [id,root]of actorMap)if(!ids.has(id)){removeActor(root);actorMap.delete(id);}
    for(const actor of snapshot.actors){
      let root=actorMap.get(actor.id);
      const appearance=a=>JSON.stringify([a.color,a.skin,a.kind,a.hair,a.pants,a.shoes,a.gender,a.age,a.hat,a.hatColor,a.accessory,a.skirt,a.isDJ,a.bag,a.robot,a.visitorProfileId,a.visitorStyle]);
      if(root&&appearance(root.userData.actor)!==appearance(actor)){
        removeActor(root);actorMap.delete(actor.id);root=null;
      }
      const fresh=!root;root=root||createActor(actor);
      const target=new T.Vector3(actor.col,0,actor.row);
      const customer=actor.kind==='customer'&&!actor.outside&&actor.col>=0&&actor.row>=0&&actor.row<=snapshot.rows&&actor.col<=snapshot.cols+1.5;
      if(customer){
        const track=root.userData.customerMotion ||= createCustomerMotion(actor,{navigation:customerNavigation,time:lastAnimationTime??0});
        const pose=track.update(actor,{navigation:customerNavigation,time:lastAnimationTime??0});
        root.visible=!!pose;root.userData.motion=null;
        if(pose){root.position.set(pose.col,0,pose.row);root.rotation.y=pose.heading;}
      }else if(fresh||root.position.distanceTo(target)>3){
        root.userData.customerMotion=null;root.visible=true;
        root.position.copy(target);root.rotation.y=actor.heading;root.userData.motion=null;
      }else{
        root.userData.customerMotion=null;root.visible=true;
        const previous=root.userData.motion;
        if(!previous||!previous.target.equals(target)||previous.targetHeading!==actor.heading){
          root.userData.motion={from:root.position.clone(),target,fromHeading:root.rotation.y,targetHeading:actor.heading,start:lastAnimationTime};
        }
      }
      root.scale.setScalar(actor.scale);root.userData.actor=actor;keepArmsClear(root);
    }
  }

  const hemisphere=new T.HemisphereLight('#e9f3ff','#827251',2.0);scene.add(hemisphere);
  const sun=new T.DirectionalLight('#ffe4bc',3.25);sun.position.set(4,12,8);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
  sun.shadow.normalBias=.035;sun.shadow.bias=-.00015;sun.shadow.radius=3;scene.add(sun,sun.target);
  const fill=new T.DirectionalLight('#c5e1e9',.7);fill.position.set(-5,7,-2);scene.add(fill);
  const rim=new T.DirectionalLight('#ffe6ae',.8);rim.position.set(8,5,-5);scene.add(rim);
  function setLighting(value='day'){
    if(disposed)return;lighting=['day','sunset','night'].includes(value)?value:'day';
    const settings={day:{bg:'#dce4db',sky:'#ecf4ff',ground:'#87745a',hemi:2,sun:'#ffe6c2',power:3.15,fill:.72,rim:.7,glow:.62},sunset:{bg:'#d9c6b8',sky:'#f6ddcd',ground:'#815e5f',hemi:1.3,sun:'#ffb77a',power:3.1,fill:.45,rim:1.0,glow:1.0},night:{bg:'#182e39',sky:'#afcbdc',ground:'#304344',hemi:.8,sun:'#b4cffa',power:.55,fill:.3,rim:.48,glow:1.7}}[lighting];
    scene.background=new T.Color(settings.bg);groundMaterial.color.set(settings.bg);hemisphere.color.set(settings.sky);hemisphere.groundColor.set(settings.ground);hemisphere.intensity=settings.hemi;
    sun.color.set(settings.sun);sun.intensity=settings.power;fill.intensity=settings.fill;rim.intensity=settings.rim;palette.light.emissiveIntensity=settings.glow;palette.led.emissiveIntensity=lighting==='night'?1.6:.85;
    for(const light of fixtureLights)light.intensity=lighting==='night'?light.userData.nightIntensity:lighting==='sunset'?1.15:light.userData.dayIntensity;
    const c=snapshot.cols;sun.position.set(lighting==='sunset'?c+8:c*.3,lighting==='sunset'?7:13,lighting==='sunset'?snapshot.rows+7:snapshot.rows+4);
  }
  function update(raw){
    if(disposed)return snapshot;
    snapshot=normalizeLifeSnapshot(raw);
    // The Canvas2D projection is deliberately absent from this signature. Orbit,
    // resize and editor zoom must never skew or rebuild genuine 3D furniture.
    const next=JSON.stringify([snapshot.cols,snapshot.rows,snapshot.wallHeight,snapshot.moving,snapshot.layout]);
    if(next!==signature){
      customerNavigation=buildCustomerNavigation(snapshot,{allowOutside:true});
      release(worldResources);world.traverse(o=>{if(o.isInstancedMesh)o.dispose();});world.clear();fixtureLights.length=0;doors.length=0;
      if(!inventory)architecture();for(const item of snapshot.layout)furniture(item);signature=next;
      ground.visible=!inventory;ground.position.set(snapshot.cols/2,-.565,snapshot.rows/2);ground.scale.set(500,500,1);
      sun.target.position.set(snapshot.cols/2,0,snapshot.rows/2);
      const extent=Math.max(snapshot.cols,snapshot.rows)*.82+3;Object.assign(sun.shadow.camera,{left:-extent,right:extent,top:extent,bottom:-extent,near:.1,far:70});sun.shadow.camera.updateProjectionMatrix();
      setLighting(lighting);
    }
    for(const door of doors)door.rotation.y=-snapshot.doorOpen*Math.PI*.48;
    updateActors();return snapshot;
  }
  function animate(timeMs=0){
    if(disposed)return;
    const time=Number.isFinite(timeMs)?timeMs:0;
    lastAnimationTime=time;
    for(const root of actorMap.values()){
      const {actor,body,head,legs,arms,seed,customerMotion}=root.userData;
      const customerPose=customerMotion?.advance(time);
      if(customerMotion){
        root.visible=!!customerPose;
        if(!customerPose)continue;
        root.position.set(customerPose.col,0,customerPose.row);root.rotation.y=customerPose.heading;
      }
      const phase=customerPose?customerPose.phase*Math.PI*2:time*.0085+(seed%100)*.11;
      // Smooth only the displayed pose between incoming snapshots. The source
      // positions, heading, clock, routes and counters are never advanced here.
      const motion=root.userData.motion;
      if(motion){
        if(motion.start===null||time<motion.start)motion.start=time;
        const t=Math.max(0,Math.min(1,(time-motion.start)/100));
        root.position.lerpVectors(motion.from,motion.target,t);
        const turn=Math.atan2(Math.sin(motion.targetHeading-motion.fromHeading),Math.cos(motion.targetHeading-motion.fromHeading));
        root.rotation.y=motion.fromHeading+turn*t;
      }
      const walking=customerPose?customerPose.walking:actor.walking;
      if(root.userData.personAsset){root.userData.personAsset.animate(time,customerPose?{...actor,walking}:actor,{position:root.position,heading:root.rotation.y});continue;}
      const walk=walking?1:0;body.position.y=walk?Math.abs(Math.sin(phase))*.018:Math.sin(time*.0017+seed)*.006;
      body.rotation.z=walk?Math.sin(phase)*.016:0;head.rotation.y=walk?0:Math.sin(time*.0007+seed)*.075;
      legs.forEach((leg,i)=>{const stride=Math.sin(phase+i*Math.PI);leg.rotation.x=stride*.40*walk;leg.userData.knee.rotation.x=Math.max(0,-stride)*.48*walk;});
      arms.forEach((arm,i)=>{arm.rotation.x=-Math.sin(phase+i*Math.PI)*.33*walk;arm.userData.elbow.rotation.x=-.13-Math.max(0,Math.sin(phase+i*Math.PI))*.14*walk;});
      keepArmsClear(root);
    }
  }
  function refreshMedia(player){
    if(disposed||!mediaContext)return;
    const c=mediaContext,w=512,h=768;c.clearRect(0,0,w,h);
    if(player&&typeof player.draw==='function')player.draw(c,w,h);
    else{
      c.fillStyle='#214f4c';c.fillRect(0,0,w,h);c.fillStyle='#d9b974';c.beginPath();c.arc(256,262,92,0,Math.PI*2);c.fill();
      c.fillStyle='#f5eedb';c.textAlign='center';c.font='600 57px sans-serif';c.fillText('ADMIRA',256,438);c.font='22px sans-serif';c.fillText('UN ESPACIO CON VIDA',256,489);c.fillStyle='#a5c2ae';c.fillRect(99,555,314,2);
    }
    mediaTexture.needsUpdate=true;
  }
  function dispose(){
    if(disposed)return;disposed=true;
    for(const root of actorMap.values())removeActor(root);
    scene.traverse(o=>{if(o.isInstancedMesh)o.dispose();});
    release(worldResources);release(sharedResources);sun.shadow.dispose();scene.clear();actorMap.clear();fixtureLights.length=0;doors.length=0;
  }
  update(snapshot);refreshMedia(null);
  return {scene,world,actors,update,animate,refreshMedia,setLighting,dispose,
    get snapshot(){return snapshot;},get lighting(){return lighting;},
    get resources(){return {geometry:geometry.size,materials:materials.size,textures:textures.size};}
  };
}
