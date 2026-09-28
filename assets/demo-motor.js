/* Motor /demo del modo experto: lee el guion de /demo/ y lo recorre en autopiloto.
   Común a pixeria.com/admira.studio, xpaceos.com/admira.store y clearchannel.tv/admira.app:
   cada web publica su propio /demo/ con la misma estructura (ver el comentario de esa página).
   El estado vive en sessionStorage para seguir la demo al cambiar de página. */
(function () {
  'use strict';
  if (window.PFDemo) return;
  var KEY = 'pf_demo_run';
  var GUION = (document.querySelector('meta[name="pf-demo-guion"]') || {}).content || '/demo/';
  var en = document.documentElement.lang.indexOf('en') === 0;
  function t(es, english) { return en ? english : es; }
  function leer() { try { return JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch (_) { return null; } }
  function guardar(s) { try { s ? sessionStorage.setItem(KEY, JSON.stringify(s)) : sessionStorage.removeItem(KEY); } catch (_) {} }
  function espera(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  // ── Guion ────────────────────────────────────────────────────────────────
  function cargarGuion() {
    return fetch(GUION, { cache: 'no-store', credentials: 'same-origin' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.text();
    }).then(function (html) {
      var doc = new DOMParser().parseFromString(html, 'text/html');
      var lista = doc.querySelector('[data-demo]');
      if (!lista) throw new Error(t('el guion no tiene lista [data-demo]', 'script page has no [data-demo] list'));
      var defecto = Number(lista.getAttribute('data-duracion-defecto')) || 60;
      return Array.from(lista.children).filter(function (li) { return li.matches('li'); }).map(function (li) {
        var h = li.querySelector('h2,h3');
        return {
          titulo: (h ? h.textContent : li.textContent).trim().replace(/\s+/g, ' '),
          pagina: li.getAttribute('data-pagina') || location.pathname,
          duracion: Number(li.getAttribute('data-duracion')) || defecto,
          pasos: Array.from(li.querySelectorAll('.pasos > li')).map(function (p) {
            return { accion: p.getAttribute('data-accion') || 'di', en: p.getAttribute('data-en') || '', texto: p.textContent.trim() };
          })
        };
      });
    });
  }

  // ── Escena: cursor, rótulo, subtítulo y barra de progreso ──────────────────
  var escena = null;
  function montar() {
    if (escena) return escena;
    var css = document.createElement('style');
    css.textContent = '' +
      '.pfd-cursor{position:fixed;left:0;top:0;z-index:2147483600;width:26px;height:26px;pointer-events:none;transition:transform .9s cubic-bezier(.45,.05,.25,1);filter:drop-shadow(0 2px 3px rgba(0,0,0,.55))}' +
      '.pfd-cursor.pfd-clic::after{content:"";position:absolute;left:-14px;top:-14px;width:28px;height:28px;border-radius:50%;border:3px solid #00ff41;animation:pfd-onda .55s ease-out}' +
      '@keyframes pfd-onda{from{transform:scale(.3);opacity:1}to{transform:scale(1.6);opacity:0}}' +
      '.pfd-hud{position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:2147483601;width:min(92vw,620px);pointer-events:none;font:13px/1.45 "IBM Plex Mono",ui-monospace,monospace;color:#e8f2ec}' +
      '.pfd-rotulo{background:#030c06;border:1px solid #48b06a;border-radius:10px;padding:9px 14px 10px;box-shadow:0 6px 22px rgba(0,0,0,.45)}' +
      '.pfd-rotulo b{color:#7dff9a;font-size:11px;letter-spacing:.08em;text-transform:uppercase;display:block}' +
      '.pfd-rotulo span{display:block;font-size:16px;color:#fff}' +
      '.pfd-barra{height:4px;margin-top:8px;background:#102117;border-radius:2px;overflow:hidden}' +
      '.pfd-barra i{display:block;height:100%;width:0;background:#00ff41}' +
      '.pfd-sub{margin-top:8px;background:rgba(3,12,6,.92);border-radius:8px;padding:8px 12px;font-size:14px;color:#c8ffd0}' +
      '.pfd-sub:empty{display:none}' +
      '.pfd-ayuda{margin-top:6px;text-align:center;font-size:10.5px;color:#9fd9ad;text-shadow:0 1px 2px #000}' +
      '.pfd-foco{outline:2px dashed #00ff41 !important;outline-offset:3px !important}';
    document.head.appendChild(css);
    var cursor = document.createElement('div');
    cursor.className = 'pfd-cursor';
    cursor.setAttribute('aria-hidden', 'true');
    cursor.innerHTML = '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M3 2l7.5 19 2.6-7.9L21 10.6z" fill="#fff" stroke="#000" stroke-width="1.4" stroke-linejoin="round"/></svg>';
    var hud = document.createElement('div');
    hud.className = 'pfd-hud';
    hud.setAttribute('role', 'status');
    hud.innerHTML = '<div class="pfd-rotulo"><b></b><span></span><div class="pfd-barra"><i></i></div></div><div class="pfd-sub"></div>' +
      '<div class="pfd-ayuda">' + t('Esc para · → siguiente · ← anterior', 'Esc stop · → next · ← previous') + '</div>';
    document.body.append(cursor, hud);
    var x = innerWidth / 2, y = innerHeight - 90;
    cursor.style.transform = 'translate(' + x + 'px,' + y + 'px)';
    escena = { cursor: cursor, hud: hud, kicker: hud.querySelector('b'), titulo: hud.querySelector('.pfd-rotulo span'),
               barra: hud.querySelector('.pfd-barra i'), sub: hud.querySelector('.pfd-sub') };
    return escena;
  }
  function desmontar() {
    if (!escena) return;
    escena.cursor.remove(); escena.hud.remove();
    document.querySelectorAll('.pfd-foco').forEach(function (el) { el.classList.remove('pfd-foco'); });
    escena = null;
  }

  // ── Ejecución ─────────────────────────────────────────────────────────────
  var turno = 0;        // cada arranque/salto invalida los bucles anteriores
  var barraTimer = null;
  function vivo(mio) { return mio === turno; }

  function moverA(el, mio) {
    el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
    return espera(450).then(function () {
      if (!vivo(mio)) return;
      var r = el.getBoundingClientRect();
      escena.cursor.style.transform = 'translate(' + Math.round(r.left + Math.min(r.width * 0.5, 60)) + 'px,' + Math.round(r.top + r.height * 0.5) + 'px)';
      document.querySelectorAll('.pfd-foco').forEach(function (e) { e.classList.remove('pfd-foco'); });
      el.classList.add('pfd-foco');
      return espera(950);
    });
  }
  function clic() {
    escena.cursor.classList.remove('pfd-clic');
    void escena.cursor.offsetWidth;
    escena.cursor.classList.add('pfd-clic');
    return espera(600);
  }
  function aviso(el, texto) {
    el.value = texto;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function teclear(el, texto, mio) {
    el.focus({ preventScroll: true });
    el.value = '';
    var i = 0, paso = Math.max(12, Math.min(45, Math.round(4000 / Math.max(1, texto.length))));
    return new Promise(function (fin) {
      (function sig() {
        if (!vivo(mio)) return fin();
        if (i >= texto.length) { aviso(el, texto); return fin(); }
        el.value += texto[i++];
        el.dispatchEvent(new Event('input', { bubbles: true }));
        setTimeout(sig, paso);
      })();
    });
  }
  function elegir(el, texto) {
    var buscado = texto.toLowerCase();
    var op = Array.from(el.options).find(function (o) { return o.text.trim().toLowerCase() === buscado || o.value.toLowerCase() === buscado; }) ||
             Array.from(el.options).find(function (o) { return o.text.toLowerCase().indexOf(buscado) >= 0; });
    if (op) aviso(el, op.value);
    return !!op;
  }

  function ejecutarPaso(p, mio) {
    if (p.accion === 'espera') return espera((Number(p.texto) || 1) * 1000);
    if (p.accion === 'di') { escena.sub.textContent = p.texto; return espera(Math.min(6000, 1800 + p.texto.length * 45)); }
    var el = p.en && document.querySelector(p.en);
    if (!el) { escena.sub.textContent = t('(no encuentro ', '(missing ') + p.en + ')'; return espera(1200); }
    return moverA(el, mio).then(function () {
      if (!vivo(mio)) return;
      if (p.accion === 'escribe') return clic().then(function () { return teclear(el, p.texto, mio); });
      if (p.accion === 'elige') return clic().then(function () { elegir(el, p.texto); return espera(700); });
      if (p.accion === 'clic') return clic().then(function () { el.click(); return espera(900); });
      // «señala» y cualquier acción desconocida: el ratón marca el clic pero no pulsa.
      if (p.texto) escena.sub.textContent = p.texto;
      return clic().then(function () { return espera(Math.min(5000, 1500 + p.texto.length * 40)); });
    });
  }

  function mismaPagina(ruta) {
    var a = new URL(ruta, location.href), actual = location.pathname.replace(/index\.html$/, '');
    return a.pathname.replace(/index\.html$/, '') === actual;
  }

  function correr() {
    var s = leer();
    if (!s) return;
    var punto = s.puntos[s.i];
    if (!punto || s.i > s.hasta) return terminar(t('Demo terminada.', 'Demo finished.'));
    if (!mismaPagina(punto.pagina)) {
      guardar(s);
      location.assign(new URL(punto.pagina, location.href).href);
      return;
    }
    var mio = ++turno;
    montar();
    escena.kicker.textContent = 'Demo ' + (s.i + 1) + ' / ' + s.puntos.length;
    escena.titulo.textContent = punto.titulo;
    escena.sub.textContent = '';
    var t0 = Date.now(), total = punto.duracion * 1000;
    clearInterval(barraTimer);
    barraTimer = setInterval(function () {
      if (!escena) return;
      escena.barra.style.width = Math.min(100, (Date.now() - t0) / total * 100) + '%';
    }, 200);
    var cadena = Promise.resolve();
    punto.pasos.forEach(function (p) {
      cadena = cadena.then(function () { if (vivo(mio)) return ejecutarPaso(p, mio); });
    });
    cadena.then(function () {
      // Lo que sobre del minuto se queda en pantalla enseñando el resultado.
      return espera(Math.max(0, total - (Date.now() - t0)));
    }).then(function () {
      if (!vivo(mio)) return;
      saltar(1);
    });
  }

  function saltar(delta) {
    var s = leer();
    if (!s) return;
    s.i = Math.max(s.desde, s.i + delta);
    turno++;
    guardar(s);
    if (s.i > s.hasta) return terminar(t('Demo terminada.', 'Demo finished.'));
    correr();
  }
  function terminar(msg) {
    turno++;
    clearInterval(barraTimer);
    guardar(null);
    desmontar();
    if (msg && window.PFDemo.escribir) window.PFDemo.escribir(msg);
  }

  document.addEventListener('keydown', function (ev) {
    if (!leer()) return;
    if (ev.key === 'Escape') { ev.preventDefault(); terminar(t('Demo parada.', 'Demo stopped.')); }
    else if (ev.key === 'ArrowRight') { ev.preventDefault(); saltar(1); }
    else if (ev.key === 'ArrowLeft') { ev.preventDefault(); saltar(-1); }
  }, true);

  // ── Comando /demo ─────────────────────────────────────────────────────────
  function comando(arg, escribir) {
    window.PFDemo.escribir = escribir;
    arg = (arg || '').trim().toLowerCase();
    if (arg === 'stop' || arg === 'parar') { terminar(t('Demo parada.', 'Demo stopped.')); return; }
    escribir(t('Leyendo el guion ', 'Reading script ') + GUION + ' …');
    cargarGuion().then(function (puntos) {
      if (!puntos.length) { escribir(t('El guion no tiene puntos.', 'The script has no points.')); return; }
      if (arg === 'list' || arg === 'lista') {
        escribir(puntos.map(function (p, i) { return (i + 1) + '. ' + p.titulo + '  ·  ' + p.duracion + ' s  ·  ' + p.pagina; }).join('\n') +
          '\n' + t('/demo N lanza solo el punto N · edita el guion en ', '/demo N runs point N only · edit the script at ') + GUION);
        return;
      }
      var desde = 0, hasta = puntos.length - 1;
      if (arg) {
        var n = parseInt(arg, 10);
        if (!(n >= 1 && n <= puntos.length)) { escribir(t('Usa /demo, /demo list o /demo N (1-', 'Use /demo, /demo list or /demo N (1-') + puntos.length + ').'); return; }
        desde = hasta = n - 1;
      }
      var seg = puntos.slice(desde, hasta + 1).reduce(function (a, p) { return a + p.duracion; }, 0);
      escribir(t('Autopiloto: ', 'Autopilot: ') + (hasta - desde + 1) + t(' punto(s), ~', ' point(s), ~') + Math.round(seg / 60 * 10) / 10 + ' min. Esc ' + t('para', 'stops') + '.');
      guardar({ puntos: puntos, i: desde, desde: desde, hasta: hasta });
      correr();
    }).catch(function (e) {
      escribir(t('No pude leer el guion ', 'Could not read the script ') + GUION + ': ' + e.message);
    });
  }

  window.PFDemo = { comando: comando, escribir: null };
  // Viene de otra página con la demo en marcha: sigue donde iba.
  if (leer()) {
    if (document.readyState === 'complete') setTimeout(correr, 600);
    else addEventListener('load', function () { setTimeout(correr, 600); });
  }
})();
