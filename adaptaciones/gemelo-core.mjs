import {geometry} from './especiales-core.mjs';

// Preview geometry is the PHYSICAL wall, never the delivery atlas. Standard
// names are demo grid hints, not installed-hardware metadata. 2X3 H has an
// inconsistent name/aspect in the PDF: retain the named grid and flag it.
export function twinGeometry(f, size) {
  if(f.layout){const g=geometry(f.layout);return {...g,source:'physical_wall',warnings:f.layout.ambiguedades||[]};}
  const {ancho,alto}=size;
  if(!Number.isFinite(ancho)||!Number.isFinite(alto)||ancho<=0||alto<=0)throw new Error('invalid-size');
  const match=String(f.nombre||'').match(/(?:VIDEOWALL|SINCRO VW)\s+(\d+)X(\d+)/i);
  const cols=match?Number(match[1]):1,rows=match?Number(match[2]):1;
  if(cols*rows>64)throw new Error('invalid-grid');
  const segments=[];
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++)segments.push({n:segments.length+1,N:cols*rows,wall:{x:c*ancho/cols,y:r*alto/rows,w:ancho/cols,h:alto/rows}});
  return {pared:{ancho,alto},segments,source:match?'named_demo_grid':'single_surface',warnings:f.id==='cliente-22'?['VIDEOWALL 2X3 H: nombre y proporción del PDF pendientes de confirmar / PDF name and aspect require confirmation.']:[]};
}
export function previewSize(g){const k=Math.min(1,2048/g.pared.ancho,1200/g.pared.alto);return {ancho:Math.max(2,Math.round(g.pared.ancho*k)),alto:Math.max(2,Math.round(g.pared.alto*k))};}
// Use adjacent integer boundaries at preview resolution: no gaps/overlap caused
// by independently rounding narrow screens. Native sizes remain in geometry.
export function screenCrop(rect,wall,preview){const x=Math.round(rect.x/wall.ancho*preview.ancho),y=Math.round(rect.y/wall.alto*preview.alto);return {x,y,w:Math.round((rect.x+rect.w)/wall.ancho*preview.ancho)-x,h:Math.round((rect.y+rect.h)/wall.alto*preview.alto)-y};}
