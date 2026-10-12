// Local-only browser regression. Auth is stubbed only on the isolated static test server.
// Native navigation is captured in the served module: no OS launch or device mutation.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
(async()=>{
 const base=process.env.NATIVE_DEMO_TEST_ORIGIN||'http://127.0.0.1:18463';
 assert(['127.0.0.1','localhost'].includes(new URL(base).hostname),'Local test server only');
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 const results=[];
 for(const route of ['/help/','/mcp/']){
  const page=await browser.newPage();await page.addInitScript(()=>{localStorage.setItem('admiranext_expert_lang','es');});
  await page.route('**/auth/session',r=>r.fulfill({json:{ok:true}}));
  for(const name of ['demo-android.mjs','demo-ios.mjs'])await page.route('**/suite/'+name+'*',r=>{
   const source=fs.readFileSync(path.join(__dirname,'../suite',name),'utf8').replace('root.location.assign(', 'root.__captureNative(');
   return r.fulfill({body:source,contentType:'text/javascript; charset=utf-8'});
  });
  await page.addInitScript(()=>{window.__nativeRequests=[];window.__captureNative=uri=>window.__nativeRequests.push(JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(new URL(uri).searchParams.get('request').replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0)))));});
  await page.goto(base+route+'?project=starbucks&lang=es');
  await page.waitForSelector('.pf-cli.ax-dock',{state:'attached'});await page.locator('.pix-nav-icon-expert').first().click();
  const input=page.locator('#pf-cli-input');let count=0;
  for(const [command,device] of [['/demo android','both'],['/demo android Fold8','fold'],['/demo android watch','watch'],['/demo ios','both'],['/demo ios watch','watch']]){
   await input.fill(command);await input.press('Enter');await page.waitForFunction(n=>window.__nativeRequests.length>n,count);
   const payload=await page.evaluate(()=>window.__nativeRequests.at(-1));assert.equal(payload.project,'starbucks');assert.equal(payload.device,device);
   results.push({route,command,project:payload.project,device});count++;
  }
  assert.equal(await page.locator('#native-players').count(),1);
  await page.locator('.pix-nav-icon-expert').first().click();await page.locator('#native-players').scrollIntoViewIfNeeded();
  if(process.env.NATIVE_DEMO_SHOT_DIR)await page.screenshot({path:path.join(process.env.NATIVE_DEMO_SHOT_DIR,route.includes('help')?'pixeria-help.png':'pixeria-mcp.png'),fullPage:false});
  await page.close();
 }
 await browser.close();console.log(JSON.stringify({scope:'Local static server, auth fixture, native navigation captured without OS launch',passed:results.length,results},null,2));
})().catch(e=>{console.error(e);process.exit(1)});
