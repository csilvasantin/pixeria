const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
(async () => {
 const browser = await chromium.launch({executablePath:process.env.CHROME_PATH || '/opt/google/chrome/chrome',args:['--no-sandbox']});
 try {
 const page = await browser.newPage({viewport:{width:1440,height:1200}});
 const base = process.argv[2]; assert.ok(base, 'Pass a library URL');
 const evidence = process.env.EVIDENCE_DIR || '/tmp/demo-biblioteca-evidence'; fs.mkdirSync(evidence,{recursive:true});
 const catalogURL = new URL('piezas.json',base).href;
 await page.goto(base); await page.locator('.card').nth(1).waitFor();
 const catalog = await (await page.request.get(catalogURL)).json();
 assert.equal(catalog.items.length,2);
 for (const item of catalog.items) {
   const poster = await page.request.get(new URL(item.miniatura,catalogURL).href); assert.equal(poster.status(),200);
   const card = page.locator(`[data-circuito="${item.circuito}"]`);
   const measured = await card.locator('video').evaluate(v=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Video metadata timeout')),20000);v.onloadedmetadata=()=>{clearTimeout(timer);resolve(v.duration);};v.onerror=()=>{clearTimeout(timer);reject(new Error('Video failed'));};v.preload='metadata';v.load();}));
   assert.ok(Math.abs(measured-item.duration)<0.1, `${item.marca} duration`);
   const target = new URL(await card.locator('.distribute').getAttribute('href'));
   assert.equal(target.searchParams.get('pieza'),item.videoId); assert.equal(target.searchParams.get('piezas'),catalogURL);
 }
 await page.screenshot({path:evidence+'/biblioteca-desktop.png',fullPage:true});
 await page.selectOption('#circuito','jti'); assert.equal(await page.locator('.card:visible').count(),1);
 assert.equal(await page.locator('.card:visible').getAttribute('data-circuito'),'jti');
 await page.selectOption('#circuito','all');
 await page.setViewportSize({width:390,height:844});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No mobile horizontal overflow');
 await page.screenshot({path:evidence+'/biblioteca-mobile.png',fullPage:true});
 await page.setViewportSize({width:1440,height:1100});
 for(const item of catalog.items){
   await page.goto(base); await page.getByRole('link',{name:`Distribuir ${item.marca}: ${item.titulo}`,exact:true}).click();
   await page.locator('.pieza-titulo').filter({hasText:item.titulo}).waitFor({timeout:30000});
   assert.ok((await page.locator('#pieza').innerText()).includes(item.videoId));
   assert.ok((await page.locator('#pieza').innerText()).includes(item.audioId));
   const cors = await page.evaluate(async url => {const r=await fetch(url);return {status:r.status,data:await r.json()};},catalogURL);
   assert.equal(cors.status,200); assert.equal(cors.data.items.length,2);
   await page.screenshot({path:evidence+'/distribuir-'+item.circuito+'.png',fullPage:true});
   console.log('PASS click + Smith title/video/audio + cross-origin catalog:',item.marca,page.url());
 }
 console.log('PASS metadata, thumbnails, filters, mobile layout');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
