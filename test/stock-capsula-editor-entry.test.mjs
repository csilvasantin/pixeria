import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

for(const page of ['stock.html','en/stock.html'])test(page+': Stock #1815 opens the capsule editor and musical scripts keep the standard importer',()=>{
 const html=readFileSync(new URL('../'+page,import.meta.url),'utf8');
 const start=html.indexOf('function isEditableCapsula('),end=html.indexOf('function renderPromptHtml(',start);
 assert.ok(start>0&&end>start);
 const context={URLSearchParams};vm.createContext(context);vm.runInContext(html.slice(start,end),context);
 const capsule={id:'1792700022035-lho8uh',num:1815,type:'video',externalRef:'capsula-url:aa519cf8a50173ad',url:'https://stock.admira.store/original.mp4',title:'Depredador',prompt:'Guion de la cápsula'};
 const editable=new URL(context.ainimationImportHref(capsule));
 assert.equal(editable.searchParams.get('mode'),'capsula');assert.equal(editable.searchParams.get('admiraStockId'),capsule.id);
 assert.equal(editable.searchParams.get('admiraStockUrl'),capsule.url);
 const musical={id:'musica-440',type:'capsula',externalRef:'capsula-musical:440',tags:['capsula','musica'],url:'https://stock.admira.store/music.json',title:'La afinación de 440 Hz',prompt:'Guion musical'};
 const ordinary=new URL(context.ainimationImportHref(musical));
 assert.equal(ordinary.searchParams.has('mode'),false);assert.equal(ordinary.searchParams.get('admiraStockUrl'),musical.url);
 assert.equal(ordinary.searchParams.get('admiraStockType'),'capsula');assert.equal(ordinary.searchParams.get('admiraStockPrompt'),musical.prompt);
 assert.equal(new URL(context.ainimationImportHref({...capsule,externalRef:'another-video',tags:['capsula']})).searchParams.has('mode'),false);
});
