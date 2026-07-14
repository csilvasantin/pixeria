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
    ['/avatar.html', 'Avatar 3D'],
    ['/anonimizador.html', 'Anonimizador'],
    ['/crear/', 'Assets'],
    ['/stock.html', 'Stock'],
    ['/xpacios/', 'Xpacios']
  ];
  var EN = [
    ['/en/audio.html', 'Audio'],
    ['/en/musica.html', 'Music'],
    ['/en/imagenes.html', 'Images'],
    ['/en/video.html', 'Video'],
    ['/en/publicidad.html', 'Advertising'],
    ['/en/avatar.html', '3D Avatar'],
    ['/en/anonimizador.html', 'Anonymizer'],
    ['/en/crear/', 'Assets'],
    ['/en/stock.html', 'Stock'],
    ['/xpacios/', 'Xpacios']
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

  function normalizeInternalNav() {
    if (isHome()) return;
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
