import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import vm from 'node:vm';
for(const file of ['stock.html','en/stock.html'])test(file+' preserves media import and passes exact capsule reference',()=>{
 const html=readFileSync(new URL('../'+file,import.meta.url),'utf8');const body=html.match(/function ainimationImportHref\(it\) \{([\s\S]*?)\n    \}/)[1];const f=vm.runInNewContext('(it)=>{'+body+'}',{URLSearchParams});
 const item={url:'https://api.admira.store/stock/asset/example',type:'video',id:'example',title:'Texto & título',externalRef:'capsula-url:aa519cf8a50173ad'};
 const url=new URL(f(item));assert.equal(url.searchParams.get('admiraCapsuleRef'),item.externalRef);assert.equal(url.searchParams.get('admiraStockUrl'),item.url);assert.equal(url.searchParams.get('admiraStockTitle'),item.title);
 assert.equal(new URL(f({...item,externalRef:'other'})).searchParams.has('admiraCapsuleRef'),false);
});
