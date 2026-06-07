(function () {
  const canvas = document.getElementById('matrix-rain');
  if (!canvas) return;

  const ctx = canvas.getContext('2d', { alpha: true });
  const glyphs = 'PIXERIA0123456789AIｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ';
  const fontSize = 16;
  let width = 0;
  let height = 0;
  let sideWidth = 120;
  let columns = 0;
  let drops = [];
  let speeds = [];

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
    columns = Math.ceil(width / fontSize);
    drops = new Array(columns).fill(0).map(() => Math.random() * -height / fontSize);
    speeds = new Array(columns).fill(0).map(() => 0.35 + Math.random() * 0.85);
  }

  function pickGlyph() {
    return glyphs.charAt(Math.floor(Math.random() * glyphs.length));
  }

  function sidePower(x) {
    const left = x < sideWidth ? 1 - x / sideWidth : 0;
    const right = x > width - sideWidth ? 1 - (width - x) / sideWidth : 0;
    return Math.max(0, left, right);
  }

  function draw() {
    ctx.fillStyle = 'rgba(2, 6, 2, 0.075)';
    ctx.fillRect(0, 0, width, height);
    ctx.font = fontSize + 'px "JetBrains Mono", ui-monospace, monospace';
    ctx.textBaseline = 'top';

    for (let i = 0; i < columns; i += 1) {
      const x = i * fontSize;
      const y = drops[i] * fontSize;
      const head = drops[i] > 1 && Math.random() > 0.968;
      const side = sidePower(x);
      ctx.globalAlpha = side ? 0.50 + side * 0.46 : 0.30;
      ctx.fillStyle = head ? '#e8ffe8' : (side ? '#00ff41' : '#00c837');
      ctx.shadowColor = '#00ff41';
      ctx.shadowBlur = head ? 12 : side * 8;
      ctx.fillText(pickGlyph(), x, y);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;

      if (y > height && Math.random() > 0.975) drops[i] = 0;
      drops[i] += speeds[i] + side * 0.22;
    }

    requestAnimationFrame(draw);
  }

  resize();
  window.addEventListener('resize', resize);
  requestAnimationFrame(draw);
})();
