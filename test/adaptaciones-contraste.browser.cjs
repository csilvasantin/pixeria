// Contraste WCAG de Adaptaciones con y sin marca blanca (Carlos, 4-oct-2026, 23:19).
// Recorre pasos 1 y 2 con cada marca y modo, mide cada texto visible contra su fondo efectivo
// (fondos con alfa compuestos hacia arriba; degradados por su primer color) y falla si alguno
// queda por debajo de 4,5:1 (3:1 para texto grande: ≥ 24 px o ≥ 18,66 px en negrita).
// Uso: BASE=https://… [AGT=token de agente] [Q=?gate=off] node test/adaptaciones-contraste.browser.cjs
const { chromium } = require(process.env.PW || '/usr/local/lib/node_modules/playwright-core');
const BASE = process.env.BASE || 'https://www.pixeria.com', Q = process.env.Q || '';
const CASOS = (process.env.CASOS || 'admira,starbucks:claro,starbucks:oscuro,jti:claro,jti:oscuro,altadis:claro,altadis:oscuro').split(',');
const medir = () => {
  const parse = (s) => { const m = String(s).match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[\s,\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const over = (f, b) => ({ r: f.r * f.a + b.r * (1 - f.a), g: f.g * f.a + b.g * (1 - f.a), b: f.b * f.a + b.b * (1 - f.a), a: 1 });
  const lum = (c) => { const l = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * l(c.r) + 0.7152 * l(c.g) + 0.0722 * l(c.b); };
  const ratio = (a, b) => { const [h, l] = [lum(a), lum(b)].sort((x, y) => y - x); return (h + 0.05) / (l + 0.05); };
  const fondoDe = (el) => {
    const capas = [];
    for (let e = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e);
      let c = parse(cs.backgroundColor);
      if ((!c || c.a === 0) && cs.backgroundImage && cs.backgroundImage !== 'none') { const g = cs.backgroundImage.match(/rgba?\([^)]+\)/); if (g) c = parse(g[0]); }
      if (c && c.a > 0) { capas.push(c); if (c.a >= 1) break; }
    }
    let bg = { r: 255, g: 255, b: 255, a: 1 };
    if (capas.length && capas[capas.length - 1].a < 1) bg = parse(getComputedStyle(document.documentElement).backgroundColor) || bg;
    for (let i = capas.length - 1; i >= 0; i--) bg = over(capas[i], bg);
    return bg;
  };
  const out = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const vistos = new Set();
  for (let n; (n = walker.nextNode());) {
    if (!n.textContent.trim()) continue;
    const el = n.parentElement; if (!el || vistos.has(el)) continue; vistos.add(el);
    if (el.closest('[hidden],script,style,canvas,video,option,datalist,.stk-list[hidden],#stock-list')) continue;
    if (el.closest('button:disabled,select:disabled,input:disabled,[aria-disabled=true]')) continue;
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || +cs.opacity === 0) continue;
    let op = 1; for (let e = el; e; e = e.parentElement) op *= +getComputedStyle(e).opacity;
    if (op < 0.05) continue;
    const bg = fondoDe(el); let fg = parse(cs.color); if (!fg) continue; fg = { ...fg, a: fg.a * op }; if (fg.a < 1) fg = over(fg, bg);
    const px = parseFloat(cs.fontSize), bold = +cs.fontWeight >= 700, grande = px >= 24 || (bold && px >= 18.66);
    const k = ratio(fg, bg), min = grande ? 3 : 4.5;
    out.push({ k: Math.round(k * 100) / 100, min, txt: n.textContent.trim().slice(0, 40), sel: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : ''), fg: cs.color, bg: `rgb(${bg.r | 0},${bg.g | 0},${bg.b | 0})` });
  }
  return out;
};
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  let fallos = 0, peor = null;
  for (const caso of CASOS) {
    const [marca, modo] = caso.split(':');
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
    if (process.env.AGT) await ctx.request.post(BASE + '/auth/agente', { headers: { Authorization: 'Bearer ' + process.env.AGT, 'X-Agente': 'LucasGrokBotBox' } });
    const p = await ctx.newPage();
    const qs = new URLSearchParams(Q.replace(/^\?/, '')); if (marca !== 'admira') { qs.set('marca', marca); if (modo) qs.set('modo', modo); }
    await p.goto(BASE + '/en/adaptaciones/' + (qs.toString() ? '?' + qs : ''), { waitUntil: 'load' });
    await p.waitForFunction(() => document.querySelectorAll('#stock-list li[role=option]').length > 0, null, { timeout: 30000 });
    await p.waitForTimeout(2500);
    const marcaActiva = await p.evaluate(() => document.documentElement.getAttribute('data-mb-marca') || 'admira');
    const paso1 = await p.evaluate(medir);
    await p.click('#stock-pick'); await p.click('#stock-list li[role=option]:nth-child(3)');
    await p.waitForFunction(() => !document.querySelector('#btn-adaptar').disabled, null, { timeout: 30000 });
    await p.click('#btn-adaptar'); await p.waitForTimeout(1500);
    const paso2 = await p.evaluate(medir);
    const todos = [...paso1.map(x => ({ ...x, paso: 1 })), ...paso2.map(x => ({ ...x, paso: 2 }))];
    const malos = todos.filter(x => x.k < x.min).sort((a, b) => a.k - b.k);
    const w = todos.slice().sort((a, b) => a.k / a.min - b.k / b.min)[0];
    if (!peor || w.k / w.min < peor.k / peor.min) peor = { ...w, caso };
    fallos += malos.length;
    console.log(`${caso} (marca activa: ${marcaActiva}) · textos ${todos.length} · por debajo ${malos.length} · peor ${w.k}:1 «${w.txt}» ${w.sel} ${w.fg} sobre ${w.bg}`);
    malos.slice(0, +(process.env.N || 6)).forEach(x => console.log(`   ✗ paso ${x.paso} ${x.k}:1 (<${x.min}) «${x.txt}» ${x.sel} ${x.fg} / ${x.bg}`));
    if (process.env.SHOTS) await p.screenshot({ path: `${process.env.SHOTS}/contraste-${caso.replace(':', '-')}.png` });
    await ctx.close();
  }
  await b.close();
  console.log(`PEOR: ${peor.k}:1 «${peor.txt}» en ${peor.caso} (${peor.sel})`);
  console.log(fallos ? `✗ ${fallos} textos por debajo de WCAG AA` : '✓ todos los textos cumplen WCAG AA');
  process.exit(fallos ? 1 : 0);
})();
