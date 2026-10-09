export const CREATOR_SCHEMA='admira.creator-demo.v1';
export const CREATOR_HISTORY='admira.creator-demo.history.v1';
export const STEPS=['brief','concept','creative','adapt','twin'];
export function createCreatorCampaign(seed,en=false){
 if(!/^[a-f0-9]{32}$/.test(seed))throw Error('creator-seed');
 const nums=Array.from({length:8},(_,i)=>parseInt(seed.slice(i*4,i*4+4),16));
 const first=['CITY','NIGHT','STREET','FRESH','OPEN','URBAN','DAILY','FREE'];
 const last=['PULSE','FLOW','WAVE','SHIFT','RHYTHM','ENERGY','MOTION','SPIRIT'];
 const name=first[nums[0]%8]+' '+last[nums[1]%8];
 const headline=en?['OWN THE STREET','MOVE YOUR WAY','FIND YOUR FLOW','MAKE IT YOURS','FEEL THE CITY','START SOMETHING'][nums[2]%6]:['TU CALLE. TU RITMO.','MUÉVETE A TU MANERA','ENCUENTRA TU RITMO','HAZLO TUYO','SIENTE LA CIUDAD','EMPIEZA ALGO NUEVO'][nums[2]%6];
 const hue=nums[3]%360;
 function color(h,s,l){const a=s*Math.min(l,1-l);const f=n=>{const k=(n+h/30)%12;return Math.round(255*(l-a*Math.max(-1,Math.min(k-3,9-k,1)))).toString(16).padStart(2,'0');};return '#'+f(0)+f(8)+f(4);}
 return {schema:CREATOR_SCHEMA,id:'creator-'+seed,seed,name,headline,cta:en?'COME IN. FIND YOUR PAIR.':'ENTRA. ENCUENTRA TU PAR.',background:color(hue,.3,.055),accent:color(hue,.9,.66),secondary:color((hue+80)%360,.8,.75),foreground:'#f5f4ee',hue,motif:nums[4]%3,angle:(nums[5]%18-9)/50,seconds:32,language:en?'en':'es',store:'sneakers-store-santa-rosa-19',demo:true,generatedBy:'local composition',product:'/campanas/next-step/product.webp',productProvenance:'Existing NEXT STEP concept artwork, reused; not newly AI-generated',published:false,physicalDelivery:false};
}
export function creatorTwinURL(c,{en=c.language==='en',view='360',origin='https://www.admira.store'}={}){
 const u=new URL('/xpacios/sneakerstore/',origin);u.searchParams.set('creator',c.seed);u.searchParams.set('lang',en?'en':'es');u.searchParams.set('embed','1');if(view==='3d')u.searchParams.set('view','jordan');else u.searchParams.set('scene','entrada');return u.href;
}
export function retainCampaign(rows,c){if(!Array.isArray(rows))rows=[];return [{...c,createdAt:new Date().toISOString()},...rows.filter(r=>r.id!==c.id)].slice(0,30);}
