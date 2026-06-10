(function () {
  var containerId = 'GTM-KD696XW';
  if (!containerId || window.__pixeriaAnalyticsLoaded) return;
  window.__pixeriaAnalyticsLoaded = true;

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () {
    window.dataLayer.push(arguments);
  };

  window.gtag('consent', 'default', {
    analytics_storage: 'granted',
    ad_storage: 'denied'
  });

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
