/* Browser-only expert console, shared by Pixeria and Admira Studio. */
(function () {
  'use strict';
  var panel = document.querySelector('.rail-bottom,.quad-bottom,#pixNavExpertLayer');
  if (!panel || panel.classList.contains('pf-cli')) return;
  var mode = panel.matches('.rail-bottom') ? 'rail' : panel.matches('.quad-bottom') ? 'quad' : 'layer';
  var en = document.documentElement.lang.indexOf('en') === 0;
  function t(es, english) { return en ? english : es; }
  var MIN = 48, height = MIN, expanded = 260;
  try { expanded = Number(localStorage.getItem('pixeria_cli_height')) || expanded; } catch (_) {}
  if (!Number.isFinite(expanded) || expanded <= MIN) expanded = 260;
  // Keep the existing library and newsletter available in the main page.
  var center = document.querySelector('.cuad-center') || document.querySelector('main');
  Array.from(panel.children).forEach(function (child) {
    if (!child.matches('.rail-hd,.pf-resize-handle') && center) center.appendChild(child);
  });
  panel.replaceChildren();
  panel.classList.add('pf-cli');
  panel.setAttribute('aria-label', t('Consola web experta', 'Expert web console'));
  document.body.appendChild(panel);
  // A scroll viewport reserves the console's real height, including on mobile.
  var viewport = document.createElement('div');
  viewport.className = 'pf-cli-viewport';
  Array.from(document.body.children).forEach(function (child) {
    if (child !== panel && !child.matches('script,style,link')) viewport.appendChild(child);
  });
  document.body.insertBefore(viewport, panel);
  var grip = document.createElement('div');
  grip.className = 'pf-cli-grip';
  grip.tabIndex = 0;
  grip.setAttribute('role', 'separator');
  grip.setAttribute('aria-orientation', 'horizontal');
  grip.setAttribute('aria-label', t('Altura de consola: arrastra, usa las flechas o doble clic para plegar', 'Console height: drag, use arrow keys or double-click to collapse'));
  var log = document.createElement('div');
  log.id = 'pf-cli-output';
  log.className = 'pf-cli-output';
  log.setAttribute('role', 'log');
  log.setAttribute('aria-live', 'polite');
  log.tabIndex = 0;
  grip.setAttribute('aria-controls', log.id);
  var form = document.createElement('form');
  form.className = 'pf-cli-form';
  var label = document.createElement('label');
  label.htmlFor = 'pf-cli-input';
  label.textContent = 'EXPERT ›';
  var input = document.createElement('input');
  input.id = label.htmlFor;
  input.type = 'text';
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.setAttribute('autocapitalize', 'off');
  input.setAttribute('aria-label', t('Comando web', 'Web command'));
  input.placeholder = t('Escribe help para empezar', 'Type help to get started');
  var run = document.createElement('button');
  run.type = 'submit';
  run.textContent = '↵';
  run.setAttribute('aria-label', t('Ejecutar comando', 'Run command'));
  var toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.setAttribute('aria-controls', log.id);
  form.append(label, input, run, toggle);
  panel.append(grip, log, form);
  var wasOpen = false, drag = null;
  function maxHeight() {
    var available = window.visualViewport ? window.visualViewport.height : innerHeight;
    return Math.max(MIN, Math.floor(available * 0.5));
  }
  function resize(value, remember) {
    height = Math.round(Math.max(MIN, Math.min(maxHeight(), value)));
    if (remember && height > MIN) {
      expanded = height;
      try { localStorage.setItem('pixeria_cli_height', String(expanded)); } catch (_) {}
    }
    document.documentElement.style.setProperty('--pf-cli-height', height + 'px');
    if (panel.classList.contains('pf-cli-folded') !== (height === MIN)) panel.classList.toggle('pf-cli-folded', height === MIN);
    log.hidden = height === MIN;
    toggle.textContent = height === MIN ? '▴' : '▾';
    toggle.setAttribute('aria-expanded', String(height > MIN));
    toggle.setAttribute('aria-label', height === MIN ? t('Desplegar consola', 'Expand console') : t('Plegar consola', 'Collapse console'));
    grip.setAttribute('aria-valuemin', String(MIN));
    grip.setAttribute('aria-valuemax', String(maxHeight()));
    grip.setAttribute('aria-valuenow', String(height));
  }
  function sync() {
    var open = mode === 'rail' ? !document.body.classList.contains('pf-bottom-off') : mode === 'quad' ? !panel.classList.contains('is-collapsed') : !panel.hidden;
    if (panel.dataset.cliOpen !== String(open)) panel.dataset.cliOpen = String(open);
    if (open && !wasOpen) resize(MIN, false);
    wasOpen = open;
    if (document.body.classList.contains('pf-cli-open') !== open) document.body.classList.toggle('pf-cli-open', open);
    var vv = window.visualViewport;
    document.documentElement.style.setProperty('--pf-cli-viewport', (vv ? vv.height : innerHeight) + 'px');
    document.documentElement.style.setProperty('--pf-cli-keyboard', (vv ? Math.max(0, innerHeight - vv.height - vv.offsetTop) : 0) + 'px');
    resize(height, false);
  }
  function fold() { resize(height > MIN ? MIN : expanded, false); }
  toggle.addEventListener('click', fold);
  grip.addEventListener('dblclick', fold);
  grip.addEventListener('pointerdown', function (ev) {
    if (ev.button !== 0) return;
    ev.preventDefault();
    drag = { y: ev.clientY, height: height };
    grip.setPointerCapture(ev.pointerId);
  });
  grip.addEventListener('pointermove', function (ev) {
    if (drag) resize(drag.height + drag.y - ev.clientY, true);
  });
  function stop() { drag = null; }
  grip.addEventListener('pointerup', stop);
  grip.addEventListener('pointercancel', stop);
  grip.addEventListener('lostpointercapture', stop);
  grip.addEventListener('keydown', function (ev) {
    if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); fold(); }
    if (ev.key === 'ArrowUp' || ev.key === 'ArrowDown') {
      ev.preventDefault(); resize(height + (ev.key === 'ArrowUp' ? 1 : -1) * (ev.shiftKey ? 48 : 16), true);
    }
    if (ev.key === 'Home') { ev.preventDefault(); resize(MIN, false); }
    if (ev.key === 'End') { ev.preventDefault(); resize(maxHeight(), true); }
  });
  new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  new MutationObserver(sync).observe(panel, { attributes: true, attributeFilter: ['class', 'hidden'] });
  window.addEventListener('resize', sync);
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', sync);
    window.visualViewport.addEventListener('scroll', sync);
  }
  var history = [], cursor = 0, draft = '';
  var sections = {
    home: en ? '/en/' : '/', audio: 'audio.html', music: 'musica.html', musica: 'musica.html',
    images: 'imagenes.html', imagenes: 'imagenes.html', video: 'video.html',
    stock: 'stock.html', assets: 'crear/', docs: 'documentacion/', radar: 'radar/'
  };
  function write(text) {
    var line = document.createElement('div');
    line.textContent = text;
    log.appendChild(line);
    while (log.childElementCount > 200) log.firstChild.remove();
    log.scrollTop = log.scrollHeight;
    return line;
  }
  function clock() {
    var d = new Date();
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    return '[' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()) + ']';
  }
  function visible(text) {
    return String(text || '').replace(/su(no)/ig, 'motor').slice(0, 240);
  }
  var demoBusy = false;
  var motorBase = (location.protocol === 'http:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')
    ? 'http://127.0.0.1:3777'
    : ('https://macmini.tail48b61c.ts.net/' + 'su' + 'no');
  function stockPage(id) { return 'https://www.pixeria.com/stock.html?highlight=' + encodeURIComponent(id); }
  function stockAsset(id) { return 'https://api.admira.store/stock/asset/' + encodeURIComponent(id); }
  function addLink(id) {
    var a = document.createElement('a');
    a.href = stockPage(id);
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = a.href;
    var line = document.createElement('div');
    line.appendChild(a);
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
  }
  function addPlayer(src, video) {
    var el = document.createElement(video ? 'video' : 'audio');
    el.controls = true;
    el.preload = 'metadata';
    el.src = src;
    if (video) { el.muted = true; el.playsInline = true; el.style.maxWidth = '280px'; }
    else el.style.width = '100%';
    var line = document.createElement('div');
    line.appendChild(el);
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
  }
  function track(label) {
    write(clock() + ' ' + label + ' ' + t('encargada', 'queued'));
    var line = write(clock() + ' ' + label + ' ' + t('generando… 0s', 'generating… 0s'));
    var t0 = Date.now();
    var timer = setInterval(function () {
      var s = Math.round((Date.now() - t0) / 1000);
      var n = Math.min(8, s % 9);
      line.textContent = clock() + ' ' + label + ' ' + t('generando… ', 'generating… ') + s + 's ' + '▰'.repeat(n) + '▱'.repeat(8 - n);
      log.scrollTop = log.scrollHeight;
    }, 1000);
    return {
      seconds: function () { return Math.max(1, Math.round((Date.now() - t0) / 1000)); },
      finish: function (ok, detail) {
        clearInterval(timer);
        var s = Math.max(1, Math.round((Date.now() - t0) / 1000));
        line.textContent = clock() + ' ' + label + ' ' + (ok
          ? t('lista en ', 'ready in ') + s + 's'
          : t('falló en ', 'failed in ') + s + 's' + (detail ? ' · ' + visible(detail) : ''));
        log.scrollTop = log.scrollHeight;
        return s;
      }
    };
  }
  async function publishStock(meta) {
    var payload = {
      type: meta.type, motor: meta.motor, prompt: meta.prompt || '', title: meta.title || '',
      comment: meta.comment || '', tags: ['admira-tv', 'hilo-musical'], quality: 'best', mime: meta.mime, costEst: meta.costEst || null
    };
    if (meta.base64) payload.base64 = meta.base64;
    else payload.sourceUrl = meta.url;
    var r = await fetch('https://api.admira.store/stock/publish', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    });
    var data = await r.json().catch(function () { return {}; });
    if (!r.ok || !data.id) throw new Error('stock ' + r.status + ' ' + (data.error || ''));
    return data.id;
  }
  async function bytesToBase64(buf) {
    var u8 = new Uint8Array(buf), bin = '', i;
    for (i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  async function runVoice(piece) {
    var prog = track(piece.label);
    try {
      var r = await fetch('https://api.admira.store/tts/free', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: piece.text, lang: piece.lang })
      });
      if (!r.ok) throw new Error('voz HTTP ' + r.status);
      var buf = await r.arrayBuffer();
      if (buf.byteLength < 500) throw new Error('voz vacía');
      var id = await publishStock({
        type: 'locucion', motor: 'web-speech-free', mime: 'audio/mpeg', costEst: 'gratis',
        prompt: piece.text, title: piece.title, comment: piece.label, base64: await bytesToBase64(buf)
      });
      var secs = prog.finish(true);
      addPlayer(stockAsset(id), false);
      addLink(id);
      return { ok: true, label: piece.label, seconds: secs, id: id, href: stockPage(id) };
    } catch (e) {
      var secsFail = prog.finish(false, e && e.message);
      return { ok: false, label: piece.label, seconds: secsFail, error: visible(e && e.message) };
    }
  }
  async function runSong(piece) {
    var prog = track(piece.label);
    try {
      var token = '';
      try { token = localStorage.getItem('pixer_pro_pw') || ''; } catch (_) {}
      if (!token) throw new Error(t('falta la contraseña PRO en este navegador', 'PRO password missing in this browser'));
      var lyrics = piece.lyrics;
      var prompt = [piece.voice, piece.style, piece.seconds + ' seconds'].filter(Boolean).join(', ');
      var title = (piece.client + ' · ' + piece.song).slice(0, 80);
      write(clock() + ' ' + t(
        'estilo ' + piece.style + ' · voz ' + piece.voiceLabel + ' · cliente ' + piece.client,
        'style ' + piece.style + ' · voice ' + piece.voiceLabel + ' · client ' + piece.client
      ));
      var gen = await fetch(motorBase + '/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt, lyrics: lyrics, title: title, instrumental: false, model: '', token: token })
      });
      var genBody = await gen.json().catch(function () { return {}; });
      if (!gen.ok) throw new Error(genBody.error || ('motor HTTP ' + gen.status));
      var clipId = ((genBody.ids || [])[0]) || ((genBody.clips || [])[0] || {}).id;
      if (!clipId) throw new Error(t('el motor no devolvió pieza', 'the engine returned no piece'));
      var videoUrl = '';
      var video = await fetch(motorBase + '/clip-video', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: clipId, token: token })
      });
      var videoBody = await video.json().catch(function () { return {}; });
      if (video.ok && videoBody.video_url) videoUrl = videoBody.video_url;
      if (!videoUrl) throw new Error(videoBody.error || t('sin vídeo de la canción', 'no song video'));
      var id = await publishStock({
        type: 'video', motor: 'pixeria-music', mime: 'video/mp4', costEst: '~10 cred', url: videoUrl,
        prompt: prompt, title: title,
        comment: piece.client + ' · ' + piece.voiceLabel + ' · ' + piece.style
      });
      var secs = prog.finish(true);
      addPlayer(stockAsset(id), true);
      addLink(id);
      return { ok: true, label: piece.label, seconds: secs, id: id, href: stockPage(id) };
    } catch (e) {
      var secsFail = prog.finish(false, e && e.message);
      return { ok: false, label: piece.label, seconds: secsFail, error: visible(e && e.message) };
    }
  }
  function demoPlan() {
    if (en) return [
      { kind: 'voice', label: 'Voice 1', title: 'Pixeria demo · Closing', lang: 'en', text: 'Attention: the store closes in fifteen minutes. Thank you for visiting.' },
      { kind: 'voice', label: 'Voice 2', title: 'Pixeria demo · Welcome', lang: 'en', text: 'Welcome. Today there is an offer in the center aisle.' },
      { kind: 'song', label: 'Song 1', song: 'Aisle', style: 'pop', voice: 'voz masculina', voiceLabel: 'male', client: 'Pixeria demo', seconds: 8, lyrics: '[Verse]\nPixeria demo opens the door\n[Chorus]\nPixeria demo plays in the store' },
      { kind: 'song', label: 'Song 2', song: 'Counter', style: 'flamenco', voice: 'voz femenina', voiceLabel: 'female', client: 'Pixeria demo', seconds: 8, lyrics: '[Verse]\nPixeria demo at the counter\n[Chorus]\nPixeria demo stays a moment' }
    ];
    return [
      { kind: 'voice', label: 'Locución 1', title: 'Pixeria demo · Cierre', lang: 'es', text: 'Atención: la tienda cierra en quince minutos. Gracias por su visita.' },
      { kind: 'voice', label: 'Locución 2', title: 'Pixeria demo · Bienvenida', lang: 'es', text: 'Bienvenidos. Hoy hay oferta en el pasillo central.' },
      { kind: 'song', label: 'Canción 1', song: 'Pasillo', style: 'pop', voice: 'voz masculina', voiceLabel: 'masculina', client: 'Pixeria demo', seconds: 8, lyrics: '[Estrofa]\nPixeria demo abre la puerta\n[Estribillo]\nPixeria demo suena en la tienda' },
      { kind: 'song', label: 'Canción 2', song: 'Mostrador', style: 'flamenco', voice: 'voz femenina', voiceLabel: 'femenina', client: 'Pixeria demo', seconds: 8, lyrics: '[Estrofa]\nPixeria demo en el mostrador\n[Estribillo]\nPixeria demo se queda un momento' }
    ];
  }
  async function runDemo() {
    if (demoBusy) { write(t('demo ya está en curso.', 'demo is already running.')); return; }
    demoBusy = true;
    input.disabled = true;
    var results = [];
    try {
      write(t('Demo en vivo: 2 locuciones y 2 canciones, una detrás de otra.', 'Live demo: 2 voice lines and 2 songs, one after another.'));
      var plan = demoPlan();
      for (var i = 0; i < plan.length; i++) {
        results.push(plan[i].kind === 'voice' ? await runVoice(plan[i]) : await runSong(plan[i]));
      }
      write(t('Resumen', 'Summary'));
      results.forEach(function (item, n) {
        write((n + 1) + '. ' + item.label + ' · ' + item.seconds + 's · ' + (item.ok ? item.href : t('falló', 'failed') + (item.error ? ' · ' + item.error : '')));
      });
    } finally {
      demoBusy = false;
      input.disabled = false;
      input.focus();
    }
  }
  function execute(command) {
    var words = command.trim().split(/\s+/), name = words.shift().toLowerCase(), arg = words.join(' ');
    if (name.charAt(0) === '/') name = name.slice(1);
    switch (name) {
      case 'help': case 'ayuda':
        write(t(
          'Comandos en este navegador:\nhelp · clear · echo <texto> · date · status · version · history\nopen <home|audio|music|images|video|stock|assets|docs|radar>\ndemo · /demo — dos locuciones y dos canciones, en vivo\n↑/↓ historial · arrastra el borde superior · doble clic para plegar/desplegar',
          'Commands in this browser:\nhelp · clear · echo <text> · date · status · version · history\nopen <home|audio|music|images|video|stock|assets|docs|radar>\ndemo · /demo — two voice lines and two songs, live\n↑/↓ history · drag the top edge · double-click to collapse/expand'
        ));
        break;
      case 'clear': case 'limpiar': log.replaceChildren(); break;
      case 'echo': write(arg); break;
      case 'date': case 'fecha': write(new Date().toLocaleString(en ? 'en-GB' : 'es-ES')); break;
      case 'version': write((document.querySelector('meta[name="admiranext-version"]') || {}).content || 'Pixeria'); break;
      case 'status': case 'estado': write(t('Consola web activa', 'Web console active') + ' · ' + location.host + ' · ' + document.documentElement.lang + '\n' + location.pathname); break;
      case 'history': case 'historial': write(history.map(function (item, i) { return (i + 1) + '  ' + item; }).join('\n')); break;
      case 'open': case 'abrir':
        var path = Object.prototype.hasOwnProperty.call(sections, arg.toLowerCase()) && sections[arg.toLowerCase()];
        if (!path) { write(t('Usa open seguido de una sección de help.', 'Use open followed by a section from help.')); break; }
        location.assign(path[0] === '/' ? path : (en ? '/en/' : '/') + path); break;
      case 'demo': return runDemo();
      default: write(t('Comando desconocido. Escribe help.', 'Unknown command. Type help.'));
    }
  }
  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var command = input.value.trim();
    if (!command) return;
    history.push(command);
    if (history.length > 100) history.shift();
    cursor = history.length; draft = ''; input.value = '';
    if (height === MIN) resize(expanded, false);
    write('› ' + command);
    Promise.resolve(execute(command)).catch(function (e) { write(visible(e && e.message)); });
  });
  input.addEventListener('keydown', function (ev) {
    if (ev.key !== 'ArrowUp' && ev.key !== 'ArrowDown') return;
    ev.preventDefault();
    if (cursor === history.length) draft = input.value;
    cursor = Math.max(0, Math.min(history.length, cursor + (ev.key === 'ArrowUp' ? -1 : 1)));
    input.value = cursor === history.length ? draft : history[cursor];
  });
  write(t('Pixeria · CLI web lista. Escribe help.', 'Pixeria · Web CLI ready. Type help.'));
  resize(MIN, false);
  sync();
})();
