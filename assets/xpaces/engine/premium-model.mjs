// Renderer input only. No game state, passage counter or media owner lives here.
const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
export function normalizeProjection(raw){
  if(!raw||!['width','height','ox','oy','tileW','tileH'].every(k=>Number.isFinite(Number(raw[k]))))return null;
  const p=Object.fromEntries(['width','height','ox','oy','tileW','tileH'].map(k=>[k,Number(raw[k])]));
  if(p.width<=0||p.height<=0||p.tileW<=0||p.tileH<=0||p.tileH>=p.tileW)return null;
  return p;
}
export const FOOTPRINTS=Object.freeze({counter:[1,2],shelves:[1,2],wineRack:[2,1],lottery:[2,1],vending:[1,1],magazines:[2,1],manager:[2,1],plant:[1,1],floorLamp:[1,1],rug:[2,2],djBooth:[2,1],tablet:[1,1],turnKiosk:[1,1],aroma:[1,1],metahuman:[1,1]});
export function normalizeSnapshot(raw={}){
  const cols=clamp(finite(raw.cols,14),4,40),rows=clamp(finite(raw.rows,8),4,40);
  return {
    cols,rows,wallHeight:clamp(finite(raw.wallHeight,3.25),1.5,10),elevation:clamp(finite(raw.elevation,.46),.2,1.2),
    doorOpen:clamp(finite(raw.doorOpen),0,1),time:finite(raw.time),projection:normalizeProjection(raw.projection),
    layout:(Array.isArray(raw.layout)?raw.layout:[]).slice(0,300).filter(Boolean).map((item,i)=>({
      id:String(item.id??`furniture-${i}`),type:String(item.type||'custom'),col:finite(item.col),row:finite(item.row),
      sx:clamp(finite(item.sx,1),.1,8),sy:clamp(finite(item.sy,1),.1,8),rot:finite(item.rot),flipX:!!item.flipX,
      label:String(item.label||''),fp:Array.isArray(item.fp)?item.fp.slice(0,2).map(v=>clamp(finite(v,1),.1,10)):null,
      ph:clamp(finite(item.ph,1.1),.1,8),wallY:finite(item.wallY,2.2)
    })),
    actors:(Array.isArray(raw.actors)?raw.actors:[]).slice(0,200).filter(Boolean).map((actor,i)=>({
      id:String(actor.id??`actor-${i}`),col:finite(actor.col),row:finite(actor.row),kind:String(actor.kind||'customer'),
      color:typeof actor.color==='string'?actor.color:'#407e8c',skin:typeof actor.skin==='string'?actor.skin:'#c8916d',
      heading:finite(actor.heading),walking:!!actor.walking
    }))
  };
}
export function layoutSignature(snapshot){return JSON.stringify([snapshot.cols,snapshot.rows,snapshot.wallHeight,snapshot.layout,snapshot.projection?[snapshot.projection.tileW,snapshot.projection.tileH]:null]);}
export function actorGridPosition(x,y,iso,footOffset=0){
  const dx=(finite(x)-iso.ox)/(iso.tileW/2),dy=(finite(y)+footOffset-iso.oy)/(iso.tileH/2);
  return {col:(dx+dy)/2,row:(dy-dx)/2};
}
