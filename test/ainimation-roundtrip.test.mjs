import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import vm from 'node:vm';
for(const language of ['','en/'])test('AInimation edit links and descendant versions · '+(language||'es'),()=>{
 const html=readFileSync(new URL('../'+language+'stock.html',import.meta.url),'utf8');
 const from=html.indexOf('function ainimationImportHref'),to=html.indexOf('function renderPromptHtml',from);
 const c=vm.createContext({URL,URLSearchParams,location:new URL('https://admira.studio/'+language+'stock.html?cliente=demo&highlight=old')});vm.runInContext(html.slice(from,to),c);
 for(const kind of ['director','interactive']){
  const href=new URL(c.ainimationImportHref({id:'old',type:'animation',mime:kind==='interactive'?'text/html':'video/webm',editorKind:kind,url:'https://stock.admira.store/asset',title:'Pieza'}));
  assert.equal(href.pathname,kind==='interactive'?'/interactivos/':'/studio.html');assert.equal(href.searchParams.get('admiraStockId'),'old');assert.equal(href.searchParams.get('admiraEditable'),kind);
  const back=new URL(href.searchParams.get('admiraReturnUrl'));assert.equal(back.pathname,'/'+language+'stock.html');assert.equal(back.searchParams.get('cliente'),'demo');assert.equal(back.searchParams.has('highlight'),false);
 }
 const begin=html.indexOf('const isAdaptacion ='),end=html.indexOf('\n',begin);vm.runInContext(html.slice(begin,end)+';globalThis.linked=isAdaptacion;',c);
 assert.equal(c.linked({motor:'ainimation',externalRef:'old'}),true);assert.equal(c.linked({motor:'AInimation Studio',externalRef:'old'}),true);assert.equal(c.linked({motor:'adaptador',externalRef:'old'}),true);assert.equal(c.linked({motor:'other',externalRef:'old'}),false);
 const filter=html.slice(html.indexOf('        if (filters.origen) {'),html.indexOf('        if (!matchesType',html.indexOf('        if (filters.origen) {')));
 const allItems=[{id:'old'},{id:'new',motor:'ainimation',externalRef:'old'},{id:'next',motor:'ainimation',externalRef:'new'},{id:'other'}];
 Object.assign(c,{allItems,filters:{origen:'old'}});vm.runInContext('globalThis.family=allItems.filter(it=>{'+filter+'return false;});',c);assert.equal(c.family.map(x=>x.id).join(','),'old,new,next');
});
