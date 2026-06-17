/* Radar vivo de Pixeria — render compartido (ES/EN).
 * Carga modelos desde assets/radar.json y pinta el bloque .radar-live.
 * Para actualizar el radar, edita SOLO ese JSON (no el HTML).
 * Detecta idioma por <html lang>: usa campos *_en cuando lang empieza por "en".
 */
(function () {
  var root = document.getElementById('radarLive');
  if (!root || !('fetch' in window)) return;
  var src = root.getAttribute('data-radar-src') || '/assets/radar.json';
  var isEN = (document.documentElement.lang || 'es').toLowerCase().indexOf('en') === 0;

  var MONTHS_ES = ['enero','febrero','marzo','abril','mayo','junio','julio',
    'agosto','septiembre','octubre','noviembre','diciembre'];
  var MONTHS_EN = ['January','February','March','April','May','June','July',
    'August','September','October','November','December'];

  function pick(obj, base) { var v = isEN ? obj[base + '_en'] : obj[base]; return (v == null ? obj[base] : v); }

  function slug(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  function fmtMonth(iso) {
    var m = /^(\d{4})-(\d{2})/.exec(iso || '');
    if (!m) return null;
    var idx = parseInt(m[2], 10) - 1;
    return (isEN ? MONTHS_EN[idx] : MONTHS_ES[idx]) + ' ' + m[1];
  }

  function revealNodes(nodes) {
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reduce.matches || !('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-visible'); obs.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.08 });
    nodes.forEach(function (el, i) {
      el.classList.add('reveal');
      el.style.setProperty('--reveal-delay', (Math.min(i % 6, 5) * 60) + 'ms');
      io.observe(el);
    });
  }

  fetch(src, { cache: 'no-cache' })
    .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
    .then(function (data) {
      var title = pick(data, 'title');
      if (title) { var t = document.getElementById('radarTitle'); if (t) t.textContent = title; }

      var month = fmtMonth(data.updated);
      if (month) { var u = document.getElementById('radarUpdated'); if (u) u.textContent = month; }

      var grid = document.getElementById('radarModels');
      if (grid && Array.isArray(data.models) && data.models.length) {
        var frag = document.createDocumentFragment();
        var made = [];
        data.models.forEach(function (m) {
          var card = document.createElement('div');
          card.className = 'model';
          if (m.name) card.id = slug(m.name);
          var tag = document.createElement('span'); tag.className = 'tag'; tag.textContent = pick(m, 'category') || '';
          var name = document.createElement('strong'); name.textContent = m.name || '';
          var note = document.createElement('small'); note.textContent = pick(m, 'note') || '';
          card.appendChild(tag); card.appendChild(name); card.appendChild(note);
          frag.appendChild(card); made.push(card);
        });
        grid.replaceChildren(frag);
        revealNodes(made);
        if (location.hash) { var el = document.getElementById(location.hash.slice(1)); if (el) el.scrollIntoView({ block: 'center' }); }
      }

      var noteEl = document.getElementById('radarNote');
      var noteTpl = pick(data, 'note');
      if (noteEl && noteTpl) noteEl.innerHTML = String(noteTpl).replace('{watching}', data.watching || '');
    })
    .catch(function () { /* fallback estatico ya esta en el HTML */ });
})();
