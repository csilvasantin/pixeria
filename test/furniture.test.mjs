import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isFurniture3D,furnitureData,dimensions,replacementURL} from '../assets/furniture/catalog.mjs';
import {isXpace} from '../assets/xpaces/catalog.mjs';
import {readReplacements} from '../assets/furniture/replacements.mjs';
import {exportRows,toCSV} from '../assets/xpaces/inventory.mjs';
test('3D furniture remains furniture, never a whole Xpace',()=>{const item={type:'furni',mime:'model/gltf-binary',tags:['3d','mueble','alsea']};assert.equal(isFurniture3D(item),true);assert.equal(isXpace(item),false);assert.equal(isFurniture3D({...item,mime:'image/png'}),false);});
test('reject invalid dimensions and metadata',()=>{for(const x of [[NaN,20,30],[0,20,30],[20,-1,20],[20,20,10001]])assert.throws(()=>dimensions(x));assert.deepEqual(dimensions([45,45,95]),[45,45,95]);assert.equal(furnitureData({prompt:'broken'}),null);assert.equal(furnitureData({prompt:JSON.stringify({schema:'pixeria.furniture/1',inventoryIds:['silla-1'],quantity:'<img>'})}),null);});
test('replacement deep links isolate the Xpace and survive shared URLs',()=>{const url=replacementURL('space-1','silla-1','variant-1');assert.deepEqual(readReplacements(url,'space-1'),{'silla-1':'variant-1'});assert.deepEqual(readReplacements(url,'space-2'),{});assert.deepEqual(readReplacements('https://example.org/?xvariant-space-1=not-json','space-1'),{});});
test('inventory export retains variant identity and edited dimensions',()=>{const rows=exportRows([{id:'silla-1',visible:true,variant:'v1',medidas:{ancho:.45,fondo:.45,alto:.95,unidad:'m'}},{id:'silla-2',visible:false}]);assert.equal(rows.length,1);assert.equal(rows[0].variant,'v1');assert.match(toCSV(rows),/"variant"/);assert.match(toCSV(rows),/"v1"/);assert.equal(rows[0].medidas.alto,.95);});

test('retired grouping drafts do not reappear from an older index',()=>{assert.equal(isFurniture3D({id:'1790368601152-7o2fq5',type:'furni',mime:'model/gltf-binary'}),false);assert.equal(isFurniture3D({oculto:true,type:'furni',mime:'model/gltf-binary'}),false);});
