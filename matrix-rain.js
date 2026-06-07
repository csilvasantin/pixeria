(function () {
  const canvas = document.getElementById('matrix-rain');
  if (!canvas) return;
  const ctx = canvas.getContext('2d', { alpha: true });

  const GLYPHS = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789ABCDEFｦﾞﾟ｡･ｰ';
  const FONT_SIZE = 16;
  let width = 0, height = 0, sideWidth = 120, columns = 0, drops = [], speeds = [];

  // Por columna: si tiene un writer activo, va sirviendo los chars de un
  // título uno a uno mientras el "drop" desciende; al acabar vuelve a glifos.
  let writers = [];

  function pickTitle() {
    const pool = (typeof window !== 'undefined' && Array.isArray(window.MATRIX_TITLES_FEED))
      ? window.MATRIX_TITLES_FEED : null;
    if (!pool || !pool.length) return null;
    let s = String(pool[Math.floor(Math.random() * pool.length)] || '').slice(0, 60).trim();
    // Si es una URL, quita el protocolo para que se lea mejor
    s = s.replace(/^https?:\/\//, '').replace(/^www\./, '');
    return s || null;
  }

  function randomGlyph() {
    return GLYPHS.charAt(Math.floor(Math.random() * GLYPHS.length));
  }

  function glyphFor(col) {
    // Probabilidad pequeña por columna por frame de empezar a escribir un título.
    // Sólo se activa cuando hay feed (window.MATRIX_TITLES_FEED no vacío).
    if (!writers[col] && Math.random() < 0.010) {
      const t = pickTitle();
      if (t) writers[col] = { title: t, pos: 0 };
    }
    const w = writers[col];
    if (w) {
      let ch = w.title.charAt(w.pos);
      w.pos += 1;
      if (w.pos >= w.title.length) writers[col] = null;
      if (!ch || !ch.trim()) ch = randomGlyph(); // espacios y similares
      return ch;
    }
    return randomGlyph();
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    sideWidth = Math.min(190, Math.max(72, Math.round(width * 0.115)));
    columns = Math.ceil(width / FONT_SIZE);
    drops = new Array(columns).fill(0).map(() => Math.random() * -height / FONT_SIZE);
    speeds = new Array(columns).fill(0).map(() => 0.4 + Math.random() * 0.9);
    writers = new Array(columns).fill(null);
  }

  function sidePower(x) {
    const left = x < sideWidth ? 1 - x / sideWidth : 0;
    const right = x > width - sideWidth ? 1 - (width - x) / sideWidth : 0;
    return Math.max(0, left, right);
  }

  function draw() {
    // Fade más suave para que las gotas dejen rastro y se vean mejor
    ctx.fillStyle = 'rgba(2, 6, 2, 0.07)';
    ctx.fillRect(0, 0, width, height);

    ctx.font = FONT_SIZE + 'px "JetBrains Mono", ui-monospace, monospace';
    ctx.textBaseline = 'top';

    for (let i = 0; i < columns; i++) {
      const x = i * FONT_SIZE;
      const y = drops[i] * FONT_SIZE;
      const ch = glyphFor(i);
      const head = drops[i] > 1 && Math.random() > 0.965;
      const side = sidePower(x);

      ctx.globalAlpha = side ? 0.52 + side * 0.45 : 0.30;
      if (head) {
        ctx.fillStyle = '#e8ffe8';
        ctx.shadowColor = '#00ff41';
        ctx.shadowBlur = 12;
      } else {
        ctx.fillStyle = side ? '#00ff41' : '#00c837';
        ctx.shadowColor = '#00ff41';
        ctx.shadowBlur = side * 8;
      }
      ctx.fillText(ch, x, y);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;

      if (y > height && Math.random() > 0.975) {
        drops[i] = 0;
      }
      drops[i] += speeds[i] + side * 0.22;
    }
    requestAnimationFrame(draw);
  }

  resize();
  window.addEventListener('resize', resize);
  requestAnimationFrame(draw);
})();
