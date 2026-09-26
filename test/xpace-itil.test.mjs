import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {itilEnabled,itilEntries,itilCatalog,itilCount,isItilCI,demoStatus,DEMO_STATUS,ITIL_ASSETS,ITIL_KEY} from '../assets/xpaces/itil.mjs';
import {ITIL_TIERS} from '../assets/xpaces/itil-glyphs.mjs';
const mem=()=>{const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),m};};
const CAFE='1790375438696-1ladz7',URL0='https://www.pixeria.com/stock?type=xpaces&highlight='+CAFE;
test('capa ITIL: encendida por defecto solo en la Cafebrería; ?itil=0 la apaga y se recuerda',()=>{
 const s=mem();
 assert.equal(itilEnabled(CAFE,URL0,s),true);
 assert.equal(itilEnabled('otro-xpacio',URL0,s),false);
 assert.equal(itilEnabled(CAFE,URL0+'&itil=0',s),false);
 assert.equal(s.m.get(ITIL_KEY),'0');
 assert.equal(itilEnabled(CAFE,URL0,s),false,'recuerda el apagado');
 assert.equal(itilEnabled(CAFE,URL0+'&itil=1',s),true);
 assert.equal(itilEnabled(CAFE,URL0,s),true);
 assert.ok(ITIL_ASSETS.has('1790370079244-cv7t5i'));
});
test('semáforo DEMO: estados simulados por id, el resto operativo',()=>{
 for(const v of Object.values(DEMO_STATUS))assert.ok(['ok','warn','down'].includes(v));
 assert.equal(demoStatus('S2'),'warn');
 assert.equal(demoStatus('no-existe'),'ok');
});
test('capa ITIL: solo dibuja elementos reales del inventario de la Cafebrería (no inventa)',()=>{
 const inv=JSON.parse(fs.readFileSync(new URL('../assets/xpaces/inventory/alsea-4380.json',import.meta.url)));
 const items=inv.items||inv;
 const out=itilEntries(items);
 assert.ok(out.length>0);
 for(const {e} of out)assert.ok(items.includes(e));
 const byTipo=Object.fromEntries(out.map(x=>[x.e.tipo,x.kind]));
 if(byTipo.screen)assert.equal(byTipo.screen,'pantalla');
 if(byTipo.pos)assert.equal(byTipo.pos,'tpv');
 assert.deepEqual(itilEntries([{id:'x',tipo:'mesa'}]),[]);
});
test('capa ITIL: arte de los 4 niveles presente (8 bits JSON, 16 PNG, 32/64 WebP)',()=>{
 const base=new URL('../assets/xpaces/itil/',import.meta.url);
 const man=JSON.parse(fs.readFileSync(new URL('manifest.json',base)));
 assert.ok(fs.existsSync(new URL('8bit/sprites.json',base)));
 const urls=JSON.stringify(man).match(/"[^"]+\.(png|webp)"/g).map(s=>s.slice(1,-1)).filter(u=>!u.startsWith('8bit/')); // 8 bits: se pinta desde sprites.json
 assert.ok(urls.length>=27,String(urls.length));
 for(const u of urls)assert.ok(fs.existsSync(new URL(u,base)),u);
 assert.ok(!urls.some(u=>/64bit\/.*\.png$/.test(u)),'64 bits en WebP');
});

test('recuento ITIL: fuente única (inventario alsea-4380) e IDÉNTICO en 8/16/32/64 bits',()=>{
 const inv=JSON.parse(fs.readFileSync(new URL('../assets/xpaces/inventory/alsea-4380.json',import.meta.url)));
 const man=JSON.parse(fs.readFileSync(new URL('../assets/xpaces/itil/manifest.json',import.meta.url)));
 const sprites=JSON.parse(fs.readFileSync(new URL('../assets/xpaces/itil/8bit/sprites.json',import.meta.url)));
 // Criterio escrito a mano sobre el JSON, independiente del módulo
 const esperado=inv.items.filter(e=>e.categoria==='IoT'||e.categoria==='Pantallas'||(e.categoria==='Equipamiento'&&['pos','ups'].includes(e.tipo))).map(e=>e.id);
 const cat=itilCatalog(inv.items);
 assert.deepEqual(cat.map(x=>x.e.id),esperado);
 const c=itilCount(inv.items);
 assert.equal(c.total,esperado.length);
 assert.equal(c.total,19);
 assert.equal(c.ok+c.warn+c.down+c.unknown,c.total,'el desglose suma el total');
 assert.equal(c.conDibujo+c.pendiente,c.total);
 assert.ok(!cat.some(x=>x.e.id==='barra'),'la barra es mobiliario, no CI');
 // Cada nivel dibuja el MISMO conjunto: todo CI tiene arte (propio o genérico «pendiente») en los 4 niveles
 const porNivel={};
 for(const tier of ITIL_TIERS){
  porNivel[tier]=cat.filter(x=>{const it=man.items[x.kind]||man.items.generico;const t=it?.tiers?.[tier];if(!t)return false;return tier==='good'?!!sprites.sprites[x.kind]:true;}).length;
 }
 assert.deepEqual(Object.values(porNivel),[c.total,c.total,c.total,c.total],JSON.stringify(porNivel));
 assert.ok(man.items.generico?.pendiente,'icono genérico marcado pendiente');
 for(const x of cat.filter(x=>x.pendiente))assert.equal(x.kind,'generico');
});
test('criterio ITIL: mobiliario, iluminación, cocina y clima no cuentan; TPV y SAI sí',()=>{
 assert.equal(isItilCI({categoria:'Mobiliario',tipo:'counter'}),false);
 assert.equal(isItilCI({categoria:'Equipamiento',tipo:'espresso'}),false);
 assert.equal(isItilCI({categoria:'Equipamiento',tipo:'hvac'}),false);
 assert.equal(isItilCI({categoria:'Equipamiento',tipo:'pos'}),true);
 assert.equal(isItilCI({categoria:'Equipamiento',tipo:'ups'}),true);
 assert.equal(isItilCI({categoria:'IoT',tipo:'switch'}),true);
 assert.equal(demoStatus('switch-1',true),'unknown');
});
