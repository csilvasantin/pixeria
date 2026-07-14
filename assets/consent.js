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
    if (!document.getElementById('pixeria-consent-styles')) {
      var style = document.createElement('style');
      style.id = 'pixeria-consent-styles';
      style.textContent =
        '#cookie-consent{position:fixed;left:16px;right:16px;bottom:16px;z-index:2147483646;display:flex;align-items:center;justify-content:space-between;gap:18px;max-width:980px;margin:auto;padding:14px 16px;border:1px solid rgba(0,255,65,.45);border-radius:10px;background:rgba(2,10,4,.97);color:#d8f5df;box-shadow:0 12px 40px rgba(0,0,0,.55);font:13px/1.45 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}' +
        '#cookie-consent .cc-text{margin:0}' +
        '#cookie-consent .cc-link{color:#68dce9;text-decoration:underline}' +
        '#cookie-consent .cc-actions{display:flex;gap:8px;flex:0 0 auto}' +
        '#cookie-consent .cc-btn{min-height:38px;padding:8px 14px;border:1px solid rgba(0,255,65,.55);border-radius:7px;background:transparent;color:#d8f5df;font:700 12px/1 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;cursor:pointer}' +
        '#cookie-consent .cc-accept{background:#00ff41;color:#021006}' +
        '@media(max-width:680px){#cookie-consent{left:10px;right:10px;bottom:10px;align-items:stretch;flex-direction:column}#cookie-consent .cc-actions{justify-content:flex-end}}';
      (document.head || document.documentElement).appendChild(style);
    }
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
