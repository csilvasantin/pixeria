// Motor /demo contra un servidor estático LOCAL. Solo se simula la sesión (/auth/session).
// PLAYWRIGHT_MODULE=/ruta/a/playwright DEMO_TEST_ORIGIN=http://127.0.0.1:8463 node test/demo-motor.browser.cjs
// DEMO_VIDEO_DIR=<dir> graba además la demo completa (3 puntos, ~3 min) y deja capturas de cada punto.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict');
const base=process.env.DEMO_TEST_ORIGIN || 'http://127.0.0.1:8463';
const video=process.env.DEMO_VIDEO_DIR;
assert(['localhost','127.0.0.1'].includes(new URL(base).hostname),'Local test origins only');
async function abrir(b,opts){
  const c=await b.newContext({viewport:{width:1440,height:900},...opts});
  await c.route('**/auth/session',r=>r.fulfill({json:{ok:true}}));
  // Los botones «señala» no deben llegar nunca a la red de generación.
  const llamadas=[];c.on('request',r=>{if(r.method()==='POST')llamadas.push(r.url())});
  const p=await c.newPage();const errores=[];p.on('pageerror',e=>errores.push(e.message));
  await p.goto(base+'/',{waitUntil:'domcontentloaded'});await p.waitForSelector('.pf-cli',{state:'attached'});
  await p.locator('.cc-reject').click({timeout:1000}).catch(()=>{});
  await p.locator('.pf-window-expert').click();
  return {c,p,errores,llamadas};
}
async function orden(p,texto){const i=p.locator('#pf-cli-input');await i.fill(texto);await i.press('Enter');}
(async()=>{
  const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
  // 1) /demo list lee el guion y numera los puntos.
  let {c,p,errores}=await abrir(b);
  await orden(p,'/demo list');
  await p.waitForFunction(()=>/3\. /.test(document.querySelector('.pf-cli-output').innerText));
  const lista=await p.locator('.pf-cli-output').innerText();
  assert.match(lista,/1\. Creación de locución/);assert.match(lista,/2\. Creación de canción/);assert.match(lista,/3\. Creación de gemelo digital anónimo/);
  await orden(p,'demo 9');await p.waitForFunction(()=>/\(1-3\)/.test(document.querySelector('.pf-cli-output').innerText));
  console.log('PASS /demo list + rango');
  // 2) /demo 2 abre musica.html, escribe de verdad y Esc lo para.
  await orden(p,'/demo 2');
  await p.waitForURL(/musica\.html/);await p.waitForSelector('.pfd-hud');
  assert.match(await p.locator('.pfd-rotulo').innerText(),/Demo 2 \/ 3[\s\S]*Creación de canción/i);
  await p.waitForFunction(()=>document.querySelector('#m-titulo').value==='Otoño en Valencia',null,{timeout:40000});
  assert.equal(await p.locator('#m-style').inputValue(),'flamenco');
  await p.keyboard.press('Escape');
  await p.waitForSelector('.pfd-hud',{state:'detached'});
  assert.equal(await p.evaluate(()=>sessionStorage.getItem('pf_demo_run')),null);
  assert.deepEqual(errores,[]);console.log('PASS /demo 2 + Esc');await c.close();
  if(!video){await b.close();return;}
  // 3) Demo completa grabada: tres puntos, cambios de página, un minuto por punto.
  ({c,p,errores,llamadas}=await abrir(b,{recordVideo:{dir:video,size:{width:1440,height:900}}}));
  const t0=Date.now();
  await orden(p,'/demo');
  for(const [n,ruta] of [[1,/audio\.html/],[2,/musica\.html/],[3,/anonimizador\.html/]]){
    await p.waitForURL(ruta,{timeout:90000});await p.waitForSelector('.pfd-hud');
    await p.waitForTimeout(40000);await p.screenshot({path:video+'/punto-'+n+'.png'});
    console.log('punto',n,'visto a los',Math.round((Date.now()-t0)/1000),'s');
  }
  await p.waitForSelector('.pfd-hud',{state:'detached',timeout:60000});
  const total=Math.round((Date.now()-t0)/1000);
  assert(total>=170&&total<=215,'duración total '+total+' s');
  assert.deepEqual(llamadas.filter(u=>!/127\.0\.0\.1|localhost/.test(u)),[],'la demo no debe generar nada');
  assert.deepEqual(errores,[]);console.log('PASS demo completa en',total,'s, sin POST de generación');
  await c.close();await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
