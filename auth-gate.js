/*
 * Respaldo cliente de la verja server-side de Pixeria.
 * No usa popup/FedCM, no lee JWT y no guarda credenciales en localStorage.
 */
(function () {
  'use strict';
  document.documentElement.classList.add('gate-locked');
  var style = document.createElement('style');
  style.id = 'pixeria-gate-style';
  style.textContent = 'html.gate-locked body{visibility:hidden!important}';
  (document.head || document.documentElement).appendChild(style);

  fetch('/auth/session', {credentials:'include', cache:'no-store', headers:{Accept:'application/json'}})
    .then(function (response) {
      if (!response.ok) throw new Error('login_required');
      document.documentElement.classList.remove('gate-locked');
      if (style.parentNode) style.parentNode.removeChild(style);
    })
    .catch(function () {
      var destination = location.pathname + location.search + location.hash;
      location.replace('/auth/login?return_to=' + encodeURIComponent(destination));
    });
})();
