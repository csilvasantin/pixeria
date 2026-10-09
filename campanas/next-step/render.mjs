// NEXT STEP: one authored timeline; seven compositions, each with its own pixel map.
export const DURATION=32;
const screen=(id,x,y,w,h)=>({id,x,y,w,h,rotation:0});
export const INSTALLATIONS=[
 {id:'landscape',name:{es:'LCD gigante',en:'Giant LCD'},width:1920,height:1080,screens:[screen('lcd',0,0,1920,1080)]},
 {id:'portrait',name:{es:'Entrada',en:'Entrance'},width:1080,height:1920,screens:[screen('entrance',0,0,1080,1920)]},
 {id:'jordan',name:{es:'Videowall Jordan',en:'Jordan videowall'},width:2892,height:2066,approximate:true,screens:[screen('jordan-1',0,0,540,1360),screen('jordan-2',588,0,540,1706),screen('jordan-3',1176,0,540,2066),screen('jordan-4',1764,0,540,1706),screen('jordan-5',2352,0,540,1360)]},
 {id:'rear',name:{es:'LED del fondo',en:'Rear LED'},width:2880,height:2304,approximate:true,screens:[screen('rear-left',0,0,1080,2304),screen('rear-top',1080,0,720,756),screen('rear-right',1800,0,1080,2304)],masks:[{id:'door',x:1080,y:756,w:720,h:1548}]},
 {id:'strip',name:{es:'Tira panorámica',en:'Panoramic strip'},width:3840,height:600,approximate:true,screens:[screen('strip',0,0,3840,600)]},
 {id:'column',name:{es:'Columna LED',en:'LED column'},width:320,height:1920,approximate:true,screens:[screen('column',0,0,320,1920)]},
 {id:'tablet',name:{es:'iPad de entrada',en:'Entrance iPad'},width:1080,height:1440,approximate:true,screens:[screen('tablet',0,0,1080,1440)]}
];
export function cue(seconds,en=false){const phase=Math.floor(((seconds%DURATION)+DURATION)%DURATION/8);return {phase,title:['NEXT STEP','DEFY GRAVITY','FIND YOUR PACE',en?'MAKE YOUR MOVE':'DA EL PASO'][phase],caption:(en?['YOUR NEXT VERSION STARTS HERE','DESIGNED TO STAND OUT','THE CITY IS YOUR RUNWAY','STEP INSIDE. TRY SOMETHING NEW.']:['TU PRÓXIMA VERSIÓN EMPIEZA AQUÍ','DISEÑADO PARA SALIR DE LO DE SIEMPRE','LA CIUDAD ES TU PASARELA','ENTRA. PRUÉBATE ALGO DIFERENTE.'])[phase]};}
export function drawNextStep(canvas,i,product,seconds=0,en=false){
 const x=canvas.getContext('2d'),w=i.width,h=i.height,scale=canvas.width/w;const targetH=Math.round(h*scale);if(canvas.height!==targetH)canvas.height=targetH;
 x.save();x.scale(scale,scale);x.fillStyle='#080a0e';x.fillRect(0,0,w,h);
 const time=((seconds%DURATION)+DURATION)%DURATION,{phase,title,caption}=cue(time,en),short=Math.min(w,h),lime='#d9ff43',white='#f4f3ec',cyan='#73d8ff';
 const glow=x.createRadialGradient(w*(.62+.08*Math.sin(time*.18)),h*.46,0,w*.62,h*.46,w*.7);glow.addColorStop(0,phase===2?'#263c3b':'#232c44');glow.addColorStop(.5,'#101a25');glow.addColorStop(1,'#080a0e');x.fillStyle=glow;x.fillRect(0,0,w,h);
 x.strokeStyle='#9bdfff15';x.lineWidth=Math.max(1,short*.001);for(let n=0;n<15;n++){const yy=(n*h/12+time*h*.013)%h;x.beginPath();x.moveTo(0,yy);x.lineTo(w,yy-h*.3);x.stroke();}
 x.save();x.translate(w*.65,h*.55);x.rotate(-.28);for(let n=1;n<6;n++){x.strokeStyle=n===3?'#d9ff4350':'#73d8ff18';x.lineWidth=short*.002;x.beginPath();x.ellipse(0,0,w*(.18+n*.045),h*(.15+n*.02),0,0,Math.PI*2);x.stroke();}x.restore();
 function text(s,xx,yy,size,color=white,align='left',weight=900){x.fillStyle=color;x.textAlign=align;x.textBaseline='top';x.font=`${weight} ${size}px "NextStep",sans-serif`;x.fillText(s,xx,yy);}
 function fit(s,xx,yy,max,size,color=white,align='left',weight=900){x.font=`${weight} ${size}px "NextStep",sans-serif`;const px=Math.min(size,size*max/Math.max(1,x.measureText(s).width));text(s,xx,yy,px,color,align,weight);}
 function shoe(xx,yy,ww,hh,angle=-.1){if(!product)return;const k=Math.min(ww/product.width,hh/product.height),sw=product.width*k,sh=product.height*k;x.save();x.translate(xx+ww/2,yy+hh/2+Math.sin(time*.65)*short*.018);x.rotate(angle+Math.sin(time*.23)*.025);x.drawImage(product,-sw/2,-sh/2,sw,sh);x.restore();}
 const margin=short*.065;
 if(i.id==='jordan'){
   shoe(w*.13,h*.1,w*.72,h*.79,-.05);
   ['NEXT','STEP','/ 19','YOUR','MOVE'].forEach((word,n)=>{const s=i.screens[n];fit(word,s.x+s.w/2,s.h-h*.12,s.w*.86,h*.08,n===2?lime:white,'center');});
   fit('SNEAKER STORE',w/2,h*.035,i.screens[2].w*.85,h*.037,lime,'center',600);
 }else if(i.id==='rear'){
   fit('NEXT',w*.035,h*.22,w*.31,h*.12);fit('STEP',w*.035,h*.34,w*.31,h*.12,lime);
   fit(en?'YOUR NEXT VERSION':'TU PRÓXIMA VERSIÓN',w*.035,h*.53,w*.3,h*.022,white,'left',600);
   shoe(w*.63,h*.23,w*.35,h*.47,-.24);
   fit('SS / 19',w*.5,h*.11,w*.22,h*.06,lime,'center');
   fit(en?'MAKE YOUR MOVE':'DA EL PASO',w*.81,h*.75,w*.32,h*.035,white,'center');
   for(const mask of i.masks||[]){x.fillStyle='#050609';x.fillRect(mask.x,mask.y,mask.w,mask.h);}
 }else if(i.id==='column'){
   for(const [n,c]of [...'NEXT'].entries())text(c,w/2,h*.065+n*h*.085,w*.68,lime,'center');
   shoe(w*.03,h*.48,w*.94,h*.18,-.15);for(const [n,c]of [...'STEP'].entries())text(c,w/2,h*.69+n*h*.066,w*.55,white,'center');
 }else if(i.id==='strip'){
   fit(phase===0?'NEXT STEP':title,w*.035,h*.2,w*.5,h*.45,lime);
   shoe(w*.5,-h*.04,w*.29,h*1.12,-.06);fit('SANTA ROSA / 19',w*.96,h*.32,w*.17,h*.11,white,'right',600);
 }else if(w<h){
   text('SNEAKER STORE / 19',margin,margin,short*.032,lime,'left',600);
   fit(phase===0?'NEXT':phase===1?'DEFY':phase===2?'FIND YOUR':en?'MAKE YOUR':'DA EL',margin,h*.15,w-margin*2,short*.22);
   fit(phase===0?'STEP':phase===1?'GRAVITY':phase===2?'PACE':en?'MOVE':'PASO',margin,h*.15+short*.22,w-margin*2,short*.22,lime);
   shoe(-w*.06,h*.37,w*1.12,h*.34,-.22);
   fit(caption,margin,h*.79,w-margin*2,short*.038,white,'left',600);
   fit(en?'STEP INSIDE →':'ENTRA Y DESCUBRE →',margin,h*.9,w-margin*2,short*.055,lime);
 }else{
   text('SNEAKER STORE  /  BARCELONA  /  19',margin,margin,short*.029,lime,'left',600);
   const words=phase===0?['NEXT','STEP']:phase===1?['DEFY','GRAVITY']:phase===2?['FIND YOUR','PACE']:en?['MAKE YOUR','MOVE']:['DA EL','PASO'];
   fit(words[0],margin,h*.25,w*.49,short*.205);fit(words[1],margin,h*.25+short*.205,w*.49,short*.205,lime);
   shoe(w*.43,h*.1,w*.58,h*.78,-.12);fit(caption,margin,h*.79,w*.84,short*.035,white,'left',600);
 }
 if(i.id!=='column'&&i.id!=='jordan'&&i.id!=='rear'){x.fillStyle=lime;x.fillRect(margin,h-margin*.6,(w-margin*2)*(time/DURATION),Math.max(2,short*.002));}
 x.restore();return canvas;
}
export async function loadNextStepAssets(base=new URL('./',import.meta.url)){
 const image=new Image();image.src=new URL('product.webp',base).href;const font=new FontFace('NextStep',`url(${new URL('display.ttf',base)})`,{weight:'100 900'});document.fonts.add(font);await Promise.all([image.decode(),font.load()]);return image;
}
export function createClock(now=()=>performance.now()/1000){let start=now(),held=0,paused=false;return{time:()=>paused?held:now()-start,pause(){held=this.time();paused=true;},play(){if(paused){start=now()-held;paused=false;}},restart(){start=now();held=0;},get paused(){return paused;}};}
