// Presentation-only pursuit of an existing customer's observed positions.
// Navigation, movement, turns and gait share one continuous, collision-safe path.
// The simulation's positions, state, destinations and clock are never written.
const finite=Number.isFinite;
const distance=(a,b)=>Math.hypot(a.col-b.col,a.row-b.row);
const point=a=>({col:a.col,row:a.row});
const angle=a=>Math.atan2(Math.sin(a),Math.cos(a));
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));

export function createCustomerMotion(actor,{navigation,time=0}={}){
  let nav=navigation,pose=null,target=null,route=[],lastTime=finite(time)?time:0,lastObserved=lastTime,lastSource=null;
  let preferredSpeed=1.6,speed=0,phase=0,heading=finite(actor?.heading)?actor.heading:0,relocated=false,blocked=false;
  const valid=a=>a&&finite(a.col)&&finite(a.row);
  const seed=Array.from(String(actor?.id||'visitor')).reduce((h,c)=>Math.imul(h^c.charCodeAt(0),16777619)>>>0,2166136261);
  phase=(seed%997)/997;
  function publish(moved=null){
    if(!pose)return null;
    if(moved!==null)Object.assign(pose,{walking:moved>.000001,speed:moved>0?speed:0,distance:moved});
    Object.assign(pose,{heading,phase,blocked,relocated});
    return {...pose};
  }
  function update(next,{navigation:nextNav=nav,time:now=lastTime}={}){
    if(!valid(next)||!nextNav)return publish();
    const changed=nav?.key!==nextNav.key;nav=nextNav;
    if(!pose){
      const start=nav.resolve(next);
      if(!start){blocked=true;return null;}
      pose={...point(start),walking:false,speed:0,distance:0};relocated=distance(start,next)>.001;
      heading=finite(next.heading)?next.heading:heading;
    }else if(changed&&!nav.isWalkable(pose)){
      // Furniture may be placed on an existing visitor by the editor. Recover
      // to the closest valid location once, never animate through that object.
      const safe=nav.resolve(pose);
      if(!safe){pose=null;route=[];target=null;speed=0;blocked=true;return null;}
      pose={...point(safe),walking:false,speed:0,distance:0};relocated=true;route=[];speed=0;
    }
    const source=point(next),elapsed=clamp((now-lastObserved)/1000,.05,1);
    if(lastSource){
      const observed=distance(lastSource,source)/elapsed;
      if(observed>.015)preferredSpeed=clamp(observed*1.12,.65,6);
    }
    lastSource=source;lastObserved=finite(now)?now:lastObserved;
    // Bad external snapshots do not put a body inside furniture. A corrected
    // target remains a presentation target only, never a new simulation state.
    const goal=nav.isWalkable(source)?source:nav.resolve(source);
    if(!goal){route=[];speed=0;blocked=true;return publish();}
    if(!target||changed||distance(target,goal)>.00001){
      target=point(goal);
      const planned=nav.route(pose,target);
      route=Array.isArray(planned)?planned.map(point):[];
      blocked=planned===null; if(blocked)speed=0;
    }
    if(!next.walking&&distance(pose,target)<.006){route=[];speed=0;}
    return publish();
  }
  function advance(now){
    if(!finite(now)||now<lastTime){lastTime=finite(now)?now:lastTime;return publish();}
    const elapsed=clamp((now-lastTime)/1000,0,.12);lastTime=now;
    if(!pose)return null;
    relocated=false;let moved=0;
    if(!elapsed)return publish();
    let remaining=0,previous=pose;
    for(const waypoint of route){remaining+=distance(previous,waypoint);previous=waypoint;}
    const acceleration=10,deceleration=14;
    const nextHeading=route.length?Math.atan2(route[0].col-pose.col,route[0].row-pose.row):heading;
    const turnFactor=clamp(1-Math.abs(angle(nextHeading-heading))/Math.PI,.2,1);
    const desired=blocked||remaining<.00001?0:Math.min(preferredSpeed*turnFactor,Math.sqrt(2*deceleration*remaining));
    speed+=clamp(desired-speed,-deceleration*elapsed,acceleration*elapsed);
    // Substeps keep every corner on the path. No chord joins two waypoint legs.
    let allowance=Math.min(remaining,Math.max(0,speed)*elapsed),facing=null;
    while(allowance>.000001&&route.length){
      const goal=route[0],length=distance(pose,goal);
      if(length<.00001){route.shift();continue;}
      const step=Math.min(length,allowance),ratio=step/length;
      const next={col:pose.col+(goal.col-pose.col)*ratio,row:pose.row+(goal.row-pose.row)*ratio};
      if(!nav.segmentClear(pose,next)){route=[];speed=0;blocked=true;break;}
      facing=Math.atan2(goal.col-pose.col,goal.row-pose.row);
      pose.col=next.col;pose.row=next.row;moved+=step;allowance-=step;
      // Finish this rendered frame at the corner; the following frame starts
      // its next leg. Even the chord between two displayed frames stays safe.
      if(step>=length-.000001){route.shift();break;}
    }
    if(facing!==null){
      const turn=angle(facing-heading);
      heading=angle(heading+clamp(turn,-4.6*elapsed,4.6*elapsed));
    }
    phase=(phase+moved/.78)%1;
    if(!route.length)speed=0;
    return publish(moved);
  }
  update(actor,{navigation,time:lastTime});
  return {update,advance,rebaseTime(now){if(finite(now)){lastTime=now;lastObserved=now;}return publish(0);},get pose(){return publish();}};
}
