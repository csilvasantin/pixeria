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
export function localizedTwinWarnings(g,t){
  const translations=new Map([
    ['La imagen de ejemplo de la página 5 rotula su primera celda «640x540»; la cuadrícula rotula «640x360px» y 3 × 360 = 1080 px. Se usa 640×360.','Page 5 labels the first example cell 640×540, but the grid says 640×360 and 3 × 360 = 1080 px. The preview uses 640×360.'],
    ['La tabla de la página 3 lo llama «9x1 H», pero la página 6 lo titula «VIDEOWALL 11x1 H (2880 X 1620)» y su cuadrícula dibuja 12 celdas de 720×540 con una oscura: 11 pantallas. Se modelan las 11 del diagrama. Hay que confirmar con el cliente antes de emitir.','Page 3 calls it 9×1 H, while page 6 shows an 11×1 H wall with 11 active 720×540 cells. The preview follows those 11 cells; confirm the layout before broadcasting.'],
    ['El PDF no indica el número de pantallas ni su disposición física. 15 son las 16 celdas de la página 5 menos la marcada con x. La fila única se deduce de la regla de la página 5 y del ejemplo, donde el texto pasa de una fila a la siguiente. Hay que confirmar antes de emitir.','The PDF does not state the physical screen count or layout. The 15-screen row is inferred from 16 cells with one crossed out and the page 5 reading order. Confirm before broadcasting.'],
    ['VIDEOWALL 2X3 H: nombre y proporción del PDF pendientes de confirmar / PDF name and aspect require confirmation.','VIDEOWALL 2X3 H: PDF name and aspect ratio require confirmation.']
  ]);
  return g.warnings.map(w=>t(w,translations.get(w)||w));
}
