import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {exportRows,toCSV,readHidden,selectionURL} from '../assets/xpaces/inventory.mjs';
for(const [slug,count] of [['alsea',34],['xtanco',13]])test(`${slug}: canonical IDs, exact count, dimensions and blank commercial fields`,()=>{
 const manifest=JSON.parse(fs.readFileSync(new URL(`../assets/xpaces/inventory/${slug}.json`,import.meta.url)));
 const rows=manifest.items.filter(e=>e.origen==='json-medidas');assert.equal(rows.length,count);assert.equal(new Set(manifest.items.map(r=>r.id)).size,manifest.items.length);
 for(const e of rows){assert.ok(e.medidas.ancho>0&&e.medidas.fondo>0&&e.medidas.alto>0);assert.equal(e.cantidad,1);for(const key of ['fabricante','modelo','garantia'])assert.equal(e[key],'');if(e.tipo==='screen')assert.equal(e.pantalla,'PANTALLA_'+e.id);}
});
test('URL round trip handles empty/all selections, unknown data and independent models',()=>{
 const entries=[{id:'silla,1',visible:false},{id:'pantalla',visible:true}];const url=selectionURL('https://www.pixeria.com/stock?foo=1','alsea',entries);assert.deepEqual([...readHidden(url,'alsea')],['silla,1']);assert.deepEqual([...readHidden(url,'xtanco')],[]);assert.equal(url.searchParams.get('highlight'),'alsea');assert.equal(url.searchParams.get('foo'),'1');assert.deepEqual([...readHidden('https://x.test/?xhide-a=bad','a')],[]);assert.equal(selectionURL(url,'alsea',entries.map(e=>({...e,visible:true}))).searchParams.has('xhide-alsea'),false);
});
test('export only visible rows, excludes runtime objects and CSV escapes quotes/newlines/formulas',()=>{
 const rows=exportRows([{id:'1',nombre:'=formula',visible:true,medidas:{ancho:1,fondo:2,alto:3,unidad:'m'},object:{secret:1}},{id:'2',visible:false}]);assert.equal(rows.length,1);assert.equal(rows[0].object,undefined);const csv=toCSV(rows);assert.ok(csv.includes('"\'=formula"'));assert.ok(csv.includes('"1","2","3","m"'));assert.equal(exportRows([]).length,0);assert.ok(toCSV([{nombre:'a,"b"\nc'}]).includes('"a,""b""\nc"'));
});
