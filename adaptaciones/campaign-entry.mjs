import {DEFAULT_CAMPAIGN} from './campaign-core.mjs?v=campaign-1';
export const CREATOR_KEY='pixeria.creator-campaign.v1';
// Reuse existing destinations without changing inclusion, placement or review state.
export function orientationPair(installations){
 return ['landscape','portrait'].flatMap(id=>{const existing=installations.find(i=>i.id===id);return existing?[existing]:[];});
}
export function newCampaign(en=false,id='campaign-'+Date.now().toString(36)){
 const c=JSON.parse(JSON.stringify(DEFAULT_CAMPAIGN));
 Object.assign(c,{id,revision:1,name:en?'New campaign':'Nueva campaña',headline:en?'YOUR HEADLINE':'TU TITULAR',cta:en?'YOUR CALL TO ACTION':'TU LLAMADA A LA ACCIÓN',product:'/adaptaciones/campanas/product-placeholder.svg',logo:'/adaptaciones/campanas/logo-placeholder.svg',productLabel:en?'Replace with your product':'Sustituye por tu producto',placements:{},direction:'hero'});
 c.installations=c.installations.slice(0,3);
 return c;
}
