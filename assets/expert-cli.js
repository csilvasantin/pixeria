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
  }
  function execute(command) {
    var words = command.trim().split(/\s+/), name = words.shift().toLowerCase().replace(/^\//, ''), arg = words.join(' ');
    switch (name) {
      case 'help': case 'ayuda':
        write(t('Comandos en este navegador:', 'Commands in this browser:') + '\nhelp · clear · echo <text> · date · status · version · history\nopen <home|audio|music|images|video|stock|assets|docs|radar>\n/demo · /demo list · /demo N · /demo stop\n' + t('↑/↓ historial · arrastra el borde superior · doble clic para plegar/desplegar', '↑/↓ history · drag the top edge · double-click to collapse/expand'));
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
      case 'demo':
        if (window.PFDemo) { window.PFDemo.comando(arg, write); break; }
        var motor = document.createElement('script');
        motor.src = '/assets/demo-motor.js?v=4685';
        motor.onload = function () { window.PFDemo.comando(arg, write); };
        motor.onerror = function () { write(t('No pude cargar el motor de demo.', 'Could not load the demo engine.')); };
        document.body.appendChild(motor);
        break;
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
    execute(command);
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
