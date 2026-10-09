// Native, authored compositions. The same seed and clock drive every wall and preview.
export function drawCreatorCampaign(canvas,i,product,seconds,c,background=null){
 const x=canvas.getContext('2d'),w=i.width,h=i.height,k=canvas.width/w,short=Math.min(w,h),time=seconds%32,phase=Math.floor(time/8);
 const ht=Math.round(h*k);if(canvas.height!==ht)canvas.height=ht;x.save();x.scale(k,k);x.fillStyle=c.background;x.fillRect(0,0,w,h);if(background)x.drawImage(background,0,0,w,h);
 const glow=x.createRadialGradient(w*.7,h*.45,0,w*.7,h*.45,w*.8);glow.addColorStop(0,c.accent+'48');glow.addColorStop(1,background?c.background+'55':c.background);x.fillStyle=glow;x.fillRect(0,0,w,h);
 x.save();x.strokeStyle=c.secondary+'30';x.lineWidth=Math.max(2,short*.003);
 if(c.motif===0){for(let n=0;n<11;n++){x.beginPath();x.ellipse(w*.68,h*.5,(n+2)*w*.055,(n+2)*h*.065,-.2+time*.008,0,Math.PI*2);x.stroke();}}
 else if(c.motif===1){for(let n=0;n<16;n++){const xx=(n*w/12+time*w*.009)%w;x.beginPath();x.moveTo(xx-h*.4,0);x.lineTo(xx,h);x.stroke();}}
 else {for(let n=0;n<13;n++){const yy=(n*h/10+time*h*.012)%h;x.beginPath();x.moveTo(0,yy);x.bezierCurveTo(w*.25,yy-h*.2,w*.75,yy+h*.2,w,yy);x.stroke();}}
 x.restore();
 function fit(text,xx,yy,max,px,color=c.foreground,align='left'){if(text===c.headline||text===c.name||c.name.split(' ').includes(text))px*=c.titleScale||1;x.font=`900 ${px}px "NextStep",sans-serif`;px=Math.min(px,px*max/Math.max(x.measureText(text).width,1));x.font=`900 ${px}px "NextStep",sans-serif`;x.fillStyle=color;x.textAlign=align;x.textBaseline='top';x.fillText(text,xx,yy);}
 function shoe(xx,yy,ww,hh){if(!product)return;const pw=product.videoWidth||product.naturalWidth||product.width,ph=product.videoHeight||product.naturalHeight||product.height;if(!pw||!ph)return;const r=Math.min(ww/pw,hh/ph);if(c.mode==='full'){x.drawImage(product,xx+(ww-pw*r)/2,yy+(hh-ph*r)/2,pw*r,ph*r);return;}x.save();x.translate(xx+ww/2,yy+hh/2+Math.sin(time*.6)*short*.015);x.rotate(c.angle+Math.sin(time*.2)*.04);x.drawImage(product,-product.width*r/2,-product.height*r/2,product.width*r,product.height*r);x.restore();}
 const words=c.name.split(' '),title=phase%2===0?c.name:c.headline;
 if(i.id==='jordan'){
  shoe(w*.07,h*.07,w*.88,h*.69);
  i.screens.forEach((s,n)=>{fit(n%2?words[1]:words[0],s.x+s.w/2,s.h-h*.12,s.w*.86,h*.07,n%2?c.accent:c.foreground,'center');});fit('SNEAKER XTORE',w/2,h*.02,i.screens[2].w*.86,h*.025,c.accent,'center');
 }else if(i.id==='rear'){
  fit(words[0],w*.03,h*.25,w*.32,h*.12);fit(words[1],w*.03,h*.37,w*.32,h*.12,c.accent);fit(c.headline,w*.03,h*.57,w*.32,h*.026);shoe(w*.63,h*.25,w*.35,h*.42);fit('SNEAKER XTORE',w*.5,h*.12,w*.22,h*.038,c.accent,'center');fit(c.cta,w*.81,h*.76,w*.32,h*.026,c.foreground,'center');for(const m of i.masks||[]){x.fillStyle='#050609';x.fillRect(m.x,m.y,m.w,m.h);}
 }else if(i.id==='column'){
  fit(words[0],w/2,h*.06,w*.85,w*.2,c.accent,'center');shoe(w*.03,h*.2,w*.94,h*.49);fit(words[1],w/2,h*.77,w*.85,w*.2,c.foreground,'center');fit('XTORE',w/2,h*.9,w*.86,w*.12,c.secondary,'center');
 }else if(i.id==='strip'){
  fit(title,w*.025,h*.2,w*.5,h*.42,c.accent);shoe(w*.52,-h*.05,w*.29,h*1.1);fit('SNEAKER XTORE',w*.98,h*.34,w*.16,h*.085,c.foreground,'right');
 }else if(w<h){
  fit('SNEAKER XTORE',w*.06,h*.035,w*.88,w*.045,c.accent);fit(words[0],w*.06,h*.15,w*.88,w*.22);fit(words[1],w*.06,h*.15+w*.22,w*.88,w*.22,c.accent);shoe(-w*.03,h*.36,w*1.06,h*.38);fit(c.headline,w*.06,h*.8,w*.88,w*.054);fit(c.cta,w*.06,h*.91,w*.88,w*.037,c.accent);
 }else{
  fit('SNEAKER XTORE / SANTA ROSA 19',short*.06,h*.055,w*.6,short*.026,c.accent);fit(words[0],short*.06,h*.25,w*.40,short*.21);fit(words[1],short*.06,h*.25+short*.21,w*.40,short*.21,c.accent);shoe(w*.48,h*.09,w*.50,h*.73);fit(c.headline,short*.06,h*.8,w*.85,short*.052);fit(c.cta,short*.06,h*.91,w*.85,short*.024,c.secondary);
 }
 x.restore();return canvas;
}
