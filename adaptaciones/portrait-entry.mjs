// An explicit shortcut into the existing image workflow. No media/API work here.
import {formatFamily} from './format-catalog.mjs';
import {geometry} from './especiales-core.mjs';
const RATIOS={'9:16':[1080,1920],'16:9':[1920,1080],'1:1':[1080,1080],'4:5':[1080,1350]};
export const canEnterPortrait = (source, ready) => !!ready && source?.kind==='image'
  && Number.isInteger(source.ancho) && Number.isInteger(source.alto)
  && source.alto>0 && source.ancho>source.alto;
export function portraitDimensions(format) {
  try {
    if(format.especial) return geometry(format.layout).pared;
    const [ancho,alto]=format.custom||RATIOS[format.id]||[];
    return {ancho,alto};
  } catch (_) { return {}; }
}
const inProfile=(format,profile)=>profile==='proyecto'?!!format.proyecto:formatFamily(format)===profile;
export function portraitEntryPlan({source,ready,formats,profile}) {
  if(!canEnterPortrait(source,ready)||!Array.isArray(formats)||!['standard','proyecto','especiales'].includes(profile))return null;
  const candidates=formats.filter(f=>inProfile(f,profile)).map((format,index)=>({format,index,...portraitDimensions(format)}))
    .filter(f=>Number.isInteger(f.ancho)&&Number.isInteger(f.alto)&&f.ancho>0&&f.alto>f.ancho);
  // Log ratio distance is symmetric; exact 9:16 wins and equal ratios keep catalog order.
  candidates.sort((a,b)=>Math.abs(Math.log((a.ancho/a.alto)/(9/16)))-Math.abs(Math.log((b.ancho/b.alto)/(9/16)))||a.index-b.index);
  const target=candidates[0];
  if(target)return {profile,id:target.format.id,ancho:target.ancho,alto:target.alto};
  const fallback=formats.find(f=>f.id==='9:16'&&formatFamily(f)==='standard');
  const size=fallback&&portraitDimensions(fallback);
  return size&&Number.isInteger(size.ancho)&&Number.isInteger(size.alto)&&size.ancho>0&&size.alto>size.ancho
    ?{profile:'standard',id:fallback.id,...size}:null;
}
export function selectPortraitEntry(formats,entry) {
  if(!entry)return false;
  const target=formats.find(f=>f.id===entry.id&&inProfile(f,entry.profile));
  if(!target)return false;
  formats.forEach(f=>{if(inProfile(f,entry.profile))f.on=f===target;});
  return true;
}
