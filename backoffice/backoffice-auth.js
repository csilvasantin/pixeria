(function() {
  'use strict';

  const ALLOWED_DOMAIN = 'admira.com';
  const STORAGE_KEY = 'backoffice_user_email';
  const CLIENT_ID = '861856772040-quq6ut76k4mqj3fdq87h6g6caht3nm4l.apps.googleusercontent.com'; // OAuth 2.0 Web Client (proyecto admira-app). Orígenes JS autorizados deben incluir https://www.pixeria.com y https://pixeria.com

  function emailAllowed(email) {
    return typeof email === 'string' && email.toLowerCase().endsWith('@' + ALLOWED_DOMAIN);
  }

  // Check if already logged in
  function isLoggedIn() {
    const stored = localStorage.getItem(STORAGE_KEY);
    return emailAllowed(stored);
  }

  function setLoggedIn(email) {
    localStorage.setItem(STORAGE_KEY, email);
  }

  function logout() {
    localStorage.removeItem(STORAGE_KEY);
    // Reload to show login again
    window.location.reload();
  }

  // Simple JWT decode (no signature verification - fine for this client-side gate)
  function parseJwt(token) {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(jsonPayload);
    } catch (e) {
      console.error('Failed to parse JWT', e);
      return null;
    }
  }

  function showLoginOverlay() {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.id = 'god-auth-overlay';
    overlay.style.cssText = `
      position: fixed; inset: 0; background: rgba(11,17,23,0.98);
      z-index: 999999; display: flex; align-items: center; justify-content: center;
      font-family: Inter, system-ui, sans-serif; color: #f4f0e8;
    `;

    overlay.innerHTML = `
      <div style="max-width: 420px; width: 90%; background: #111a20; border: 1px solid #68dce9; border-radius: 12px; padding: 40px 32px; text-align: center;">
        <div style="margin-bottom: 24px;">
          <span style="display: inline-block; width: 48px; height: 48px; border: 2px solid #68dce9; background: rgba(104,220,233,0.1); color: #68dce9; font-size: 28px; line-height: 44px; border-radius: 8px; font-weight: 700;">G</span>
        </div>
        <h2 style="margin: 0 0 8px; font-size: 28px;">Backoffice</h2>
        <p style="margin: 0 0 24px; color: #aeb9bd; font-size: 15px;">Acceso restringido a cuentas @admira.com</p>

        <div id="google-signin-button" style="margin: 20px 0;"></div>

        <p style="font-size: 12px; color: #6b7280; margin-top: 24px;">
          Solo cuentas <strong>@admira.com</strong> pueden acceder.<br>
          Inicia sesión con Google para gestionar Pixeria.
        </p>
      </div>
    `;

    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    // Load Google Identity Services if not present
    if (!window.google || !window.google.accounts) {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = initGoogleSignIn;
      document.head.appendChild(script);
    } else {
      initGoogleSignIn();
    }

    function initGoogleSignIn() {
      if (!window.google || !window.google.accounts || !window.google.accounts.id) {
        console.error('Google Identity Services not loaded');
        return;
      }

      const buttonContainer = document.getElementById('google-signin-button');
      if (!buttonContainer) return;

      // Initialize
      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: handleGoogleCredentialResponse,
        auto_select: false,
        cancel_on_tap_outside: true,
        hosted_domain: ALLOWED_DOMAIN,
      });

      // Render the button
      window.google.accounts.id.renderButton(
        buttonContainer,
        {
          theme: 'outline',
          size: 'large',
          text: 'signin_with',
          shape: 'rectangular',
          logo_alignment: 'left'
        }
      );
    }
  }

  function handleGoogleCredentialResponse(response) {
    const payload = parseJwt(response.credential);
    if (!payload) {
      alert('Error al leer la respuesta de Google.');
      return;
    }

    const email = payload.email;
    const emailVerified = payload.email_verified;
    const hostedDomain = payload.hd;

    if (emailAllowed(email) && emailVerified && hostedDomain === ALLOWED_DOMAIN) {
      setLoggedIn(email);

      // Remove overlay
      const overlay = document.getElementById('god-auth-overlay');
      if (overlay) overlay.remove();
      document.body.style.overflow = '';

      // Optional: show a small logged in indicator
      showLoggedInIndicator(email);

      // Re-initialize god mode if the script is present
      if (window.__initGodMode) {
        window.__initGodMode();
      }
    } else {
      alert('Acceso denegado. Solo cuentas @admira.com pueden entrar en el backoffice.');
      // Optionally sign out from Google
      if (window.google && window.google.accounts && window.google.accounts.id) {
        window.google.accounts.id.disableAutoSelect();
      }
    }
  }

  function showLoggedInIndicator(email) {
    // Add a small badge in the toolbar if it exists, or create one
    const toolbar = document.querySelector('.god-toolbar');
    if (toolbar) {
      const badge = document.createElement('span');
      badge.style.cssText = 'margin-left:8px; font-size:10px; background:#68dce9; color:#0b1117; padding:1px 6px; border-radius:3px;';
      badge.textContent = '✓ ' + email.split('@')[0];
      toolbar.appendChild(badge);

      // Add logout button
      const logoutBtn = document.createElement('button');
      logoutBtn.textContent = 'Salir';
      logoutBtn.style.cssText = 'margin-left:6px; font-size:10px;';
      logoutBtn.onclick = logout;
      toolbar.appendChild(logoutBtn);
    } else {
      // Fallback: add a small floating logout
      const logoutFloat = document.createElement('div');
      logoutFloat.style.cssText = 'position:fixed; bottom:60px; right:16px; z-index:99999; font-size:11px;';
      logoutFloat.innerHTML = `<button onclick="(${logout.toString()})()" style="background:#111a20;color:#f4f0e8;border:1px solid #68dce9;padding:2px 8px;border-radius:3px;">Salir de God Mode</button>`;
      document.body.appendChild(logoutFloat);
    }
  }

  // Main entry
  function initGodAuth() {
    if (isLoggedIn()) {
      // Already logged in - show small indicator if toolbar appears later
      setTimeout(() => {
        const toolbar = document.querySelector('.god-toolbar');
        if (toolbar && !toolbar.querySelector('.god-user-badge')) {
          const stored = localStorage.getItem(STORAGE_KEY);
          if (stored) {
            const badge = document.createElement('span');
            badge.className = 'god-user-badge';
            badge.style.cssText = 'margin-left:8px; font-size:10px; background:#68dce9; color:#0b1117; padding:1px 6px; border-radius:3px;';
            badge.textContent = '✓ ' + stored.split('@')[0];
            toolbar.appendChild(badge);
          }
        }
      }, 800);
      return; // allow everything
    }

    // Not logged in - show gate
    showLoginOverlay();
  }

  // Expose logout globally in case needed
  window.godLogout = logout;

  // Auto-run
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGodAuth);
  } else {
    initGodAuth();
  }

  // Also expose for god-mode.js to call if needed
  window.__godAuthCheck = isLoggedIn;
})();