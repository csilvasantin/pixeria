// Run against a LOCAL static server. Only the local auth/session endpoint is stubbed.
// PLAYWRIGHT_MODULE=/path/to/playwright CLI_TEST_ORIGINS=http://127.0.0.1:8463 node test/expert-cli.browser.cjs
// Diseño vigente (Carlos, 5-oct-2026): el ⌘ de Modo Experto muestra el panel completo o lo oculta
// DEL TODO (sin la línea «› /help»), con la piel de la suite (suite/experto.js, data-min="hide");
// el estado se recuerda en la pestaña (sessionStorage «ax-experto-abierto»). ⌘ se superpone: el
// contenido no se mueve. /avatarDigital, /avatar Digital y /admirito alternan a Admirito.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');const exe=process.env.CHROME_PATH||(fs.existsSync('/usr/bin/google-chrome')?'/usr/bin/google-chrome':undefined);
(async()=>{const b=await chromium.launch({executablePath:exe,headless:true,args:['--no-sandbox']});
for(const base of (process.env.CLI_TEST_ORIGINS || 'http://127.0.0.1:8463').split(','))for(const lang of ['/','/en/'])for(const width of [1440,390]){
 assert(['localhost','127.0.0.1'].includes(new URL(base).hostname), 'Local test origins only');
 const c=await b.newContext({viewport:{width,height:900}});const p=await c.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.route('**/auth/session',r=>r.fulfill({json:{ok:true}}));
 await p.goto(base+lang,{waitUntil:'domcontentloaded'});await p.waitForSelector('.pf-cli',{state:'attached'});
 // La piel de la suite tarda un poco en anclar el panel (.ax-dock).
 await p.waitForSelector('.pf-cli.ax-dock',{state:'attached',timeout:15000});
 await p.locator('.cc-reject').click({timeout:1000}).catch(()=>{});
 const panel=p.locator('.pf-cli'),input=p.locator('#pf-cli-input'),out=p.locator('.pf-cli-output'),toggle=p.locator('.pix-nav-icon-expert').first();
 const rect=()=>p.evaluate(()=>{const r=document.querySelector('.cuad-center,main').getBoundingClientRect();return [r.left,r.top+scrollY,r.width,r.height].map(Math.round).join(',')});
 const shown=()=>panel.isVisible();const saved=()=>p.evaluate(()=>sessionStorage.getItem('ax-experto-abierto'));
 assert.equal(await shown(),false,'⌘ entra oculto del todo (ni la línea /help)');
 const before=await rect();
 await toggle.click();await p.waitForTimeout(300);
 assert.equal(await shown(),true,'⌘ abre el panel');assert((await panel.boundingBox()).height>200,'abre completo, no la barra mínima');
 assert.equal(await rect(),before,'abrir ⌘ no mueve el contenido');assert.equal(await saved(),'1');
 assert.equal(await toggle.getAttribute('aria-expanded'),'true');
 await input.fill('help');await input.press('Enter');assert.match(await out.innerText(),/open/);
 await input.fill('echo <img src=x onerror=alert(1)>');await input.press('Enter');assert.equal(await p.locator('.pf-cli-output img').count(),0);assert.match(await out.innerText(),/<img/);
 await input.press('ArrowUp');assert.match(await input.inputValue(),/^echo/);
 await input.fill('unknown');await input.press('Enter');assert.match(await out.innerText(),/help/i);
 await input.fill('/admirito');await input.press('Enter');await p.waitForFunction(()=>/Admirito/.test(document.querySelector('.pf-cli-output').innerText),null,{timeout:10000});
 await input.fill('clear');await input.press('Enter');assert.doesNotMatch(await out.innerText(),/Admirito/);
 const dims=await p.evaluate(()=>({width:document.documentElement.scrollWidth,inner:innerWidth}));assert(dims.width<=dims.inner,'sin scroll horizontal');
 // Recarga en la misma pestaña: se recuerda abierto.
 await p.reload({waitUntil:'domcontentloaded'});await p.waitForSelector('.pf-cli.ax-dock',{state:'attached',timeout:15000});await p.waitForTimeout(300);
 assert.equal(await shown(),true,'la pestaña recuerda ⌘ abierto');
 // Segundo clic: oculto del todo y sin reservar alto abajo.
 await toggle.click();await p.waitForTimeout(300);
 assert.equal(await shown(),false,'⌘ se oculta del todo');assert.equal(await saved(),'0');assert.equal(await rect(),before,'cerrar ⌘ no mueve el contenido');
 assert.equal(await toggle.getAttribute('aria-expanded'),'false');
 await p.screenshot({path:(process.env.CLI_SHOT_DIR||'/tmp')+'/experto-'+(lang==='/'?'root':'en')+'-'+width+'.png'});
 assert.deepEqual(errors,[]);console.log('PASS',base,lang,width,'oculto/abierto/pestaña/historial/salida-segura/admirito/overlay');await c.close();
}await b.close()})().catch(e=>{console.error(e);process.exit(1)});
