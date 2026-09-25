const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'/Users/csilvasantin/GitHub/ConsejoAdmiraNextGame/node_modules/playwright-core');
const fs=require('fs'),assert=require('assert/strict'),crypto=require('crypto');
const base=process.env.FURNITURE_BASE||'http://127.0.0.1:9440',out=process.env.FURNITURE_QA_DIR||'/tmp/furniture-4376-qa';fs.mkdirSync(out,{recursive:true});
(async()=>{const b=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--use-angle=metal']});
 const catalog=JSON.parse(fs.readFileSync('assets/furniture/catalog.json'));const chair=catalog.find(i=>i.file==='alsea-silla');assert.ok(chair);const results=[];
 let saved=fs.existsSync(out+'/variant.json')?JSON.parse(fs.readFileSync(out+'/variant.json')):null;
 for(const mobile of [false,true]){const p=await b.newPage({viewport:mobile?{width:390,height:844}:{width:1500,height:1050},isMobile:mobile,hasTouch:mobile});const errors=[];p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(45000);
 const cookie=async()=>{const c=p.getByRole('button',{name:'Rechazar',exact:true});if(await c.count())await c.click();};
 for(const item of [chair,catalog.find(i=>i.file==='xtanco-taburete')].filter(Boolean)){
  await p.goto(base+'/crear/?gate=off&view=edicion');await cookie();await p.goto(base+'/crear/?gate=off&view=edicion&furniture='+item.id);await p.waitForSelector('.furniture-viewer[data-ready=true]');assert.equal(await p.locator('.furniture-dialog').count(),1);
  const dialog=p.locator('.furniture-dialog'),host=p.locator('.furniture-viewer');const state=()=>host.evaluate(e=>e.furnitureState());let initial=await state();assert.ok(initial.materials.length);assert.equal(await dialog.evaluate(e=>e.scrollWidth>e.clientWidth),false);
  await p.screenshot({path:`${out}/${mobile?'mobile':'desktop'}-${item.file}-before.png`});
  // Proportional dimensions, then restore and edit freely.
  const width=dialog.locator('[name=dimension0]');await width.fill(String(initial.size[0]*1.2));await width.blur();let resized=await state();assert.ok(Math.abs(resized.size[2]/initial.size[2]-1.2)<.001);
  await width.fill(String(initial.size[0]));await width.blur();await dialog.locator('[name=proportional]').uncheck();const height=dialog.locator('[name=dimension2]');await height.fill(String(+(initial.size[2]+10).toFixed(1)));await height.blur();assert.ok(Math.abs((await state()).size[2]-initial.size[2]-10)<.01);
  const material=dialog.locator('.furniture-material').first(),texture=material.locator('select');await texture.selectOption('nogal');await p.waitForFunction(()=>document.querySelector('.furniture-message').textContent==='Textura aplicada.');assert.equal((await state()).materials[0].texture,true);
  await material.locator('[type=file]').setInputFiles('assets/furniture/textures/roble.jpg');await p.waitForFunction(()=>document.querySelector('.furniture-material select').value==='upload');
  await texture.selectOption('none');await p.waitForFunction(()=>document.querySelector('.furniture-message').textContent==='Textura aplicada.');await material.locator('[type=color]').fill('#2563eb');assert.equal((await state()).materials[0].color,'#2563eb');
  await dialog.locator('[name=title]').fill(item.slug==='alsea'?'Alsea · Silla azul · 95 cm':'Xtanco · Taburete azul · 85 cm');
  await dialog.evaluate(e=>e.scrollTop=0);await p.screenshot({path:`${out}/${mobile?'mobile':'desktop'}-${item.file}-after.png`});
  if(!mobile&&item===chair&&!saved&&process.env.SAVE_VARIANT==='1'){
   const before=await (await p.request.get(item.url)).body();await dialog.locator('[type=submit]').click();await p.waitForFunction(()=>document.querySelector('.furniture-dialog')?.dataset.saved,null,{timeout:180000});
   const id=await dialog.getAttribute('data-saved'),url=await dialog.locator('.furniture-result a').getAttribute('href');saved={id,url,original:item.id};fs.writeFileSync(out+'/variant.json',JSON.stringify(saved,null,2));
   const after=await (await p.request.get(item.url)).body();assert.equal(crypto.createHash('sha256').update(before).digest('hex'),crypto.createHash('sha256').update(after).digest('hex'));
  }
  await dialog.locator('[data-close]').click();await dialog.waitFor({state:'detached'});results.push({mobile,item:item.file,size:(await Promise.resolve(resized)).size});
 }
 if(saved){const u=new URL(saved.url);await p.goto(base+'/stock.html?gate=off&'+u.searchParams);await cookie();await p.waitForSelector('.xpace-viewer[data-ready=true]',{timeout:90000});const host=p.locator('.xpace-viewer'),state=()=>host.evaluate(e=>e.xpaceState().inventory);
  assert.equal((await state()).items.find(i=>i.id==='silla-1').variant,saved.id);assert.equal((await state()).items.find(i=>i.id==='silla-2').variant,null);
  const select=p.locator('[data-id=silla-1] select');assert.equal(await select.inputValue(),saved.id);await p.locator('[data-id=silla-1] .xpace-item').click();await host.locator('[data-preset=home]').click();await host.locator('canvas').scrollIntoViewIfNeeded();await p.waitForTimeout(400);await p.screenshot({path:`${out}/${mobile?'mobile':'desktop'}-xpace-after.png`});
  await select.selectOption('');await p.waitForFunction(()=>!document.querySelector('.xpace-viewer').xpaceState().inventory.items.find(i=>i.id==='silla-1').variant);await host.locator('canvas').scrollIntoViewIfNeeded();await p.screenshot({path:`${out}/${mobile?'mobile':'desktop'}-xpace-before.png`});
  await select.selectOption(saved.id);await p.waitForFunction(id=>document.querySelector('.xpace-viewer').xpaceState().inventory.items.find(i=>i.id==='silla-1').variant===id,saved.id);const checkbox=p.locator('[data-id=silla-1] input');await checkbox.uncheck();assert.equal((await state()).items.find(i=>i.id==='silla-1').objectVisible,false);await checkbox.check();
  await p.reload();await p.waitForSelector('.xpace-viewer[data-ready=true]',{timeout:90000});assert.equal((await state()).items.find(i=>i.id==='silla-1').variant,saved.id);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 }
 assert.deepEqual(errors,[]);await p.close();fs.writeFileSync(out+'/results.json',JSON.stringify(results,null,2));console.log(mobile?'mobile passed':'desktop passed');
 }await b.close();})().catch(e=>{console.error(e);process.exit(1)});
