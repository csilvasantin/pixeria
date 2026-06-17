(function () {
  var containerId = 'GTM-KD696XW';
  if (!containerId || window.__pixeriaAnalyticsLoaded) return;
  window.__pixeriaAnalyticsLoaded = true;

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () {
    window.dataLayer.push(arguments);
  };

  // Consent Mode v2: denegado por defecto (RGPD/ePrivacy). GA no almacena ni
  // envia nada hasta que el usuario acepta en el banner (assets/consent.js).
  window.gtag('consent', 'default', {
    analytics_storage: 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    wait_for_update: 500
  });

  // Si el usuario ya acepto en una visita anterior, restaurar el consentimiento.
  try {
    if (localStorage.getItem('pixeria_consent') === 'granted') {
      window.gtag('consent', 'update', { analytics_storage: 'granted' });
    }
  } catch (e) {}

  window.dataLayer.push({
    'gtm.start': new Date().getTime(),
    event: 'gtm.js'
  });

  window.dataLayer.push({
    event: 'pixeria.page_view',
    pixeria_path: window.location.pathname,
    pixeria_title: document.title,
    pixeria_language: document.documentElement.lang || 'unknown'
  });

  var firstScript = document.getElementsByTagName('script')[0];
  if (!firstScript || !firstScript.parentNode) return;

  var tag = document.createElement('script');
  tag.async = true;
  tag.src = 'https://www.googletagmanager.com/gtm.js?id=' + encodeURIComponent(containerId);
  firstScript.parentNode.insertBefore(tag, firstScript);
})();
