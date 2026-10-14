(function(root){
  'use strict';
  const values=(rows,key,name)=>[...new Map(rows.map(r=>[r[key],{id:r[key],name:r[name]||r[key]}])).values()].sort((a,b)=>a.name.localeCompare(b.name,'es'));
  const rowsFor=(data,s={})=>(data.rows||[]).filter(r=>(!s.project||r.project===s.project)&&(!s.circuit||r.circuit===s.circuit)&&(!s.location||r.location===s.location)&&(!s.device||r.screen===s.device));
  const screensFor=(data,s)=>!s?.project||s.device&&!s.location||s.location&&!s.circuit?[]:[...new Set(rowsFor(data,s).map(r=>r.screen))];
  const projects=data=>values(data.rows||[],'project','projectName');
  const circuits=(data,s)=>values(rowsFor(data,{project:s.project}),'circuit','circuitName');
  const locations=(data,s)=>s.circuit?values(rowsFor(data,{project:s.project,circuit:s.circuit}),'location','locationName'):[];
  const devices=(data,s)=>s.location?values(rowsFor(data,{project:s.project,circuit:s.circuit,location:s.location}),'screen','deviceName'):[];
  function memberships(data,id){return(data.assignments||[]).filter(a=>(a.stockIds||[]).includes(id));}
  function membershipText(data,id){return memberships(data,id).map(a=>`${a.name} · ${a.projectName||a.project} → ${a.circuitName||a.circuit} → ${a.locationName||a.location} → ${a.deviceName||a.screen}`).join('\n');}
  const api={rowsFor,screensFor,projects,circuits,locations,devices,memberships,membershipText};
  root.StockDestinations=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
