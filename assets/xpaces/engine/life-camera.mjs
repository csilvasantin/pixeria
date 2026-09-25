const finite=Number.isFinite;
const positive=value=>finite(value)&&value>0;

/** Good's toIso(): X=ox+(col-row)*tileW/2, Y=oy+(col+row)*tileH/2.
 * With Three world (x,y,z)=(col,height,row), a camera at +X,+Z has screen-right
 * (1,0,-1)/sqrt(2) and screen-up (-sin(e),sqrt(2)*cos(e),-sin(e))/sqrt(2).
 * Thus pixelsPerUnit=tileW/sqrt(2), sin(e)=tileH/tileW (not tan(e)).
 * The optional frustum contains the same logical Canvas rectangle; extra room
 * in a differently shaped viewport is letterboxing, not a new scene crop.
 * This registers positions, not the silhouettes of interpreted 3D furniture.
 */
export function mappedCameraFrame(snapshot={},width=1,height=1){
  const p=snapshot.projection;
  const hasTiles=p&&positive(p.tileW)&&positive(p.tileH)&&p.tileH<p.tileW;
  const elevation=hasTiles?Math.asin(p.tileH/p.tileW)
    :finite(snapshot.elevation)&&snapshot.elevation>0&&snapshot.elevation<Math.PI/2?snapshot.elevation:Math.asin(28/80);
  const cols=positive(snapshot.cols)?snapshot.cols:14,rows=positive(snapshot.rows)?snapshot.rows:8;
  const target={x:cols/2,y:.65,z:rows/2},angle=Math.PI/4,radius=Math.hypot(cols,rows)*2.8;
  const position={x:target.x+Math.cos(angle)*Math.cos(elevation)*radius,y:target.y+Math.sin(elevation)*radius,z:target.z+Math.sin(angle)*Math.cos(elevation)*radius};
  const result={angle,elevation,target,position,frustum:null,registration:'room-fit'};
  if(!hasTiles||!positive(p.width)||!positive(p.height)||!finite(p.ox)||!finite(p.oy))return result;
  const pixelsPerUnit=p.tileW/Math.SQRT2;
  const targetRight=(target.x-target.z)/Math.SQRT2;
  const targetUp=-(target.x+target.z)*Math.sin(elevation)/Math.SQRT2+target.y*Math.cos(elevation);
  const centerX=(p.width/2-p.ox)/pixelsPerUnit-targetRight;
  const centerY=(p.oy-p.height/2)/pixelsPerUnit-targetUp;
  const aspect=(positive(width)?width:1)/(positive(height)?height:1);
  const vertical=Math.max(p.height,p.width/aspect)/pixelsPerUnit,horizontal=vertical*aspect;
  return {...result,registration:'good-canvas-contain',pixelsPerUnit,source:{width:p.width,height:p.height,ox:p.ox,oy:p.oy,tileW:p.tileW,tileH:p.tileH},
    frustum:{left:centerX-horizontal/2,right:centerX+horizontal/2,top:centerY+vertical/2,bottom:centerY-vertical/2}};
}
