import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {selectBooks,parseCapsula} from '../assets/xpaces/capsulas.mjs';
test('alsea-4380: estantería de libros dada de alta y pizarra-3 con el libro del día (#4397)',()=>{
 const m=JSON.parse(fs.readFileSync(new URL('../assets/xpaces/inventory/alsea-4380.json',import.meta.url)));
 assert.equal(m.items.filter(e=>e.origen==='json-medidas').length,m.measuredCount);assert.equal(m.measuredCount,35);
 const shelf=m.items.find(e=>e.id==='estanteria-libros');assert.equal(shelf.runtime.builder,'estanteria-libros');assert.equal(shelf.runtime.junto,'sofa');assert.ok(shelf.medidas.ancho>0);
 assert.equal(m.items.find(e=>e.id==='pizarra-3').contenido.tipo,'libro-del-dia');
 for(const id of ['pizarra-1','pizarra-2','pantalla-recogida','balda-recogida'])assert.equal(m.items.find(e=>e.id===id).contenido,undefined);
});
test('solo cápsulas Blinkist reales, un libro por título, la más reciente primero',()=>{
 const c=(id,createdAt,slug,extra={})=>({id,type:'capsula',createdAt,tags:['formacion','waltdisney','blinkist'],prompt:`https://www.blinkist.com/en/books/${slug}`,title:'T '+id,comment:`PARA CARBONO\nA\n\nPARA SILICIO\nB\n\nAPLICACIÓN\nC\n\nFuente: Libro ${slug}, de Autora (resumen Blinkist).`,...extra});
 const books=selectBooks({items:[c('1','2026-09-21T00:00:00Z','x-en'),c('2','2026-09-25T00:00:00Z','x-en'),c('3','2026-09-24T00:00:00Z','y-en'),{id:'4',type:'image',createdAt:'2026-09-26'},c('5','2026-09-26T00:00:00Z','z',{tags:['formacion'],prompt:'https://example.com'})]});
 assert.deepEqual(books.map(b=>b.id),['2','3']);assert.equal(books[0].libro,'Libro x-en');assert.equal(books[0].autor,'Autora');assert.equal(books[0].consejero,'Walt Disney');
 assert.deepEqual(books[0].secciones.map(s=>s[1]),['A','B','C']);
 assert.equal(parseCapsula({id:'o',prompt:'https://www.blinkist.com/books/creative-confidence-en',comment:'sin fuente',tags:[]}).libro,'Creative Confidence');
});
