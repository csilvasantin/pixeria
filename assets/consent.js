/* Banner de consentimiento de cookies — Pixeria.
 * RGPD/ePrivacy: la analitica (Google Analytics) NO se activa hasta que el
 * usuario acepta. La eleccion se guarda en localStorage. Sin dependencias.
 * Trabaja junto a assets/analytics.js (Consent Mode v2, denegado por defecto).
 */
(function () {
  var KEY = 'pixeria_consent';
  var stored = null;
  try { stored = localStorage.getItem(KEY); } catch (e) {}
  if (stored === 'granted' || stored === 'denied') return; // ya decidio

  var isEN = (document.documentElement.lang || 'es').toLowerCase().indexOf('en') === 0;
  var T = isEN ? {
    text: 'We use our own cookies and Google Analytics to understand usage. Analytics only runs if you accept.',
    accept: 'Accept', reject: 'Reject', more: 'Privacy & cookies', privacy: '/en/privacy.html'
  } : {
    text: 'Usamos cookies propias y Google Analytics para entender el uso. La analitica solo se activa si aceptas.',
    accept: 'Aceptar', reject: 'Rechazar', more: 'Privacidad y cookies', privacy: '/privacidad.html'
  };

  function decide(granted) {
    try { localStorage.setItem(KEY, granted ? 'granted' : 'denied'); } catch (e) {}
    if (granted && typeof window.gtag === 'function') {
      window.gtag('consent', 'update', { analytics_storage: 'granted' });
    }
    var el = document.getElementById('cookie-consent');
    if (el) el.parentNode.removeChild(el);
  }

  function build() {
    if (document.getElementById('cookie-consent')) return;
    var bar = document.createElement('div');
    bar.id = 'cookie-consent';
    bar.setAttribute('role', 'dialog');
    bar.setAttribute('aria-label', isEN ? 'Cookie consent' : 'Consentimiento de cookies');
    bar.innerHTML =
      '<p class="cc-text">' + T.text +
      ' <a class="cc-link" href="' + T.privacy + '">' + T.more + '</a></p>' +
      '<div class="cc-actions">' +
        '<button type="button" class="cc-btn cc-reject">' + T.reject + '</button>' +
        '<button type="button" class="cc-btn cc-accept">' + T.accept + '</button>' +
      '</div>';
    document.body.appendChild(bar);
    bar.querySelector('.cc-accept').addEventListener('click', function () { decide(true); });
    bar.querySelector('.cc-reject').addEventListener('click', function () { decide(false); });
  }

  if (document.body) build();
  else document.addEventListener('DOMContentLoaded', build);
})();
