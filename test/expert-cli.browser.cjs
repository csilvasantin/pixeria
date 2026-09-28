// Run against a LOCAL static server. Only the local auth/session endpoint is stubbed.
// PLAYWRIGHT_MODULE=/path/to/playwright CLI_TEST_ORIGINS=http://127.0.0.1:8463 node test/expert-cli.browser.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
for(const base of (process.env.CLI_TEST_ORIGINS || 'http://127.0.0.1:8463').split(','))for(const lang of ['/','/en/'])for(const width of [1440,390]){
 assert(['localhost','127.0.0.1'].includes(new URL(base).hostname), 'Local test origins only');const c=await b.newContext({viewport:{width,height:900}});const p=await c.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.route('**/auth/session',r=>r.fulfill({json:{ok:true}}));await p.goto(base+lang,{waitUntil:'domcontentloaded'});await p.waitForSelector('.pf-cli',{state:'attached'});
 await p.locator('.cc-reject').click({timeout:1000}).catch(()=>{});
 await p.locator('.pf-window-expert').click();const panel=p.locator('.pf-cli'),grip=p.locator('.pf-cli-grip'),input=p.locator('#pf-cli-input');
 assert.equal((await panel.boundingBox()).height,48);
 await input.fill('help');await input.press('Enter');const helpText=await p.locator('.pf-cli-output').innerText();assert.match(helpText,/open/);assert.match(helpText,/\/demo/);assert.doesNotMatch(helpText,/suno/i);
 let box=await grip.boundingBox();await p.mouse.move(box.x+box.width/2,box.y+4);await p.mouse.down();await p.mouse.move(box.x+box.width/2,box.y-70,{steps:5});await p.mouse.up();let height=(await panel.boundingBox()).height;assert(height>260);
 assert.equal(await p.evaluate(()=>Number(localStorage.getItem('pixeria_cli_height'))),height);
 await grip.dblclick();assert.equal((await panel.boundingBox()).height,48);await grip.dblclick();assert.equal((await panel.boundingBox()).height,height);
 await p.reload({waitUntil:'domcontentloaded'});await p.waitForSelector('.pf-cli');assert.equal((await panel.boundingBox()).height,48);await grip.dblclick();assert.equal((await panel.boundingBox()).height,height);
 await input.fill('echo <img src=x onerror=alert(1)>');await input.press('Enter');assert.equal(await p.locator('.pf-cli-output img').count(),0);assert.match(await p.locator('.pf-cli-output').innerText(),/<img/);
 await input.press('ArrowUp');assert.match(await input.inputValue(),/^echo/);await input.fill('clear');await input.press('Enter');assert.equal(await p.locator('.pf-cli-output').innerText(),'');
 await input.fill('unknown');await input.press('Enter');assert.match(await p.locator('.pf-cli-output').innerText(),/help/);
 await grip.focus();await grip.press('Home');assert.equal((await panel.boundingBox()).height,48);await grip.press('ArrowUp');assert.equal((await panel.boundingBox()).height,64);
 const dims=await p.evaluate(()=>{const v=document.querySelector('.pf-cli-viewport'),pan=document.querySelector('.pf-cli');v.scrollTop=v.scrollHeight;return {v:v.getBoundingClientRect().bottom,p:pan.getBoundingClientRect().top,scroll:v.scrollHeight>v.clientHeight,width:document.documentElement.scrollWidth,inner:innerWidth}});assert(dims.v<=dims.p+1);assert(dims.scroll);assert(dims.width<=dims.inner);
 await p.locator('.pf-window-expert').click();assert.equal(await panel.isVisible(),false);await p.locator('.pf-window-expert').click();assert.equal((await panel.boundingBox()).height,48);
 await p.locator('.pf-cli-viewport').evaluate(el=>el.scrollTop=0);await p.screenshot({path:'/tmp/4663-'+(base.endsWith('8464')?'studio':'pixeria')+'-'+(lang==='/'?'root':'en')+'-'+width+'.png'});
 assert.deepEqual(errors,[]);console.log('PASS',base,lang,width,'drag/reload/history/safe-output/keyboard/scroll');await c.close();
}await b.close()})().catch(e=>{console.error(e);process.exit(1)});
