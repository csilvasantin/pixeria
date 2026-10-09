export const EDIT_FIELDS=['name','headline','cta','background','accent','secondary','foreground','titleScale','backgroundAsset'];
export function presentation(value){
 const out={};if(!value||typeof value!=='object'||Array.isArray(value))throw Error('presentation-invalid');
 for(const [key,v] of Object.entries(value)){
  if(!EDIT_FIELDS.includes(key))throw Error('presentation-field');
  if(['name','headline','cta'].includes(key)){if(typeof v!=='string'||!v.trim()||v.length>160||/[\u0000-\u001f]/.test(v))throw Error('presentation-copy');out[key]=v.trim();}
  else if(['background','accent','secondary','foreground'].includes(key)){if(!/^#[0-9a-f]{6}$/i.test(v))throw Error('presentation-color');out[key]=v;}
  else if(key==='titleScale'){if(typeof v!=='number'||v<.5||v>1.5)throw Error('presentation-scale');out[key]=v;}
  else if(key==='backgroundAsset'){if(!/^[a-zA-Z0-9_-]{6,100}$/.test(v))throw Error('presentation-asset');out[key]=v;}
 }
 return out;
}
export function planInstruction(instruction,c){
 const text=String(instruction||'').trim();if(!text||text.length>1200)throw Error('instruction-length');
 const clean=text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(),patch={};let background=null,variants=1;
 const patterns=[['name',/(?:nombre|name)\s*(?:a|to|:|=)\s*["“](.+?)["”]/i],['headline',/(?:titular|headline)\s*(?:a|to|:|=)\s*["“](.+?)["”]/i],['cta',/(?:cta|llamada a la accion|call to action)\s*(?:a|to|:|=)\s*["“](.+?)["”]/i]];
 for(const [field,re]of patterns){const match=re.exec(text);if(match)patch[field]=match[1];}
 if(/(?:titular|headline|titulo|title).{0,25}(?:mas grande|larger|bigger|aument)/.test(clean))patch.titleScale=Math.min(1.5,(c.titleScale||1)+.15);
 if(/(?:titular|headline|titulo|title).{0,25}(?:mas pequeno|smaller|reduc)/.test(clean))patch.titleScale=Math.max(.5,(c.titleScale||1)-.15);
 for(const [field,words]of [['accent','acento|accent'],['foreground','texto|text'],['background','fondo|background']]){const m=new RegExp('(?:'+words+')\\s*(?:a|to|:|=)?\\s*(#[0-9a-f]{6})','i').exec(text);if(m)patch[field]=m[1];}
 const bg=/(?:fondo|background)\s+(?:a|por|de|to|with|:)?\s*(.+?)(?=\s+(?:y|and)\s+(?:prepara|crea|genera|haz|make|create|prepare|mant|keep|conserv)|[.;]|$)/i.exec(text);
 if(bg&&!/^#[0-9a-f]{6}$/i.test(bg[1].trim()))background=bg[1].trim().slice(0,400);
 if(/(?:tres|three|3)\s+(?:variantes|variants|variations)/.test(clean))variants=3;
 if(!Object.keys(patch).length&&!background)throw Error('instruction-unsupported');
 return {schema:'pixeria.creator-edit-plan.v1',instruction:text,patch:presentation(patch),background,variants,preserve:['product','logo','image','video','seed'],requiresAI:Boolean(background),changes:Object.entries(patch).map(([field,after])=>({field,before:c[field]??null,after})),approved:false};
}
