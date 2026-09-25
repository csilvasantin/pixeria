const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('assert/strict'),fs=require('fs'),crypto=require('crypto');
(async()=>{
const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE || undefined,headless:true,args:['--use-angle=metal']});
const results=[];const output=process.env.XPACES_QA_DIR || '/tmp/xpaces-qa';fs.mkdirSync(output,{recursive:true});
for(const config of [{name:'desktop',viewport:{width:1440,height:1000},isMobile:false},{name:'mobile',viewport:{width:390,height:844},isMobile:true,hasTouch:true},{name:'english',viewport:{width:1280,height:900}}]){
 const context=await browser.newContext(config),page=await context.newPage(),errors=[];
 page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:9437/${config.name==='english'?'en/':''}stock.html?gate=off&type=xpaces`);
 await page.waitForSelector('.stock-card[data-type=xpaces]',{timeout:30000});assert.equal(await page.locator('.stock-card').count(),2);
 // Asset thumbnails must all decode, including Xtanco's linked render.
 await page.waitForFunction(()=>[...document.querySelectorAll('.stock-card-media img')].every(i=>i.complete&&i.naturalWidth>0));
 const cookie=page.getByRole('button',{name:/^Rechazar$|^Reject$/});if(await cookie.count())await cookie.click();
 await page.screenshot({path:`${output}/${config.name}-catalog.png`});
 for(const id of ['1790364696893-14ykfy','1790365002072-l9tpjw']){
  await page.locator(`.stock-card[data-id="${id}"] .stock-card-media`).click();
  await page.waitForSelector('.xpace-viewer[data-ready=true]',{timeout:40000});
  console.log(config.name,id,'loaded');
  const host=page.locator('.xpace-viewer'),canvas=host.locator('canvas'),state=()=>host.evaluate(e=>e.xpaceState().camera);
  console.log('presets');
  await host.locator('[data-preset=floor]').click();assert.ok((await state()).elevation>1.56);
  await host.locator('[data-preset=front]').click();assert.equal((await state()).elevation,.02);
  await host.locator('[data-preset=home]').click();
  if(config.isMobile){
   const b=await canvas.boundingBox(),x=b.x+b.width/2,y=b.y+b.height/2;
   const cdp=await context.newCDPSession(page);
   const touch=(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(([x,y,id])=>({x,y,id}))});
   const before=await state();
   await touch('touchStart',[[x-30,y,1],[x+30,y,2]]);
   await touch('touchMove',[[x-60,y,1],[x+60,y,2]]);await touch('touchEnd',[]);
   assert.ok((await state()).zoom>before.zoom,'touch pinch zoom');
   await host.locator('[data-preset=home]').click();
   await touch('touchStart',[[x,y,1]]);await touch('touchMove',[[x+40,y+10,1]]);await touch('touchEnd',[]);
   assert.notEqual((await state()).angle,Math.PI/4,'touch orbit');
   await host.locator('[data-preset=home]').click();await cdp.detach();
  }
  console.log('drag');
  const box=await canvas.boundingBox();
  await page.mouse.move(box.x+box.width*.55,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(box.x+box.width*.65,box.y+box.height*.52,{steps:12});await page.mouse.up();
  assert.notEqual((await state()).angle,Math.PI/4);
  console.log('pan');
  await host.locator('[data-pan]').click();await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(box.x+box.width*.6,box.y+box.height*.5,{steps:8});await page.mouse.up();assert.notEqual((await state()).panX,0);
  await host.locator('[data-zoom="1.25"]').click();assert.ok((await state()).zoom>1);
  console.log('night');
  await host.locator('[data-light=night]').click();assert.equal(await host.locator('[data-light=night]').getAttribute('aria-pressed'),'true');
  await page.screenshot({path:`${output}/${config.name}-${id}-night.png`});
  await host.locator('[data-light=day]').click();await host.locator('[data-preset=home]').click();
  const perf=await page.evaluate(()=>new Promise(resolve=>{let start=performance.now(),previous=start,intervals=[];function frame(now){intervals.push(now-previous);previous=now;if(now-start<2500)requestAnimationFrame(frame);else{intervals.sort((a,b)=>a-b);resolve({fps:Math.round(intervals.length*1000/(now-start)),p95ms:Math.round(intervals[Math.floor(intervals.length*.95)]*10)/10});}}requestAnimationFrame(frame);}));
  await page.screenshot({path:`${output}/${config.name}-${id}.png`});
  assert.equal(await page.locator('[data-xpace-download=blend]').isEnabled(),true);
  if(config.name==='desktop'||config.name==='english')for(const ext of ['glb','blend']){
   const downloadPromise=page.waitForEvent('download');await page.locator(`[data-xpace-download=${ext}]`).click();const download=await downloadPromise;assert.ok(download.suggestedFilename().endsWith('.'+ext));const file=await download.path();const bytes=fs.readFileSync(file);assert.ok(bytes.length>1000000);results.push({case:config.name,id,download:ext,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
  }
  await host.evaluate(e=>window.oldXpaceState=e.xpaceState);await page.locator('#stockLightboxClose').click();assert.equal(await page.evaluate(()=>window.oldXpaceState().disposed),true);
  results.push({case:config.name,id,...perf});fs.writeFileSync(output+'/results.json',JSON.stringify(results,null,2));
 }
 assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await context.close();console.log(config.name,'passed');
}
await browser.close();fs.writeFileSync(output+'/results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));
})().catch(e=>{console.error(e);process.exit(1)});
