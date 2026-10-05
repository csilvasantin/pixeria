const test=require('node:test');const assert=require('node:assert/strict');const {readFileSync}=require('node:fs');
const html=readFileSync(require('node:path').join(__dirname,'../en/stock.html'),'utf8');
test('English Stock loads the complete catalogue so recent announcements beyond 200 remain reachable',async()=>{
 const items=Array.from({length:501},(_,i)=>({id:String(i),type:i===500?'locucion':'video'}));
 const body=html.slice(html.indexOf('async function fetchList()'),html.indexOf('function feedMatrix()'));
 const run=new Function('fetch','STOCK_LIST_URL','STOCK_LIST_FALLBACK',body+';return fetchList;')(async()=>({ok:true,json:async()=>({items})}),'index','fallback');
 const result=await run();assert.equal(result.length,501);assert.equal(result[500].type,'locucion');
});
test('English Stock renders announcements as audio with native playback controls',()=>{
 const body=html.slice(html.indexOf('function renderPreview(it)'),html.indexOf('function escAttr(s)'));
 const preview=new Function('isFurniture3D','isXpace','isFurni',body+';return renderPreview;')(()=>false,()=>false,()=>false);
 assert.match(preview({type:'locucion',url:'https://stock.admira.store/stock/test/asset.mp3'}),/<audio src="https:\/\/stock.admira.store\/stock\/test\/asset.mp3" preload="none" controls>/);
});
for(const page of ['stock.html','en/stock.html'])test(page+' deep link selects Megafonía and opens an announcement outside active filters',()=>{
 const source=readFileSync(require('node:path').join(__dirname,'..',page),'utf8');
 const start=source.indexOf('function highlightFromQuery()'),end=source.indexOf('\n    }',source.indexOf('history.replaceState',start))+6;const body=source.slice(start,end);
 const item={id:'saved-announcement',type:'locucion'},filters={type:'video'},typeFilter={value:'video'};let opened=null,applied=0;
 const fn=new Function('location','allItems','grid','openLightbox','history','filters','typeFilter','applyFilters',body+';return highlightFromQuery;')({search:'?highlight=saved-announcement',href:'https://www.pixeria.com/stock.html?highlight=saved-announcement'},[item],{querySelector:()=>null},x=>opened=x,{replaceState:()=>{}},filters,typeFilter,()=>applied++);
 fn();assert.equal(opened,item);assert.equal(filters.type,'locucion');assert.equal(typeFilter.value,'locucion');assert.equal(applied,1);
});
