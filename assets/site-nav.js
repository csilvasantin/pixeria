/* Navegacion superior canonica de Pixeria.
 * La home conserva Idioma y Contacto. Las paginas interiores reutilizan las
 * mismas diez secciones, en el mismo orden, sin esos dos controles.
 */
(function () {
  // Pixeria is English; Admira Studio keeps the Spanish source routes.
  // Explicit language routes remain available for review in this shared preview.
  //
  // Idioma elegido en el Experto (/idioma, /language ESP|ENG · Carlos, 5-oct-2026): se guarda en
  // localStorage[admiranext_expert_lang] y MANDA sobre el auto-redirect. Antes, en pixeria, /language ESP
  // te llevaba a la ruta ES y esta misma línea te devolvía a /en/ al cargar: parecía que no cambiaba.
  //   · preferencia 'es' (o ?lang=es) → nunca se redirige a /en/; desde /en/ de una página traducida, vuelves a ES.
  //   · preferencia 'en' (o ?lang=en) → desde una ruta ES traducida pasas a /en/.
  //   · sin preferencia → como siempre: pixeria va a /en/, Admira Studio se queda en ES.
  var LANG_KEY = 'admiranext_expert_lang';
  var englishHost = /(^|\.)pixeria\.(com|pages\.dev)$/.test(location.hostname);
  var localePath = location.pathname;
  var translatedPages = ['/', '/index.html', '/audio.html', '/musica.html', '/imagenes.html', '/video.html', '/anonimizador.html', '/publicidad.html', '/stock.html', '/crear/'];
  function langPref() {
    try { var v = localStorage.getItem(LANG_KEY); return v === 'es' || v === 'en' ? v : ''; } catch (_) { return ''; }
  }
  function setLangPref(l) {
    try { localStorage.setItem(LANG_KEY, l === 'en' ? 'en' : 'es'); } catch (_) {}
  }
  // Ruta canónica para comparar: /stock y /stock.html son la misma página; /index.html es /.
  function canonPath(p) {
    p = p || '/';
    if (/(^|\/)index\.html$/.test(p)) return p.replace(/index\.html$/, '');
    if (!/\/$/.test(p) && !/\.[a-z0-9]+$/i.test(p)) return p + '.html';
    return p;
  }
  function isEnPath(p) { return p.indexOf('/en/') === 0; }
  function isTranslated(p) {
    return translatedPages.indexOf(canonPath(isEnPath(p) ? p.slice(3) : p)) >= 0;
  }
  // Ruta de la versión `l` de la página actual, o '' si ya estás en ella o no existe.
  function langPath(l) {
    var p = location.pathname;
    var alt = document.querySelector('link[rel="alternate"][hreflang="' + l + '"]');
    if (alt && alt.getAttribute('href')) {
      // El hreflang lleva el dominio canónico (www.pixeria.com / www.admira.studio): solo vale su
      // ruta, en el origen donde estés (admira.studio sin www, *.pixeria.pages.dev…).
      try {
        var want = new URL(alt.getAttribute('href'), location.href).pathname;
        return canonPath(want) === canonPath(p) ? '' : want;
      } catch (_) {}
    }
    if (!isTranslated(p)) return '';
    if (l === 'en') return isEnPath(p) ? '' : '/en' + (p === '/index.html' ? '/' : p);
    return isEnPath(p) ? (p.slice(3) || '/') : '';
  }
  // URL completa para pasar a `l`: conserva el resto del query (cliente=, marca=…) y el hash. En
  // pixeria la ruta ES lleva ?lang=es por si localStorage no está disponible (privado, bloqueado).
  function langUrl(l) {
    var path = langPath(l);
    if (!path) return '';
    var q = new URLSearchParams(location.search);
    q.delete('lang');
    if (l === 'es' && englishHost) q.set('lang', 'es');
    var qs = q.toString();
    return path + (qs ? '?' + qs : '') + location.hash;
  }
  window.PixeriaIdioma = { clave: LANG_KEY, preferido: langPref, fijar: setLangPref, ruta: langPath, url: langUrl };
  var langRedirect = (function () {
    if (!isTranslated(localePath)) return '';
    var qLang = new URLSearchParams(location.search).get('lang');
    var want = qLang === 'es' || qLang === 'en' ? qLang : (langPref() || (englishHost ? 'en' : ''));
    var onEn = isEnPath(localePath);
    if (want === 'en' && !onEn) return '/en' + (localePath === '/index.html' ? '/' : localePath) + location.search + location.hash;
    if (want === 'es' && onEn) {
      var q = new URLSearchParams(location.search);
      if (englishHost) q.set('lang', 'es');
      var qs = q.toString();
      return (localePath.slice(3) || '/') + (qs ? '?' + qs : '') + location.hash;
    }
    return '';
  })();
  if (langRedirect) {
    location.replace(langRedirect);
    return;
  }
  // Sello de este fichero (?v=…): marca-blanca.js y la consola experta viajan con el mismo,
  // así que cada release de sellar.py refresca también los scripts que carga site-nav.js.
  var SELF = document.currentScript;
  var STAMP = (function () { try { return new URL(SELF.src).search; } catch (_) { return ''; } })();

  // Marca blanca del catálogo de admiranext.com (FLT-101333). Solo se carga si esta pestaña
  // la pide (?marca= en la URL o una marca recordada) o si se usa /marca en la consola
  // experta: en una visita normal Pixeria no descarga nada nuevo. Ver docs/marca-blanca.md.
  var marcaPromise = null;
  function loadMarca() {
    if (window.AdmiraMarca) return Promise.resolve(window.AdmiraMarca);
    if (!marcaPromise) {
      marcaPromise = new Promise(function (resolve, reject) {
        var s = document.createElement('script');
        s.src = '/assets/marca-blanca.js' + STAMP;
        s.setAttribute('data-pixeria-marca', '');
        s.onload = function () { window.AdmiraMarca ? resolve(window.AdmiraMarca) : reject(new Error('marca-blanca.js')); };
        s.onerror = function () { s.remove(); marcaPromise = null; reject(new Error('marca-blanca.js')); };
        (document.head || document.documentElement).appendChild(s);
      });
    }
    return marcaPromise;
  }
  window.PixeriaMarca = { cargar: loadMarca };
  (function () {
    var q = null, stored = null;
    try { q = new URLSearchParams(location.search).get('marca'); stored = sessionStorage.getItem('mb:marca'); } catch (_) {}
    if (q == null && !stored) return;
    // ?marca=admira/off solo olvida la marca recordada: se carga para eso, sin velo.
    if (q != null && /^\s*(off|admira|ninguna|ninguno|none|default|apagar|quitar|reset)?\s*$/i.test(q)) { loadMarca().catch(function () {}); return; }
    // Con marca pedida, la página espera un instante en blanco en vez de enseñar el verde
    // de Pixeria y cambiar de golpe: como mucho 1,5 s, y antes si la marca ya está puesta
    // o no se pudo cargar. Sin marca este velo no existe.
    var veil = document.createElement('style');
    veil.id = 'pixeria-marca-velo';
    veil.textContent = 'html:not([data-mb-marca]) body{opacity:0!important}';
    (document.head || document.documentElement).appendChild(veil);
    var lift = function () { if (veil.parentNode) veil.parentNode.removeChild(veil); };
    document.addEventListener('admira:marca', lift);
    document.addEventListener('admira:marca-error', lift);
    setTimeout(lift, 1500);
    loadMarca().catch(lift);
  })();

  var ES = [
    ['/audio.html', 'Audio'],
    ['/musica.html', 'Música'],
    ['/imagenes.html', 'Imágenes'],
    ['/video.html', 'Video'],
    ['/adaptaciones/', 'Adaptador'],
    ['/publicidad.html', 'Publicidad'],
    ['/anonimizador.html', 'Anonimizador'],
    ['/ideas.html', 'Ideas'],
    ['/crear/', 'Assets'],
    ['/stock.html', 'Stock']
  ];
  var EN = [
    ['/en/audio.html', 'Audio'],
    ['/en/musica.html', 'Music'],
    ['/en/imagenes.html', 'Images'],
    ['/en/video.html', 'Video'],
    ['/en/adaptaciones/', 'Adapter'],
    ['/en/publicidad.html', 'Advertising'],
    ['/en/anonimizador.html', 'Anonymizer'],
    // Ideas todavía no tiene versión inglesa: se apunta a la española antes que
    // dejar un enlace roto o esconder la categoría a quien navega en inglés.
    ['/ideas.html', 'Ideas'],
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
      var previewRoot = document.body.dataset.previewRoot;
      link.href = previewRoot && /\/(?:en\/)?video\.html$/.test(item[0]) ? previewRoot + 'video.html'
        : previewRoot && /\/(?:en\/)?adaptaciones\/$/.test(item[0]) ? previewRoot + 'adaptaciones/' : item[0];
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

  // ─── Texto descriptivo plegable ─────────────────────────────────────────────
  // El .lead de cada página se lee UNA vez y a partir de ahí solo roba sitio a lo
  // que importa (la galería, los controles). Se pliega POR DEFECTO y se despliega
  // con un botón junto al cursor del titular. La preferencia se recuerda por
  // navegador: si lo abres, sigue abierto al navegar.
  function installLeadToggle() {
    var head = document.querySelector('header.page-head');
    if (!head || head.querySelector('.lead-toggle')) return;
    var lead = head.querySelector('.lead');
    var h1 = head.querySelector('h1');
    if (!lead || !h1) return;
    var KEY = 'pixeria-lead-open';
    var open = false;
    try { open = localStorage.getItem(KEY) === '1'; } catch (e) {}
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'lead-toggle';
    function paint() {
      lead.hidden = !open;
      btn.textContent = open ? '\u2212' : '?';          // − / ?
      btn.setAttribute('aria-expanded', String(open));
      var t = open ? 'Ocultar la descripción' : 'Qué es esto';
      btn.setAttribute('aria-label', t);
      btn.title = t;
    }
    btn.addEventListener('click', function () {
      open = !open;
      try { localStorage.setItem(KEY, open ? '1' : '0'); } catch (e) {}
      paint();
    });
    lead.id = lead.id || 'page-lead';
    btn.setAttribute('aria-controls', lead.id);
    h1.appendChild(btn);                                  // dentro del h1 → junto al ▋
    paint();
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
      '.pix-nav-home-rails .rail{position:fixed;top:var(--pf-topbar-h,70px);bottom:0;z-index:160;width:var(--pf-left-w,300px);max-height:none;overflow:auto;border:1px solid rgba(140,160,150,.30);border-radius:0;background:rgba(2,10,5,.96);box-shadow:0 0 34px rgba(0,255,65,.10);backdrop-filter:blur(8px)}' +
      '.pix-nav-home-rails .rail-left{left:0;display:flex;flex-direction:column;border-left:0;border-top:2px solid #68dce9;border-right-color:#68dce9}.pix-nav-home-rails .rail-right{right:0;width:var(--pf-right-w,330px);border-right:0;border-top:2px solid #e8c268;border-left-color:#e8c268}' +
      '.pix-nav-home-rails .rail-hd{position:sticky;top:0;z-index:3;margin:0;padding:13px 16px 11px;font-size:12px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#9ab0a4;background:rgba(8,14,10,.78);border-bottom:1px solid rgba(140,160,150,.30)}.pix-nav-home-rails .rail-left .rail-hd{color:#68dce9}.pix-nav-home-rails .rail-right .rail-hd{color:#e8c268}' +
      '.pix-nav-home-rails .rail-nav{display:flex;flex-direction:column;padding:8px}.pix-nav-home-rails .rail-nav a{display:block;padding:10px 12px;border:1px solid transparent;color:#c8ffd0;text-decoration:none}.pix-nav-home-rails .rail-nav a:hover,.pix-nav-home-rails .rail-nav a[aria-current="page"]{border-color:#00ff41;background:rgba(0,255,65,.07)}.pix-nav-home-rails .rail-nav b{display:block;font-weight:760;font-size:14px;color:#e8f2ec}.pix-nav-home-rails .rail-nav small{display:block;margin-top:2px;font-size:11.5px;color:#7fae8c;line-height:1.3}.pix-nav-home-rails .rail-options-meta{margin-top:auto;padding:12px 16px 16px;border-top:1px solid rgba(140,160,150,.30)}.pix-nav-home-rails .rail-ver{display:block;padding:6px 9px;border:1px solid #68dce9;color:#68dce9;font-size:11px;font-weight:800;letter-spacing:.04em;text-align:center}.pix-nav-home-rails .rail-extra{padding:4px 16px 18px}.pix-nav-home-rails .rail-sub{margin:6px 0 8px;font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#9ab0a4}.pix-nav-home-rails .rail-doc{display:block;padding:9px 0;font-size:13.5px;color:#e8f2ec;border-bottom:1px solid rgba(140,160,150,.30);text-decoration:none}' +
      // Los raíles se SUPERPONEN (Carlos, 3-oct-2026): el <main> conserva sus márgenes
      // propios y no se mueve al abrir ☰ o ▤. Guardián: test/paneles-superpuestos.test.cjs.
      '.pix-rail-resize{position:fixed;top:var(--pf-topbar-h,70px);bottom:0;width:14px;z-index:170;cursor:col-resize;touch-action:none;background:transparent}.pix-rail-resize::after{content:"";position:absolute;top:50%;left:5px;width:4px;height:44px;margin-top:-22px;border-radius:2px;background:rgba(104,220,233,.55)}.pix-rail-resize-right::after{background:rgba(232,194,104,.6)}.pix-rail-resize:hover::after,.pix-rail-resize:focus-visible::after,.pix-rail-resizing .pix-rail-resize::after{background:#00ff41}.pix-rail-resize-left{left:calc(min(var(--pf-left-w,300px),100vw - 24px) - 7px)}.pix-rail-resize-right{right:calc(min(var(--pf-right-w,330px),100vw - 24px) - 7px)}.pf-left-off .pix-rail-resize-left,.pf-right-off .pix-rail-resize-right{display:none}.pix-rail-resizing{cursor:col-resize;user-select:none}' +
      '.pix-nav-home-rails .rail{max-width:calc(100vw - 24px)}.pix-nav-home-rails.pf-left-off .rail-left{display:none}.pix-nav-home-rails.pf-right-off .rail-right{display:none}' +
      // Botón para plegar/desplegar el texto descriptivo del page-head. Va DENTRO del h1,
      // justo antes del cursor ▋, y se dimensiona en em para acompañar al titular a
      // cualquier tamaño de pantalla.
      '.lead-toggle{display:inline-grid;place-items:center;vertical-align:middle;width:1.15em;height:1.15em;margin-left:.18em;'+
      'font-family:inherit;font-size:.30em;line-height:1;font-weight:700;color:var(--matrix,#00ff41);background:transparent;'+
      'border:1px solid currentColor;border-radius:3px;cursor:pointer;opacity:.6;transition:opacity .15s,background .15s;'+
      'padding:0;text-shadow:none;box-shadow:none}'+
      '.lead-toggle:hover,.lead-toggle:focus-visible{opacity:1;background:rgba(0,255,65,.14);outline:none}'+
      '.page-head .lead[hidden]{display:none}'+
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
      '.pix-nav-advanced-layer{top:calc(var(--pf-topbar-h,70px) + 2px);right:18px;width:min(330px,calc(100vw - 36px));padding:18px;display:grid;gap:8px}' +
      '.pix-nav-expert-layer{left:18px;right:18px;bottom:18px;padding:12px 16px;display:flex;align-items:center;justify-content:center;gap:18px;flex-wrap:wrap}' +
      '.pix-nav-layer a{color:#caffd7;text-decoration:none;border:1px solid rgba(0,255,65,.22);padding:9px 11px}' +
      '.pix-nav-meta{box-sizing:border-box;display:flex;flex-wrap:wrap;align-items:center;justify-content:flex-start;gap:6px 18px;width:100%;max-width:none;margin:28px 0 8px;padding:12px 0 0;border-top:1px solid rgba(140,160,150,.30);font:400 12px/1.5 "JetBrains Mono","IBM Plex Mono","Fira Code",ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:.04em;text-transform:none;text-align:left}' +
      '.pix-nav-meta a{color:var(--mbx-brand,inherit);text-decoration:none;border:0;padding:0;background:none}' +
      ':root:not([data-mb-marca]) .pix-nav-meta{color:#7fae8c}:root:not([data-mb-marca]) .pix-nav-meta a{color:#c8ffd0}:root:not([data-mb-marca]) .pix-nav-meta a:hover{color:#00ff41}' +
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
    // Sin «P» de logo: la marca es solo el nombre (Carlos 29-sep-2026).
    link.querySelectorAll('.brand-mark, .pf-brand-mark, span').forEach(function (mark) {
      if (mark.matches('.brand-mark, .pf-brand-mark') || mark.textContent.trim() === 'P') mark.remove();
    });
    var name = link.querySelector('.brand-name, b, span');
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
      // Un solo bloque: la consola experta lo deja al final del contenido como una línea
      // de enlaces con el mismo aspecto en todas las páginas, tenga la página el CSS que tenga.
      expert.innerHTML = '<p class="pix-nav-meta"><span>Pixeria · sistema creativo</span><a href="/stock.html">Stock</a><a href="/documentacion/">Documentación</a><a href="https://www.xpaceos.com">XpaceOS</a><a href="https://www.admira.app">Admira</a></p>';
      document.body.appendChild(expert);
    }
    mountLiveRails();
  }

  // Contenido VIVO de la página (se MUEVE con sus eventos, no se copia), opcional:
  //   #cuad-opciones → ☰ Opciones · #cuad-avanzado-live → Avanzado · #cuad-experto-live → Experto.
  // Lo usa el Adaptador: Tamaños en Opciones, ajustes en Avanzado y plan H.264 en Experto.
  function mountLiveRails() {
    var pairs = [['cuad-opciones', '.rail-left', '🔍 Opciones'], ['cuad-avanzado-live', '.rail-right', '⚙️ Avanzado'], ['cuad-experto-live', '#pixNavExpertLayer', '']];
    pairs.forEach(function (p) {
      var node = document.getElementById(p[0]), host = document.querySelector(p[1]);
      if (!node || !host || host.contains(node)) return;
      if (p[0] === 'cuad-opciones') {
        var meta = host.querySelector('.rail-options-meta');
        host.innerHTML = '<div class="rail-hd">' + p[2] + '</div>';
        host.appendChild(node);
        if (meta) host.appendChild(meta);
        document.body.classList.add('cuad-live-options');
      } else if (p[2]) {
        host.innerHTML = '<div class="rail-hd">' + p[2] + '</div>';
        host.appendChild(node);
      } else {
        host.insertBefore(node, host.firstChild);
      }
      node.classList.add('rail-live');
    });
  }

  var HOME_RAIL_SECTIONS = [
    ['/crear/', 'Studio · Crear', 'Generar assets: video, imagen, audio, texto, mobiliario'],
    ['/musica.html', 'Música', 'Bandas sonoras, jingles y marca sonora'],
    ['/audio.html', 'Audio · Megafonía', 'Voces, locución y megafonía de marca'],
    ['/video.html', 'Vídeo', 'Storyboards, generación, edición y loops'],
    ['/adaptaciones/', 'Adaptador', 'Un vídeo, todas las pantallas: 9:16, 16:9, 1:1 y 4:5'],
    ['/imagenes.html', 'Imágenes', 'Dirección de arte, producto y estilo'],
    ['/avatar.html', 'Avatar 3D', 'Presentadores y avatares generativos'],
    ['/anonimizador.html', 'Anonimizador', 'Privacidad en imagen y vídeo'],
    ['/ideas.html', 'Ideas', 'Mapas del tesoro del Consejo: ideas para debatir'],
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
    document.querySelectorAll('.quad-left,.quad-right').forEach(function (rail) { rail.remove(); });
    var here = norm(location.pathname);
    var left = document.createElement('aside');
    var version = (document.querySelector('meta[name="admiranext-version"]') || {}).content || 'Pixeria';
    left.className = 'rail rail-left';
    left.setAttribute('aria-label', 'Opciones · secciones de Pixeria');
    left.innerHTML = '<div class="rail-hd">🔍 Opciones</div><nav class="rail-nav" aria-label="Secciones de Pixeria">' +
      HOME_RAIL_SECTIONS.map(function (s) {
        var current = norm(s[0]) === here;
        return '<a href="' + s[0] + '"' + (current ? ' aria-current="page"' : '') + '><b>' + s[1] + '</b><small>' + s[2] + '</small></a>';
      }).join('') + '</nav><div class="rail-options-meta" aria-label="Release de Pixeria">' +
      '<span class="rail-ver">' + version + '</span></div>';
    var right = document.createElement('aside');
    right.className = 'rail rail-right';
    right.setAttribute('aria-label', 'Avanzado · método y detalle');
    right.innerHTML = '<div class="rail-hd">⚙️ Avanzado</div><div class="rail-extra"><p class="rail-sub">Radar ampliado y documentación</p>' +
      HOME_RAIL_DOCS.map(function (d) { return '<a class="rail-doc" href="' + d[0] + '">' + d[1] + ' →</a>'; }).join('') + '</div>';
    document.body.appendChild(left);
    document.body.appendChild(right);
    document.body.classList.add('pix-nav-home-rails');
    mountLiveRails();
    // Los paneles entran CERRADOS en cada carga: el estado abierto no se recuerda.
    document.body.classList.add('pf-left-off', 'pf-right-off');
  }

  // UX cuadrática (#4905): ☰ y ▤ también se redimensionan arrastrando su borde
  // interior, como ⌘. Los raíles siguen superpuestos (no mueven el <main>) y el
  // ancho se recuerda con las mismas claves que cuadratura.js.
  function addRailResizers() {
    if (!document.body.classList.contains('pix-nav-home-rails')) return;
    var root = document.documentElement;
    function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
    function maxW() { return Math.max(220, Math.min(620, window.innerWidth - 24)); }
    var conf = [
      ['.rail-left', 'left', '--pf-left-w', 'pixeria_pf_left_w', 220],
      ['.rail-right', 'right', '--pf-right-w', 'pixeria_pf_right_w', 240]
    ];
    conf.forEach(function (c) {
      var rail = document.querySelector('.pix-nav-home-rails ' + c[0]);
      if (!rail || document.querySelector('.pix-rail-resize-' + c[1])) return;
      try {
        var saved = parseInt(localStorage.getItem(c[3]) || '', 10);
        if (Number.isFinite(saved)) root.style.setProperty(c[2], clamp(saved, c[4], maxW()) + 'px');
      } catch (_) {}
      var h = document.createElement('div');
      h.className = 'pix-rail-resize pix-rail-resize-' + c[1];
      h.setAttribute('role', 'separator');
      h.setAttribute('aria-orientation', 'vertical');
      h.setAttribute('aria-label', (document.documentElement.lang || '').toLowerCase().indexOf('en') === 0
        ? (c[1] === 'left' ? 'Resize options panel' : 'Resize advanced panel')
        : (c[1] === 'left' ? 'Redimensionar panel de opciones' : 'Redimensionar panel avanzado'));
      h.title = h.getAttribute('aria-label');
      h.tabIndex = 0;
      document.body.appendChild(h);
      function setW(w) {
        w = Math.round(clamp(w, c[4], maxW()));
        root.style.setProperty(c[2], w + 'px');
        try { localStorage.setItem(c[3], String(w)); } catch (_) {}
      }
      h.addEventListener('pointerdown', function (ev) {
        ev.preventDefault();
        if (h.setPointerCapture && ev.pointerId != null) { try { h.setPointerCapture(ev.pointerId); } catch (_) {} }
        document.body.classList.add('pix-rail-resizing');
        function move(e) { setW(c[1] === 'left' ? e.clientX : window.innerWidth - e.clientX); }
        function up() {
          document.body.classList.remove('pix-rail-resizing');
          h.removeEventListener('pointermove', move);
          h.removeEventListener('pointerup', up);
          h.removeEventListener('pointercancel', up);
        }
        h.addEventListener('pointermove', move);
        h.addEventListener('pointerup', up);
        h.addEventListener('pointercancel', up);
      });
      h.addEventListener('keydown', function (ev) {
        if (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight') return;
        ev.preventDefault();
        var cur = Math.round(rail.getBoundingClientRect().width);
        var d = (ev.shiftKey ? 32 : 12) * (ev.key === 'ArrowRight' ? 1 : -1) * (c[1] === 'left' ? 1 : -1);
        setW(cur + d);
      });
    });
  }

  function bindRailToggles() {
    if (!document.body.classList.contains('pix-nav-home-rails')) return;
    var controls = [
      ['.pix-nav-icon-menu', 'pf-left-off'],
      ['.pix-nav-icon-advanced', 'pf-right-off']
    ];
    controls.forEach(function (item) {
      var button = document.querySelector('.pf-topbar ' + item[0] + ', .quad-top ' + item[0] + ', .site-header ' + item[0] + ', .topnav ' + item[0]);
      if (!button || button.dataset.railToggle === '1') return;
      button.dataset.railToggle = '1';
      button.setAttribute('aria-pressed', document.body.classList.contains(item[1]) ? 'false' : 'true');
      button.addEventListener('click', function () {
        var off = document.body.classList.toggle(item[1]);
        button.setAttribute('aria-pressed', off ? 'false' : 'true');
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
        // Con los raíles superpuestos, ▤ ya abre .rail-right (bindRailToggles):
        // la capa flotante de respaldo duplicaba el panel encima del raíl (#4905).
        if (id === 'pixNavAdvancedLayer' && document.body.classList.contains('pix-nav-home-rails') && document.querySelector('.rail-right')) return;
        var layer = document.getElementById(id);
        // Con la piel ⌘ EXPERTO · CLI anclada, el clic lo gobierna suite/experto.js y expert-cli.js lo sigue.
        if (id === 'pixNavExpertLayer' && layer && layer.classList.contains('ax-dock')) return;
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
    installLeadToggle();
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
    addRailResizers();
    bindRailToggles();
    if (english) {
      var translatedLabels = {'Mostrar u ocultar menú':'Options', 'Abrir panel avanzado':'Advanced', 'Abrir panel experto':'Expert', 'Desplegar flujo de producción':'Options', 'Desplegar acciones rápidas':'Expert'};
      document.querySelectorAll('.pf-topbar button').forEach(function (button) {
        var label = translatedLabels[button.getAttribute('aria-label')];
        if (label) { button.setAttribute('aria-label',label); button.title = label; }
      });
    }

    // Si cuadratura.js ya creó la barra canónica, sus tres SVG son los buenos.
    // En las demás familias se montan los mismos controles alrededor del menú.
    if (!document.querySelector('.pf-topbar')) {
      document.querySelectorAll('.site-header, .topnav').forEach(bindStandardControls);
    }
  }

  // El sello visible se copia del <meta> canonico, que es el que firma el release
  // y el que lee /webmaster. Antes iba a mano en cada pagina y derivaba: el
  // 1-sep-2026 la home enseñaba un sello de 25 dias antes (FLT-1484).
  function syncRailVersion() {
    var meta = document.querySelector('meta[name="admiranext-version"]');
    var version = meta && meta.content;
    if (!version) return;
    document.querySelectorAll('.rail-ver').forEach(function (el) {
      if (el.textContent !== version) el.textContent = version;
    });
  }

  // Altura REAL de la barra de 4 bandas en --pf-topbar-h (FLT-101334): en móvil la barra
  // ocupa dos filas, así que nada de 70px fijos. Raíles, índices pegajosos, anclas y
  // alturas de pantalla completa de cada página se calculan con esta variable.
  function trackTopbarHeight() {
    var bar = document.querySelector('.pf-topbar');
    if (!bar || bar.dataset.pfHeight === '1') return;
    bar.dataset.pfHeight = '1';
    var root = document.documentElement;
    var apply = function () {
      var h = Math.round(bar.getBoundingClientRect().height);
      if (h > 0) root.style.setProperty('--pf-topbar-h', h + 'px');
    };
    apply();
    if (window.ResizeObserver) new ResizeObserver(apply).observe(bar);
    else window.addEventListener('resize', apply);
  }

  // Hasta el 3-oct-2026 se guardaba si ☰/▤/⌘ quedaban abiertos (pixeria_pf_left/right/
  // bottom = '1') y cada página los reabría empujando el contenido. Ya no se lee; se
  // borra el rastro para que ninguna copia vieja del script inline lo resucite.
  function forgetOpenPanels() {
    try { ['pixeria_pf_left', 'pixeria_pf_right', 'pixeria_pf_bottom'].forEach(function (k) { localStorage.removeItem(k); }); } catch (_) {}
  }

  // Suno es un motor oculto (norma de Carlos, 5-oct-2026): nunca se ve en la interfaz. Los textos
  // del sitio ya no lo nombran; esto cubre lo que llega de datos (títulos, comentarios y prompts del
  // Stock): en pantalla se lee «Pixeria Music». Solo cambia lo que se ve, no los datos.
  var SUNO_RE = /\bsuno(?:[ -]?local)?(?:[ -]?v?\d+(?:[.-]\d+)?)?(?:\.ai)?\b/gi;
  var SUNO_TEST = /suno/i;
  var SUNO_SKIP = {SCRIPT: 1, STYLE: 1, TEXTAREA: 1, INPUT: 1, NOSCRIPT: 1};
  function ocultarSunoEn(rootNode) {
    if (!rootNode) return;
    if (rootNode.nodeType === 3) {
      var par = rootNode.parentNode;
      if (par && !SUNO_SKIP[par.nodeName] && !(par.isContentEditable) && SUNO_TEST.test(rootNode.nodeValue)) rootNode.nodeValue = rootNode.nodeValue.replace(SUNO_RE, 'Pixeria Music');
      return;
    }
    if (rootNode.nodeType !== 1 || SUNO_SKIP[rootNode.nodeName] || rootNode.isContentEditable) return;
    ['title', 'alt', 'placeholder', 'aria-label'].forEach(function (at) {
      var v = rootNode.getAttribute(at);
      if (v && SUNO_TEST.test(v)) rootNode.setAttribute(at, v.replace(SUNO_RE, 'Pixeria Music'));
    });
    if (!SUNO_TEST.test(rootNode.textContent) && !rootNode.querySelector('[title],[alt],[placeholder],[aria-label]')) return;
    for (var c = rootNode.firstChild; c; c = c.nextSibling) ocultarSunoEn(c);
  }
  function vigilarSuno() {
    ocultarSunoEn(document.body);
    if (/suno/i.test(document.title)) document.title = document.title.replace(SUNO_RE, 'Pixeria Music');
    new MutationObserver(function (muts) {
      muts.forEach(function (m) {
        if (m.type === 'characterData') ocultarSunoEn(m.target);
        else if (m.type === 'attributes') ocultarSunoEn(m.target);
        else for (var i = 0; i < m.addedNodes.length; i++) ocultarSunoEn(m.addedNodes[i]);
      });
    }).observe(document.body, {childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['title', 'alt', 'placeholder', 'aria-label']});
  }

  function start() {
    try { vigilarSuno(); } catch (_) {}
    forgetOpenPanels();
    normalizeInternalNav();
    syncRailVersion();
    trackTopbarHeight();
    // cuadratura.js crea la barra de la home de forma diferida; esta segunda
    // pasada normaliza tambien esa barra cuando se reutiliza en una interior.
    setTimeout(function () {
      normalizeInternalNav(); syncRailVersion(); trackTopbarHeight();
      // Cliente activo (selector global junto al logo): assets/cliente-activo.js.
      var cliente = document.createElement('script');
      cliente.src = '/assets/cliente-activo.js' + (STAMP || '');
      document.body.appendChild(cliente);
      if (!document.querySelector('.rail-bottom,.quad-bottom,#pixNavExpertLayer')) return;
      var css = document.createElement('link');
      css.rel = 'stylesheet'; css.href = '/assets/expert-cli.css' + (STAMP || '?v=4663');
      document.head.appendChild(css);
      var cli = document.createElement('script');
      cli.src = '/assets/expert-cli.js?v=installation-20261009';
      document.body.appendChild(cli);
      // ⌘ EXPERTO · CLI con el look de digitalavatar.ai (Carlos, 4-oct-2026): piel compartida de la
      // suite (www.admiranext.com/suite) sobre la consola de expert-cli.js; los comandos no cambian.
      var axCss = document.createElement('link');
      axCss.rel = 'stylesheet'; axCss.href = 'https://www.admiranext.com/suite/experto.css?v=20261005-experto-idioma-2';
      document.head.appendChild(axCss);
      var ax = document.createElement('script');
      ax.src = 'https://www.admiranext.com/suite/experto.js?v=20261007-pill-1';
      ax.setAttribute('data-panel', '.pf-cli');
      ax.setAttribute('data-body', '');
      ax.setAttribute('data-form', '.pf-cli-form');
      ax.setAttribute('data-input', '#pf-cli-input');
      ax.setAttribute('data-log', '#pf-cli-output');
      ax.setAttribute('data-extras', '');
      ax.setAttribute('data-chrome', '');
      ax.setAttribute('data-engine', 'PIXERIA ENGINE');
      // Modo Experto: el icono lo muestra completo o lo oculta DEL TODO (Carlos, 5-oct-2026), sin la
      // línea mínima «› /help»; el estado se recuerda en la pestaña.
      ax.setAttribute('data-min', 'hide');
      document.body.appendChild(ax);
    }, 0);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
