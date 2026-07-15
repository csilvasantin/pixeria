/* Navegacion superior canonica de Pixeria.
 * La home conserva Idioma y Contacto. Las paginas interiores reutilizan las
 * mismas diez secciones, en el mismo orden, sin esos dos controles.
 */
(function () {
  var ES = [
    ['/audio.html', 'Audio'],
    ['/musica.html', 'Música'],
    ['/imagenes.html', 'Imágenes'],
    ['/video.html', 'Video'],
    ['/publicidad.html', 'Publicidad'],
    ['/anonimizador.html', 'Anonimizador'],
    ['/crear/', 'Assets'],
    ['/stock.html', 'Stock']
  ];
  var EN = [
    ['/en/audio.html', 'Audio'],
    ['/en/musica.html', 'Music'],
    ['/en/imagenes.html', 'Images'],
    ['/en/video.html', 'Video'],
    ['/en/publicidad.html', 'Advertising'],
    ['/en/anonimizador.html', 'Anonymizer'],
    ['/en/crear/', 'Assets'],
    ['/en/stock.html', 'Stock']
  ];

  function norm(path) {
    return String(path || '').replace(/index\.html$/, '').replace(/\.html$/, '').replace(/\/$/, '') || '/';
  }

  function isHome() {
    var path = norm(location.pathname);
    return path === '/' || path === '/en';
  }

  function render(nav, items) {
    var here = norm(location.pathname);
    nav.replaceChildren();
    items.forEach(function (item) {
      var link = document.createElement('a');
      link.href = item[0];
      link.textContent = item[1];
      if (norm(item[0]) === here) {
        link.classList.add('active');
        link.setAttribute('aria-current', 'page');
      }
      nav.appendChild(link);
    });
  }

  function iconSvg(kind) {
    if (kind === 'menu') {
      return '<svg viewBox="0 0 16 14" aria-hidden="true"><path class="menu-line" d="M3 3.5h10M3 7h10M3 10.5h10"/></svg>';
    }
    if (kind === 'advanced') {
      return '<svg viewBox="0 0 16 14" aria-hidden="true"><rect class="frame" x="1" y="1" width="14" height="12" rx="1.5"/><rect class="panel" x="10" y="1.6" width="4.4" height="10.8" rx="1"/></svg>';
    }
    return '<svg viewBox="0 0 16 14" aria-hidden="true"><rect class="frame" x="1" y="1" width="14" height="12" rx="1.5"/><rect class="panel" x="1.6" y="8.4" width="12.8" height="4" rx="1"/></svg>';
  }

  function iconButton(kind, label) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'pix-nav-icon pix-nav-icon-' + kind;
    button.setAttribute('aria-label', label);
    button.setAttribute('title', label);
    button.innerHTML = iconSvg(kind);
    return button;
  }

  function installIconStyles() {
    if (document.getElementById('pixeria-site-nav-styles')) return;
    var style = document.createElement('style');
    style.id = 'pixeria-site-nav-styles';
    style.textContent =
      '.pix-nav-leading{display:flex;align-items:center;gap:10px;min-width:0}' +
      '.pix-nav-controls{display:flex;align-items:center;gap:10px}' +
      '.pf-topbar{box-sizing:border-box;position:sticky;top:0;z-index:180;min-height:70px;display:grid;grid-template-columns:minmax(190px,auto) minmax(0,1fr) auto;align-items:center;gap:18px;padding:0 28px;background:rgba(2,6,2,.92);border:0;border-bottom:1px solid rgba(26,74,34,.95)!important;box-shadow:0 0 24px rgba(0,255,65,.08);backdrop-filter:blur(10px)}' +
      '.pf-topbar-left,.pf-topbar-right{display:flex;align-items:center;gap:12px;min-width:0}.pf-topbar-right{justify-content:flex-end}' +
      '.pf-topbar-brand{display:inline-flex;align-items:center;gap:12px;min-width:0}' +
      '.pf-brand-mark{box-sizing:border-box;width:34px;height:34px;display:grid;place-items:center;border:1px solid var(--line,rgba(0,255,65,.38));color:var(--matrix,#00ff41);background:rgba(0,255,65,.10);text-shadow:0 0 12px rgba(0,255,65,.62);font-weight:800}' +
      '.pf-brand-name{color:var(--ink,#e8f2ec);font-weight:800;letter-spacing:.08em}' +
      '.quad-ui.pix-nav-canonical-header{padding:0!important}' +
      '.pix-nav-home-rails.quad-ui:not(.pix-nav-canonical-header){padding:70px 0 0!important}.pix-nav-home-rails .quad-top{top:0;left:0;right:0;width:auto;height:70px;min-height:70px;box-sizing:border-box;padding:0 28px;border:0;border-bottom:1px solid rgba(26,74,34,.95);box-shadow:0 0 24px rgba(0,255,65,.08);z-index:180}' +
      '.pix-nav-home-rails .rail{position:fixed;top:70px;bottom:0;z-index:160;width:var(--pf-left-w,300px);max-height:none;overflow:auto;border:1px solid rgba(140,160,150,.30);border-radius:0;background:rgba(2,10,5,.90);box-shadow:0 0 34px rgba(0,255,65,.10);backdrop-filter:blur(8px)}' +
      '.pix-nav-home-rails .rail-left{left:0;border-left:0;border-top:2px solid #68dce9;border-right-color:#68dce9}.pix-nav-home-rails .rail-right{right:0;width:var(--pf-right-w,330px);border-right:0;border-top:2px solid #e8c268;border-left-color:#e8c268}' +
      '.pix-nav-home-rails .rail-hd{position:sticky;top:0;z-index:3;margin:0;padding:13px 16px 11px;font-size:12px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#9ab0a4;background:rgba(8,14,10,.78);border-bottom:1px solid rgba(140,160,150,.30)}.pix-nav-home-rails .rail-left .rail-hd{color:#68dce9}.pix-nav-home-rails .rail-right .rail-hd{color:#e8c268}' +
      '.pix-nav-home-rails .rail-nav{display:flex;flex-direction:column;padding:8px}.pix-nav-home-rails .rail-nav a{display:block;padding:10px 12px;border:1px solid transparent;color:#c8ffd0;text-decoration:none}.pix-nav-home-rails .rail-nav a:hover,.pix-nav-home-rails .rail-nav a[aria-current="page"]{border-color:#00ff41;background:rgba(0,255,65,.07)}.pix-nav-home-rails .rail-nav b{display:block;font-weight:760;font-size:14px;color:#e8f2ec}.pix-nav-home-rails .rail-nav small{display:block;margin-top:2px;font-size:11.5px;color:#7fae8c;line-height:1.3}.pix-nav-home-rails .rail-extra{padding:4px 16px 18px}.pix-nav-home-rails .rail-sub{margin:6px 0 8px;font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#9ab0a4}.pix-nav-home-rails .rail-doc{display:block;padding:9px 0;font-size:13.5px;color:#e8f2ec;border-bottom:1px solid rgba(140,160,150,.30);text-decoration:none}' +
      '.pix-nav-home-rails main{margin-left:var(--pf-left-w,300px);margin-right:var(--pf-right-w,330px);transition:margin .16s ease}.pix-nav-home-rails.pf-left-off .rail-left{display:none}.pix-nav-home-rails.pf-right-off .rail-right{display:none}.pix-nav-home-rails.pf-left-off main{margin-left:0}.pix-nav-home-rails.pf-right-off main{margin-right:0}' +
      '.pix-nav-icon{width:42px;height:42px;display:inline-grid;place-items:center;flex:0 0 42px;padding:0;border:1px solid rgba(0,255,65,.42);border-radius:0;background:rgba(0,255,65,.04);color:#00ff41;cursor:pointer;box-shadow:inset 0 0 16px rgba(0,255,65,.04)}' +
      '.pix-nav-icon:hover,.pix-nav-icon[aria-expanded="true"]{background:rgba(0,255,65,.12);box-shadow:0 0 16px rgba(0,255,65,.18),inset 0 0 16px rgba(0,255,65,.08)}' +
      '.pix-nav-icon svg{width:21px;height:19px;display:block}' +
      '.pix-nav-icon .frame{fill:none;stroke:#8bd49f;stroke-width:1.4}' +
      '.pix-nav-icon .panel{fill:#8bd49f;opacity:.72}' +
      '.pix-nav-icon-menu .menu-line{fill:none;stroke:#00ff41;stroke-width:2.1;stroke-linecap:square;filter:drop-shadow(0 0 3px rgba(0,255,65,.9))}' +
      '.pix-nav-icon-advanced{border-color:rgba(232,194,104,.58)}' +
      '.primary-nav,.site-header .nav,.quad-links,.pf-topbar-nav{display:flex;align-items:center;justify-content:center;gap:5px!important}' +
      '.primary-nav a,.site-header .nav a,.quad-links a,.pf-topbar-nav a{flex:0 1 auto;min-width:0;padding:8px 10px!important;border:1px solid transparent!important;border-radius:0!important;background:transparent!important;color:#c8ffd0!important;font-size:12px!important;font-weight:400!important;line-height:1.55!important;letter-spacing:.08em!important;text-transform:uppercase!important;white-space:nowrap;text-decoration:none!important}' +
      '.primary-nav a:hover,.site-header .nav a:hover,.quad-links a:hover,.pf-topbar-nav a:hover,.primary-nav a.active,.site-header .nav a.active,.quad-links a.active,.pf-topbar-nav a.active,.primary-nav a[aria-current="page"],.site-header .nav a[aria-current="page"],.quad-links a[aria-current="page"],.pf-topbar-nav a[aria-current="page"]{color:#00ff41!important;border-color:#00ff41!important;background:rgba(0,255,65,.1)!important;text-shadow:0 0 12px rgba(0,255,65,.62)!important}' +
      '.quad-brand,.pf-topbar-brand,.pf-topbar-lang,.pf-topbar-contact{text-decoration:none!important}' +
      '.pix-nav-layer{position:fixed;z-index:1200;border:1px solid rgba(0,255,65,.42);background:rgba(0,10,3,.97);color:#caffd7;box-shadow:0 0 28px rgba(0,255,65,.18);font:700 12px/1.4 "IBM Plex Mono",monospace}' +
      '.pix-nav-layer[hidden]{display:none!important}' +
      '.pix-nav-advanced-layer{top:72px;right:18px;width:min(330px,calc(100vw - 36px));padding:18px;display:grid;gap:8px}' +
      '.pix-nav-expert-layer{left:18px;right:18px;bottom:18px;padding:12px 16px;display:flex;align-items:center;justify-content:center;gap:18px;flex-wrap:wrap}' +
      '.pix-nav-layer a{color:#caffd7;text-decoration:none;border:1px solid rgba(0,255,65,.22);padding:9px 11px}' +
      '.pix-nav-layer a:hover{color:#00ff41;border-color:#00ff41}' +
      '.quad-right a{min-height:86px;display:flex;align-items:center;justify-content:center;writing-mode:vertical-rl;text-orientation:mixed;padding:8px 4px;font-size:11px;letter-spacing:.08em;text-transform:uppercase}' +
      '@media(max-width:980px){.pf-topbar{grid-template-columns:1fr auto;min-height:62px;padding:0 14px;gap:10px}.pf-topbar-left{grid-column:1;grid-row:1}.pf-topbar-right{grid-column:2;grid-row:1}.pf-topbar-nav{grid-column:1/-1;grid-row:2;justify-content:flex-start!important;overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:8px}.pf-topbar-nav a{flex:0 0 auto!important}.pix-nav-icon{width:38px;height:38px;flex-basis:38px}.pix-nav-controls{gap:6px}}';
    (document.head || document.documentElement).appendChild(style);
  }

  function canonicalBrand(brand) {
    var link = brand && (String(brand.tagName || '').toLowerCase() === 'a' ? brand : brand.querySelector('a'));
    if (!link) return brand;
    if (link !== brand) {
      link.remove();
      brand.parentNode.replaceChild(link, brand);
    }
    link.className = 'pf-topbar-brand';
    var mark = link.querySelector('.brand-mark, span');
    var name = link.querySelector('.brand-name, b, span:not(:first-child)');
    if (mark) mark.className = 'pf-brand-mark';
    if (name) name.className = 'pf-brand-name';
    return link;
  }

  function canonicalHeader(header, menu, brand, nav, advanced, expert) {
    if (!header || !menu || !brand || !nav || !advanced || !expert) return;
    var left = document.createElement('div');
    var right = document.createElement('div');
    left.className = 'pf-topbar-left';
    right.className = 'pf-topbar-right';
    menu.classList.remove('quad-icon');
    advanced.classList.remove('quad-icon');
    expert.classList.remove('quad-icon');
    left.appendChild(menu);
    left.appendChild(canonicalBrand(brand));
    nav.className = 'pf-topbar-nav';
    right.appendChild(advanced);
    right.appendChild(expert);
    header.className = 'pf-topbar';
    while (header.firstChild) header.removeChild(header.firstChild);
    header.appendChild(left);
    header.appendChild(nav);
    header.appendChild(right);
    document.body.classList.add('pix-nav-canonical-header');
  }

  function ensureFallbackLayers() {
    if (!document.getElementById('pixNavAdvancedLayer')) {
      var advanced = document.createElement('aside');
      advanced.id = 'pixNavAdvancedLayer';
      advanced.className = 'pix-nav-layer pix-nav-advanced-layer';
      advanced.hidden = true;
      advanced.innerHTML = '<a href="/radar/">Radar</a><a href="/plataforma.html">Plataforma</a><a href="/documentacion/">Documentación</a><a href="/concepto.html">Concepto Pixeria</a>';
      document.body.appendChild(advanced);
    }
    if (!document.getElementById('pixNavExpertLayer')) {
      var expert = document.createElement('div');
      expert.id = 'pixNavExpertLayer';
      expert.className = 'pix-nav-layer pix-nav-expert-layer';
      expert.hidden = true;
      expert.innerHTML = '<span>Pixeria · sistema creativo</span><a href="/stock.html">Stock</a><a href="/documentacion/">Documentación</a><a href="https://www.xpaceos.com">XpaceOS</a><a href="https://www.admira.app">Admira</a>';
      document.body.appendChild(expert);
    }
  }

  var HOME_RAIL_SECTIONS = [
    ['/crear/', 'Studio · Crear', 'Generar assets: video, imagen, audio, texto, mobiliario'],
    ['/musica.html', 'Música', 'Bandas sonoras, jingles y marca sonora'],
    ['/audio.html', 'Audio · Megafonía', 'Voces, locución y megafonía de marca'],
    ['/video.html', 'Vídeo', 'Storyboards, generación, edición y loops'],
    ['/imagenes.html', 'Imágenes', 'Dirección de arte, producto y estilo'],
    ['/avatar.html', 'Avatar 3D', 'Presentadores y avatares generativos'],
    ['/anonimizador.html', 'Anonimizador', 'Privacidad en imagen y vídeo'],
    ['/plataforma.html', 'Plataforma', 'Mapa de capas, motores y salida a XpaceOS'],
    ['/stock.html', 'Stock', 'Galería pública de assets desplegados'],
    ['/crear-campana/', 'Campañas', 'Compra y activación en puntos y pantallas'],
    ['/publicidad.html', 'Publicidad', 'Formatos y activos por canal'],
    ['/clearchannel/', 'Demo Clear Channel', 'Pixer Feed en vivo sobre pantallas reales']
  ];
  var HOME_RAIL_DOCS = [
    ['/radar/', 'Radar completo de modelos'],
    ['/plataforma.html', 'Arquitectura de plataforma'],
    ['/documentacion/', 'Documentación'],
    ['/concepto.html', 'Concepto Pixeria']
  ];

  function ensureHomeRails() {
    if (isHome() || document.querySelector('.rail-left')) return;
    document.querySelectorAll('.quad-left,.quad-right,.quad-bottom').forEach(function (rail) { rail.remove(); });
    var here = norm(location.pathname);
    var left = document.createElement('aside');
    left.className = 'rail rail-left';
    left.setAttribute('aria-label', 'Opciones · secciones de Pixeria');
    left.innerHTML = '<div class="rail-hd">🔍 Opciones</div><nav class="rail-nav" aria-label="Secciones de Pixeria">' +
      HOME_RAIL_SECTIONS.map(function (s) {
        var current = norm(s[0]) === here;
        return '<a href="' + s[0] + '"' + (current ? ' aria-current="page"' : '') + '><b>' + s[1] + '</b><small>' + s[2] + '</small></a>';
      }).join('') + '</nav>';
    var right = document.createElement('aside');
    right.className = 'rail rail-right';
    right.setAttribute('aria-label', 'Avanzado · método y detalle');
    right.innerHTML = '<div class="rail-hd">⚙️ Avanzado</div><div class="rail-extra"><p class="rail-sub">Radar ampliado y documentación</p>' +
      HOME_RAIL_DOCS.map(function (d) { return '<a class="rail-doc" href="' + d[0] + '">' + d[1] + ' →</a>'; }).join('') + '</div>';
    document.body.appendChild(left);
    document.body.appendChild(right);
    document.body.classList.add('pix-nav-home-rails');
    try {
      if (localStorage.getItem('pixeria_pf_left') !== '1') document.body.classList.add('pf-left-off');
      if (localStorage.getItem('pixeria_pf_right') !== '1') document.body.classList.add('pf-right-off');
    } catch (_) {
      document.body.classList.add('pf-left-off', 'pf-right-off');
    }
  }

  function bindRailToggles() {
    if (!document.body.classList.contains('pix-nav-home-rails')) return;
    var controls = [
      ['.pix-nav-icon-menu', 'pf-left-off', 'pixeria_pf_left'],
      ['.pix-nav-icon-advanced', 'pf-right-off', 'pixeria_pf_right']
    ];
    controls.forEach(function (item) {
      var button = document.querySelector('.pf-topbar ' + item[0] + ', .quad-top ' + item[0] + ', .site-header ' + item[0] + ', .topnav ' + item[0]);
      if (!button || button.dataset.railToggle === '1') return;
      button.dataset.railToggle = '1';
      button.addEventListener('click', function () {
        var open = document.body.classList.toggle(item[1]);
        button.setAttribute('aria-pressed', open ? 'false' : 'true');
        try { localStorage.setItem(item[2], open ? '0' : '1'); } catch (_) {}
      });
    });
  }

  function bindStandardControls(header) {
    if (header.dataset.pixNavIcons === '1') return;
    header.dataset.pixNavIcons = '1';
    var brand = header.querySelector(':scope > .brand, :scope > .pix-nav-leading > .brand');
    if (!brand) return;

    var leading = brand.parentElement && brand.parentElement.classList.contains('pix-nav-leading') ? brand.parentElement : document.createElement('div');
    if (!leading.classList.contains('pix-nav-leading')) {
      leading.className = 'pix-nav-leading';
      brand.replaceWith(leading);
      leading.appendChild(brand);
    }
    var menu = iconButton('menu', 'Mostrar u ocultar menú');
    leading.insertBefore(menu, brand);

    var actions = header.querySelector(':scope > .topnav-actions, :scope > .header-actions');
    if (!actions) {
      actions = document.createElement('div');
      actions.className = 'topnav-actions';
      header.appendChild(actions);
    }
    actions.querySelectorAll('.nav-toggle').forEach(function (oldToggle) { oldToggle.remove(); });
    var controls = document.createElement('div');
    controls.className = 'pix-nav-controls';
    var advanced = iconButton('advanced', 'Abrir panel avanzado');
    var expert = iconButton('expert', 'Abrir panel experto');
    controls.appendChild(advanced);
    controls.appendChild(expert);
    actions.appendChild(controls);

    ensureFallbackLayers();
    var nav = header.querySelector('.primary-nav, .nav');
    var mobileNav = document.getElementById('mobileNav');
    menu.addEventListener('click', function () {
      if (mobileNav && innerWidth <= 860) {
        var open = !mobileNav.classList.contains('open');
        mobileNav.classList.toggle('open', open);
        menu.setAttribute('aria-expanded', open ? 'true' : 'false');
      } else if (nav) {
        nav.hidden = !nav.hidden;
        menu.setAttribute('aria-expanded', nav.hidden ? 'false' : 'true');
      }
    });
    function bindLayer(button, id) {
      button.addEventListener('click', function () {
        var layer = document.getElementById(id);
        var open = layer.hidden;
        document.querySelectorAll('.pix-nav-layer').forEach(function (other) { other.hidden = true; });
        document.querySelectorAll('.pf-topbar-right .pix-nav-icon, .pix-nav-controls .pix-nav-icon').forEach(function (other) { other.setAttribute('aria-expanded', 'false'); });
        layer.hidden = !open;
        button.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    }
    bindLayer(advanced, 'pixNavAdvancedLayer');
    bindLayer(expert, 'pixNavExpertLayer');
    try { canonicalHeader(header, menu, brand, nav, advanced, expert); } catch (_) {}
  }

  function upgradeQuadControls() {
    document.querySelectorAll('.quad-top').forEach(function (topbar) {
      var left = topbar.querySelector('[data-quad-toggle="left"]');
      var right = topbar.querySelector('[data-quad-toggle="right"], .pix-nav-icon-advanced');
      var bottom = topbar.querySelector('[data-quad-toggle="bottom"]');
      if (left) {
        left.classList.add('pix-nav-icon', 'pix-nav-icon-menu');
        left.innerHTML = iconSvg('menu');
      }
      if (!right) {
        var rightPanel = document.createElement('nav');
        rightPanel.className = 'quad-menu quad-right is-collapsed';
        rightPanel.setAttribute('aria-label', 'Navegación avanzada');
        rightPanel.innerHTML = '<a href="/radar/">Radar</a><a href="/documentacion/">Docs</a>';
        topbar.parentNode.insertBefore(rightPanel, topbar.nextSibling);
        right = iconButton('advanced', 'Desplegar menú avanzado derecho');
        right.classList.add('quad-icon');
        right.addEventListener('click', function () {
          var open = rightPanel.classList.contains('is-collapsed');
          rightPanel.classList.toggle('is-collapsed', !open);
          document.body.classList.toggle('quad-right-open', open);
          right.classList.toggle('is-active', open);
          right.setAttribute('aria-expanded', open ? 'true' : 'false');
        });
        topbar.insertBefore(right, bottom || null);
      } else {
        right.classList.add('pix-nav-icon', 'pix-nav-icon-advanced');
        right.innerHTML = iconSvg('advanced');
      }
      if (bottom) {
        bottom.classList.add('pix-nav-icon', 'pix-nav-icon-expert');
        bottom.innerHTML = iconSvg('expert');
      }
      try { canonicalHeader(topbar, left, topbar.querySelector('.quad-brand'), topbar.querySelector('.quad-links'), right, bottom); } catch (_) {}
    });
  }

  function upgradeFrameControls() {
    document.querySelectorAll('.pf-topbar').forEach(function (topbar) {
      var menu = topbar.querySelector('.pf-window-left');
      var advanced = topbar.querySelector('.pf-window-advanced');
      var expert = topbar.querySelector('.pf-window-expert');
      if (menu) {
        menu.classList.add('pix-nav-icon', 'pix-nav-icon-menu');
        menu.innerHTML = iconSvg('menu');
      }
      if (advanced) {
        advanced.classList.add('pix-nav-icon', 'pix-nav-icon-advanced');
        advanced.innerHTML = iconSvg('advanced');
      }
      if (expert) {
        expert.classList.add('pix-nav-icon', 'pix-nav-icon-expert');
        expert.innerHTML = iconSvg('expert');
      }
    });
  }

  function normalizeInternalNav() {
    installIconStyles();
    if (isHome()) {
      upgradeFrameControls();
      return;
    }
    var english = (document.documentElement.lang || '').toLowerCase().indexOf('en') === 0;
    var items = english ? EN : ES;

    document.querySelectorAll('.primary-nav, .site-header .nav, .quad-links, .pf-topbar-nav').forEach(function (nav) {
      render(nav, items);
    });

    document.querySelectorAll(
      '.topnav-actions .language-switcher, .topnav-actions .nav-action, ' +
      '.site-header .header-actions > .language-switcher, .site-header .header-actions > .nav-action, ' +
      '.pf-topbar-lang, .pf-topbar-contact, .quad-cta'
    ).forEach(function (element) {
      element.remove();
    });

    document.querySelectorAll('.quad-brand small').forEach(function (label) {
      label.remove();
    });
    upgradeQuadControls();
    upgradeFrameControls();
    ensureHomeRails();
    bindRailToggles();

    // Si cuadratura.js ya creó la barra canónica, sus tres SVG son los buenos.
    // En las demás familias se montan los mismos controles alrededor del menú.
    if (!document.querySelector('.pf-topbar')) {
      document.querySelectorAll('.site-header, .topnav').forEach(bindStandardControls);
    }
  }

  function start() {
    normalizeInternalNav();
    // cuadratura.js crea la barra de la home de forma diferida; esta segunda
    // pasada normaliza tambien esa barra cuando se reutiliza en una interior.
    setTimeout(normalizeInternalNav, 0);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
