export function drawCampaign(canvas,c,i,plan,assets,{guides=false}={}){
 const x=canvas.getContext('2d'),scale=canvas.width/i.width;canvas.height=Math.round(i.height*scale);x.save();x.scale(scale,scale);
 x.fillStyle=c.background;x.fillRect(0,0,i.width,i.height);
 x.save();x.beginPath();i.screens.forEach(s=>x.rect(s.x,s.y,s.w,s.h));x.clip();
 const g=x.createLinearGradient(0,i.height,i.width,0);g.addColorStop(0,c.background);g.addColorStop(1,c.accent+'38');x.fillStyle=g;x.fillRect(0,0,i.width,i.height);
 x.strokeStyle=c.accent+'35';x.lineWidth=Math.min(i.width,i.height)*.003;
 for(let n=-5;n<12;n++){x.beginPath();x.moveTo(n*i.width/8,0);x.lineTo(n*i.width/8+i.height*.65,i.height);x.stroke();}
 const contain=(image,r)=>{if(!image)return;const k=Math.min(r.w/image.naturalWidth,r.h/image.naturalHeight);x.drawImage(image,r.x+(r.w-image.naturalWidth*k)/2,r.y+(r.h-image.naturalHeight*k)/2,image.naturalWidth*k,image.naturalHeight*k);};
 for(const l of plan.layers){
  if(l.role==='product'||l.role==='echo'){const p=l.role==='echo'?{...l,x:l.x+l.w*.1,y:l.y+l.h*.1,w:l.w*.8,h:l.h*.8}:l;x.globalAlpha=l.role==='echo'?.55:1;contain(assets.product,p);x.globalAlpha=1;}
  else if(l.role==='logo')contain(assets.logo,l);
  else {x.font=`${l.role==='headline'?'900':'600'} ${l.px}px 'Campaign Sans',sans-serif`;x.fillStyle=l.role==='headline'?c.foreground:c.accent;x.textBaseline='top';l.lines.forEach((line,n)=>x.fillText(line,l.x,l.y+n*l.lineHeight));}
 }
 x.restore();
 for(const mask of i.masks||[]){x.fillStyle='#040907';x.fillRect(mask.x,mask.y,mask.w,mask.h);}
 if(guides){x.strokeStyle='#74ffb7';x.lineWidth=2/scale;i.screens.forEach(s=>x.strokeRect(s.x,s.y,s.w,s.h));x.setLineDash([5/scale,5/scale]);x.strokeStyle='#ffcc6b';plan.layers.filter(l=>l.role!=='echo').forEach(l=>x.strokeRect(l.x,l.y,l.w,l.h));}
 x.restore();return canvas;
}
export function panelCanvas(master,s){
 const canvas=document.createElement('canvas'),rot=s.rotation||0;canvas.width=rot%180?s.h:s.w;canvas.height=rot%180?s.w:s.h;const x=canvas.getContext('2d');
 x.translate(canvas.width/2,canvas.height/2);x.rotate(-rot*Math.PI/180);x.drawImage(master,s.x,s.y,s.w,s.h,-s.w/2,-s.h/2,s.w,s.h);return canvas;
}
