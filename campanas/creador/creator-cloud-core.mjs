export const CLOUD_SCHEMA='pixeria.campaign-cloud.v1';
export const MAX_CAMPAIGN_BYTES=8*1024*1024;
export function cloudIdentity(value){
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('campaign-invalid');
 const c=value.schema==='admira.creator-full.v1'?value.campaign:value;
 if(!['admira.creator-demo.v1','pixeria.installation-campaign.v1'].includes(c?.schema)||!/^[-a-zA-Z0-9_]{1,80}$/.test(c.id||''))throw Error('campaign-invalid');
 if(typeof c.name!=='string'||!c.name.trim()||c.name.length>160)throw Error('campaign-name');
 if(c.schema==='admira.creator-demo.v1'&&(!/^[a-f0-9]{32}$/.test(c.seed||'')||c.id!=='creator-'+c.seed))throw Error('campaign-seed');
 // Provider bytes and secrets never belong in a cloud snapshot. Only archived references.
 if(value.schema==='admira.creator-full.v1'){if(value.seed!==c.seed||c.mode!=='full'||!['media-ready','adapted','twin'].includes(value.phase)||!Array.isArray(value.events)||!value.prompts)throw Error('full-campaign-invalid');for(const role of ['image','video']){const asset=value[role];if(!/^[a-zA-Z0-9_-]{6,100}$/.test(asset?.id||'')||asset.url!=='https://api.admira.store/stock/asset/'+asset.id)throw Error('full-campaign-media');}}
 const text=JSON.stringify(value);if(new TextEncoder().encode(text).length>MAX_CAMPAIGN_BYTES)throw Error('campaign-too-big');
 if(/"(?:token|authorization|api_key|imageData)"\s*:/i.test(text))throw Error('campaign-private-field');
 return {id:c.id,name:c.name,kind:value.schema==='admira.creator-full.v1'?'full':c.schema==='admira.creator-demo.v1'?'demo':'installation'};
}
export function compareCampaigns(a,b){
 const left=a.campaign||a,right=b.campaign||b;
 return ['name','headline','cta','price','accent','secondary','background','foreground','direction','seconds','titleScale','backgroundAsset','image','video','product','logo','placements','installations'].filter(k=>JSON.stringify(left[k])!==JSON.stringify(right[k])).map(field=>({field,before:left[field]??null,after:right[field]??null}));
}
