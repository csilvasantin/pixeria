(function() {
  if (window.__godModeLoaded) return;
  window.__godModeLoaded = true;

  // Wait for god-auth if present
  if (window.__godAuthCheck && !window.__godAuthCheck()) {
    // Will be re-inited from auth success
    window.__initGodMode = initGodMode;
    return;
  }

  const STORAGE_KEY = 'god-text-edits-' + location.pathname;

  // Add styles for editing
  const style = document.createElement('style');
  style.textContent = `
    .god-toolbar {
      position: fixed;
      bottom: 16px;
      right: 16px;
      z-index: 99999;
      background: #0b1117;
      border: 1px solid #68dce9;
      border-radius: 8px;
      padding: 8px;
      display: flex;
      gap: 6px;
      font-family: system-ui, sans-serif;
      font-size: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.4);
    }
    .god-toolbar button {
      background: #111a20;
      color: #f4f0e8;
      border: 1px solid #68dce9;
      padding: 4px 8px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 11px;
    }
    .god-toolbar button:hover { background: #68dce9; color: #0b1117; }
    .god-editing {
      outline: 2px dashed #68dce9 !important;
      background: rgba(104, 220, 233, 0.08) !important;
      padding: 2px;
    }
    .god-banner {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: #ff6b5c;
      color: #0b1117;
      text-align: center;
      font-size: 11px;
      padding: 2px;
      z-index: 99998;
      font-weight: bold;
    }
  `;
  document.head.appendChild(style);

  // Banner
  const banner = document.createElement('div');
  banner.className = 'god-banner';
  banner.textContent = '🛠 GOD MODE — Editable texts version (pixeria.com/god) — Changes saved in browser only';
  document.body.appendChild(banner);

  // Toolbar
  const toolbar = document.createElement('div');
  toolbar.className = 'god-toolbar';
  toolbar.innerHTML = `
    <button id="god-toggle">✏️ Toggle Edit</button>
    <button id="god-save">💾 Save</button>
    <button id="god-load">📥 Load</button>
    <button id="god-export">📤 Export JSON</button>
    <button id="god-clear">🗑 Clear</button>
  `;
  document.body.appendChild(toolbar);

  let editMode = false;
  let editableElements = [];

  function getTextElements() {
    // Select common text containers, avoid nav icons, buttons with only icons, etc.
    const selectors = 'h1, h2, h3, h4, h5, p, li, span, a, strong, em, .subtitle, .eyebrow, button:not(.god-toolbar button)';
    return Array.from(document.querySelectorAll(selectors)).filter(el => {
      // Only elements with direct text or simple children
      const text = el.textContent.trim();
      if (!text || text.length < 2) return false;
      // Skip if mostly icons or very short non-text
      if (/^[\s\W]+$/.test(text)) return false;
      // Skip pure icon buttons etc.
      if (el.tagName === 'BUTTON' && el.querySelector('svg, img')) return false;
      return true;
    });
  }

  function assignIds() {
    const els = getTextElements();
    els.forEach((el, i) => {
      if (!el.dataset.godId) {
        el.dataset.godId = 't' + i;
      }
    });
    return els;
  }

  function enableEdit() {
    editableElements = assignIds();
    editableElements.forEach(el => {
      el.contentEditable = 'true';
      el.classList.add('god-editing');
    });
    editMode = true;
    document.getElementById('god-toggle').textContent = '⏹ Stop Edit';
  }

  function disableEdit() {
    editableElements.forEach(el => {
      el.contentEditable = 'false';
      el.classList.remove('god-editing');
    });
    editMode = false;
    document.getElementById('god-toggle').textContent = '✏️ Toggle Edit';
  }

  function saveEdits() {
    const data = {};
    const els = getTextElements();
    els.forEach(el => {
      if (el.dataset.godId) {
        data[el.dataset.godId] = el.textContent.trim();
      }
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    alert('Edits saved to browser localStorage for this page. They will persist on reload in this browser.');
  }

  function loadEdits() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      alert('No saved edits for this page.');
      return;
    }
    const data = JSON.parse(raw);
    const els = assignIds();
    let applied = 0;
    els.forEach(el => {
      if (el.dataset.godId && data[el.dataset.godId]) {
        el.textContent = data[el.dataset.godId];
        applied++;
      }
    });
    alert(`Loaded ${applied} text edits from localStorage.`);
  }

  function exportJSON() {
    const els = getTextElements();
    const exportData = els.map((el, idx) => ({
      id: el.dataset.godId || ('t' + idx),
      tag: el.tagName.toLowerCase(),
      original: (el.dataset.originalText || el.textContent.trim()).substring(0, 120),
      current: el.textContent.trim().substring(0, 120)
    }));
    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pixeria-god-texts-' + location.pathname.replace(/\//g, '_') + '.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function clearEdits() {
    localStorage.removeItem(STORAGE_KEY);
    // Reload page to original texts? For now just remove and suggest refresh.
    if (confirm('Cleared localStorage edits. Reload page to see original texts?')) {
      location.reload();
    }
  }

  // Wire buttons
  document.getElementById('god-toggle').addEventListener('click', () => {
    if (editMode) disableEdit();
    else enableEdit();
  });
  document.getElementById('god-save').addEventListener('click', saveEdits);
  document.getElementById('god-load').addEventListener('click', loadEdits);
  document.getElementById('god-export').addEventListener('click', exportJSON);
  document.getElementById('god-clear').addEventListener('click', clearEdits);

  // On load, try to apply saved edits
  function applySavedEdits() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    const els = assignIds();
    els.forEach(el => {
      if (el.dataset.godId && data[el.dataset.godId] != null) {
        // Store original for export
        if (!el.dataset.originalText) el.dataset.originalText = el.textContent.trim();
        el.textContent = data[el.dataset.godId];
      }
    });
  }

  // Initial apply
  applySavedEdits();

  // Keyboard hint
  document.addEventListener('keydown', function(e) {
    if (e.key.toLowerCase() === '?' && document.activeElement.tagName === 'BODY') {
      e.preventDefault();
      const btn = document.getElementById('god-toggle');
      if (btn) btn.click();
    }
  });

  console.log('%c[Pixeria GOD] Text editor loaded. Use the toolbar in bottom-right. Edits saved locally.', 'color:#68dce9');
})();
