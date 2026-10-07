// Capa fina del avatar digital (encargo avatar · 4-oct-2026; antes FLT-101350).
// Ya no monta nada por su cuenta ni enciende solo: el avatar lo gobierna el cargador
// único https://www.admiranext.com/assets/avatar.js (elección del usuario >
// interruptor del proyecto > apagado), que la verja inyecta en cada página. Este
// fichero existe para quien aún lo pida (CLI viejos en caché): trae el cargador y
// le pasa los comandos. Mismo contrato: window.AvatarDigital.handle(texto).
(function (root) {
  'use strict';
  if (typeof document === 'undefined' || root.AdmiraAvatar) return;
  var SRC = 'https://www.admiranext.com/assets/avatar.js?v=20261007-demo-ack-1';
  var loading = null;
  function cargar() {
    if (root.AdmiraAvatar) return Promise.resolve(root.AdmiraAvatar);
    if (!loading) loading = new Promise(function (resolve) {
      var s = document.createElement('script');
      s.src = SRC;
      s.async = true;
      s.setAttribute('data-brain', '/avatar-ask');
      s.setAttribute('data-admira-avatar', '');
      s.onload = function () { resolve(root.AdmiraAvatar || null); };
      s.onerror = function () { loading = null; resolve(null); };
      document.head.appendChild(s);
    });
    return loading;
  }
  function no() { return /^en/i.test(document.documentElement.lang || '') ? 'Digital avatar unavailable' : 'Avatar digital no disponible'; }
  root.AvatarDigital = {
    handle: function (text) { return cargar().then(function (A) { return A ? A.handle(text) : no(); }); },
    show: function () { return cargar().then(function (A) { return A && A.run('/avatarON'); }); },
    hide: function () { return cargar().then(function (A) { return A && A.run('/avatarOFF'); }); },
    storedOn: function () { try { return root.localStorage.getItem('admira-avatar:override') === 'on'; } catch (_) { return false; } }
  };
})(typeof window === 'undefined' ? globalThis : window);
