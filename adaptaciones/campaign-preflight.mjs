// The review uses the same plan and font as the exported canvas; no AI requests.
const inside=(a,b)=>a.x>=b.x-1&&a.y>=b.y-1&&a.x+a.w<=b.x+b.w+1&&a.y+a.h<=b.y+b.h+1;
const intersects=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
const normalized=s=>String(s||'').trim().replace(/\s+/g,' ');
const luminance=hex=>{const rgb=hex.slice(1).match(/../g).map(n=>parseInt(n,16)/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};
export function contrastRatio(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
export function reviewPlan(c,i,plan,measureInk=(text,px)=>({width:text.length*px*.59})){
 const issues=[],seen=new Set(),add=(code,role='',screen='',warning=false)=>{const key=[code,role,screen,warning].join(':');if(!seen.has(key)){seen.add(key);issues.push({code,role,screen,warning});}};
 for(const error of plan.errors||[]){const [code,role]=error.split(':');add(code,role);}
 const visible=rect=>i.screens.some(s=>inside(rect,s))&&!(i.masks||[]).some(m=>intersects(rect,m));
 const screenFor=l=>i.screens.filter(s=>intersects(l,s)).map(s=>s.id).join(', ');
 const textLayers=plan.layers.filter(l=>typeof l.text==='string');
 // A missing layer must never turn a truncated/omitted message into a passing review.
 if(!c.wallStory&&!c.journeyStory)for(const role of ['headline','cta','price'])if(normalized(c[role])&&!issues.some(x=>x.role===role)){const matching=textLayers.filter(l=>l.role===role);if(!matching.length)add('text-missing',role);else if(matching.some(l=>normalized(l.text)!==normalized(c[role])))add('text-incomplete',role);}
 for(const l of textLayers){
  const screen=screenFor(l),lines=l.lines;
  if(!Array.isArray(lines)||!lines.length||normalized(lines.join(' '))!==normalized(l.text)){add('text-incomplete',l.role,screen);continue;}
  if(!Number.isFinite(l.px)||l.px<=0||!Number.isFinite(l.lineHeight)||l.lineHeight<=0||lines.length*l.lineHeight>l.h+1)add('text-overflow',l.role,screen);
  if(!visible(l))add('text-cut',l.role,screen);
  lines.forEach((line,n)=>{
   const m=measureInk(line,l.px,l.role),left=m.actualBoundingBoxLeft||0,right=m.actualBoundingBoxRight??m.width;
   const top=m.actualBoundingBoxAscent===undefined?0:-m.actualBoundingBoxAscent,bottom=m.actualBoundingBoxDescent??l.px;
   const ink={x:l.x-left,y:l.y+n*l.lineHeight+top,w:left+right,h:bottom-top};
   if(m.width>l.w+1)add('text-overflow',l.role,screen);
   if(!visible(ink))add('text-cut',l.role,screen);
  });
  if(contrastRatio(c.visualStyle==='eink-poster'&&l.role==='headline'?'#111111':l.role==='headline'?c.foreground:c.accent,c.visualStyle==='eink-poster'?'#ffffff':c.background)<3)add('text-contrast',l.role,screen,true);
 }
 const errors=issues.filter(x=>!x.warning).map(x=>[x.code,x.role,x.screen].filter(Boolean).join(':'));
 return {...plan,valid:plan.valid&&errors.length===0,errors:[...new Set(errors)],issues,textCount:textLayers.length};
}
export const formatKind=i=>i.screens.length>1?'segmented':i.height>i.width?'portrait':'landscape';
