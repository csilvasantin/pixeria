// Portable format contract and optional virtual shop placements; never alter source presets.
import {formatSize,validateEstancos} from './estancos-core.mjs';
export const APPLICATION_KEY=id=>`pixeria.adapter.aplicaciones.${id}`;
export function restoreApplications(raw,doc,formats) {
  const ids=new Set(doc?.estancos?.map(e=>e.id)),fmts=new Set(formats.map(f=>f.id));
  const seen=new Set();
  return (Array.isArray(raw)?raw:[]).filter(x=>{
    if(!ids.has(x?.estanco)||!fmts.has(x?.formato)) return false;
    const k=`${x.estanco}:${x.formato}`; if(seen.has(k)) return false;seen.add(k);return true;
  }).map(x=>({estanco:x.estanco,formato:x.formato,estado:'demo'}));
}
export function applyApplications(doc,raw,formats) {
  const out=structuredClone(doc); if(!out) return null;
  const apps=restoreApplications(raw,doc,formats);
  for(const x of apps){
    const est=out.estancos.find(e=>e.id===x.estanco),f=formats.find(f=>f.id===x.formato),[ancho,alto]=formatSize(f),id=`demo-${f.id}`;
    est.pantallas.push({id,screen:`${est.id}-${id}`,formato:f.id,ancho,alto,nombre:`Demo · ${f.nombre}`,nameEn:`Demo · ${f.nombre}`,estado:'demo',virtual:true});
  }
  const errors=validateEstancos(out,{formats,proyecto:out.proyecto});if(errors.length) throw new Error(errors.join('; '));
  return out;
}
export function formatContract(ficha,formats,doc,applications,ajustes={}) {
  return {version:1,tipo:'studio-formatos-aplicaciones',proyecto:ficha.id,ficha:structuredClone(ficha),
    formatos:formats.map(f=>({id:f.id,nombre:f.nombre,...(f.layout?{layout:structuredClone(f.layout)}:{custom:[...f.custom]})})),
    estancos:structuredClone(doc),aplicaciones:restoreApplications(applications,doc,formats),ajustes:structuredClone(ajustes),
    nota:'Aplicaciones virtuales de demo; no confirman hardware instalado. Virtual demo placements; do not confirm installed hardware.'};
}
