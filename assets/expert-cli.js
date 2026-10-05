/* Browser-only expert console, shared by Pixeria and Admira Studio. */
(function () {
  'use strict';
  // ─── Piezas puras (también se prueban en node: test/marca-blanca.test.cjs) ───
  var COMMANDS = ['help', 'clear', 'echo', 'date', 'status', 'version', 'history', 'open', 'marca', 'idioma', 'language', 'languague', 'avatar', 'avataron', 'avataroff', 'avatardigital', 'digitalavatar', 'admirito'];
  var MARCA_VERB = /^\/?(?:marca|brand|marcablanca)$/i;
  // Semilla del catálogo de admiranext.com/marcablanca: vale para el Tab sin red. Con la
  // marca blanca cargada se usa la lista real (AdmiraMarca.conocidas()).
  var BRAND_SEED = ['admira', 'lumbre', 'brumelle', 'frescaria'];
  function commonPrefix(list) {
    return list.reduce(function (a, b) { var i = 0; while (i < a.length && a[i] === b[i]) i++; return a.slice(0, i); }, list[0] || '');
  }
  // Tab: completa el nombre del comando y, tras /marca, los ids del catálogo (más off);
  // tras open, las secciones. → {value, options}
  function complete(value, brandIds, sections) {
    var text = String(value == null ? '' : value);
    var m = text.match(/^(\s*)(\/?)(\S*)$/);
    if (m) {
      var typed = m[3].toLowerCase();
      var names = COMMANDS.filter(function (c) { return c.indexOf(typed) === 0; });
      if (!names.length) return {value: text, options: []};
      var slash = m[2] || (names.length === 1 && names[0] === 'marca' ? '/' : '');
      if (names.length === 1) return {value: m[1] + slash + names[0] + ' ', options: names};
      return {value: m[1] + m[2] + commonPrefix(names), options: names};
    }
    var a = text.match(/^(\s*\/?(\S+)\s+)(\S*)$/);
    if (!a) return {value: text, options: []};
    var verb = a[2].toLowerCase(), part = a[3].toLowerCase();
    var pool = MARCA_VERB.test(verb) ? (brandIds && brandIds.length ? brandIds : BRAND_SEED).concat(['off'])
      : (verb === 'open' || verb === 'abrir') ? (sections || []) : [];
    var options = pool.filter(function (o, i) { return o.indexOf(part) === 0 && pool.indexOf(o) === i; });
    if (!options.length) return {value: text, options: []};
    if (options.length === 1) return {value: a[1] + options[0], options: options};
    return {value: a[1] + commonPrefix(options), options: options};
  }
  // /marca <id|off|web> (alias /brand). M es window.AdmiraMarca (assets/marca-blanca.js);
  // write pinta una línea en la consola. → Promise<{ok}>
  function runMarca(arg, M, en, write) {
    function t(es, english) { return en ? english : es; }
    function tag(b) { return b && b.propuesta ? t(' · propuesta automática, no es la marca oficial', ' · automatic proposal, not the official brand') : b && b.ejemplo ? t(' · marca ficticia de ejemplo', ' · fictional sample brand') : ''; }
    function list(items) { return items.map(function (b) { return b.id + (b.propuesta ? t(' (propuesta)', ' (proposal)') : b.ejemplo ? t(' (ejemplo)', ' (sample)') : ''); }).join(', '); }
    if (!M) { write(t('La marca blanca aún no está lista en esta página. Vuelve a intentarlo en un momento.', 'White label is not ready on this page yet. Try again in a moment.')); return Promise.resolve({ok: false}); }
    var p = M.parseArg(arg);
    if (p.kind === 'invalid') {
      write(t('Marca no válida: «' + p.input + '».', 'Invalid brand: “' + p.input + '”.') + '\n' +
        t('Usa un id del catálogo (' + M.conocidas().map(function (b) { return b.id; }).join(', ') + '), off para volver a Admira o una web (starbucks.es) para analizarla.',
          'Use a catalogue id (' + M.conocidas().map(function (b) { return b.id; }).join(', ') + '), off to return to Admira or a website (starbucks.es) to analyse it.'));
      return Promise.resolve({ok: false});
    }
    if (p.kind === 'status') {
      var now = M.actual();
      write(now
        ? t('Marca activa: ' + now.nombre + ' (' + now.id + ')' + tag(now) + '. /marca off vuelve a Admira.', 'Active brand: ' + now.nombre + ' (' + now.id + ')' + tag(now) + '. /marca off returns to Admira.')
        : t('Sin marca blanca: ves el aspecto de Admira.', 'No white label: you see the Admira look.'));
      return M.listar().then(function (items) { write(t('Disponibles: ', 'Available: ') + list(items) + '.'); return {ok: true}; },
        function () { write(t('No se pudo leer el catálogo de admiranext.com. Conocidas: ', 'Could not read the admiranext.com catalogue. Known: ') + list(M.conocidas()) + '.'); return {ok: false}; });
    }
    if (p.kind === 'off') {
      var r = M.desactivar();
      write(r.changed && r.previous
        ? t('Marca ' + r.previous.nombre + ' desactivada: vuelve Admira.', r.previous.nombre + ' brand turned off: back to Admira.')
        : t('No había ninguna marca blanca activa: ya ves Admira.', 'No white label was active: you already see Admira.'));
      return Promise.resolve({ok: true});
    }
    if (p.kind === 'web') {
      var w = M.analizar(p.url);
      write(t('Abriendo el analizador de marca blanca en otra pestaña: ' + w.href, 'Opening the white-label analyser in a new tab: ' + w.href) + '\n' +
        t('Allí se analiza la web y se guarda en el catálogo; después actívala aquí con /marca <id>.', 'There the site is analysed and saved to the catalogue; then turn it on here with /marca <id>.'));
      return Promise.resolve({ok: !!w.ok});
    }
    write(t('Aplicando la marca ' + p.id + '…', 'Applying the ' + p.id + ' brand…'));
    return M.activar(p.id).then(function (res) {
      if (res.ok) { write(t('Marca ' + res.nombre + ' (' + res.id + ') activa' + tag(res) + '. Se mantiene al navegar en esta pestaña; /marca off vuelve a Admira.', res.nombre + ' (' + res.id + ') brand on' + tag(res) + '. It stays while you browse in this tab; /marca off returns to Admira.')); return {ok: true}; }
      if (res.reason === 'unknown') {
        write(t('La marca «' + p.id + '» no está en el catálogo de admiranext.com. No se ha aplicado nada.', 'The brand “' + p.id + '” is not in the admiranext.com catalogue. Nothing was applied.') + '\n' +
          t('Disponibles: ', 'Available: ') + list(M.conocidas()) + t('. Para crearla: /marca <web de la marca>.', '. To create it: /marca <brand website>.'));
        return {ok: false};
      }
      write(t('No se pudo contactar con admiranext.com. No se ha aplicado nada; vuelve a intentarlo.', 'Could not reach admiranext.com. Nothing was applied; try again.'));
      return {ok: false};
    });
  }
  var pure = {COMMANDS: COMMANDS, BRAND_SEED: BRAND_SEED, MARCA_VERB: MARCA_VERB, complete: complete, runMarca: runMarca};
  if (typeof module !== 'undefined' && module.exports) module.exports = pure;
  if (typeof document === 'undefined') return;

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
  // La consola se SUPERPONE (Carlos, 3-oct-2026): no envuelve el <body> ni le recorta
  // la altura; el contenido no se mueve al abrir ⌘. Ver docs/shell-cuadratico.md.
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
  // Modo Experto = mostrar el panel completo u ocultarlo del todo (Carlos, 5-oct-2026). Con la piel
  // anclada de la suite (suite/experto.js, data-min="hide") manda su estado (.ax-min) y el panel nativo
  // de la página (raíl, cuadrante o capa) lo sigue; sin piel, manda el nativo. Se recuerda en la pestaña.
  var OPEN_KEY = 'ax-experto-abierto';
  function nativeOpen() { return mode === 'rail' ? !document.body.classList.contains('pf-bottom-off') : mode === 'quad' ? !panel.classList.contains('is-collapsed') : !panel.hidden; }
  function setNative(open) {
    if (mode === 'rail') document.body.classList.toggle('pf-bottom-off', !open);
    else if (mode === 'quad') panel.classList.toggle('is-collapsed', !open);
    else panel.hidden = !open;
  }
  function docked() { return panel.classList.contains('ax-dock'); }
  try { if (sessionStorage.getItem(OPEN_KEY) === '1' && !nativeOpen()) setNative(true); } catch (_) {}
  function sync() {
    var open = docked() ? !panel.classList.contains('ax-min') : nativeOpen();
    if (docked() && nativeOpen() !== open) setNative(open);
    else if (!docked() && open !== wasOpen) { try { sessionStorage.setItem(OPEN_KEY, open ? '1' : '0'); } catch (_) {} }
    if (panel.dataset.cliOpen !== String(open)) panel.dataset.cliOpen = String(open);
    document.querySelectorAll('.pix-nav-icon-expert').forEach(function (b) { if (b.getAttribute('aria-expanded') !== String(open)) b.setAttribute('aria-expanded', String(open)); });
    // Al abrirse, desplegado: ficha + registro + orden (nunca la barra mínima).
    if (open && !wasOpen) resize(document.documentElement.hasAttribute('data-ax-experto') ? Math.max(expanded, 300) : expanded, false);
    wasOpen = open;
    if (document.body.classList.contains('pf-cli-open') !== open) document.body.classList.toggle('pf-cli-open', open);
    var vv = window.visualViewport;
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
    adapter: en ? '/en/adaptaciones/' : '/adaptaciones/', adaptador: '/adaptaciones/', stock: 'stock.html', assets: 'crear/', docs: 'documentacion/', radar: 'radar/'
  };
  function write(text) {
    var line = document.createElement('div');
    line.textContent = text;
    log.appendChild(line);
    while (log.childElementCount > 200) log.firstChild.remove();
    log.scrollTop = log.scrollHeight;
  }
  // La marca blanca se carga al usarla (site-nav.js la expone en PixeriaMarca.cargar).
  function marca() {
    if (window.AdmiraMarca) return Promise.resolve(window.AdmiraMarca);
    return window.PixeriaMarca && window.PixeriaMarca.cargar ? window.PixeriaMarca.cargar().catch(function () { return null; }) : Promise.resolve(null);
  }
  // El avatar lo gobierna el cargador único de admiranext.com (assets/avatar.js), que la
  // verja inyecta en cada página. Si aún no está, la capa fina /assets/avatar-digital.js lo trae.
  function cargarAvatar() {
    if (window.AdmiraAvatar) return Promise.resolve(window.AdmiraAvatar);
    if (window.AvatarDigital) return Promise.resolve(window.AvatarDigital);
    return new Promise(function (resolve) {
      var s = document.createElement('script');
      s.src = '/assets/avatar-digital.js';
      s.async = true;
      s.onload = function () { resolve(window.AvatarDigital || null); };
      s.onerror = function () { resolve(null); };
      document.head.appendChild(s);
    });
  }
  // /marca y el cliente activo (assets/cliente-activo.js · Carlos, 4-oct-2026, 20:32): el selector
  // «Cliente» está oculto y Admira lo ve todo. Superusuario: /marca todas lo enseña junto al logo,
  // /marca <cliente> filtra por ese cliente (y si además es una marca del catálogo, la viste) y
  // /marca off oculta el selector y vuelve a Admira (además de apagar la marca blanca, como siempre).
  // → true si ya está resuelto aquí; false para seguir con la marca blanca (runMarca).
  function marcaCliente(arg) {
    var PC = window.PixeriaCliente, a = String(arg || '').trim();
    // off oculta el selector aunque la lista de clientes aún no haya llegado.
    if (PC && /^off$/i.test(a) && !(PC.listo && PC.listo())) { PC.selector(false); PC.fijar(''); return false; }
    if (!PC || !PC.listo || !PC.listo()) return false;
    var def = PC.porDefecto(), defNombre = def ? def.nombre : 'Admira';
    if (/^(todas|todos|all)$/i.test(a)) {
      if (!PC.esAdmin()) { write(t('Solo el superusuario (cuentas de Carlos o sesión de agente) puede mostrar el selector de cliente.', 'Only the superuser (Carlos\'s accounts or an agent session) can show the client selector.')); return true; }
      PC.selector(true);
      write(t('Selector «Cliente» visible junto al logo. /marca <cliente> filtra; /marca off lo oculta y vuelve a ' + defNombre + '.', '«Client» selector shown next to the logo. /marca <client> filters; /marca off hides it and returns to ' + defNombre + '.'));
      return true;
    }
    if (/^off$/i.test(a)) {
      var habia = PC.selectorVisible() || !PC.esDefecto();
      PC.selector(false); PC.fijar('');
      if (habia) write(t('Selector de cliente oculto: ' + defNombre + ', con todo el contenido.', 'Client selector hidden: ' + defNombre + ', with all content.'));
      return false;
    }
    if (!a) { if (!PC.esDefecto()) write(t('Cliente activo: ' + PC.actual().nombre + '.', 'Active client: ' + PC.actual().nombre + '.')); return false; }
    var c = PC.resolver(a);
    if (!c || !PC.esAdmin()) return false;
    PC.fijar(c.id);
    write(PC.esDefecto() ? t('Cliente ' + c.nombre + ': ves todo el contenido.', c.nombre + ' client: you see all content.')
      : t('Cliente activo: ' + c.nombre + ' (' + c.id + ') en toda la sesión; solo su contenido y el genérico de ' + defNombre + '. /marca off vuelve a ' + defNombre + '.',
        'Active client: ' + c.nombre + ' (' + c.id + ') for the whole session; only its content plus ' + defNombre + ' generic content. /marca off returns to ' + defNombre + '.'));
    // Si también es una marca del catálogo de marca blanca, se aplica como antes (/marca starbucks).
    marca().then(function (M) {
      if (!M) return;
      return M.listar().catch(function () { return M.conocidas(); }).then(function (items) {
        if ((items || []).some(function (b) { return b.id === c.id || b.id === a.toLowerCase(); })) return runMarca(a, M, en, write);
      });
    });
    return true;
  }
  function normalizeLangToken(s) {
    var n = String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, '');
    if (!n) return '';
    if (/^(en|eng|english|ingles)$/.test(n)) return 'en';
    if (/^(es|esp|spa|spanish|espanol|castellano)$/.test(n)) return 'es';
    return null;
  }
  function parseLangCommand(text) {
    var raw = String(text == null ? '' : text).trim();
    if (!raw) return null;
    var body = raw.replace(/^\//, '').trim();
    var m = body.match(/^(idioma|language|languague)(?:[\s_-]*(.*))?$/i);
    if (!m) return null;
    var token = normalizeLangToken(m[2] || '');
    if (token === null) return {ok: false};
    var cur = document.documentElement.lang.indexOf('en') === 0 ? 'en' : 'es';
    return {ok: true, lang: token || (cur === 'en' ? 'es' : 'en')};
  }
  // Idioma del Experto: se recuerda en localStorage[admiranext_expert_lang] (la misma clave que lee
  // site-nav.js y que guarda suite/experto.js), para que el auto-redirect de pixeria a /en/ no te
  // devuelva al inglés tras /language ESP. Navega a la versión hreflang en ESTE origen.
  var LANG_KEY = 'admiranext_expert_lang';
  function expertLangUrl(l) {
    var I = window.PixeriaIdioma;
    if (I && typeof I.url === 'function') return I.url(l);
    var link = document.querySelector('link[rel="alternate"][hreflang="' + l + '"]');
    if (!link || !link.getAttribute('href')) return '';
    var target = new URL(link.getAttribute('href'), location.href);
    var cur = location.pathname.replace(/\/$/, '') || '/';
    var want = target.pathname.replace(/\/$/, '') || '/';
    if (cur === want) return '';
    var q = new URLSearchParams(location.search);
    q.delete('lang');
    if (l === 'es' && /(^|\.)pixeria\.(com|pages\.dev)$/.test(location.hostname)) q.set('lang', 'es');
    var qs = q.toString();
    return target.pathname + (qs ? '?' + qs : '') + location.hash;
  }
  function applyExpertLang(next) {
    var l = next === 'en' ? 'en' : 'es';
    try { localStorage.setItem(LANG_KEY, l); } catch (_) {}
    document.documentElement.lang = l;
    // La suite (si está) aplica el idioma y puede navegar ella misma, a la misma URL que calculamos aquí.
    try { if (typeof window.AdmiraSetLanguage === 'function') window.AdmiraSetLanguage(l); } catch (_) {}
    try {
      var url = expertLangUrl(l);
      if (url) { location.assign(url); return l; }
    } catch (_) {}
    try { document.dispatchEvent(new CustomEvent('admiranext:lang', {detail: {lang: l}})); } catch (_) {}
    return l;
  }
  function execute(command) {
    var langCmd = parseLangCommand(command);
    if (langCmd) {
      if (!langCmd.ok) {
        write(t('Usa /idioma o /language (toggle), /idioma ESP|ENG. También idiomaESP, languageENG…',
          'Use /idioma or /language (toggle), /idioma ESP|ENG. Also idiomaESP, languageENG…'));
        return;
      }
      applyExpertLang(langCmd.lang);
      write(langCmd.lang === 'en' ? 'Language: English' : 'Idioma: español');
      return;
    }
    var words = command.trim().split(/\s+/), name = words.shift().toLowerCase().replace(/^\//, ''), arg = words.join(' ');
    if (MARCA_VERB.test(name)) {
      if (!marcaCliente(arg)) marca().then(function (M) { return runMarca(arg, M, en, write); });
      return;
    }
    switch (name) {
      case 'help': case 'ayuda':
        write(t('Comandos en este navegador:', 'Commands in this browser:') + '\nhelp · clear · echo <text> · date · status · version · history\nopen <home|audio|music|images|video|stock|assets|docs|radar>\nidioma [/language] [ESP|ENG] — ' + t('alterna o fija el idioma (también idiomaESP)', 'toggle or set language (also idiomaESP)') + '\n' +
          t('/marca [marca] — Marca blanca del catálogo de admiranext.com/marcablanca: /marca <id> viste la web con esa marca, /marca off vuelve a Admira, /marca sola dice cuál está activa y lista las disponibles, /marca <web> abre el analizador en otra pestaña. Alias: /brand.',
            '/marca [brand] — White label from the admiranext.com/marcablanca catalogue: /marca <id> dresses the site in that brand, /marca off returns to Admira, /marca alone shows the active one and lists them, /marca <website> opens the analyser in a new tab. Alias: /brand.') + '\n' +
          t('marca: off (Admira), ', 'brand: off (Admira), ') + brandIds().join(', ') + t(' · o una web para analizarla (starbucks.es)', ' · or a website to analyse (starbucks.es)') + '\n' +
          t('/avatar good abre el calvo (cara 3D, 52 blendshapes) · /avatar better abre la chica (Ready Player Me, gafas) · /avatar best abre a Neo (MetaHuman; si el host de render está apagado, cae a la chica). /avatar sin nivel dice el estado. /avatarON lo muestra y /avatarOFF lo oculta. /avatar reset vuelve al interruptor del proyecto (alias /digitalAvatar, /cli ayudante). /avatarDigital, /avatar Digital o /admirito muestra u oculta a Admirito, la nube. Tu elección se recuerda en este navegador.',
            '/avatar good opens the bald 3D face (facecap, 52 blendshapes) · /avatar better opens the web girl (Ready Player Me, glasses) · /avatar best opens Neo (MetaHuman; if the render host is off, the girl takes over). /avatar alone shows the status. /avatarON shows it and /avatarOFF hides it. /avatar reset follows the project switch (aliases /digitalAvatar, /cli helper). /avatarDigital, /avatar Digital or /admirito shows or hides Admirito, the cloud. Your choice is remembered in this browser.') + '\n' +
          (window.PixeriaCliente && window.PixeriaCliente.esAdmin() ? t('/marca todas — superusuario: muestra el selector «Cliente» junto al logo; /marca <cliente> (o proyecto<Cliente>) filtra por ese cliente; /marca off lo oculta y vuelve a Admira, que lo ve todo.', '/marca todas — superuser: shows the «Client» selector next to the logo; /marca <client> (or proyecto<Client>) filters by that client; /marca off hides it and returns to Admira, which sees everything.') + '\n' : '') +
          t('↑/↓ historial · Tab completa comandos, marcas y secciones · arrastra el borde superior · doble clic para plegar/desplegar', '↑/↓ history · Tab completes commands, brands and sections · drag the top edge · double-click to collapse/expand'));
        break;
      case 'avatar': case 'avataron': case 'avataroff':
      case 'avatardigital': case 'digitalavatar': case 'admirito':
      case 'cli':
        if (name !== 'cli' || /^(ayudante|helper)(?:\s|$)/i.test(arg)) {
          cargarAvatar().then(function (A) {
            return A ? A.handle(command) : t('Avatar digital no disponible', 'Digital avatar unavailable');
          }).then(write);
          break;
        }
        write(t('Comando desconocido. Escribe help.', 'Unknown command. Type help.'));
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
  function brandIds() {
    try { if (window.AdmiraMarca) return window.AdmiraMarca.conocidas().map(function (b) { return b.id; }); } catch (_) {}
    return BRAND_SEED.slice();
  }
  input.addEventListener('keydown', function (ev) {
    if (ev.key === 'Tab' && !ev.shiftKey && !ev.altKey && !ev.ctrlKey && !ev.metaKey && input.value.trim()) {
      var c = complete(input.value, brandIds(), Object.keys(sections));
      if (!c.options.length) return;
      ev.preventDefault();
      input.value = c.value;
      if (c.options.length > 1) { if (height === MIN) resize(expanded, false); write(c.options.join('  ')); }
      // Con /marca se trae el catálogo real para el siguiente Tab (solo al usar /marca).
      if (/^\s*\/?(?:marca|brand|marcablanca)\s/i.test(input.value)) marca().then(function (M) { if (M) M.listar().catch(function () {}); });
      return;
    }
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
