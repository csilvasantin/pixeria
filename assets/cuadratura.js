/* ══════════════════════════════════════════════════════════════════════════
   Cuadratura AdmiraNeXT · Pixeria — toggles + AUTO-CUADRATURA (autónoma)
   Patrón de 4 zonas en TODAS las páginas con chrome estándar (Carlos 2026-07-11):
     · OPCIONES  → raíl IZQUIERDO  (.rail-left)   navegación de secciones
     · CENTRO    → lo importante   (.cuad-center)
     · AVANZADO  → raíl DERECHO    (.rail-right)   detalle/documentación
     · EXPERTO   → franja INFERIOR (.rail-bottom)  meta + versión + estado
   Dos modos:
     1) La página trae su .cuad ARTESANAL (index, en/) → aquí solo se montan
        los iconos toggle en la barra superior.
     2) La página NO trae .cuad → AUTO-CUADRATURA: se envuelve el <main> y se
        inyectan los tres raíles estándar. El raíl AVANZADO admite contenido
        propio de la página vía <template id="cuad-avanzado">.
   Persistencia en localStorage pixeria_pf_left/right/bottom (abierto === "1");
   el estado inicial sin parpadeo lo aplica un script inline al abrir <body>.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  // ── Fuente ÚNICA de las secciones del raíl OPCIONES (mismo orden que la home) ──
  var SECTIONS = [
    { href: '/crear/',            t: 'Studio · Crear',    d: 'Generar assets: video, imagen, audio, texto, mobiliario' },
    { href: '/musica.html',       t: 'Música',            d: 'Bandas sonoras, jingles y marca sonora' },
    { href: '/audio.html',        t: 'Audio · Megafonía', d: 'Voces, locución y megafonía de marca' },
    { href: '/video.html',        t: 'Vídeo',             d: 'Storyboards, generación, edición y loops' },
    { href: '/imagenes.html',     t: 'Imágenes',          d: 'Dirección de arte, producto y estilo' },
    { href: '/avatar.html',       t: 'Avatar 3D',         d: 'Presentadores y avatares generativos' },
    { href: '/anonimizador.html', t: 'Anonimizador',      d: 'Privacidad en imagen y vídeo' },
    { href: '/plataforma.html',   t: 'Plataforma',        d: 'Mapa de capas, motores y salida a XpaceOS' },
    { href: '/stock.html',        t: 'Stock',             d: 'Galería pública de assets desplegados' },
    { href: '/crear-campana/',    t: 'Campañas',          d: 'Compra y activación en puntos y pantallas' },
    { href: '/xpacios/',          t: 'Xpacios',           d: 'Gemelos isométricos de tus locales' },
    { href: '/publicidad.html',   t: 'Publicidad',        d: 'Formatos y activos por canal' },
    { href: '/clearchannel/',     t: 'Demo Clear Channel', d: 'Pixer Feed en vivo sobre pantallas reales' }
  ];
  var DOCS = [
    { href: '/radar/',            t: 'Radar completo de modelos' },
    { href: '/plataforma.html',   t: 'Arquitectura de plataforma' },
    { href: '/documentacion/',    t: 'Documentación' },
    { href: '/concepto.html',     t: 'Concepto Pixeria' }
  ];

  var PANELS = [
    { sel: '.rail-left', cls: 'pf-left-off', ls: 'pixeria_pf_left',
      title: 'Opciones · panel izquierdo',
      svg: '<rect class="frame" x="1" y="1" width="14" height="12" rx="1.5"/><rect class="panel" x="1.6" y="1.6" width="4.4" height="10.8" rx="1"/>' },
    { sel: '.rail-right', cls: 'pf-right-off', ls: 'pixeria_pf_right',
      title: 'Avanzado · panel derecho',
      svg: '<rect class="frame" x="1" y="1" width="14" height="12" rx="1.5"/><rect class="panel" x="10" y="1.6" width="4.4" height="10.8" rx="1"/>' },
    { sel: '.rail-bottom', cls: 'pf-bottom-off', ls: 'pixeria_pf_bottom',
      title: 'Experto · panel inferior',
      svg: '<rect class="frame" x="1" y="1" width="14" height="12" rx="1.5"/><rect class="panel" x="1.6" y="8.4" width="12.8" height="4" rx="1"/>' }
  ];

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

  // ── AUTO-CUADRATURA: envuelve <main> e inyecta los raíles estándar ────────
  function buildAutoCuad() {
    if (document.querySelector('.cuad')) return;                  // ya es artesanal
    // Las páginas quad-ui (audio/música/imágenes/vídeo, marco de 4 bordes estilo
    // Admira.tv) traen SU propia cuadratura completa — no doble-enmarcar.
    if (document.body.classList.contains('quad-ui') || document.querySelector('.quad-menu')) return;
    var main = document.querySelector('main');
    if (!main || !document.querySelector('.admira-nav')) return;  // solo chrome estándar

    var center = document.createElement('div');
    center.className = 'cuad-center';
    while (main.firstChild) center.appendChild(main.firstChild);

    // Normaliza rutas para casar la sección ACTUAL aunque el server sirva sin
    // extensión (/audio ~ /audio.html) o sin barra final (/crear ~ /crear/).
    function normPath(p){ return String(p).replace(/index\.html$/, '').replace(/\.html$/, '').replace(/\/$/, '') || '/'; }
    var here = normPath(location.pathname);
    var left = document.createElement('aside');
    left.className = 'rail rail-left';
    left.setAttribute('aria-label', 'Opciones · secciones de Pixeria');
    left.innerHTML = '<div class="rail-hd">🔍 Opciones</div>' +
      '<nav class="rail-nav" aria-label="Secciones de Pixeria">' +
      SECTIONS.map(function (s) {
        var cur = normPath(s.href) === here;
        return '<a href="' + s.href + '"' + (cur ? ' class="rail-cur" aria-current="page"' : '') + '>' +
          '<b>' + esc(s.t) + '</b><small>' + esc(s.d) + '</small></a>';
      }).join('') + '</nav>';

    var right = document.createElement('aside');
    right.className = 'rail rail-right';
    right.setAttribute('aria-label', 'Avanzado · método y detalle');
    var tpl = document.getElementById('cuad-avanzado');   // contenido AVANZADO propio de la página (opcional)
    right.innerHTML = '<div class="rail-hd">⚙️ Avanzado</div>' + (tpl ? tpl.innerHTML :
      '<div class="rail-extra"><p class="rail-sub">Radar ampliado y documentación</p>' +
      DOCS.map(function (d) { return '<a class="rail-doc" href="' + d.href + '">' + esc(d.t) + ' &rarr;</a>'; }).join('') +
      '</div>');

    var ver = (document.querySelector('meta[name="admiranext-version"]') || {}).content || 'Pixeria';
    var bottom = document.createElement('div');
    bottom.className = 'rows rail-bottom';
    bottom.setAttribute('aria-label', 'Experto · meta y estado');
    bottom.innerHTML = '<div class="rail-hd">🧪 Experto</div>' +
      '<div class="rail-meta">' +
      '<span class="rail-ver">' + esc(ver) + '</span>' +
      '<a href="https://www.admira.live">Estado del equipo · Live</a>' +
      '<a href="/radar/">Radar</a>' +
      '<a href="/documentacion/">Documentación</a>' +
      '<a href="https://www.xpaceos.com">XpaceOS</a>' +
      '<a href="https://www.admira.app">Admira</a>' +
      '</div>';

    var cuad = document.createElement('div');
    cuad.className = 'cuad';
    cuad.appendChild(left); cuad.appendChild(center); cuad.appendChild(right); cuad.appendChild(bottom);
    main.appendChild(cuad);
  }

  // ── Toggles (look SCUMM, tematizados en cuadratura.css) ───────────────────
  function makeToggle(p) {
    if (!document.querySelector(p.sel)) return null;
    var on = !document.body.classList.contains(p.cls);
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'pf-ico' + (on ? ' on' : '');
    b.title = p.title;
    b.setAttribute('aria-label', p.title);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.innerHTML = '<svg viewBox="0 0 16 14" aria-hidden="true">' + p.svg + '</svg>';
    b.onclick = function () {
      var off = document.body.classList.toggle(p.cls);
      try { localStorage.setItem(p.ls, off ? '0' : '1'); } catch (e) {}
      b.classList.toggle('on', !off);
      b.setAttribute('aria-pressed', off ? 'false' : 'true');
    };
    return b;
  }

  function isActive(href) {
    var a = document.createElement('a');
    a.href = href;
    function normPath(p){ return String(p).replace(/index\.html$/, '').replace(/\.html$/, '').replace(/\/$/, '') || '/'; }
    return normPath(a.pathname) === normPath(location.pathname);
  }

  function mainNavItems() {
    var stockNav = document.querySelector('.primary-nav');
    var siteNav = document.querySelector('.site-header .nav');
    var source = stockNav || siteNav;
    if (source) {
      return Array.prototype.slice.call(source.querySelectorAll('a')).map(function (a) {
        return { href: a.getAttribute('href') || a.href, t: a.textContent.trim() };
      }).filter(function (a) { return a.href && a.t; });
    }
    return SECTIONS.slice(0, 10).map(function (s) { return { href: s.href, t: s.t.replace(/^.*·\s*/, '') }; });
  }

  function pageLanguageLink() {
    return document.querySelector('.language-switcher a, .topnav-actions .language-switcher a, .mobile-language-switcher a');
  }

  function buildTopbar() {
    if (document.querySelector('.pf-topbar')) return;
    var leftToggle = makeToggle(PANELS[0]);
    var rightToggle = makeToggle(PANELS[1]);
    var bottomToggle = makeToggle(PANELS[2]);
    if (!leftToggle || !rightToggle || !bottomToggle) return;

    leftToggle.classList.add('pf-window-left');
    rightToggle.classList.add('pf-window-advanced');
    bottomToggle.classList.add('pf-window-expert');

    var bar = document.createElement('header');
    bar.className = 'pf-topbar';
    bar.setAttribute('aria-label', 'Pixeria · marco cuadrático');

    var left = document.createElement('div');
    left.className = 'pf-topbar-left';
    left.appendChild(leftToggle);

    var brand = document.createElement('a');
    brand.className = 'pf-topbar-brand';
    brand.href = '/';
    brand.setAttribute('aria-label', 'Pixeria inicio');
    brand.innerHTML = '<span class="pf-brand-mark">P</span><span class="pf-brand-name">Pixeria</span>';
    left.appendChild(brand);

    var nav = document.createElement('nav');
    nav.className = 'pf-topbar-nav';
    nav.setAttribute('aria-label', 'Secciones principales de Pixeria');
    mainNavItems().forEach(function (item) {
      var a = document.createElement('a');
      a.href = item.href;
      a.textContent = item.t;
      if (isActive(item.href)) a.setAttribute('aria-current', 'page');
      nav.appendChild(a);
    });

    var right = document.createElement('div');
    right.className = 'pf-topbar-right';
    var lang = pageLanguageLink();
    if (lang) {
      var langLink = document.createElement('a');
      langLink.className = 'pf-topbar-lang';
      langLink.href = lang.getAttribute('href') || lang.href;
      langLink.textContent = lang.textContent.trim() || 'ENG';
      langLink.setAttribute('aria-label', lang.getAttribute('aria-label') || 'Cambiar idioma');
      right.appendChild(langLink);
    }
    var contact = document.createElement('a');
    contact.className = 'pf-topbar-contact';
    contact.href = '#contact';
    contact.textContent = 'Contacto';
    contact.setAttribute('data-admira-contact', '');
    right.appendChild(contact);
    right.appendChild(rightToggle);
    right.appendChild(bottomToggle);

    bar.appendChild(left);
    bar.appendChild(nav);
    bar.appendChild(right);
    document.body.insertBefore(bar, document.body.firstChild);
    document.body.classList.add('pf-has-frame');
  }

  function mount() {
    buildAutoCuad();
    if (!document.querySelector('.cuad')) return;      // sin cuadratura → sin toggles
    buildTopbar();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
