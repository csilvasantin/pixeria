const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const output=process.env.XPACES_QA_DIR||'/tmp/xpaces-4375-qa';fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE,headless:true,args:['--use-angle=metal']});const results=[];
 for(const config of [{name:'desktop',viewport:{width:1500,height:1050}},{name:'mobile',viewport:{width:390,height:844},isMobile:true,hasTouch:true},{name:'english',viewport:{width:1280,height:900}}]){
  const context=await browser.newContext(config),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(30000);
  for(const [slug,id,count] of [['alsea','1790364696893-14ykfy',34],['xtanco','1790365002072-l9tpjw',13]]){
   const base=process.env.XPACES_BASE||'http://127.0.0.1:9437';await page.goto(`${base}/${config.name==='english'?'en/':''}stock.html?gate=off&type=xpaces&highlight=${id}`);
   const cookie=page.getByRole('button',{name:/^Rechazar$|^Reject$/});if(await cookie.count())await cookie.click();
   await page.waitForSelector('.xpace-viewer[data-ready=true]',{timeout:60000});
   const host=page.locator('.xpace-viewer'),state=()=>host.evaluate(e=>e.xpaceState().inventory);
   const initial=await state();assert.equal(initial.items.filter(e=>e.core).length,count);assert.equal(await page.locator('.xpace-inventory-row').count(),initial.items.length);
   // Every logical object must independently toggle its actual scene root.
   for(const entry of initial.items.filter(e=>e.core)){
    const checkbox=page.locator(`.xpace-inventory-row[data-id="${entry.id}"] input`);await checkbox.uncheck();let row=(await state()).items.find(e=>e.id===entry.id);assert.equal(row.visible,false);assert.equal(row.objectVisible,false);await checkbox.check();
   }
   const cat=page.locator('.xpace-category input[data-category=Mobiliario]').first();await cat.uncheck();assert.ok((await state()).items.some(e=>!e.visible));await cat.check();
   const chosen=slug==='alsea'?'silla-1':'taburete-1',row=page.locator(`.xpace-inventory-row[data-id="${chosen}"]`);
   await row.locator('button').click();assert.equal((await state()).selected,chosen);await row.locator('input').uncheck();assert.equal((await state()).selected,null);assert.ok(new URL(page.url()).searchParams.get('xhide-'+id).includes(chosen));
   assert.equal(await cat.evaluate(e=>e.indeterminate),true);
   const shareURL=page.url();await page.reload();await page.waitForSelector('.xpace-viewer[data-ready=true]',{timeout:60000});assert.equal((await state()).items.find(e=>e.id===chosen).visible,false);
   const downloads={};for(const ext of ['json','csv']){const pending=page.waitForEvent('download');await page.locator(`[data-export=${ext}]`).click();const dl=await pending,path=await dl.path();downloads[ext]=fs.readFileSync(path,'utf8');fs.writeFileSync(`${output}/${config.name}-${slug}.${ext}`,downloads[ext]);}
   const exported=JSON.parse(downloads.json);assert.equal(exported.items.length,initial.items.length-1);assert.ok(!exported.items.some(e=>e.id===chosen));for(const e of exported.items)for(const key of ['fabricante','modelo','garantia'])assert.equal(e[key],'');
   assert.equal(downloads.csv.split('\r\n').length,exported.items.length+2);
   // A click in the rendered model selects a visible row; drag does not select.
   await host.locator('[data-preset=floor]').click();const canvas=host.locator('canvas');await canvas.scrollIntoViewIfNeeded();await page.waitForTimeout(500);const box=await canvas.boundingBox();let picked=null;
   for(const [u,v] of [[.5,.5],[.4,.4],[.55,.6],[.7,.5],[.3,.5],[.6,.3]]){await page.mouse.click(box.x+box.width*u,box.y+box.height*v);picked=(await state()).selected;if(picked)break;}assert.ok(picked,'3D click selects inventory row');assert.notEqual(picked,chosen);
   await host.locator('[data-preset=home]').click();await canvas.scrollIntoViewIfNeeded();await page.waitForTimeout(350);await page.screenshot({path:`${output}/${config.name}-${slug}-hidden.png`});
   await page.locator('[data-all=no]').click();assert.ok((await state()).items.every(e=>!e.visible&&!e.objectVisible));await page.locator('[data-all=yes]').click();assert.ok((await state()).items.every(e=>e.visible&&e.objectVisible));
   // Publish full reference inventories once; assertions verify real API response in the UI.
   if(process.env.PUBLISH_INVENTORIES==='1'&&config.name==='desktop'){
    await page.locator('[data-save]').click();await page.waitForFunction(()=>document.querySelector('.xpace-inventory-message').textContent.match(/Guardados en Stock|No se ha completado/),null,{timeout:180000});
    assert.match(await page.locator('.xpace-inventory-message').innerText(),/Guardados en Stock/);const links=await page.locator('.xpace-inventory-message a').evaluateAll(a=>a.map(e=>e.href));results.push({slug,stock:links});
   }
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
   await host.evaluate(e=>window.oldXpaceState=e.xpaceState);await page.locator('#stockLightboxClose').click();assert.equal(await page.evaluate(()=>window.oldXpaceState().disposed),true);results.push({case:config.name,slug,core:count,total:initial.items.length,picked,shareURL});fs.writeFileSync(`${output}/results.json`,JSON.stringify(results,null,2));console.log(config.name,slug,'passed');
  }await context.close();
 }await browser.close();console.log(JSON.stringify(results));
})().catch(e=>{console.error(e);process.exit(1)});
