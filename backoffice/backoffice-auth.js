(function () {
  'use strict';

  function login() {
    var destination = location.pathname + location.search + location.hash;
    location.replace('/auth/login?return_to=' + encodeURIComponent(destination));
  }

  function logout() {
    fetch('/auth/logout', {method:'POST', credentials:'include', cache:'no-store'})
      .then(function () { login(); })
      .catch(login);
  }

  function showIdentity(email) {
    var toolbar = document.querySelector('.god-toolbar');
    if (!toolbar || toolbar.querySelector('.god-user-badge')) return;
    var badge = document.createElement('span');
    badge.className = 'god-user-badge';
    badge.style.cssText = 'margin-left:8px;font-size:10px;background:#68dce9;color:#0b1117;padding:1px 6px;border-radius:3px';
    badge.textContent = '\u2713 ' + String(email || '').split('@')[0];
    toolbar.appendChild(badge);
    var button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Salir';
    button.style.cssText = 'margin-left:6px;font-size:10px';
    button.addEventListener('click', logout);
    toolbar.appendChild(button);
  }

  function check() {
    return fetch('/auth/session', {credentials:'include', cache:'no-store', headers:{Accept:'application/json'}})
      .then(function (response) {
        if (!response.ok) throw new Error('login_required');
        return response.json();
      })
      .then(function (session) {
        setTimeout(function () { showIdentity(session.email); }, 500);
        return true;
      })
      .catch(function () { login(); return false; });
  }

  window.godLogout = logout;
  window.__godAuthCheck = function () { return check(); };
  check();
})();
