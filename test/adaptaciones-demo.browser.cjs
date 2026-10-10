// BASE=http://127.0.0.1:9494 PW=/path/to/playwright [SHOTS=/directory] node test/adaptaciones-demo.browser.cjs
// Browser regression: the opt-in demo serves real media without changing the empty default.
const assert = require('node:assert/strict');
const {chromium} = require(process.env.PW || 'playwright');
const path = require('node:path');
const BASE = process.env.BASE || 'http://127.0.0.1:9494';
const expected = [[1080,1920],[1920,1080],[1080,1080],[1080,1350]];

(async () => {
  const browser = await chromium.launch({executablePath:process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--autoplay-policy=no-user-gesture-required']});
  try {
    const open = async (route, width = 1440) => {
      const context = await browser.newContext({viewport:{width,height:width < 500 ? 844 : 1000}});
      await context.route('**/auth/session', r => r.fulfill({contentType:'application/json',body:'{"ok":true}'}));
      const stock = JSON.stringify({items:[{id:'demo-test-stock',type:'video',url:'https://example.invalid/unselected.mp4',title:'Unselected test video'}]});
      await context.route('**/stock-index', r => r.fulfill({contentType:'application/json',body:stock}));
      await context.route('https://stock.admira.store/stock/index.json', r => r.fulfill({contentType:'application/json',body:stock}));
      await context.route('https://api.yokup.com/**', r => r.abort());
      const page = await context.newPage(), errors = [], mediaRequests = [];
      page.on('pageerror', error => errors.push(String(error)));
      page.on('request', request => { if (request.url().includes('/adaptaciones/media/')) mediaRequests.push(request.url()); });
      await page.goto(BASE + route, {waitUntil:'load'});
      await page.waitForFunction(() => document.querySelector('#adapter-project option[value="altadis-estancos-bcn"]') && document.querySelector('#project-status').textContent);
      return {context,page,errors,mediaRequests};
    };
    for (const lang of ['', '/en']) {
      for (const query of ['', '?demo=unknown']) {
        const {context,page,errors,mediaRequests} = await open(lang + '/adaptaciones/' + query);
        await page.waitForTimeout(300);
        assert.equal(await page.locator('#demo-renders').isVisible(), false);
        assert.equal(await page.locator('#src').getAttribute('src'), null);
        assert.deepEqual(mediaRequests, []);
        assert.deepEqual(errors, []);
        await context.close();
      }
      for (const demo of ['jti','altadis']) {
        const {context,page,errors} = await open(lang + '/adaptaciones/?demo=' + demo);
        await page.waitForFunction(() => {
          const videos = [...document.querySelectorAll('#demo-renders video')];
          return videos.length === 4 && videos.every(v => v.readyState >= 1) && document.querySelector('#src').videoWidth;
        }, null, {timeout:30000});
        assert.equal(await page.locator('#demo-renders').isVisible(), true);
        assert.deepEqual(await page.locator('#demo-renders video').evaluateAll(videos => videos.map(v => [v.videoWidth,v.videoHeight])), expected);
        await page.locator('#demo-renders video').evaluateAll(videos => Promise.all(videos.map(video => { video.muted=true;return video.play(); })));
        await page.waitForFunction(() => [...document.querySelectorAll('#demo-renders video')].every(video => video.currentTime > .2 && video.readyState >= 2), null, {timeout:15000});
        await page.locator('#demo-renders video').evaluateAll(videos => videos.forEach(video => video.pause()));
        assert.equal(await page.locator('#demo-renders .demo-render a[download]').count(), 4);
        assert.match(await page.locator('#src').getAttribute('src'), /jti-tu-sitio-de-siempre-fuente\.mp4$/);
        if (demo === 'altadis') assert.equal(await page.locator('#adapter-project').inputValue(), 'altadis-estancos-bcn');
        assert.match(await page.locator('#demo-render-settings').textContent(), lang ? /interactive adaptation/ : /adaptación interactiva/);
        const sources = await page.locator('#demo-renders video').evaluateAll(videos => videos.map(v => v.src));
        await page.locator('#modo-global').evaluate(select => { select.value='cover';select.dispatchEvent(new Event('change',{bubbles:true})); });
        assert.deepEqual(await page.locator('#demo-renders video').evaluateAll(videos => videos.map(v => v.src)), sources);
        if (process.env.SHOTS) await page.screenshot({path:path.join(process.env.SHOTS,`demo-${demo}-${lang ? 'en' : 'es'}-1440.png`)});
        assert.deepEqual(errors, []);
        await context.close();
      }
    }
    {
      const {context,page,errors} = await open('/adaptaciones/?demo=altadis&proyecto=general');
      await page.locator('#demo-renders').waitFor({state:'visible'});
      assert.equal(await page.locator('#adapter-project').inputValue(), 'general');
      assert.deepEqual(errors, []);
      await context.close();
    }
    const {context,page,errors} = await open('/adaptaciones/?demo=jti',390);
    await page.locator('#demo-renders').waitFor({state:'visible'});
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    if (process.env.SHOTS) await page.screenshot({path:path.join(process.env.SHOTS,'demo-jti-es-390.png')});
    assert.deepEqual(errors, []);
    await context.close();
    console.log('PASS: empty defaults, invalid demo, four MP4 formats decoded and played, fixed renders, Altadis project and explicit override, ES/EN and mobile layout');
  } finally { await browser.close(); }
})().catch(error => { console.error(error);process.exitCode=1; });
