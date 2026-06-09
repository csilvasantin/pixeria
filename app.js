(function () {
  const STORAGE_KEY = 'pixer-brief-v.2026.05.02-r35';
  const KEYS_STORE = 'pixer-keys';
  const VERSION = 'v.2026.05.02-r35';
  const COSTES_FECHA = '2026-05-15';
  const ELEVEN_WORKER_URL = 'https://pixer-eleven.csilvasantin.workers.dev';
  const XAI_WORKER_URL    = 'https://pixer-eleven.csilvasantin.workers.dev';

  // ─── API keys (localStorage) ───────────────────────────────────────
  function loadKeys() {
    try { return JSON.parse(localStorage.getItem(KEYS_STORE) || '{}'); }
    catch { return {}; }
  }
  function saveKeys(k) {
    try { localStorage.setItem(KEYS_STORE, JSON.stringify(k)); } catch {}
  }
  function hasKeyFor(motorId) {
    const k = loadKeys();
    if (motorId === 'elevenlabs-v2') return true; // proxied vía worker pixer-eleven
    if (motorId === 'elevenlabs-flash-v2-5') return true; // proxied vía worker pixer-eleven
    if (motorId === 'elevenlabs-v3') return true; // proxied vía worker pixer-eleven
    if (motorId === 'grok-imagine-image-pro') return true; // proxied vía worker
    if (motorId === 'imagen-4.0-ultra-generate-001') return true; // Gemini API key
    if (motorId === 'nano-banana') return true; // Gemini 2.5 Flash Image via worker
    if (motorId === 'veo-3.0-generate-001') return true; // Gemini API key
    if (motorId === 'veo-3.1-fast-generate-preview') return true; // Gemini API key
    if (motorId === 'gemini-omni-flash') return false; // API aún no pública (Google I/O 2026) — sin endpoint todavía
    if (motorId === 'suno-local-v45') return true; // depende del proxy local, se chequea aparte
    if (motorId === 'suno-local-v5') return true; // depende del proxy local, se chequea aparte
    if (motorId === 'lyria-3-pro-preview') return true; // proxied vía worker
    if (motorId === 'runway-gen3' || motorId === 'openai-tts-hd' || motorId === 'openai-sora') return false;
    return true;
  }
  function bindSettingsModal() {
    const dlg = document.getElementById('keysModal');
    const open = document.getElementById('openSettings');
    if (!dlg || !open) return;
    const inEL = document.getElementById('key-elevenlabs');
    const inELV = document.getElementById('key-elevenlabs-voice');
    const inX = document.getElementById('key-xai');
    function refresh() {
      const k = loadKeys();
      if (inEL) inEL.value = k.elevenlabs || '';
      if (inELV) inELV.value = k.elevenlabs_voice || '';
      if (inX) inX.value = k.xai || '';
    }
    open.addEventListener('click', () => { refresh(); dlg.showModal(); });
    document.getElementById('closeKeys')?.addEventListener('click', () => dlg.close());
    document.getElementById('saveKeys')?.addEventListener('click', () => {
      const k = {
        elevenlabs: inEL?.value.trim() || undefined,
        elevenlabs_voice: inELV?.value.trim() || undefined,
        xai: inX?.value.trim() || undefined,
      };
      saveKeys(k);
      showToast('Keys guardadas');
      dlg.close();
      renderMotorSelectors();
    });
    document.getElementById('clearKeys')?.addEventListener('click', () => {
      if (!confirm('¿Borrar todas las API keys de este navegador?')) return;
      localStorage.removeItem(KEYS_STORE);
      refresh();
      showToast('Keys borradas');
      renderMotorSelectors();
    });
  }

  // Defaults por sección. Se aplican solo si la sección está vacía en localStorage.
  const DEFAULTS = {
    cliente: 'Pixeria',
    audio: {
      personaje: 'Voz adulta cálida',
      idioma: 'Espanol (ES)',
      tono: 'Cercano',
      ritmo: '8s, ritmo medio',
      guion: 'Esto es una prueba',
      cta: 'Visita admira.xp',
    },
    musica: {
      bpm: '92',
      tonalidad: 'C menor',
      versiones: 'Loop 8s · Stinger 2s',
      uso: 'Bed de menú + stinger de cierre',
      emocion: ['Calma', 'Marca'],
      capas: ['Base', 'Pad'],
    },
    imagenes: {
      paleta: 'Verde fósforo + negro profundo',
      encuadre: 'Cuadrado 1:1',
      luz: 'Atardecer suave, contraste medio',
      realismo: 'Foto realista',
      prompt: 'Una pantalla de terminal vintage estilo Matrix con código verde cayendo, luz cinematográfica',
      assets: '1 imagen 1024x1024',
    },
    video: {
      hook: 'Una pregunta directa al espectador en 3 segundos',
      desarrollo: 'Mostrar producto con planos cortos y cierre con logo',
      cierre: 'Logo + claim',
      cta: 'Visita admira.xp',
      canal: 'Reel vertical 9:16',
      duracion: '15s',
      reusa: ['audio', 'musica'],
    },
    publicidad: {
      source: 'Simulador local',
      screen: 'escaparate',
      privacy: 'No guardar imagen, no identificar personas, usar solo señal efímera agregada',
      product: 'Colección XpaceOS Retail',
      context: 'Escaparate interactivo en tienda física',
      offerMale: 'Rendimiento, tecnología y estilo urbano',
      offerFemale: 'Diseño, comodidad y expresión personal',
      offerNeutral: 'Nueva colección disponible hoy',
      cta: 'Toca la pantalla y pruébalo en el gemelo',
      style: 'Matrix retail, neón verde, producto hero, texto alto contraste',
      segment: 'neutral',
      confidence: '0.64',
      // Nuevo modelo Target (creación con Target completo)
      mode: 'batch', // 'batch' | 'live'
      targets: [],   // array de {id, gender, ageBand, persona, label, headline?, offer?, visual?, tone?}
    },
  };

  function applyDefaults() {
    const store = loadStore();
    let changed = false;
    // Migracion: el default antiguo era 'Demo Pixer.ai'. Si nadie lo edito,
    // lo movemos al nuevo default de marca 'Pixeria' (el separador "//"
    // se aplica via deriveAssetTitle, no aqui).
    if (!store.cliente || store.cliente === 'Demo Pixer.ai') { store.cliente = DEFAULTS.cliente; changed = true; }
    for (const key of ['audio', 'musica', 'imagenes', 'video', 'publicidad']) {
      if (!store[key] || Object.keys(store[key]).length === 0) {
        store[key] = JSON.parse(JSON.stringify(DEFAULTS[key]));
        changed = true;
      }
    }
    if (changed) saveStore(store);
  }

  // Catálogo de motores IA por sección.
  // Default = primer elemento (siempre el gratuito).
  const MOTORES = {
    audio: [
      { id: 'web-speech',    nombre: 'Web Speech API', tipo: 'free', badge: 'Good',   coste: 'gratis · navegador',     desc: 'TTS del sistema operativo' },
      { id: 'grok-voice',    nombre: 'Grok (xAI)',     tipo: 'pro',  badge: 'Better', coste: 'vía worker',             desc: 'voz expresiva de xAI' },
      { id: 'elevenlabs-v3', nombre: 'ElevenLabs v3',  tipo: 'pro',  badge: 'Best',   coste: '$300 / 1M caracteres',   desc: 'máxima expresividad · tags emocionales' },
    ],
    musica: [
      { id: 'pixer-loop',           nombre: 'Pixer Loop (Web Audio)', tipo: 'free', badge: 'Good',   coste: 'gratis · navegador',  desc: 'pentatónica Cm in-browser' },
      { id: 'lyria-3-pro-preview',  nombre: 'Gemini (Google)',        tipo: 'pro',  badge: 'Better', coste: 'paid tier Gemini',    desc: '~2min con voz cantando la letra' },
      { id: 'suno-local-v5',        nombre: 'Suno v5 (local)',        tipo: 'pro',  badge: 'Best',   coste: '~10 créditos / canción · cuenta loguead.', desc: 'chirp-v5 · máxima calidad · vía proxy suno-local' },
    ],
    imagenes: [
      { id: 'flux-schnell',                  nombre: 'FLUX.1 [schnell]',        tipo: 'free', badge: 'Good',   coste: 'gratis · vía Nano Banana', desc: 'rápido' },
      { id: 'nano-banana',                   nombre: 'Nano Banana (Gemini 2.5)', tipo: 'free', badge: 'Better', coste: 'gratis (free tier)',   desc: 'generación + edición consistente' },
      { id: 'grok-imagine-image-pro',        nombre: 'Grok Imagine Pro (xAI)',  tipo: 'pro',  badge: 'Best',   coste: '$0.07 / imagen',        desc: 'mayor calidad · vía worker' },
    ],
    video: [
      { id: 'runway-gen3',                   nombre: 'Runway Gen-3 Alpha',    tipo: 'pro', badge: 'Good',   coste: '$0.05 / segundo',  desc: 'video 1080p · requiere backend (sin CORS)' },
      { id: 'veo-3.1-fast-generate-preview', nombre: 'Veo 3.1 Fast (Google)', tipo: 'pro', badge: 'Better', coste: '~$0.15 / segundo', desc: 'audio nativo · imagen→video · más rápido' },
      { id: 'openai-sora',                   nombre: 'Sora (OpenAI)',         tipo: 'pro', badge: 'Best',   coste: 'vía API',          desc: 'texto→vídeo de alta calidad · próximamente' },
    ],
  };

  function loadStore() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
    catch { return {}; }
  }
  function saveStore(data) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
    catch {}
  }
  function setNested(obj, path, value) {
    const keys = path.split('.');
    let ref = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      ref[keys[i]] = ref[keys[i]] || {};
      ref = ref[keys[i]];
    }
    if (value === undefined || value === null || value === '' ||
        (Array.isArray(value) && value.length === 0)) {
      delete ref[keys[keys.length - 1]];
    } else {
      ref[keys[keys.length - 1]] = value;
    }
  }
  function getNested(obj, path) {
    return path.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);
  }
  function pruneEmpty(obj) {
    if (Array.isArray(obj)) return obj;
    if (obj && typeof obj === 'object') {
      const out = {};
      for (const k of Object.keys(obj)) {
        const v = pruneEmpty(obj[k]);
        if (v === undefined) continue;
        if (v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0) continue;
        if (Array.isArray(v) && v.length === 0) continue;
        out[k] = v;
      }
      return out;
    }
    return obj;
  }

  // Hidratar inputs desde localStorage
  function hydrate(scope) {
    const store = loadStore();
    scope.querySelectorAll('input[type=text], select, textarea').forEach(el => {
      if (!el.name) return;
      const v = getNested(store, el.name);
      if (v !== undefined) el.value = v;
    });
    scope.querySelectorAll('.chips[data-name]').forEach(group => {
      const arr = getNested(store, group.dataset.name) || [];
      group.querySelectorAll('input').forEach(i => {
        i.checked = arr.includes(i.value);
        const chip = i.closest('.chip');
        if (chip) chip.classList.toggle('active', i.checked);
      });
    });
  }

  // Render del selector de motor IA en placeholders [data-motor-section="<seccion>"]
  function renderMotorSelectors() {
    document.querySelectorAll('[data-motor-section]').forEach(host => {
      const seccion = host.dataset.motorSection;
      const opciones = MOTORES[seccion];
      if (!opciones) return;
      const store = loadStore();
      // imagenes admite multi-select: click cada motor para añadir/quitar.
      // Para comparar 2-3 motores en paralelo basta con marcar varias.
      const isMulti = (seccion === 'imagenes');
      const inputType = isMulti ? 'checkbox' : 'radio';
      let selected;
      if (isMulti) {
        const m = store[seccion] && store[seccion].motors;
        if (Array.isArray(m) && m.length) {
          selected = m.filter(id => opciones.some(o => o.id === id));
        }
        if (!selected || !selected.length) {
          const single = (store[seccion] && store[seccion].motor) || opciones[0].id;
          selected = [opciones.some(o => o.id === single) ? single : opciones[0].id];
        }
      } else {
        selected = [(store[seccion] && store[seccion].motor) || opciones[0].id];
      }
      const groupName = `motor-${seccion}-${Math.random().toString(36).slice(2, 8)}`;
      const opts = opciones.map(o => {
        const badgeText = o.soon ? 'Próximamente' : (o.badge || o.tipo);
        const badgeCls = o.soon ? 'soon' : (o.badge ? o.badge : o.tipo).toLowerCase();
        return `
        <div class="motor-opt${o.soon ? ' soon' : ''}">
          <input type="${inputType}" id="${groupName}-${o.id}" name="${groupName}" value="${o.id}" ${selected.includes(o.id) ? 'checked' : ''}${o.soon ? ' disabled' : ''}>
          <label for="${groupName}-${o.id}">
            <span class="motor-name">${o.nombre}<span class="motor-tag ${o.tipo} ${badgeCls}">${badgeText}</span></span>
            <span class="motor-cost">${o.coste}</span>
            <span class="motor-desc">${o.desc}</span>
          </label>
        </div>`;
      }).join('');
      const titleHint = isMulti
        ? '<span style="color:#75aab9;font-weight:normal;font-size:11px;margin-left:8px">· multi-click para comparar</span>'
        : '';
      host.innerHTML = `
        <div class="motor-section" data-section="${seccion}">
          <div class="motor-head">
            <span class="motor-title">Motor IA · ${seccion}${titleHint}</span>
            <span class="motor-disclaimer">Costes orientativos a ${COSTES_FECHA}</span>
          </div>
          <div class="motor-grid">${opts}</div>
          <div class="motor-warning" data-warning hidden></div>
        </div>`;
      function renderWarning() {
        const wrap = host.querySelector('[data-warning]');
        if (!wrap) return;
        const motor = opciones.find(o => o.id === ((loadStore()[seccion] && loadStore()[seccion].motor) || opciones[0].id));
        if (!motor || motor.tipo !== 'pro') { wrap.hidden = true; wrap.innerHTML = ''; return; }
        const ok = hasKeyFor(motor.id);
        const keyLabel = motor.id.startsWith('elevenlabs-') ? 'WORKER pixer-eleven'
                       : motor.id === 'grok-imagine-image-pro' ? 'WORKER pixer-eleven'
                       : motor.id.startsWith('suno-local-') ? 'PROXY suno-local:3777'
                       : motor.id === 'lyria-3-pro-preview' ? 'WORKER pixer-eleven (GCP)'
                       : motor.id === 'nano-banana' ? 'WORKER pixer-eleven (Gemini)'
                       : (motor.id.startsWith('imagen-') || motor.id.startsWith('veo-')) ? 'WORKER pixer-eleven (Gemini)'
                       : (motor.id === 'runway-gen3' || motor.id === 'openai-tts-hd' || motor.id === 'openai-sora') ? 'BACKEND_REQUERIDO'
                       : 'API_KEY';
        wrap.hidden = false;
        wrap.innerHTML = `
          <span class="warn-icon">⚠</span>
          <strong>${motor.nombre}</strong> es de pago — consume tokens (${motor.coste}).
          ${ok
            ? `<span class="warn-ok">[ KEY ${keyLabel} configurada ]</span>`
            : `<span class="warn-missing">[ FALTA ${keyLabel} · pulsa <a href="#" data-open-keys>⚙ KEYS</a> ]</span>`}`;
        wrap.querySelector('[data-open-keys]')?.addEventListener('click', (e) => {
          e.preventDefault();
          document.getElementById('openSettings')?.click();
        });
      }
      host.querySelectorAll('input').forEach(r => {
        r.addEventListener('change', () => {
          const s = loadStore();
          if (isMulti) {
            const all = Array.from(host.querySelectorAll('input:checked')).map(x => x.value);
            // Garantiza al menos 1 seleccionado: si el usuario desmarcó el último, lo re-marcamos.
            if (all.length === 0) { r.checked = true; return; }
            setNested(s, `${seccion}.motors`, all);
            // Mantener s.motor como el primero seleccionado para back-compat con paths
            // antiguos del store (briefs persistidos antes de la multi-select).
            setNested(s, `${seccion}.motor`, all[0]);
          } else {
            if (!r.checked) return;
            setNested(s, `${seccion}.motor`, r.value);
          }
          saveStore(s);
          renderWarning();
        });
      });
      renderWarning();
      // Asegurar que el motor por defecto queda en store si no había nada
      if (!store[seccion] || !store[seccion].motor) {
        const s = loadStore();
        setNested(s, `${seccion}.motor`, opciones[0].id);
        saveStore(s);
      }
    });
  }

  // Persistir cambios
  function bindPersistence(scope) {
    function persistFromInput(el) {
      const store = loadStore();
      setNested(store, el.name, el.value.trim());
      saveStore(store);
    }
    scope.querySelectorAll('input[type=text], select, textarea').forEach(el => {
      if (!el.name) return;
      el.addEventListener('input', () => persistFromInput(el));
      el.addEventListener('change', () => persistFromInput(el));
    });
    scope.querySelectorAll('.chips[data-name]').forEach(group => {
      const name = group.dataset.name;
      group.querySelectorAll('input').forEach(i => {
        i.addEventListener('change', () => {
          const chip = i.closest('.chip');
          if (chip) chip.classList.toggle('active', i.checked);
          const values = Array.from(group.querySelectorAll('input:checked')).map(x => x.value);
          const store = loadStore();
          setNested(store, name, values);
          saveStore(store);
        });
      });
    });
  }

  function buildBrief(scopeKeys) {
    const store = loadStore();
    const data = { meta: { version: VERSION, generado: new Date().toISOString() } };
    if (store.cliente) data.cliente = store.cliente;
    const sections = scopeKeys || ['audio', 'musica', 'imagenes', 'video'];
    for (const k of sections) {
      if (store[k]) data[k] = store[k];
    }
    return pruneEmpty(data);
  }

  function toMarkdown(d) {
    const lines = [];
    lines.push('# Brief Pixer.ia x Admira.xp');
    if (d.cliente) lines.push(`**Cliente / proyecto:** ${d.cliente}`);
    lines.push(`**Version:** ${d.meta.version}  ·  **Generado:** ${d.meta.generado}`);
    const sections = [
      ['audio', 'Audio'],
      ['musica', 'Musica'],
      ['imagenes', 'Imagenes'],
      ['video', 'Video'],
      ['publicidad', 'Publicidad segmentada'],
    ];
    for (const [key, title] of sections) {
      if (!d[key]) continue;
      lines.push('', `## ${title}`);
      for (const [k, v] of Object.entries(d[key])) {
        const val = Array.isArray(v) ? v.join(', ') : v;
        lines.push(`- **${k}:** ${val}`);
      }
    }
    return lines.join('\n');
  }

  function showToast(msg) {
    let t = document.querySelector('.toast');
    if (!t) {
      t = document.createElement('div');
      t.className = 'toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => t.classList.remove('show'), 1400);
  }

  function bindBriefActions(out, scopeKeys) {
    function current() { return buildBrief(scopeKeys); }
    const map = {
      genBrief: () => { out.textContent = JSON.stringify(current(), null, 2); },
      copyBrief: async () => { await navigator.clipboard.writeText(JSON.stringify(current(), null, 2)); showToast('JSON copiado'); },
      copyMd: async () => { await navigator.clipboard.writeText(toMarkdown(current())); showToast('Markdown copiado'); },
      dlBrief: () => {
        const d = current();
        const blob = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const slug = (d.cliente || (scopeKeys && scopeKeys[0]) || 'brief').toLowerCase()
          .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'brief';
        a.href = url;
        a.download = `${slug}-pixer-admira-${d.meta.version}.json`;
        a.click();
        URL.revokeObjectURL(url);
      },
      clearAll: () => {
        const store = loadStore();
        if (scopeKeys && scopeKeys.length === 1 && scopeKeys[0] !== 'all') {
          delete store[scopeKeys[0]];
          if (scopeKeys[0] === 'publicidad') {
            adBaseImage = null;
            updateAdImagePreview();
          }
        } else {
          for (const k of (scopeKeys || ['audio', 'musica', 'imagenes', 'video', 'cliente'])) {
            delete store[k];
          }
          adBaseImage = null;
          updateAdImagePreview();
        }
        saveStore(store);
        document.querySelectorAll('input[type=text], select, textarea').forEach(el => { if (el.name) el.value = ''; });
        document.querySelectorAll('.chip input').forEach(i => { i.checked = false; i.closest('.chip')?.classList.remove('active'); });
        if (out) out.textContent = '// Rellena los campos y pulsa "Generar brief".';
        showToast('Limpiado');
      },
    };
    for (const [id, fn] of Object.entries(map)) {
      const btn = document.getElementById(id);
      if (btn) btn.addEventListener('click', fn);
    }
  }

  function loadDemo(demo, chipDemo) {
    const store = loadStore();
    Object.entries(demo).forEach(([name, value]) => setNested(store, name, value));
    if (chipDemo) Object.entries(chipDemo).forEach(([name, vals]) => setNested(store, name, vals));
    saveStore(store);
    location.reload();
  }

  // Cliente field (compartido)
  function bindCliente() {
    const el = document.getElementById('proj-cliente');
    if (!el) return;
    const store = loadStore();
    if (store.cliente) el.value = store.cliente;
    el.addEventListener('input', () => {
      const s = loadStore();
      if (el.value.trim()) s.cliente = el.value.trim(); else delete s.cliente;
      saveStore(s);
    });
  }

  // Render del catálogo de motores en placeholder [data-motor-catalog]
  function renderMotorCatalog() {
    document.querySelectorAll('[data-motor-catalog]').forEach(host => {
      const labels = { audio: 'Audio', musica: 'Música', imagenes: 'Imágenes', video: 'Video' };
      const html = Object.entries(MOTORES).map(([sec, opts]) => `
        <article class="module" style="padding: 18px;">
          <div class="module-head"><h3 style="margin:0;">${labels[sec] || sec}</h3><small>3 opciones</small></div>
          ${opts.map(o => `
            <div style="display:grid; grid-template-columns: auto 1fr auto; gap:10px; padding:8px 0; border-top:1px solid var(--line);">
              <span class="motor-tag ${o.tipo}" style="align-self:center;">${o.tipo}</span>
              <div>
                <div style="font-weight:700;">${o.nombre}</div>
                <div style="color:var(--muted); font-size:13px;">${o.desc}</div>
              </div>
              <span class="motor-cost" style="align-self:center; white-space:nowrap;">${o.coste}</span>
            </div>`).join('')}
        </article>`).join('');
      host.innerHTML = html;
    });
  }

  // ─── Reproductores por sección ─────────────────────────────────────
  function getPlayer() {
    return document.getElementById('player');
  }
  function showPlayer(html) {
    const p = getPlayer();
    if (!p) return;
    p.hidden = false;
    p.innerHTML = html;
  }

  // Genera el HTML de una barra de progreso (indeterminada por defecto).
  // expectedMs: opcional; si lo pasas, ETA = max(0, expectedMs - elapsed).
  function progressHtml(label, id, expectedMs) {
    return `
      <div class="pixer-progress" data-progress-id="${id}" ${expectedMs ? `data-expected="${expectedMs}"` : ''}>
        <div class="pixer-progress-bar"><div class="pixer-progress-fill"></div></div>
        <div class="pixer-progress-status">
          <span class="left" data-progress-label>${label}</span>
          <span class="right" data-progress-time>0s</span>
        </div>
      </div>`;
  }
  function startProgress(id) {
    const el = document.querySelector(`[data-progress-id="${id}"]`);
    if (!el) return () => {};
    const t0 = Date.now();
    const expected = parseInt(el.dataset.expected || '0', 10);
    const fill = el.querySelector('.pixer-progress-fill');
    const bar = el.querySelector('.pixer-progress-bar');
    const time = el.querySelector('[data-progress-time]');
    if (expected) bar.classList.add('determinate');
    const tick = setInterval(() => {
      const elapsed = (Date.now() - t0) / 1000;
      if (time) time.textContent = `${elapsed.toFixed(0)}s`;
      if (expected && fill) {
        const pct = Math.min(95, (elapsed * 1000 / expected) * 100);
        fill.style.width = pct + '%';
      }
    }, 250);
    return function stop(success = true) {
      clearInterval(tick);
      if (fill && success) fill.style.width = '100%';
    };
  }
  function setProgressLabel(id, text) {
    const el = document.querySelector(`[data-progress-id="${id}"] [data-progress-label]`);
    if (el) el.textContent = text;
  }

  const LANG_MAP = {
    'Espanol (ES)': 'es-ES',
    'Espanol (LATAM)': 'es-MX',
    'Catalan': 'ca-ES',
    'Ingles (UK)': 'en-GB',
    'Ingles (US)': 'en-US',
    'Frances': 'fr-FR',
    'Aleman': 'de-DE',
    'Portugues': 'pt-PT',
  };

  // ─── Pro models · password gate ───────────────────────────────────
  // Bloquea modelos tipo:'pro' (Better/Best) detrás de un password compartido.
  // No es seguridad real (cualquiera con DevTools lo salta) — es un kid-mode
  // que evita clicks accidentales en modelos que cuestan dinero. Cuando un
  // modelo se conecte a una API real con coste, la verificación se sube al
  // Worker y este gate frontal pasa a ser "el aviso" antes del cobro real.
  const PRO_LOCK_KEY = 'pixer_pro_unlocked';
  // SHA-256 del password compartido. Cambia el hash para rotar el password.
  const PRO_PASSWORD_HASH = 'e6f45147f091328d3300df63f8fdc719982a56e74bd8d8f7dfa088cc8ce0eb60';
  async function _sha256(s) {
    const buf = new TextEncoder().encode(s);
    const h = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  function isProUnlocked() {
    try { return localStorage.getItem(PRO_LOCK_KEY) === '1'; } catch { return false; }
  }
  function setProUnlocked(on) {
    try {
      if (on) localStorage.setItem(PRO_LOCK_KEY, '1');
      else localStorage.removeItem(PRO_LOCK_KEY);
    } catch {}
    updateProLockBadge();
  }
  async function unlockPro() {
    const pw = prompt('🔒 Modelos PRO bloqueados.\n\nIntroduce el password para desbloquear los modelos de pago (Better + Best · ElevenLabs · Suno · Lyria · Veo · Grok · Runway · Imagen Ultra). Se queda desbloqueado en este navegador hasta que pulses "Bloquear".');
    if (pw == null) return false;
    const h = await _sha256(pw);
    if (h === PRO_PASSWORD_HASH) {
      setProUnlocked(true);
      return true;
    }
    alert('Password incorrecto. Modelos PRO siguen bloqueados.');
    return false;
  }
  async function ensureProUnlocked() {
    if (isProUnlocked()) return true;
    return await unlockPro();
  }
  // Badge insertado en .topnav-actions (al lado del estado XTORE) para no
  // solaparse con la banda superior Admira·Xperience. Cae a position:fixed
  // si no encuentra el contenedor.
  function updateProLockBadge() {
    let el = document.getElementById('proLockBadge');
    if (!el) {
      el = document.createElement('button');
      el.id = 'proLockBadge';
      el.type = 'button';
      el.title = 'Estado de modelos PRO (Better+Best). Click para alternar.';
      el.style.cssText = 'border:1px solid rgba(120,243,255,.35);background:rgba(5,19,28,.78);color:#cceef5;font:600 11px/1 ui-monospace,monospace;letter-spacing:.04em;padding:6px 9px;border-radius:8px;cursor:pointer';
      el.addEventListener('click', async () => {
        if (isProUnlocked()) {
          if (confirm('¿Bloquear de nuevo los modelos PRO? Tendrás que reintroducir el password.')) {
            setProUnlocked(false);
          }
        } else {
          await unlockPro();
        }
      });
      const host = document.querySelector('.topnav-actions');
      if (host) {
        host.appendChild(el);
      } else {
        el.style.cssText += ';position:fixed;top:64px;right:14px;z-index:9999';
        document.body.appendChild(el);
      }
    }
    const on = isProUnlocked();
    el.textContent = on ? '🔓 PRO' : '🔒 PRO';
    el.style.color = on ? '#a7f0a8' : '#ffd86b';
    el.style.borderColor = on ? 'rgba(167,240,168,.4)' : 'rgba(255,216,107,.4)';
  }
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', updateProLockBadge);
    } else {
      updateProLockBadge();
    }
  }
  function confirmPro(motor, coste) {
    return (async () => {
      const ok = await ensureProUnlocked();
      if (!ok) return false;
      return confirm(`⚠ ${motor} es DE PAGO y consumirá tokens (${coste}).\n\n¿Continuar con la reproducción real?`);
    })();
  }

  async function playAudio() {
    const s = loadStore().audio || {};
    const text = (s.guion || 'Esto es una prueba').trim();
    const motor = s.motor || 'web-speech';
    const keys = loadKeys();

    const ELEVEN_MODELS = {
      'elevenlabs-v2':         { label: 'ElevenLabs v2',         model_id: 'eleven_multilingual_v2', pricePer1k: 0.30 },
      'elevenlabs-flash-v2-5': { label: 'ElevenLabs Flash v2.5', model_id: 'eleven_flash_v2_5',      pricePer1k: 0.15 },
      'elevenlabs-v3':         { label: 'ElevenLabs v3',         model_id: 'eleven_v3',              pricePer1k: 0.30 },
      // TEMP: "Grok" usa por ahora ElevenLabs Flash bajo la etiqueta Grok (xAI no tiene TTS aun). Cambiar cuando exista endpoint de voz Grok.
      'grok-voice':            { label: 'Grok (xAI)',            model_id: 'eleven_flash_v2_5',      pricePer1k: 0.15 },
    };
    if (ELEVEN_MODELS[motor]) {
      const { label, model_id, pricePer1k } = ELEVEN_MODELS[motor];
      const shownModel = (motor === 'grok-voice') ? 'grok-voice' : model_id; // mantener la etiqueta Grok en la salida
      if (!(await confirmPro(label, `$${(pricePer1k * 1000).toFixed(0)} / 1M caracteres · vía worker pixer-eleven`))) return;
      const voiceId = keys.elevenlabs_voice || 'EXAVITQu4vr4xnSDxMaL';
      showPlayer(`
        <div class="player-card">
          <div class="player-head">▶ AUDIO · ${label} · voice ${voiceId}</div>
          ${progressHtml(`Generando audio en ${label}...`, 'eleven', 8000)}
        </div>`);
      const stopElevenProg = startProgress('eleven');
      try {
        const r = await fetch(ELEVEN_WORKER_URL + '/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text,
            voice_id: voiceId,
            model_id,
            voice_settings: { stability: 0.5, similarity_boost: 0.75 },
          }),
        });
        if (!r.ok) {
          stopElevenProg(false);
          let err = '';
          try { err = JSON.stringify(await r.json()); } catch { err = await r.text(); }
          showPlayer(`<div class="player-card"><div class="player-head">▶ AUDIO · ${label} · ERROR ${r.status}</div><pre class="player-body">${err.replace(/</g,'&lt;').slice(0,400)}</pre></div>`);
          return;
        }
        const blob = await r.blob();
        const url = URL.createObjectURL(blob);
        stopElevenProg(true);
        const audioTitle = deriveAssetTitle('audio', loadStore());
        const audioCover = pollinationsCoverFor('audio', loadStore());
        const est = (text.length * pricePer1k / 1000).toFixed(4);
        const pubMeta = { type: 'audio', motor, prompt: text, costEst: `~$${est}`, url, mime: 'audio/mpeg', thumbnail: audioCover || null };
        showPlayer(`
          <div class="player-card">
            <div class="player-head">▶ AUDIO · ${label} · voice ${voiceId}</div>
            <pre class="player-body">"${text.replace(/</g,'&lt;')}"</pre>
            ${audioCover ? `<img src="${escAttr(audioCover)}" style="width:100%;max-height:240px;object-fit:cover;border:1px solid var(--matrix);box-shadow:0 0 12px rgba(0,255,65,.3);">` : ''}
            <audio controls autoplay src="${url}" data-pixer-title="${escAttr(audioTitle)}"${audioCover ? ` data-pixer-cover="${escAttr(audioCover)}"` : ''} style="width:100%;"></audio>
            ${publishBtnHTML(pubMeta)}
            <small class="player-foot">// ${text.length} caracteres · ~$${est} · model_id ${shownModel} · vía worker</small>
          </div>`);
      } catch (e) {
        stopElevenProg(false);
        showPlayer(`<div class="player-card"><div class="player-head">▶ AUDIO · ERROR</div><pre class="player-body">${String(e).replace(/</g,'&lt;')}</pre></div>`);
      }
      return;
    }

    if (motor === 'openai-tts-hd') {
      showPlayer('<p class="player-msg">⚠ OpenAI TTS HD requiere backend (no permite CORS desde navegador). Usa ElevenLabs o el motor gratuito.</p>');
      return;
    }

    // Default: web-speech (gratis)
    if (!('speechSynthesis' in window)) {
      showPlayer('<p class="player-msg">⚠ Tu navegador no soporta speechSynthesis.</p>');
      return;
    }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = LANG_MAP[s.idioma] || 'es-ES';
    u.rate = 1.0; u.pitch = 1.0; u.volume = 1.0;
    const voices = speechSynthesis.getVoices();
    const v = voices.find(v => v.lang === u.lang) || voices.find(v => v.lang.startsWith(u.lang.split('-')[0]));
    if (v) u.voice = v;
    showPlayer(`
      <div class="player-card">
        <div class="player-head">▶ AUDIO · Web Speech · ${u.lang}${v ? ' · ' + v.name : ''}</div>
        <pre class="player-body">"${text.replace(/</g,'&lt;')}"</pre>
        <small class="player-foot">// Reproducción local con Web Speech API · gratis · sin red</small>
      </div>`);
    speechSynthesis.speak(u);
  }

  let _musicCtx = null, _musicNodes = [];
  function stopMusic() {
    _musicNodes.forEach(n => { try { n.stop(); } catch {} try { n.disconnect(); } catch {} });
    _musicNodes = [];
  }
  // suno-local: localhost cuando la pagina sirve por http://, o Funnel publica
  // (https://macmini.tail48b61c.ts.net/suno) cuando vivimos en GitHub Pages — el
  // navegador bloquea fetch http://localhost desde paginas https:// por mixed-content.
  const SUNO_LOCAL_URL = (location.protocol === 'http:'
      || location.hostname === 'localhost'
      || location.hostname === '127.0.0.1')
    ? 'http://127.0.0.1:3777'
    : 'https://macmini.tail48b61c.ts.net/suno';

  async function sunoLocalAlive() {
    try {
      const r = await fetch(SUNO_LOCAL_URL + '/healthz', { method: 'GET' });
      if (!r.ok) return { ok: false, error: 'http ' + r.status };
      return await r.json();
    } catch (e) {
      return { ok: false, error: 'unreachable: arranca suno-local en el Mac Mini (./suno-local/start-suno-local.sh)' };
    }
  }

  async function playSunoLocal(s, model) {
    const guion = [
      s.uso, s.tonalidad && `tonalidad ${s.tonalidad}`, s.bpm && `${s.bpm}bpm`,
      ...(Array.isArray(s.emocion) ? s.emocion : []),
      ...(Array.isArray(s.capas) ? s.capas : []),
    ].filter(Boolean).join(', ');
    const prompt = guion || 'matrix synthwave, ambient, electronic';
    const lyrics = (s.letra || '').trim();
    // Si hay letra escrita la enviamos en custom mode (Suno usa el campo prompt
    // como letra y tags como estilo). Sin letra, instrumental segun "versiones".
    const isInstrumental = lyrics ? false : (!s.versiones || /instrumental|loop|bed/i.test(s.versiones));
    const titleHint = (s.cliente || s.uso || '').slice(0, 60);

    const health = await sunoLocalAlive();
    if (!health.ok) {
      showPlayer(`<div class="player-card"><div class="player-head">▶ MÚSICA · Suno · proxy NO responde (${SUNO_LOCAL_URL})</div><pre class="player-body">${health.error}\n\nArranca en el Mac Mini:\n  cd ~/GitHub/01.-AdmiraXperience-Game/suno-local\n  ./start-suno-local.sh</pre></div>`);
      return;
    }
    if (!(await confirmPro('Suno (local)', `~2 canciones · créditos restantes: ${health.total_credits_left}`))) return;

    showPlayer(`
      <div class="player-card">
        <div class="player-head">▶ MÚSICA · Suno ${model.replace('chirp-','')} · ${prompt.slice(0,60)}</div>
        ${progressHtml('Enviando prompt a Suno...', 'suno', 60000)}
      </div>`);
    const stop = startProgress('suno');
    try {
      const r = await fetch(SUNO_LOCAL_URL + '/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, lyrics, title: titleHint, instrumental: isInstrumental, model }),
      });
      if (!r.ok) {
        stop(false);
        const err = await r.text();
        showPlayer(`<div class="player-card"><div class="player-head">▶ MÚSICA · Suno · ERROR ${r.status}</div><pre class="player-body">${err.slice(0,500)}</pre></div>`);
        return;
      }
      const data = await r.json();
      const clipIds = (data.clips || []).map(c => c.id).filter(Boolean);
      if (!clipIds.length) {
        stop(false);
        showPlayer(`<div class="player-card"><div class="player-head">▶ MÚSICA · Suno · sin clips</div><pre class="player-body">${JSON.stringify(data).slice(0,400)}</pre></div>`);
        return;
      }
      setProgressLabel('suno', `Generando · clips ${clipIds.map(id=>id.slice(0,6)).join(', ')}`);
      // Polling
      let attempt = 0;
      while (true) {
        await new Promise(r => setTimeout(r, 5000));
        attempt++;
        const pollR = await fetch(`${SUNO_LOCAL_URL}/status?ids=${clipIds.join(',')}`);
        const clips = await pollR.json();
        const ready = clips.filter(c => c.audio_url && c.status === 'streaming' || c.status === 'complete');
        setProgressLabel('suno', `Suno · intento ${attempt} · ${ready.length}/${clips.length} listos`);
        if (ready.length >= 1) {
          stop(true);
          const briefTitle = deriveAssetTitle('musica', loadStore());
          showPlayer(`
            <div class="player-card">
              <div class="player-head">▶ MÚSICA · Suno (${model.replace('chirp-','')}) · ${ready.length}/${clips.length} clips</div>
              ${ready.map((c, i) => {
                const cTitle = (c.title && c.title.trim()) || briefTitle || `Suno ${i + 1}`;
                const cover = c.image_large_url || c.image_url || '';
                const dur = (c.metadata && (c.metadata.duration_formatted || c.metadata.duration)) || '';
                const pickedUrl = c.video_url || c.audio_url;
                const pickedMime = c.video_url ? 'video/mp4' : 'audio/mpeg';
                const pubMeta = { type: 'music', motor: `suno-local-${model.replace('chirp-v','v')}`, prompt: `${cTitle} · ${prompt}`.slice(0,200), costEst: '~10 cred', url: pickedUrl, mime: pickedMime, thumbnail: cover || null };
                // Suno devuelve video_url (mp4 con cover estatico + audio embebido):
                // lo preferimos porque al enviarlo a Pixer Feed lleva caratula sin
                // depender del worker. Si solo hay audio_url, fallback a audio + img.
                if (c.video_url) {
                  return `
                <div style="display:grid;gap:6px;margin-bottom:10px;">
                  <strong style="color:var(--matrix);text-shadow:var(--glow);">[${i + 1}] ${escAttr(cTitle)} · ${dur}</strong>
                  <video controls src="${c.video_url}"${cover ? ` poster="${escAttr(cover)}"` : ''} data-pixer-title="${escAttr(cTitle)}"${cover ? ` data-pixer-cover="${escAttr(cover)}"` : ''} style="width:100%;max-height:55vh;border:1px solid var(--matrix);box-shadow:0 0 12px rgba(0,255,65,.3);"></video>
                  ${publishBtnHTML(pubMeta)}
                </div>`;
                }
                return `
                <div style="display:grid;gap:6px;margin-bottom:10px;">
                  <strong style="color:var(--matrix);text-shadow:var(--glow);">[${i + 1}] ${escAttr(cTitle)} · ${dur}</strong>
                  ${cover ? `<img src="${escAttr(cover)}" style="width:100%;max-height:240px;object-fit:cover;border:1px solid var(--matrix);box-shadow:0 0 12px rgba(0,255,65,.3);">` : ''}
                  <audio controls src="${c.audio_url}" data-pixer-title="${escAttr(cTitle)}"${cover ? ` data-pixer-cover="${escAttr(cover)}"` : ''} style="width:100%;"></audio>
                  ${publishBtnHTML(pubMeta)}
                </div>`;
              }).join('')}
              <small class="player-foot">// Suno · ${prompt.slice(0,80)}</small>
            </div>`);
          return;
        }
        if (attempt > 60) { // 5 min cap
          stop(false);
          showPlayer(`<div class="player-card"><div class="player-head">▶ MÚSICA · Suno · TIMEOUT</div><pre class="player-body">clips: ${clipIds.join(', ')}</pre></div>`);
          return;
        }
      }
    } catch (e) {
      stop(false);
      showPlayer(`<div class="player-card"><div class="player-head">▶ MÚSICA · Suno · ERROR</div><pre class="player-body">${String(e)}</pre></div>`);
    }
  }

  // Traducciones ES→EN para Lyria (que solo acepta inglés)
  const EMO_EN = { Calma:'calm', Tension:'tense', Descubrimiento:'discovery', Celebracion:'celebratory', Marca:'brand identity', Transicion:'transition' };
  const CAPA_EN = { Base:'bass', Percusion:'percussion', Melodia:'melody', Stinger:'stinger', Pad:'pad', Bed:'bed' };

  // Categorías de tempo abstractas (Lyria rechaza bpm exactos por recitation checks)
  function tempoLabel(bpm) {
    const n = parseInt(bpm, 10);
    if (!n) return 'medium tempo';
    if (n < 70) return 'slow tempo';
    if (n < 100) return 'relaxed tempo';
    if (n < 130) return 'moderate tempo';
    return 'energetic tempo';
  }

  async function playLyria3(s) {
    const moods = (Array.isArray(s.emocion) ? s.emocion.map(e => EMO_EN[e] || e.toLowerCase()) : []);
    const layers = (Array.isArray(s.capas) ? s.capas.map(c => CAPA_EN[c] || c.toLowerCase()) : []);
    const styleParts = [
      'electronic music with vocals',
      tempoLabel(s.bpm),
      ...moods,
      layers.length ? `featuring ${layers.join(' and ')}` : '',
    ].filter(Boolean);
    const prompt = styleParts.join(', ');
    const lyrics = (s.letra || '').trim();
    const model = 'lyria-3-pro-preview';
    const label = 'Lyria 3 Pro';

    if (!lyrics) {
      const ok = confirm(`No has generado letra todavía. ${label} CON letra suena cantando; sin letra cantará improvisando.\n\n¿Continuar igual?`);
      if (!ok) return;
    }
    if (!(await confirmPro(label + ' (Google)', `paid tier Gemini · vía worker pixer-eleven`))) return;

    showPlayer(`
      <div class="player-card">
        <div class="player-head">▶ MÚSICA · ${label} (Google) · ${prompt.slice(0, 60)}</div>
        ${progressHtml('Generando música con voz...', 'lyria3', 60000)}
      </div>`);
    const stop = startProgress('lyria3');
    try {
      const r = await fetch(ELEVEN_WORKER_URL + '/lyria3/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, lyrics, model }),
      });
      if (!r.ok) {
        stop(false);
        const err = await r.text();
        showPlayer(`<div class="player-card"><div class="player-head">▶ MÚSICA · ${label} · ERROR ${r.status}</div><pre class="player-body">${err.replace(/</g,'&lt;').slice(0,500)}</pre></div>`);
        return;
      }
      const data = await r.json();
      const b64 = data?.audio;
      if (!b64) {
        stop(false);
        showPlayer(`<div class="player-card"><div class="player-head">▶ MÚSICA · ${label} · sin audio</div><pre class="player-body">${JSON.stringify(data).slice(0,400)}</pre></div>`);
        return;
      }
      // base64 → Blob MP3
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: data.mimeType || 'audio/mpeg' });
      const url = URL.createObjectURL(blob);
      stop(true);
      const captionText = (data.text || '').replace(/</g,'&lt;');
      const l3Title = deriveAssetTitle('musica', loadStore());
      const l3Cover = pollinationsCoverFor('musica', loadStore());
      const pubMeta = { type: 'music', motor: model, prompt: `${l3Title} · ${prompt}`.slice(0,200), costEst: 'paid Gemini', url, mime: data.mimeType || 'audio/mpeg', thumbnail: l3Cover || null };
      showPlayer(`
        <div class="player-card">
          <div class="player-head">▶ MÚSICA · ${label} (Google) · MP3 ${(bytes.length / 1024 / 1024).toFixed(1)} MB</div>
          ${l3Cover ? `<img src="${escAttr(l3Cover)}" style="width:100%;max-height:240px;object-fit:cover;border:1px solid var(--matrix);box-shadow:0 0 12px rgba(0,255,65,.3);">` : ''}
          <audio controls autoplay src="${url}" data-pixer-title="${escAttr(l3Title)}"${l3Cover ? ` data-pixer-cover="${escAttr(l3Cover)}"` : ''} style="width:100%;"></audio>
          ${captionText ? `<pre class="player-body">${captionText}</pre>` : ''}
          <a class="btn" download="lyria3-${Date.now()}.mp3" href="${url}">⬇ Descargar MP3</a>
          ${publishBtnHTML(pubMeta)}
          <small class="player-foot">// Vertex Gemini · ${model} · ${bytes.length} bytes</small>
        </div>`);
    } catch (e) {
      stop(false);
      showPlayer(`<div class="player-card"><div class="player-head">▶ MÚSICA · ${label} · ERROR</div><pre class="player-body">${String(e)}</pre></div>`);
    }
  }

  function playMusica() {
    const s = loadStore().musica || {};
    const motor = s.motor || 'pixer-loop';
    if (motor === 'suno-local-v45')       return playSunoLocal(s, 'chirp-v4-5');
    if (motor === 'suno-local-v5')        return playSunoLocal(s, 'chirp-v5');
    if (motor === 'lyria-3-pro-preview')  return playLyria3(s);
    // default: Pixer Loop (Web Audio)
    const bpm = parseInt(s.bpm, 10) || 92;
    stopMusic();
    if (!window.AudioContext && !window.webkitAudioContext) {
      showPlayer('<p class="player-msg">⚠ AudioContext no disponible.</p>');
      return;
    }
    if (!_musicCtx) _musicCtx = new (window.AudioContext || window.webkitAudioContext)();
    const ctx = _musicCtx;
    const now = ctx.currentTime;
    // Cmin pentatonic: C Eb F G Bb (Hz)
    const notes = [261.63, 311.13, 349.23, 392.00, 466.16, 523.25];
    const beat = 60 / bpm;
    const totalBeats = 16;
    const master = ctx.createGain();
    master.gain.value = 0.18;
    master.connect(ctx.destination);
    _musicNodes.push(master);
    // Pad sostenido
    const pad = ctx.createOscillator();
    pad.type = 'sine'; pad.frequency.value = 130.81;
    const padG = ctx.createGain(); padG.gain.value = 0;
    padG.gain.linearRampToValueAtTime(0.10, now + 0.4);
    padG.gain.linearRampToValueAtTime(0, now + beat * totalBeats);
    pad.connect(padG).connect(master);
    pad.start(now); pad.stop(now + beat * totalBeats + 0.1);
    _musicNodes.push(pad, padG);
    // Melodía
    for (let i = 0; i < totalBeats; i++) {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = notes[Math.floor(Math.random() * notes.length)];
      const g = ctx.createGain();
      const t0 = now + i * beat;
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.25, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + beat * 0.9);
      o.connect(g).connect(master);
      o.start(t0); o.stop(t0 + beat);
      _musicNodes.push(o, g);
    }
    showPlayer(`
      <div class="player-card">
        <div class="player-head">▶ MÚSICA · ${bpm} bpm · ${s.tonalidad || 'C menor'}</div>
        <pre class="player-body">// Loop generado in-browser con Web Audio API
// Pentatónica Cm · ${totalBeats} beats · ${(beat * totalBeats).toFixed(1)}s</pre>
        <button type="button" class="btn" id="stopMusic">■ Parar</button>
        <small class="player-foot">// Preview gratis · motores PRO requieren API key</small>
      </div>`);
    document.getElementById('stopMusic')?.addEventListener('click', stopMusic);
  }

  const ASPECT_IMAGEN = {
    'Vertical 9:16': '9:16',
    'Cuadrado 1:1': '1:1',
    'Horizontal 16:9': '16:9',
    'Banner 3:1': '16:9',
    'Mixto': '1:1',
  };

  async function playImagen(s, fullPrompt) {
    const model = 'imagen-4.0-ultra-generate-001';
    const label = 'Imagen 4 Ultra';
    const cost = '$0.06 / imagen 2K';
    if (!(await confirmPro(label + ' (Google)', cost + ' · paid tier Gemini'))) return;
    const aspectRatio = ASPECT_IMAGEN[s.encuadre] || '1:1';
    showPlayer(`
      <div class="player-card">
        <div class="player-head">▶ IMAGEN · ${label} (Google) · ${aspectRatio}</div>
        ${progressHtml(`Generando con ${label}...`, 'imagen', 12000)}
      </div>`);
    const stop = startProgress('imagen');
    try {
      const r = await fetch(ELEVEN_WORKER_URL + '/imagen/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: fullPrompt, aspectRatio, numberOfImages: 1, model, imageSize: '2K' }),
      });
      if (!r.ok) {
        stop(false);
        const err = await r.text();
        showPlayer(`<div class="player-card"><div class="player-head">▶ IMAGEN · ${label} · ERROR ${r.status}</div><pre class="player-body">${err.replace(/</g,'&lt;').slice(0,500)}</pre></div>`);
        return;
      }
      const data = await r.json();
      const b64 = data?.predictions?.[0]?.bytesBase64Encoded;
      if (!b64) {
        stop(false);
        showPlayer(`<div class="player-card"><div class="player-head">▶ IMAGEN · ${label} · sin imagen</div><pre class="player-body">${JSON.stringify(data).slice(0,400)}</pre></div>`);
        return;
      }
      stop(true);
      const url = `data:${data.predictions[0].mimeType || 'image/png'};base64,${b64}`;
      const imgTitle = deriveAssetTitle('imagenes', loadStore());
      const pubMeta = { type: 'image', motor: model, prompt: fullPrompt, costEst: cost, url, mime: data.predictions[0].mimeType || 'image/png' };
      showPlayer(`
        <div class="player-card">
          <div class="player-head">▶ IMAGEN · ${label} (Google) · ${aspectRatio}</div>
          <div class="player-img-wrap">
            <img class="player-img" src="${url}" alt="generada" data-pixer-title="${escAttr(imgTitle)}">
          </div>
          <pre class="player-body">${fullPrompt.replace(/</g,'&lt;')}</pre>
          ${publishBtnHTML(pubMeta)}
          <small class="player-foot">// Gemini API · ${cost}</small>
        </div>`);
    } catch (e) {
      stop(false);
      showPlayer(`<div class="player-card"><div class="player-head">▶ IMAGEN · ${label} · ERROR</div><pre class="player-body">${String(e)}</pre></div>`);
    }
  }

  async function playNanoBanana(s, fullPrompt) {
    const label = 'Nano Banana';
    const aspectRatio = ASPECT_IMAGEN[s.encuadre] || '1:1';
    const url = nanoBananaUrl(fullPrompt, aspectRatio);
    const imgTitle = deriveAssetTitle('imagenes', loadStore());
    const pubMeta = { type: 'image', motor: 'nano-banana', prompt: fullPrompt, costEst: 'gratis', url, mime: 'image/png' };
    showPlayer(`
      <div class="player-card">
        <div class="player-head">▶ IMAGEN · ${label} (Gemini 2.5 Flash Image) · ${aspectRatio}</div>
        <div class="player-img-wrap">
          <div class="player-loading">// generando imagen con ${label}...</div>
          <img class="player-img" crossorigin="anonymous" src="${url}" alt="generada" data-pixer-title="${escAttr(imgTitle)}" onload="this.previousElementSibling.style.display='none'" onerror="this.style.display='none';var l=this.previousElementSibling;l.innerHTML='⚠ Nano Banana no devolvió imagen — cuota gratis agotada o error.&lt;br&gt;Reintenta en un rato.';l.style.color='#ff8a5c';l.style.lineHeight='1.5';">
        </div>
        <pre class="player-body">${fullPrompt.replace(/</g,'&lt;')}</pre>
        ${publishBtnHTML(pubMeta)}
        <small class="player-foot">// Nano Banana · Gemini 2.5 Flash Image · gratis (free tier)</small>
      </div>`);
  }

  // ─── Generadores atómicos para "comparar todas" ─────────────────
  // Cada uno devuelve {ok, url?, error?} sin renderizar UI.
  // Nano Banana (Gemini 2.5 Flash Image) vía worker aislado admira-imagen.
  // Devuelve los bytes de la imagen directamente → usable en <img src>.
  function genFluxUrl(fullPrompt, w, h) {
    const ar = (w && h) ? (w / h >= 1.25 ? '16:9' : (h / w >= 1.25 ? '9:16' : '1:1')) : '16:9';
    return `https://admira-imagen.csilvasantin.workers.dev/img?prompt=${encodeURIComponent(fullPrompt)}&ar=${ar}&model=gemini-2.5-flash-image`;
  }
  async function genGrokRaw(fullPrompt, model) {
    try {
      const r = await fetch(XAI_WORKER_URL + '/xai/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: fullPrompt, n: 1, model }),
      });
      const data = await r.json();
      const url = data?.data?.[0]?.url;
      if (!r.ok || !url) return { ok: false, error: JSON.stringify(data).slice(0, 200) };
      return { ok: true, url };
    } catch (e) { return { ok: false, error: String(e) }; }
  }
  async function genImagenRaw(fullPrompt, aspectRatio) {
    try {
      const r = await fetch(ELEVEN_WORKER_URL + '/imagen/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: fullPrompt, aspectRatio, numberOfImages: 1, model: 'imagen-4.0-ultra-generate-001', imageSize: '2K' }),
      });
      const data = await r.json();
      const b64 = data?.predictions?.[0]?.bytesBase64Encoded;
      if (!r.ok || !b64) return { ok: false, error: JSON.stringify(data).slice(0, 200) };
      return { ok: true, url: `data:${data.predictions[0].mimeType || 'image/png'};base64,${b64}` };
    } catch (e) { return { ok: false, error: String(e) }; }
  }
  // Nano Banana vía worker aislado admira-imagen (GET /img devuelve la imagen).
  function nanoBananaUrl(fullPrompt, aspectRatio) {
    const ar = aspectRatio || '1:1';
    return `https://admira-imagen.csilvasantin.workers.dev/img?prompt=${encodeURIComponent(fullPrompt)}&ar=${ar}&model=gemini-2.5-flash-image`;
  }
  async function genNanoBananaRaw(fullPrompt, aspectRatio) {
    return { ok: true, url: nanoBananaUrl(fullPrompt, aspectRatio) };
  }

  // Compara N motores en paralelo, side-by-side. Recibe la lista de IDs
  // (de MOTORES.imagenes) seleccionados por el usuario via checkbox multi-select.
  async function compareSelectedImages(motorIds, s, fullPrompt, w, h) {
    const aspectRatio = ASPECT_IMAGEN[s.encuadre] || '1:1';
    // Tabla de fabricacion por motor → {label, cost, promise}
    const factory = {
      'flux-schnell':                  () => ({ label: 'FLUX schnell',     cost: 'gratis',  promise: Promise.resolve({ ok: true, url: genFluxUrl(fullPrompt, w, h) }) }),
      'nano-banana':                   () => ({ label: 'Nano Banana',      cost: '~$0.04',  promise: genNanoBananaRaw(fullPrompt, aspectRatio) }),
      'imagen-4.0-ultra-generate-001': () => ({ label: 'Imagen 4 Ultra',   cost: '$0.06',   promise: genImagenRaw(fullPrompt, aspectRatio) }),
      'grok-imagine-image-pro':        () => ({ label: 'Grok Imagine Pro', cost: '$0.07',   promise: genGrokRaw(fullPrompt, 'grok-imagine-image-pro') }),
    };
    const motors = motorIds
      .map(id => factory[id] ? Object.assign({ id }, factory[id]()) : null)
      .filter(Boolean);
    if (!motors.length) return;
    if (motors.some(m => /imagen|grok/i.test(m.label))) {
      const total = motors.reduce((a,m)=>a + (parseFloat((m.cost||'').replace('$','').replace(',','.'))||0), 0);
      if (!(await confirmPro('COMPARAR motores', motors.map(m=>m.label).join(' + ') + (total>0?(' (~$'+total.toFixed(2)+' total)'):'')))) return;
    }
    const headerHint = motors.length>1 ? ' · click la imagen para elegir cual enviar' : '';
    showPlayer(`
      <div class="player-card">
        <div class="player-head">▶ COMPARAR · ${motors.length} motor${motors.length>1?'es':''} · ${aspectRatio}${headerHint}</div>
        <div class="compare-grid">
          ${motors.map(m => `
            <div class="compare-cell" data-cell="${m.id}" data-motor-label="${(typeof escAttr==='function')?escAttr(m.label):String(m.label).replace(/"/g,'&quot;')}">
              <div class="compare-cell-head"><strong>${m.label}</strong> <span style="opacity:.7">${m.cost}</span></div>
              <div class="compare-cell-img"><span class="compare-loading">// generando...</span></div>
            </div>`).join('')}
        </div>
        <pre class="player-body">${fullPrompt.replace(/</g,'&lt;')}</pre>
        <small class="player-foot">// ${motors.length} motor${motors.length>1?'es':''} en paralelo · resultados conforme lleguen</small>
      </div>`);

    // Click en una celda → la marca como seleccionada (única) para que
    // ENVIAR A ADMIRA XP recoja esa imagen via detectLatestAsset.
    document.querySelectorAll('.compare-cell[data-cell]').forEach(cellEl => {
      cellEl.addEventListener('click', () => {
        if (!cellEl.querySelector('.compare-cell-img img[src]')) return;
        document.querySelectorAll('.compare-cell.selected').forEach(c => c.classList.remove('selected'));
        cellEl.classList.add('selected');
      });
    });

    let firstSelected = false;
    motors.forEach(async m => {
      const t0 = Date.now();
      const res = await m.promise;
      const ms = Date.now() - t0;
      const cellWrap = document.querySelector(`[data-cell="${m.id}"]`);
      const cell = cellWrap && cellWrap.querySelector('.compare-cell-img');
      if (!cell) return;
      if (res && res.ok && res.url) {
        const cTitle = (typeof deriveAssetTitle==='function') ? deriveAssetTitle('imagenes', loadStore()) : (m.label);
        const safeTitle = (typeof escAttr==='function') ? escAttr(cTitle) : String(cTitle).replace(/"/g,'&quot;');
        cell.innerHTML = `<img src="${res.url}" alt="${m.label}" data-pixer-title="${safeTitle}" onload="this.parentElement.querySelector('.compare-time')?.remove()"><span class="compare-time">${(ms/1000).toFixed(1)}s</span>`;
        // Auto-selecciona la primera imagen que carga (default seleccionada).
        if (!firstSelected && motors.length > 1) {
          cellWrap.classList.add('selected');
          firstSelected = true;
        }
      } else {
        cell.innerHTML = `<div class="compare-error">⚠ ${(res && res.error || 'error').slice(0,100).replace(/</g,'&lt;')}</div>`;
      }
    });
  }

  async function playImagenes() {
    const s = loadStore().imagenes || {};
    // Multi-select: leer s.motors (array) y caer a [s.motor] solo si no existe.
    const motorsList = Array.isArray(s.motors) && s.motors.length ? s.motors : [s.motor || 'flux-schnell'];
    const motor = motorsList[0]; // primario para single-render path
    const prompt = (s.prompt || 'Matrix terminal screen with green falling code').trim();
    const sizeMap = {
      'Vertical 9:16': [576, 1024],
      'Cuadrado 1:1': [768, 768],
      'Horizontal 16:9': [1024, 576],
      'Banner 3:1': [1200, 400],
      'Mixto': [768, 768],
    };
    const [w, h] = sizeMap[s.encuadre] || [768, 768];
    const styleHints = [s.realismo, s.luz, s.paleta].filter(Boolean).join(', ');
    const fullPrompt = styleHints ? `${prompt}, ${styleHints}` : prompt;
    const keys = loadKeys();

    // 2+ motores seleccionados → grid comparativa.
    if (motorsList.length > 1) {
      return compareSelectedImages(motorsList, s, fullPrompt, w, h);
    }

    if (motor === 'imagen-4.0-ultra-generate-001') {
      return playImagen(s, fullPrompt);
    }

    if (motor === 'nano-banana') {
      return playNanoBanana(s, fullPrompt);
    }

    if (motor === 'grok-imagine-image-pro') {
      const label = 'Grok Imagine Pro';
      const cost = '$0.07 / imagen';
      if (!(await confirmPro(label + ' (xAI)', cost + ' · vía worker pixer-eleven'))) return;
      showPlayer(`
        <div class="player-card">
          <div class="player-head">▶ IMAGEN · ${label} (xAI)</div>
          ${progressHtml(`Generando imagen con ${label}...`, 'grokimg', 8000)}
        </div>`);
      const stopGrokImg = startProgress('grokimg');
      try {
        const r = await fetch(XAI_WORKER_URL + '/xai/image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: fullPrompt, n: 1, model: motor }),
        });
        if (!r.ok) {
          stopGrokImg(false);
          const err = await r.text();
          showPlayer(`<div class="player-card"><div class="player-head">▶ IMAGEN · ${label} · ERROR ${r.status}</div><pre class="player-body">${err.replace(/</g,'&lt;').slice(0,500)}</pre></div>`);
          return;
        }
        const data = await r.json();
        const url = data?.data?.[0]?.url;
        const revised = data?.data?.[0]?.revised_prompt || fullPrompt;
        if (!url) {
          stopGrokImg(false);
          showPlayer(`<div class="player-card"><div class="player-head">▶ IMAGEN · ${label} · sin URL</div><pre class="player-body">${JSON.stringify(data).replace(/</g,'&lt;').slice(0,400)}</pre></div>`);
          return;
        }
        stopGrokImg(true);
        const grokImgTitle = deriveAssetTitle('imagenes', loadStore());
        const pubMeta = { type: 'image', motor: 'grok-imagine-image-pro', prompt: revised, costEst: cost, url, mime: 'image/jpeg' };
        showPlayer(`
          <div class="player-card">
            <div class="player-head">▶ IMAGEN · ${label} (xAI)</div>
            <div class="player-img-wrap">
              <img class="player-img" src="${url}" alt="generada" data-pixer-title="${escAttr(grokImgTitle)}">
            </div>
            <pre class="player-body">${revised.replace(/</g,'&lt;')}</pre>
            ${publishBtnHTML(pubMeta)}
            <small class="player-foot">// xAI ${label} · ${cost} · 1 imagen</small>
          </div>`);
      } catch (e) {
        stopGrokImg(false);
        showPlayer(`<div class="player-card"><div class="player-head">▶ IMAGEN · ERROR</div><pre class="player-body">${String(e).replace(/</g,'&lt;')}</pre></div>`);
      }
      return;
    }

    // Nano Banana (Gemini 2.5 Flash Image) vía worker aislado admira-imagen.
    const url = genFluxUrl(fullPrompt, w, h);
    const fluxTitle = deriveAssetTitle('imagenes', loadStore());
    const pubMeta = { type: 'image', motor: 'nano-banana', prompt: fullPrompt, costEst: 'gratis', url, mime: 'image/png' };
    showPlayer(`
      <div class="player-card">
        <div class="player-head">▶ IMAGEN · Nano Banana (Gemini 2.5 Flash Image) · ${w}×${h}</div>
        <div class="player-img-wrap">
          <div class="player-loading">// generando imagen con Nano Banana...</div>
          <img class="player-img" crossorigin="anonymous" src="${url}" alt="generada" data-pixer-title="${escAttr(fluxTitle)}" onload="this.previousElementSibling.style.display='none'" onerror="this.style.display='none';var l=this.previousElementSibling;l.innerHTML='⚠ Nano Banana no devolvió imagen — cuota gratis agotada o error.&lt;br&gt;Reintenta en un rato o usa Grok Imagine.';l.style.color='#ff8a5c';l.style.lineHeight='1.5';">
        </div>
        <pre class="player-body">${fullPrompt.replace(/</g,'&lt;')}</pre>
        ${publishBtnHTML(pubMeta)}
        <small class="player-foot">// Nano Banana · Gemini 2.5 Flash Image · gratis (free tier)</small>
      </div>`);
  }

  function parseSeconds(str) {
    const m = String(str || '').match(/(\d+(?:\.\d+)?)/);
    return m ? Math.max(3, Math.min(60, parseFloat(m[1]))) : 15;
  }

  const ASPECT_VEO = {
    'Reel vertical 9:16': '9:16',
    'YouTube 16:9': '16:9',
    'Demo producto 16:9': '16:9',
    'Pantalla evento 16:9': '16:9',
    'Carrusel cuadrado 1:1': '16:9', // Veo 3 no soporta 1:1
  };

  const VEO_MODELS = {
    'veo-3.0-generate-001':          { label: 'Veo 3',        costPerSec: 0.40 },
    'veo-3.1-fast-generate-preview': { label: 'Veo 3.1 Fast',  costPerSec: 0.15 },
  };

  async function playVeo(s, modelOverride) {
    const model = modelOverride || 'veo-3.0-generate-001';
    const meta = VEO_MODELS[model] || VEO_MODELS['veo-3.0-generate-001'];
    const label = meta.label;
    const costPerSec = meta.costPerSec;
    const aspect = ASPECT_VEO[s.canal] || '16:9';
    const dur = Math.max(4, Math.min(8, parseSeconds(s.duracion)));
    const dur4or6or8 = dur <= 4 ? 4 : dur <= 6 ? 6 : 8;
    const guion = [s.hook, s.desarrollo, s.cierre, s.cta && `CTA: ${s.cta}`].filter(Boolean).join(' · ');
    const palette = (loadStore().imagenes && loadStore().imagenes.paleta) || 'cinematic';
    const prompt = `${guion}, ${palette}, cinematic, with appropriate ambient sound and music`;
    const cost = `~$${(dur4or6or8 * costPerSec).toFixed(2)} (${dur4or6or8}s × $${costPerSec})`;
    if (!(await confirmPro(label + ' (Google)', cost + ' · paid tier Gemini · audio nativo'))) return;

    showPlayer(`
      <div class="player-card">
        <div class="player-head">▶ VIDEO · ${label} (Google) · ${aspect} · ${dur4or6or8}s · 720p</div>
        ${progressHtml('Enviando a Veo...', 'veo', 180000)}
      </div>`);
    const stop = startProgress('veo');
    try {
      const r = await fetch(ELEVEN_WORKER_URL + '/veo/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, aspectRatio: aspect, durationSeconds: dur4or6or8, resolution: '720p', model }),
      });
      if (!r.ok) {
        stop(false);
        const err = await r.text();
        showPlayer(`<div class="player-card"><div class="player-head">▶ VIDEO · ${label} · ERROR ${r.status}</div><pre class="player-body">${err.replace(/</g,'&lt;').slice(0,500)}</pre></div>`);
        return;
      }
      const startData = await r.json();
      const opName = startData.name;
      if (!opName) {
        stop(false);
        showPlayer(`<div class="player-card"><div class="player-head">▶ VIDEO · ${label} · sin operation</div><pre class="player-body">${JSON.stringify(startData).slice(0,400)}</pre></div>`);
        return;
      }
      setProgressLabel('veo', `Generando · ${opName.slice(-12)}`);
      const t0 = Date.now();
      let attempt = 0;
      while (true) {
        await new Promise(res => setTimeout(res, 5000));
        attempt++;
        const elapsed = ((Date.now() - t0) / 1000).toFixed(0);
        setProgressLabel('veo', `Generando · ${elapsed}s · intento ${attempt}`);
        const pollR = await fetch(`${ELEVEN_WORKER_URL}/veo/status/${opName}`);
        if (!pollR.ok) {
          stop(false);
          showPlayer(`<div class="player-card"><div class="player-head">▶ VIDEO · ${label} · POLL ERROR ${pollR.status}</div><pre class="player-body">${(await pollR.text()).slice(0,400)}</pre></div>`);
          return;
        }
        const poll = await pollR.json();
        if (poll.done) {
          const uri = poll?.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
          if (!uri) {
            stop(false);
            showPlayer(`<div class="player-card"><div class="player-head">▶ VIDEO · ${label} · sin URI</div><pre class="player-body">${JSON.stringify(poll).slice(0,400)}</pre></div>`);
            return;
          }
          stop(true);
          const proxyUrl = `${ELEVEN_WORKER_URL}/veo/download?uri=${encodeURIComponent(uri)}`;
          const veoTitle = deriveAssetTitle('video', loadStore());
          const pubMeta = { type: 'video', motor: model, prompt, costEst: cost, url: proxyUrl, mime: 'video/mp4' };
          showPlayer(`
            <div class="player-card">
              <div class="player-head">▶ VIDEO · ${label} (Google) · ${aspect} · ${dur4or6or8}s · 720p · audio nativo</div>
              <video controls autoplay src="${proxyUrl}" data-pixer-title="${escAttr(veoTitle)}" style="width:100%; max-height:55vh; border:1px solid var(--matrix); box-shadow:0 0 24px rgba(0,255,65,.30);"></video>
              <pre class="player-body">${prompt.replace(/</g,'&lt;')}</pre>
              <a class="btn" download="veo-${Date.now()}.mp4" href="${proxyUrl}">⬇ Descargar MP4</a>
              ${publishBtnHTML(pubMeta)}
              <small class="player-foot">// Gemini Veo · ${cost} · ${elapsed}s de procesado</small>
            </div>`);
          return;
        }
        if (attempt > 60) {
          stop(false);
          showPlayer(`<div class="player-card"><div class="player-head">▶ VIDEO · ${label} · TIMEOUT</div><pre class="player-body">operation: ${opName}</pre></div>`);
          return;
        }
      }
    } catch (e) {
      stop(false);
      showPlayer(`<div class="player-card"><div class="player-head">▶ VIDEO · ${label} · ERROR</div><pre class="player-body">${String(e)}</pre></div>`);
    }
  }

  function playVideo() {
    const s = loadStore().video || {};
    const motor = s.motor || 'pixer-storyboard';

    if (motor === 'veo-3.0-generate-001' || motor === 'veo-3.1-fast-generate-preview') {
      return playVeo(s, motor);
    }

    // Gemini Omni — scaffolding (anunciado en Google I/O 2026; API pública aún no disponible).
    // Selector deshabilitado (soon:true); al publicarse el endpoint, sustituir por la llamada real (patrón playVeo).
    if (motor === 'gemini-omni-flash') {
      showPlayer(`
        <div class="player-card">
          <div class="player-head">▶ VIDEO · Gemini Omni Flash (Google)</div>
          <pre class="player-body">Gemini Omni se anunció en Google I/O 2026. La API pública aún no está disponible (llega "en las próximas semanas").\n\nEl motor ya está cableado y se activará en cuanto Google publique el model ID y el endpoint.</pre>
          <small class="player-foot">// scaffolding · pendiente de API oficial</small>
        </div>`);
      return;
    }

    // PRO: Runway — sin CORS público, abrir tab
    if (motor === 'runway-gen3') {
      const guion = [s.hook, s.desarrollo, s.cierre, s.cta && `CTA: ${s.cta}`].filter(Boolean).join('\n\n');
      showPlayer(`
        <div class="player-card">
          <div class="player-head">▶ VIDEO · runway-gen3</div>
          <pre class="player-body">${guion.replace(/</g,'&lt;') || '// (sin guion)'}</pre>
          <a class="btn primary" href="https://app.runwayml.com/" target="_blank" rel="noopener">Abrir Runway</a>
          <small class="player-foot">// Runway no permite CORS desde navegador. Cambia a "Pixer Storyboard" para ver la previsualización.</small>
        </div>`);
      return;
    }

    // Sora (OpenAI) — pendiente de integrar (sin endpoint en el worker todavia).
    if (motor === 'openai-sora') {
      showPlayer(`
        <div class="player-card">
          <div class="player-head">▶ VIDEO · Sora (OpenAI)</div>
          <pre class="player-body">Sora (OpenAI) todavía no está operativo en Pixeria: falta el endpoint en el worker pixer-eleven. Lo activaremos próximamente.</pre>
          <small class="player-foot">// pendiente de integración</small>
        </div>`);
      return;
    }

    // FREE: storyboard generado in-browser
    const sizeMap = {
      'Reel vertical 9:16': [432, 768],
      'YouTube 16:9': [768, 432],
      'Demo producto 16:9': [768, 432],
      'Pantalla evento 16:9': [768, 432],
      'Carrusel cuadrado 1:1': [640, 640],
    };
    const [w, h] = sizeMap[s.canal] || [768, 432];
    const totalSec = parseSeconds(s.duracion);
    const scenes = [
      { label: 'HOOK',       text: s.hook       || 'Una pregunta directa al espectador en 3 segundos' },
      { label: 'DESARROLLO', text: s.desarrollo || 'Mostrar producto con planos cortos' },
      { label: 'CIERRE',     text: [s.cierre, s.cta && `CTA: ${s.cta}`].filter(Boolean).join(' · ') || 'Logo + claim' },
    ];
    const stylePalette = (loadStore().imagenes && loadStore().imagenes.paleta) || 'cinematic film grade, dramatic light';
    const sceneSec = totalSec / scenes.length;
    const baseSeed = Math.floor(Math.random() * 1e9);
    const urls = scenes.map((sc, i) =>
      genFluxUrl(sc.text + ', ' + stylePalette + ', cinematic still, 35mm', w, h)
    );

    showPlayer(`
      <div class="player-card">
        <div class="player-head">▶ VIDEO · Pixer Storyboard · ${w}×${h} · ${totalSec.toFixed(0)}s</div>
        <div class="sb-stage" data-w="${w}" data-h="${h}" style="--ar:${w}/${h};">
          ${scenes.map((sc, i) => `
            <div class="sb-frame" data-frame="${i}">
              <img src="${urls[i]}" alt="${sc.label}">
              <div class="sb-caption"><strong>[${i + 1}/${scenes.length}] ${sc.label}</strong><span>${sc.text.replace(/</g,'&lt;')}</span></div>
            </div>`).join('')}
          <div class="sb-progress"><div class="sb-bar"></div></div>
        </div>
        <div class="brief-actions" style="margin-top:10px;">
          <button type="button" class="btn primary" id="sbStart">▶ Reproducir storyboard</button>
          <button type="button" class="btn" id="sbStop">■ Parar</button>
        </div>
        <small class="player-foot">// 3 escenas Pollinations · ${sceneSec.toFixed(1)}s/escena · TTS como voz en off · gratis</small>
      </div>`);

    const stage = getPlayer().querySelector('.sb-stage');
    const frames = stage.querySelectorAll('.sb-frame');
    const bar = stage.querySelector('.sb-bar');
    let timer = null;

    function stop() {
      clearInterval(timer); timer = null;
      try { speechSynthesis.cancel(); } catch {}
      frames.forEach(f => f.classList.remove('active'));
      bar.style.width = '0%';
    }
    function start() {
      stop();
      const startTs = performance.now();
      const totalMs = totalSec * 1000;
      // Voz en off encadenando las 3 escenas
      if ('speechSynthesis' in window) {
        scenes.forEach((sc, i) => {
          const u = new SpeechSynthesisUtterance(sc.text);
          const lang = (loadStore().audio && LANG_MAP[loadStore().audio.idioma]) || 'es-ES';
          u.lang = lang;
          u.rate = 1.05;
          speechSynthesis.speak(u);
        });
      }
      timer = setInterval(() => {
        const t = performance.now() - startTs;
        const pct = Math.min(100, (t / totalMs) * 100);
        bar.style.width = pct + '%';
        const idx = Math.min(scenes.length - 1, Math.floor(t / (totalMs / scenes.length)));
        frames.forEach((f, i) => f.classList.toggle('active', i === idx));
        if (t >= totalMs) stop();
      }, 60);
      frames[0].classList.add('active');
    }
    document.getElementById('sbStart')?.addEventListener('click', start);
    document.getElementById('sbStop')?.addEventListener('click', stop);
    // Auto-arranca
    setTimeout(start, 250);
  }

  function playPlataforma() {
    showPlayer(`
      <div class="player-card">
        <div class="player-head">▶ PLATAFORMA · reproducir todo</div>
        <pre class="player-body">// Lanzando Audio + Música + Imagen + Video en secuencia...</pre>
      </div>`);
    playAudio();
    setTimeout(playMusica, 300);
    setTimeout(playImagenes, 600);
    setTimeout(playVideo, 900);
  }

  const AUDIENCE_LABELS = {
    male: 'Segmento hombre',
    female: 'Segmento mujer',
    neutral: 'Segmento neutral / todos',
    todos: 'Todos los públicos',
  };

  const AGE_BANDS = ['18-24', '25-34', '35-44', '45-54', '55+', 'todos'];
  const GENDERS = ['hombre', 'mujer', 'todos'];
  const PERSONA_TAGS = ['tech', 'urbano', 'fitness', 'profesional', 'familia', 'eco', 'luxury', 'joven', 'padres', 'creativo'];

  const TARGET_PRESETS = [
    { gender: 'hombre', ageBand: '25-34', persona: 'tech-urbano', label: 'Hombres 25-34 Tech' },
    { gender: 'mujer', ageBand: '25-34', persona: 'profesional', label: 'Mujeres 25-34 Profesional' },
    { gender: 'hombre', ageBand: '18-24', persona: 'urbano', label: 'Hombres 18-24 Urbano' },
    { gender: 'mujer', ageBand: '35-44', persona: 'familia', label: 'Mujeres 35-44 Familia' },
    { gender: 'todos', ageBand: '18-24', persona: 'joven', label: 'Jóvenes 18-24 Unisex' },
    { gender: 'todos', ageBand: 'todos', persona: '', label: 'Público general' },
  ];

  let adBaseImage = null;

  function normalizeAudienceSegment(value) {
    const v = String(value || '').trim().toLowerCase();
    if (['male', 'man', 'hombre', 'masculino', 'm'].includes(v)) return 'male';
    if (['female', 'woman', 'mujer', 'femenino', 'f'].includes(v)) return 'female';
    return 'neutral';
  }

  function currentAdData() {
    const store = loadStore();
    const ad = { ...DEFAULTS.publicidad, ...(store.publicidad || {}) };
    ad.segment = normalizeAudienceSegment(ad.segment);
    ad.confidence = String(ad.confidence || DEFAULTS.publicidad.confidence);
    return { store, ad };
  }

  // === NUEVO: Soporte completo para Targets (género + edad + persona) ===
  function makeTarget(partial = {}) {
    const id = partial.id || ('t' + Date.now().toString(36).slice(-6));
    return {
      id,
      gender: partial.gender || 'todos',
      ageBand: partial.ageBand || 'todos',
      persona: partial.persona || '',
      label: partial.label || (partial.gender && partial.ageBand ? `${partial.gender} ${partial.ageBand}` : 'Target'),
      headline: partial.headline || '',
      offer: partial.offer || '',
      visual: partial.visual || '',
      tone: partial.tone || '',
    };
  }

  function getTargetLabel(t) {
    if (t.label) return t.label;
    const g = t.gender === 'todos' ? '' : (t.gender || '');
    const a = t.ageBand === 'todos' ? '' : (t.ageBand || '');
    const p = t.persona ? ` · ${t.persona}` : '';
    return [g, a].filter(Boolean).join(' ') + p || 'Target';
  }

  function getTargetedOffer(ad, t) {
    if (t && t.offer) return t.offer;
    if (t && t.gender === 'hombre') return ad.offerMale || DEFAULTS.publicidad.offerMale;
    if (t && t.gender === 'mujer') return ad.offerFemale || DEFAULTS.publicidad.offerFemale;
    return ad.offerNeutral || DEFAULTS.publicidad.offerNeutral;
  }

  function getTargetedHeadline(ad, t) {
    const product = (ad.product || DEFAULTS.publicidad.product).replace(/\s+/g, ' ').trim();
    if (t && t.headline) return t.headline;
    const g = t ? t.gender : ad.segment;
    if (g === 'hombre') return `${product}: potencia tu siguiente movimiento`;
    if (g === 'mujer') return `${product}: diseñado para moverte a tu manera`;
    return `${product}: entra en la experiencia`;
  }

  function getTargetTheme(t) {
    const g = t ? t.gender : 'neutral';
    const age = t ? t.ageBand : 'todos';
    if (g === 'hombre') return { a: '#00ff41', b: '#50c8ff', c: '#07140d', label: 'HOMBRE' + (age !== 'todos' ? ' ' + age : '') };
    if (g === 'mujer') return { a: '#d4ff5a', b: '#ff5cc8', c: '#140716', label: 'MUJER' + (age !== 'todos' ? ' ' + age : '') };
    return { a: '#c8ffd0', b: '#00ff41', c: '#020602', label: 'TODOS' + (age !== 'todos' ? ' ' + age : '') };
  }

  function getEffectiveTargets(ad) {
    const storeTargets = (ad.targets && ad.targets.length) ? ad.targets : [];
    if (storeTargets.length > 0) return storeTargets;
    // Fallback a modelo antiguo (3 segmentos)
    return [
      makeTarget({ gender: 'hombre', ageBand: 'todos', label: 'Hombre' }),
      makeTarget({ gender: 'mujer', ageBand: 'todos', label: 'Mujer' }),
      makeTarget({ gender: 'todos', ageBand: 'todos', label: 'Neutral' }),
    ];
  }

  function segmentedOffer(ad) {
    // Compatibilidad con modelo antiguo + nuevo
    const t = { gender: ad.segment === 'male' ? 'hombre' : ad.segment === 'female' ? 'mujer' : 'todos', ageBand: 'todos' };
    return getTargetedOffer(ad, t);
  }

  function segmentedHeadline(ad) {
    const t = { gender: ad.segment === 'male' ? 'hombre' : ad.segment === 'female' ? 'mujer' : 'todos', ageBand: 'todos' };
    return getTargetedHeadline(ad, t);
  }

  function segmentedTheme(ad) {
    const t = { gender: ad.segment === 'male' ? 'hombre' : ad.segment === 'female' ? 'mujer' : 'todos', ageBand: 'todos' };
    return getTargetTheme(t);
  }

  function segmentedAdSvg(ad, store) {
    // Delega al nuevo generador con un target derivado del segment actual
    const t = { gender: ad.segment === 'male' ? 'hombre' : ad.segment === 'female' ? 'mujer' : 'todos', ageBand: 'todos' };
    return targetedAdSvg(ad, store, t);
  }

  function targetedAdSvg(ad, store, target) {
    const t = target || { gender: 'todos', ageBand: 'todos' };
    const theme = getTargetTheme(t);
    const esc = (v) => String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const headline = getTargetedHeadline(ad, t);
    const offer = getTargetedOffer(ad, t);
    const cta = ad.cta || DEFAULTS.publicidad.cta;
    const source = ad.source || DEFAULTS.publicidad.source;
    const confidence = Math.round(Math.max(0, Math.min(1, parseFloat(ad.confidence || '0.64'))) * 100);
    const brand = (store.cliente || 'Pixeria · XpaceOS').slice(0, 42);
    const label = getTargetLabel(t);
    const baseImage = adBaseImage && adBaseImage.dataUrl
      ? `<image href="${escAttr(adBaseImage.dataUrl)}" x="960" y="150" width="500" height="500" preserveAspectRatio="xMidYMid slice" opacity=".95"/>`
      : '';
    const baseImageFrame = adBaseImage && adBaseImage.dataUrl
      ? `<rect x="960" y="150" width="500" height="500" fill="url(#imageWash)" opacity=".38"/><rect x="960" y="150" width="500" height="500" fill="none" stroke="${theme.b}" stroke-width="3"/>`
      : `<path d="M1120 238h200l76 76v264l-94 76h-208l-76-76V314z" fill="${theme.a}" opacity=".10" stroke="${theme.b}" stroke-width="3"/>`;
    const baseImageCaption = adBaseImage && adBaseImage.name
      ? `BASE IMAGE · ${esc(adBaseImage.name.slice(0, 36))}`
      : 'NO BASE IMAGE · CREATIVE SHELL';
    return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="${theme.c}"/><stop offset=".52" stop-color="#020602"/><stop offset="1" stop-color="#001406"/></linearGradient>
        <linearGradient id="imageWash" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${theme.c}" stop-opacity=".00"/><stop offset="1" stop-color="${theme.c}" stop-opacity=".90"/></linearGradient>
        <filter id="glow"><feGaussianBlur stdDeviation="7" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <pattern id="grid" width="64" height="64" patternUnits="userSpaceOnUse"><path d="M64 0H0V64" fill="none" stroke="${theme.a}" stroke-opacity=".18" stroke-width="1"/></pattern>
      </defs>
      <rect width="1600" height="900" fill="url(#bg)"/><rect width="1600" height="900" fill="url(#grid)"/>
      <circle cx="1260" cy="180" r="260" fill="${theme.b}" opacity=".12"/><circle cx="1220" cy="660" r="330" fill="${theme.a}" opacity=".10"/>
      <path d="M1040 150h330l120 120v390l-150 120h-330L900 650V260z" fill="none" stroke="${theme.a}" stroke-width="5" opacity=".78" filter="url(#glow)"/>
      ${baseImage}
      ${baseImageFrame}
      <text x="80" y="96" fill="${theme.a}" font-family="JetBrains Mono, Menlo, monospace" font-size="34" font-weight="800" letter-spacing="4">${esc(brand)}</text>
      <text x="80" y="152" fill="#c8ffd0" opacity=".72" font-family="JetBrains Mono, Menlo, monospace" font-size="22" letter-spacing="3">XPACEOS TARGET AD · ${esc(label)} · ${confidence}%</text>
      <foreignObject x="80" y="245" width="860" height="310"><div xmlns="http://www.w3.org/1999/xhtml" style="font-family:Inter,Arial,sans-serif;color:#f5fff6;font-weight:900;font-size:72px;line-height:.95;letter-spacing:-1px;text-transform:uppercase">${esc(headline)}</div></foreignObject>
      <foreignObject x="84" y="560" width="720" height="120"><div xmlns="http://www.w3.org/1999/xhtml" style="font-family:Inter,Arial,sans-serif;color:#c8ffd0;font-size:32px;line-height:1.15">${esc(offer)}</div></foreignObject>
      <rect x="84" y="720" width="640" height="86" fill="${theme.a}" filter="url(#glow)"/><text x="124" y="774" fill="#020602" font-family="JetBrains Mono, Menlo, monospace" font-size="28" font-weight="900" letter-spacing="2">${esc(cta).slice(0, 42)}</text>
      <text x="930" y="820" fill="${theme.b}" font-family="JetBrains Mono, Menlo, monospace" font-size="21" letter-spacing="2">TARGET: ${esc(label)} · señal: ${esc(source)} · ephemeral</text>
      <text x="1190" y="478" fill="${theme.a}" font-family="JetBrains Mono, Menlo, monospace" font-size="118" font-weight="900" text-anchor="middle" filter="url(#glow)">AD</text>
      <text x="1190" y="532" fill="#c8ffd0" font-family="JetBrains Mono, Menlo, monospace" font-size="26" text-anchor="middle" letter-spacing="4">DIGITAL TWIN</text>
      <text x="1190" y="620" fill="${theme.b}" font-family="JetBrains Mono, Menlo, monospace" font-size="18" text-anchor="middle" letter-spacing="2">${baseImageCaption}</text>
    </svg>`;
  }

  function updateAdImagePreview() {
    const wrap = document.getElementById('ad-image-preview');
    const img = document.getElementById('ad-image-preview-img');
    const meta = document.getElementById('ad-image-meta');
    if (!wrap || !img || !meta) return;
    if (adBaseImage && adBaseImage.dataUrl) {
      wrap.hidden = false;
      img.src = adBaseImage.dataUrl;
      meta.textContent = `${adBaseImage.name || 'imagen'} · lista para segmentar`;
    } else {
      wrap.hidden = true;
      img.removeAttribute('src');
      meta.textContent = 'Sin imagen cargada';
    }
  }

  function bindPublicidadImageUpload() {
    if (document.body.dataset.page !== 'publicidad') return;
    const input = document.getElementById('ad-image-file');
    const pick = document.getElementById('ad-image-pick');
    const clear = document.getElementById('ad-image-clear');
    if (!input || !pick || !clear) return;
    pick.addEventListener('click', () => input.click());
    clear.addEventListener('click', () => {
      adBaseImage = null;
      input.value = '';
      updateAdImagePreview();
    });
    input.addEventListener('change', async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      try {
        const dataUrl = await new Promise((resolve, reject) => {
          const fr = new FileReader();
          fr.onload = () => resolve(fr.result);
          fr.onerror = () => reject(fr.error || new Error('No se pudo leer la imagen'));
          fr.readAsDataURL(file);
        });
        adBaseImage = {
          name: file.name,
          type: file.type || 'image/*',
          dataUrl: String(dataUrl),
        };
        updateAdImagePreview();
        showToast('Imagen base cargada');
      } catch (err) {
        showToast((err && err.message) || 'No se pudo cargar la imagen');
      } finally {
        input.value = '';
      }
    });
    updateAdImagePreview();
  }

  function segmentedVariantData(store, baseAd, segment) {
    // Compat legacy
    const ad = { ...baseAd, segment };
    const t = { gender: segment === 'male' ? 'hombre' : segment === 'female' ? 'mujer' : 'todos', ageBand: 'todos' };
    const svg = targetedAdSvg(ad, store, t);
    const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    const title = `${store.cliente || 'XpaceOS'} // ${getTargetLabel(t)} // ${ad.product || 'Publicidad'}`;
    return {
      segment,
      target: t,
      label: getTargetLabel(t),
      url,
      title,
      headline: getTargetedHeadline(ad, t),
      offer: getTargetedOffer(ad, t),
      cta: ad.cta || DEFAULTS.publicidad.cta,
      source: ad.source || DEFAULTS.publicidad.source,
      confidence: ad.confidence,
      hasBaseImage: !!(adBaseImage && adBaseImage.dataUrl),
      baseImageName: adBaseImage && adBaseImage.name ? adBaseImage.name : '',
    };
  }

  function targetVariantData(store, baseAd, t) {
    const ad = { ...baseAd };
    const svg = targetedAdSvg(ad, store, t);
    const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    const label = getTargetLabel(t);
    const title = `${store.cliente || 'XpaceOS'} // ${label} // ${ad.product || 'Publicidad'}`;
    return {
      target: t,
      label,
      url,
      title,
      headline: getTargetedHeadline(ad, t) || segmentedHeadline(ad),
      offer: getTargetedOffer(ad, t) || segmentedOffer(ad),
      cta: ad.cta || DEFAULTS.publicidad.cta,
      source: ad.source || DEFAULTS.publicidad.source,
      hasBaseImage: !!(adBaseImage && adBaseImage.dataUrl),
      baseImageName: adBaseImage && adBaseImage.name ? adBaseImage.name : '',
      // Prompt listo para IA (para usar en /crear/ Marketing o modelos externos)
      promptForAI: `Publicidad para ${label}. Producto: ${ad.product}. ${ad.context || ''}. Oferta: ${getTargetedOffer(ad, t)}. Estilo: ${ad.style || ''}. ${t.visual || ''} ${t.tone ? 'Tono: ' + t.tone : ''}. Alta calidad, cinematográfico, matrix retail neon, texto legible alto contraste, composición hero del producto.`,
    };
  }

  function setAudienceSegment(segment, opts = {}) {
    const normalized = normalizeAudienceSegment(segment);
    const store = loadStore();
    store.publicidad = { ...DEFAULTS.publicidad, ...(store.publicidad || {}), segment: normalized };
    if (opts.confidence !== undefined) store.publicidad.confidence = String(opts.confidence);
    if (opts.source) store.publicidad.source = String(opts.source);
    saveStore(store);
    updateSegmentedAdUi();
    if (opts.autoplay) playPublicidad();
  }

  function updateSegmentedAdUi() {
    const { ad } = currentAdData();
    document.querySelectorAll('[data-ad-segment]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.adSegment === ad.segment));
    });
    const dot = document.getElementById('adSignalDot');
    if (dot) dot.dataset.segment = ad.segment;
    const label = document.getElementById('adSignalLabel');
    if (label) label.textContent = AUDIENCE_LABELS[ad.segment] || AUDIENCE_LABELS.neutral;
    const meta = document.getElementById('adSignalMeta');
    if (meta) meta.textContent = `fuente: ${ad.source || 'Simulador local'} · confianza ${ad.confidence || '0.64'}`;
    const sourceSelect = document.getElementById('ad-source');
    if (sourceSelect && [...sourceSelect.options].some((option) => option.value === ad.source)) {
      sourceSelect.value = ad.source;
    }
  }

  function playPublicidad() {
    const { store, ad } = currentAdData();
    const targets = getEffectiveTargets(ad);
    const variants = targets.map((t) => targetVariantData(store, ad, t));
    const selectedLabel = getTargetLabel({ gender: ad.segment === 'male' ? 'hombre' : ad.segment === 'female' ? 'mujer' : 'todos', ageBand: 'todos' });

    const plan = {
      baseImage: adBaseImage ? { name: adBaseImage.name, type: adBaseImage.type } : null,
      source: ad.source,
      screen: ad.screen,
      privacy: ad.privacy,
      mode: ad.mode || 'batch',
      targets: targets.map(t => ({ id: t.id, label: getTargetLabel(t), gender: t.gender, ageBand: t.ageBand, persona: t.persona })),
      variants: variants.map((v) => ({
        label: v.label,
        headline: v.headline,
        offer: v.offer,
        cta: v.cta,
        promptForAI: v.promptForAI,
      })),
    };

    const count = variants.length;
    showPlayer(`
      <div class="player-card segmented-player">
        <div class="player-head">▶ PUBLICIDAD CON TARGET · ${count} variante${count === 1 ? '' : 's'} · ${ad.source || 'batch'}</div>
        <div class="segmented-variants">
          ${variants.map((variant) => `
            <article class="segmented-variant${variant.label === selectedLabel ? ' selected' : ''}" data-target-id="${variant.target.id || ''}">
              <div class="segmented-variant-head">
                <strong>${variant.label}</strong>
                <span>${variant.hasBaseImage ? 'base image' : 'creative shell'}</span>
              </div>
              <div class="player-img-wrap segmented-preview">
                <img class="player-img" src="${variant.url}" alt="Creatividad ${variant.label}" data-pixer-title="${escAttr(variant.title)}">
              </div>
              <div class="segmented-variant-meta">${(variant.headline + ' · ' + variant.offer).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
              <div class="target-prompt-hint" title="Prompt optimizado para modelos de imagen/video">📋 Prompt IA listo</div>
            </article>
          `).join('')}
        </div>
        <pre class="player-body">${JSON.stringify(plan, null, 2).replace(/</g,'&lt;')}</pre>
        <small class="player-foot">// Variantes generadas para targets definidos (género + edad + persona). Haz clic en una para activar. Copia los prompts para usar en /crear/ (formato Marketing) o modelos externos.</small>
      </div>`);

    document.querySelectorAll('[data-target-id]').forEach((card) => {
      card.addEventListener('click', () => {
        document.querySelectorAll('[data-target-id]').forEach((node) => node.classList.remove('selected'));
        card.classList.add('selected');
        // Activar señal simulada correspondiente (para live mode)
        const id = card.dataset.targetId;
        // Buscar el target y simular segment aproximado
        const t = targets.find(x => x.id === id) || {};
        const seg = t.gender === 'hombre' ? 'male' : t.gender === 'mujer' ? 'female' : 'neutral';
        setAudienceSegment(seg, { source: ad.source || 'Target batch', autoplay: false });
      });
    });
  }

  function bindSegmentedAds() {
    if (document.body.dataset.page !== 'publicidad') return;
    bindPublicidadImageUpload();
    bindPublicidadTargets();
    const params = new URLSearchParams(location.search);
    const incoming = params.get('segment') || params.get('audience');
    if (incoming) {
      setAudienceSegment(incoming, {
        confidence: params.get('confidence') || undefined,
        source: params.get('source') || 'XpaceOS URL signal',
      });
    }
    document.querySelectorAll('[data-ad-segment]').forEach((button) => {
      button.addEventListener('click', () => setAudienceSegment(button.dataset.adSegment, { source: 'Manual operator' }));
    });
    document.getElementById('adSimulatePass')?.addEventListener('click', () => {
      const seq = ['male', 'female', 'neutral'];
      const current = currentAdData().ad.segment;
      const next = seq[(seq.indexOf(current) + 1) % seq.length] || 'neutral';
      setAudienceSegment(next, { confidence: (0.68 + Math.random() * 0.24).toFixed(2), source: 'Simulador local', autoplay: true });
    });
    window.ADMIRA_SEGMENTED_AD = {
      setAudience: ({ segment, confidence, source, autoplay } = {}) => setAudienceSegment(segment, { confidence, source: source || 'XpaceOS LiveCam', autoplay: autoplay !== false }),
      render: playPublicidad,
    };
    window.addEventListener('message', (event) => {
      const data = event.data || {};
      if (data.type === 'xpaceos:audience-segment') {
        setAudienceSegment(data.segment, { confidence: data.confidence, source: data.source || 'XpaceOS LiveCam', autoplay: data.autoplay !== false });
      }
    });
    try {
      const bc = new BroadcastChannel('xpaceos-audience');
      bc.addEventListener('message', (event) => {
        const data = event.data || {};
        if (data.segment) setAudienceSegment(data.segment, { confidence: data.confidence, source: data.source || 'XpaceOS LiveCam', autoplay: data.autoplay !== false });
      });
    } catch {}
    updateSegmentedAdUi();
  }

  // === UI para Targets (nuevo modelo de Publicidad con Target) ===
  function renderTargetsList() {
    const container = document.getElementById('targetsList');
    if (!container) return;
    const { ad } = currentAdData();
    const targets = ad.targets || [];

    if (targets.length === 0) {
      container.innerHTML = `<div style="opacity:.6;font-size:12px;padding:6px 8px;border:1px dashed var(--line);">Sin targets definidos. Usa los presets rápidos o "+ Añadir target". Se generarán variantes para cada uno.</div>`;
      return;
    }

    container.innerHTML = targets.map((t, idx) => `
      <div class="target-card" data-tid="${t.id}">
        <header>
          <span>${t.label || getTargetLabel(t)}</span>
          <button type="button" class="btn-mini danger" data-del="${t.id}">✕</button>
        </header>
        <div class="t-meta">
          <select data-tid="${t.id}" data-field="gender">
            ${GENDERS.map(g => `<option value="${g}" ${t.gender===g?'selected':''}>${g}</option>`).join('')}
          </select>
          <select data-tid="${t.id}" data-field="ageBand">
            ${AGE_BANDS.map(a => `<option value="${a}" ${t.ageBand===a?'selected':''}>${a}</option>`).join('')}
          </select>
        </div>
        <div class="t-row">
          <input data-tid="${t.id}" data-field="persona" placeholder="persona / interés" value="${t.persona || ''}" />
          <input data-tid="${t.id}" data-field="label" placeholder="etiqueta" value="${t.label || ''}" />
        </div>
        <div class="t-row">
          <input data-tid="${t.id}" data-field="offer" placeholder="oferta específica" value="${t.offer || ''}" style="grid-column:1/-1" />
        </div>
        <div class="t-actions">
          <button type="button" class="btn-mini" data-apply="${t.id}">Aplicar señal</button>
        </div>
      </div>
    `).join('');

    // Wire events for this render
    container.querySelectorAll('select, input').forEach(el => {
      el.addEventListener('change', (e) => {
        const tid = el.dataset.tid;
        const field = el.dataset.field;
        const { store, ad: curAd } = currentAdData();
        const ts = (curAd.targets || []).map(tt => tt.id === tid ? { ...tt, [field]: el.value } : tt);
        store.publicidad = { ...(store.publicidad || {}), targets: ts };
        saveStore(store);
        // re-render to keep in sync
        renderTargetsList();
      });
    });

    container.querySelectorAll('[data-del]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tid = btn.dataset.del;
        const { store, ad: curAd } = currentAdData();
        const ts = (curAd.targets || []).filter(tt => tt.id !== tid);
        store.publicidad = { ...(store.publicidad || {}), targets: ts };
        saveStore(store);
        renderTargetsList();
      });
    });

    container.querySelectorAll('[data-apply]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tid = btn.dataset.apply;
        const { ad: curAd } = currentAdData();
        const t = (curAd.targets || []).find(tt => tt.id === tid);
        if (!t) return;
        const seg = t.gender === 'hombre' ? 'male' : t.gender === 'mujer' ? 'female' : 'neutral';
        setAudienceSegment(seg, { source: 'Target selector', autoplay: false });
      });
    });
  }

  function addTargetFromPreset(preset) {
    const { store, ad: curAd } = currentAdData();
    const t = makeTarget(preset);
    const existing = curAd.targets || [];
    store.publicidad = { ...(store.publicidad || {}), targets: [...existing, t] };
    saveStore(store);
    renderTargetsList();
  }

  function addEmptyTarget() {
    const { store, ad: curAd } = currentAdData();
    const t = makeTarget({ gender: 'todos', ageBand: 'todos', persona: '', label: 'Nuevo target' });
    const existing = curAd.targets || [];
    store.publicidad = { ...(store.publicidad || {}), targets: [...existing, t] };
    saveStore(store);
    renderTargetsList();
  }

  function bindPublicidadTargets() {
    if (document.body.dataset.page !== 'publicidad') return;

    // Seed demo targets on first visit to the publicidad page (great onboarding for "creación con Target")
    const store = loadStore();
    if (!store.publicidad || !Array.isArray(store.publicidad.targets) || store.publicidad.targets.length === 0) {
      store.publicidad = {
        ...(store.publicidad || DEFAULTS.publicidad),
        targets: [
          makeTarget({ gender: 'hombre', ageBand: '25-34', persona: 'tech-urbano', label: 'Hombres 25-34 Tech' }),
          makeTarget({ gender: 'mujer', ageBand: '25-34', persona: 'profesional', label: 'Mujeres 25-34 Profesional' }),
          makeTarget({ gender: 'todos', ageBand: '18-24', persona: 'joven', label: 'Jóvenes 18-24 Unisex' }),
        ],
        mode: 'batch',
      };
      saveStore(store);
    }

    // Render presets
    const presetsWrap = document.getElementById('targetPresets');
    if (presetsWrap) {
      presetsWrap.innerHTML = TARGET_PRESETS.map((p, i) => `
        <button type="button" class="btn" data-preset="${i}" style="padding:3px 8px;font-size:11px">${p.label}</button>
      `).join('');
      presetsWrap.querySelectorAll('[data-preset]').forEach(b => {
        b.addEventListener('click', () => {
          const idx = parseInt(b.dataset.preset, 10);
          addTargetFromPreset(TARGET_PRESETS[idx]);
        });
      });
    }

    // Main add button (there may be two)
    const addBtns = [document.getElementById('addTargetBtn'), document.getElementById('addTargetBtn2')].filter(Boolean);
    addBtns.forEach(btn => btn.addEventListener('click', addEmptyTarget));

    // Initial render
    renderTargetsList();

    // Re-render when store changes from other parts
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) renderTargetsList();
    });
  }

  function bindPlay(page) {
    const btn = document.getElementById('playOutput');
    if (!btn) return;
    const map = {
      audio: playAudio,
      musica: playMusica,
      imagenes: playImagenes,
      video: playVideo,
      plataforma: playPlataforma,
      publicidad: playPublicidad,
    };
    const fn = map[page];
    if (!fn) { btn.hidden = true; return; }
    const labels = {
      audio: '▶ REPRODUCIR DE NUEVO',
      musica: '▶ REPRODUCIR DE NUEVO',
      imagenes: '✨ GENERAR OTRA',
      video: '▶ REPRODUCIR DE NUEVO',
      plataforma: '▶ REPRODUCIR TODO DE NUEVO',
      publicidad: '✨ REGENERAR ANUNCIO',
    };
    btn.addEventListener('click', () => {
      fn();
      const lbl = btn.querySelector('.play-label');
      if (lbl) lbl.textContent = labels[page] || '▶ REPRODUCIR DE NUEVO';
    });
  }

  // Genera letras con Gemini 2.5 Flash vía worker
  function bindGenLyrics() {
    const btn = document.getElementById('genLyrics');
    const ta = document.getElementById('m-letra');
    if (!btn || !ta) return;
    btn.addEventListener('click', async () => {
      const store = loadStore();
      const brief = { ...(store.musica || {}), cliente: store.cliente };
      const idioma = (store.audio && store.audio.idioma) ? (LANG_MAP[store.audio.idioma] || 'es-ES').split('-')[0] : 'es';
      const oldLabel = btn.textContent;
      btn.textContent = '⏳ generando...';
      btn.disabled = true;
      ta.value = '// generando letra con Gemini 2.5 Flash...';
      try {
        const r = await fetch(ELEVEN_WORKER_URL + '/llm/lyrics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ brief, idioma }),
        });
        const data = await r.json();
        if (!r.ok || !data.text) {
          ta.value = '// ERROR: ' + JSON.stringify(data).slice(0, 400);
        } else {
          ta.value = data.text;
          // Persistir
          const s = loadStore();
          setNested(s, 'musica.letra', data.text);
          saveStore(s);
          showToast('Letra generada');
        }
      } catch (e) {
        ta.value = '// ERROR: ' + String(e);
      } finally {
        btn.textContent = oldLabel;
        btn.disabled = false;
      }
    });
  }

  // ─── Stock público (R2 vía worker pixer-eleven) ─────────────────
  // Contract esperado:
  //   POST /stock/publish  → body { type, motor, prompt, costEst, mime?,
  //                                  base64? | sourceUrl?, thumbnail? }
  //     → { ok: true, id, url, createdAt }
  //   GET  /stock/list?type=&motor=&limit=&cursor=
  //     → { items: [{ id, type, motor, prompt, costEst, url, thumbnail, createdAt }], cursor? }
  const STOCK_PUBLISH_URL = ELEVEN_WORKER_URL + '/stock/publish';
  const STOCK_LIST_URL    = ELEVEN_WORKER_URL + '/stock/list';

  function publishBtnHTML(meta) {
    const json = JSON.stringify(meta).replace(/'/g, '&#39;');
    return `<button type="button" class="btn publish-btn" data-publish-meta='${json}' title="Sube este asset al stock público (R2)">📌 PUBLICAR EN STOCK</button>`;
  }

  async function publishToStock(meta, btn) {
    if (btn) { btn.disabled = true; btn.dataset.origLabel = btn.textContent; btn.textContent = '⏳ subiendo...'; }
    try {
      // Imágenes con URL externa (Nano Banana): captura el <img> ya mostrado a
      // base64 (CORS-safe) → evita el re-fetch servidor (referer) y la
      // re-generación no determinista. Publica EXACTAMENTE lo que se ve.
      if (btn && (meta.type === 'image' || meta.type === 'imagen') && meta.url
          && !meta.url.startsWith('data:') && !meta.url.startsWith('blob:')) {
        const card = btn.closest('.player-card');
        const imgEl = card && card.querySelector('img.player-img');
        if (imgEl && imgEl.naturalWidth) {
          try {
            const cv = document.createElement('canvas');
            cv.width = imgEl.naturalWidth; cv.height = imgEl.naturalHeight;
            cv.getContext('2d').drawImage(imgEl, 0, 0);
            meta = Object.assign({}, meta, { url: cv.toDataURL('image/png'), mime: 'image/png' });
          } catch (_) { /* canvas tainted → seguirá por sourceUrl */ }
        }
      }
      const payload = {
        type: meta.type,
        motor: meta.motor,
        prompt: meta.prompt || '',
        title: meta.title || null,
        comment: meta.comment || null,
        tags: Array.isArray(meta.tags) ? meta.tags : null,
        costEst: meta.costEst || null,
        thumbnail: meta.thumbnail || null,
      };
      if (meta.url && (meta.url.startsWith('data:') || meta.url.startsWith('blob:'))) {
        const { mime, base64 } = await urlToBase64(meta.url);
        payload.mime = mime;
        payload.base64 = base64;
      } else if (meta.url) {
        payload.sourceUrl = meta.url;
        payload.mime = meta.mime || null;
      } else {
        throw new Error('asset sin url');
      }
      const r = await fetch(STOCK_PUBLISH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const t = await r.text();
        showToast('❌ Stock ' + r.status + ': ' + t.slice(0, 80));
        if (btn) { btn.disabled = false; btn.textContent = '📌 REINTENTAR'; }
        return { ok: false, error: `${r.status} ${t.slice(0, 200)}` };
      }
      const data = await r.json();
      showToast('✅ Publicado · ' + (data.id || data.url || 'ok'));
      if (btn) { btn.textContent = '✅ EN STOCK'; btn.classList.add('done'); }
      return { ok: true, id: data.id, url: data.url };
    } catch (e) {
      showToast('❌ ' + String(e).slice(0, 100));
      if (btn) { btn.disabled = false; btn.textContent = '📌 REINTENTAR'; }
      return { ok: false, error: String(e) };
    }
  }

  document.addEventListener('click', (e) => {
    const b = e.target.closest('.publish-btn');
    if (!b || b.classList.contains('done')) return;
    e.preventDefault();
    let meta;
    try { meta = JSON.parse(b.dataset.publishMeta); }
    catch { showToast('❌ meta inválida'); return; }
    publishToStock(meta, b);
  });

  // ─── Enviar al feed de Admira XP (KV vía worker) ────────────────
  const SIGNAGE_URL = ELEVEN_WORKER_URL + '/signage';

  async function urlToBase64(url) {
    if (url.startsWith('data:')) {
      const [meta, b64] = url.split(',');
      const mime = (meta.match(/data:([^;]+)/) || [, 'application/octet-stream'])[1];
      return { mime, base64: b64 };
    }
    const r = await fetch(url);
    if (!r.ok) throw new Error(`fetch ${r.status}`);
    const blob = await r.blob();
    const buf = await blob.arrayBuffer();
    let bin = '';
    const u8 = new Uint8Array(buf);
    for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
    return { mime: blob.type || 'application/octet-stream', base64: btoa(bin) };
  }

  // ─── Helpers para titular y portada del asset enviado a Pixer Feed ────
  function escAttr(v) {
    return String(v || '')
      .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
      .replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  // Construye un titulo identificativo del asset desde el brief actual.
  // section: 'musica' | 'imagenes' | 'video' | 'audio'.
  // store: loadStore() actual (con .cliente y .{section}).
  function deriveAssetTitle(section, store) {
    const s = (store && store[section]) || {};
    const cliente = String((store && store.cliente) || '').trim();
    let core = '';
    if (section === 'musica') {
      if (s.letra) {
        const first = String(s.letra).split(/\r?\n/).map(l => l.trim()).find(l => l && !/^\[/.test(l));
        if (first) core = first;
      }
      core = core || s.uso || '';
    } else if (section === 'imagenes' || section === 'video') {
      core = s.prompt || s.uso || '';
    } else if (section === 'audio') {
      if (s.guion) {
        const first = String(s.guion).split(/\r?\n/).map(l => l.trim()).filter(Boolean)[0];
        if (first) core = first;
      }
      core = core || s.uso || '';
    }
    core = String(core).replace(/\s+/g, ' ').trim().slice(0, 60);
    // Separador "//" (mismo que el header del overlay Pixer Feed) en lugar de "·"
    // para que el item se lea como marca + descripcion: "Pixeria // una moto Top Gun"
    if (cliente && core) return `${cliente} // ${core}`;
    return core || cliente || section;
  }
  // Genera URL Pollinations (FLUX schnell, gratis, deterministica) para usar
  // como caratula de musica/audio cuando el motor no devuelve image_url propia
  // (Suno si la trae; Lyria y TTS no).
  function pollinationsCoverFor(section, store) {
    const s = (store && store[section]) || {};
    const parts = [];
    if (section === 'musica') {
      parts.push(s.uso || 'music album cover');
      if (Array.isArray(s.emocion)) parts.push(...s.emocion);
      parts.push('square album art, neon green matrix style, cinematic');
    } else if (section === 'audio') {
      parts.push(s.uso || 'podcast cover');
      parts.push('square art, microphone, neon green matrix style');
    } else {
      return '';
    }
    const prompt = parts.filter(Boolean).join(', ').slice(0, 200);
    const seedSrc = String((s.uso || '') + (s.tonalidad || '') + ((store && store.cliente) || '') || 'pixer');
    let seed = 0;
    for (let i = 0; i < seedSrc.length; i++) seed = (seed * 31 + seedSrc.charCodeAt(i)) >>> 0;
    return genFluxUrl(prompt, 512, 512);
  }

  function detectLatestAsset() {
    const player = document.getElementById('player');
    if (!player || player.hidden) return null;
    const selectedVariantImg = player.querySelector('.segmented-variant.selected img[src]');
    if (selectedVariantImg) {
      return {
        kind: 'image',
        src: selectedVariantImg.getAttribute('src') || selectedVariantImg.src,
        title: (selectedVariantImg.dataset && selectedVariantImg.dataset.pixerTitle) || '',
        cover: (selectedVariantImg.dataset && selectedVariantImg.dataset.pixerCover) || '',
      };
    }
    // Compare grid: si el usuario marcó una celda como seleccionada
    // (.compare-cell.selected), la imagen de esa celda gana sobre el resto.
    // Por defecto auto-selecciona la primera tras la generacion (compareSelectedImages).
    const selectedCellImg = player.querySelector('.compare-cell.selected .compare-cell-img img[src]');
    if (selectedCellImg) {
      return {
        kind: 'image',
        src: selectedCellImg.getAttribute('src') || selectedCellImg.src,
        title: (selectedCellImg.dataset && selectedCellImg.dataset.pixerTitle) || '',
        cover: (selectedCellImg.dataset && selectedCellImg.dataset.pixerCover) || '',
      };
    }
    const pick = (sel, kind) => {
      const el = player.querySelector(sel);
      if (!el) return null;
      const src = el.getAttribute('src') || el.querySelector('source')?.src || '';
      if (!src) return null;
      return {
        kind, src,
        title: (el.dataset && el.dataset.pixerTitle) || '',
        cover: (el.dataset && el.dataset.pixerCover) || '',
      };
    };
    return pick('video[src]', 'video') || pick('audio[src]', 'audio') || pick('img[src]', 'image');
  }

  function setSignageStatus({ thumb, stage, log, pct, indeterminate, id, mode }) {
    const panel = document.getElementById('signageStatus');
    if (!panel) return;
    panel.hidden = false;
    if (mode === 'reset') panel.classList.remove('error', 'done');
    if (mode === 'error') { panel.classList.add('error'); panel.classList.remove('done'); }
    if (mode === 'done')  { panel.classList.add('done'); panel.classList.remove('error'); }
    if (thumb !== undefined) {
      const img = panel.querySelector('.signage-thumb');
      if (thumb) img.src = thumb; else img.removeAttribute('src');
    }
    if (stage !== undefined) panel.querySelector('.signage-stage').textContent = stage;
    if (log !== undefined) panel.querySelector('.signage-log').textContent = log;
    if (id !== undefined) panel.querySelector('.signage-id').textContent = id ? `id ${id.slice(-8)}` : '';
    const bar = panel.querySelector('.signage-bar');
    const fill = panel.querySelector('.signage-bar-fill');
    if (indeterminate) {
      bar.classList.add('indeterminate');
    } else if (pct !== undefined) {
      bar.classList.remove('indeterminate');
      fill.style.width = pct + '%';
    }
  }

  function bindSendToAdmiraXP() {
    const btn = document.getElementById('sendToAdmiraXP');
    if (!btn) return;
    btn.addEventListener('click', async () => {
      const asset = detectLatestAsset();
      if (!asset) {
        showToast('Genera primero contenido (✨ CREAR)');
        return;
      }
      const cliente = (loadStore().cliente || 'sin cliente').slice(0, 80);
      const page = document.body.dataset.page || 'pixer';
      // El titulo viene del propio asset cuando los renders dejan data-pixer-title;
      // si no, fallback al generico "<page> · <cliente>".
      const title = (asset.title && asset.title.trim()) || `${page} · ${cliente}`;
      const cover = (asset.cover && asset.cover.trim()) || '';
      const oldText = btn.textContent;
      btn.disabled = true;
      btn.textContent = '📤 enviando...';

      // Stage 0 — preview en el panel
      const thumbUrl = asset.kind === 'image' ? asset.src : (cover || '');
      setSignageStatus({
        thumb: thumbUrl,
        stage: '📤 Detectando contenido',
        log: `${asset.kind.toUpperCase()} · "${title.slice(0, 80)}"`,
        pct: 5,
        indeterminate: false,
        id: '',
        mode: 'reset',
      });

      try {
        let payload = { kind: asset.kind, title };
        if (cover) payload.cover_url = cover; // worker quizas no lo persiste aun; harmless si lo descarta
        const isExternal = asset.src.startsWith('http://') || asset.src.startsWith('https://');

        if (isExternal) {
          payload.src = asset.src;
          setSignageStatus({ stage: '📤 Preparando URL externa', log: asset.src.slice(0, 100), pct: 30 });
        } else {
          setSignageStatus({ stage: '⚙ Convirtiendo asset a base64', log: 'puede tardar unos segundos en videos largos...', indeterminate: true });
          const t0 = Date.now();
          const { mime, base64 } = await urlToBase64(asset.src);
          payload.mime = mime;
          payload.base64 = base64;
          const sizeMB = (base64.length / 1024 / 1024 * 0.75).toFixed(2);
          setSignageStatus({ stage: '📤 Subiendo al worker', log: `${mime} · ${sizeMB} MB · convertido en ${((Date.now() - t0) / 1000).toFixed(1)}s`, pct: 50, indeterminate: false });
        }

        const r = await fetch(SIGNAGE_URL + '/push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        setSignageStatus({ stage: '💾 Guardado en Cloudflare KV', pct: 80 });
        const data = await r.json();
        if (!r.ok || !data.ok) {
          setSignageStatus({ stage: '❌ Error del worker', log: (data.error || ('HTTP ' + r.status)).slice(0, 200), pct: 100, mode: 'error' });
          return;
        }

        // Stage 5 — esperar ack REAL de la pantalla
        setSignageStatus({
          stage: '⏳ Esperando ack de la pantalla',
          log: 'la pantalla debe estar abierta en signage.html · poleo cada 2s (max 25s)',
          pct: 90,
          id: data.id,
          indeterminate: true,
        });
        const t0 = Date.now();
        const TIMEOUT_MS = 25000;
        let acked = null;
        while (Date.now() - t0 < TIMEOUT_MS) {
          await new Promise(r => setTimeout(r, 2000));
          try {
            const fr = await fetch(SIGNAGE_URL + '/feed?limit=10');
            const fd = await fr.json();
            const item = (fd.items || []).find(i => i.id === data.id);
            if (item && item.acked_at) { acked = item; break; }
          } catch {}
        }
        if (acked) {
          const screen = acked.screen || 'pantalla';
          setSignageStatus({
            stage: '▶ REPRODUCIENDO en pantalla',
            log: `${screen} confirmó ack hace ${((Date.now() - acked.acked_at) / 1000).toFixed(0)}s · LIVE`,
            pct: 100,
            id: data.id,
            mode: 'done',
          });
        } else {
          setSignageStatus({
            stage: '⚠ Sin ack de pantalla en 25s',
            log: 'subido al feed pero ninguna signage.html acuso recibo · abre la pantalla con el botón ↗',
            pct: 100,
            id: data.id,
            mode: 'error',
          });
        }
      } catch (e) {
        setSignageStatus({ stage: '❌ Error', log: String(e).slice(0, 200), pct: 100, mode: 'error' });
      } finally {
        btn.disabled = false;
        btn.textContent = oldText;
      }
    });
  }

  // ─── Badge de estado Xtore (signage live) ───────────────────────
  async function refreshXtoreStatus() {
    const el = document.getElementById('xtoreStatus');
    if (!el) return;
    try {
      const r = await fetch(SIGNAGE_URL + '/screens');
      if (!r.ok) throw new Error('http ' + r.status);
      const data = await r.json();
      const online = data.online_count || 0;
      const total = data.total_count || 0;
      el.classList.remove('online', 'stale', 'offline');
      if (online > 0) {
        el.classList.add('online');
        const onlineScreens = (data.screens || []).filter(s => s.online).sort((a, b) => a.age_seconds - b.age_seconds);
        const youngest = onlineScreens[0];
        // Identifica preferentemente la Xtore (game) frente a signage genérico
        const xtore = onlineScreens.find(s => s.role === 'xtore-game') || youngest;
        const verLabel = xtore?.version ? ` ${xtore.version.split(' ')[0]}` : '';
        const roleLabel = xtore?.role === 'xtore-game' ? 'XTORE' : 'SIGNAGE';
        el.textContent = `${roleLabel}${verLabel} · LIVE`;
        el.title = `${online}/${total} pantallas activas · última señal hace ${youngest?.age_seconds ?? 0}s\n\n` +
          (data.screens || []).map(s => {
            const v = s.version ? ` ${s.version}` : '';
            const r = s.role || 'signage';
            return `${s.online ? '🟢' : '🔴'} [${r}]${v} · ${s.screen} · ${s.age_seconds}s · feed:${s.feed_count}`;
          }).join('\n');
      } else if (total > 0) {
        const stale = (data.screens || [])[0];
        el.classList.add('stale');
        el.textContent = `XTORE · stale ${stale?.age_seconds || '?'}s`;
        el.title = `Sin pantallas activas. Última señal hace ${stale?.age_seconds || '?'}s.\nAbre signage.html para reactivar.`;
      } else {
        el.classList.add('offline');
        el.textContent = 'XTORE · offline';
        el.title = 'Ninguna pantalla signage.html abierta.\nClick para abrir la pantalla en otra ventana.';
      }
    } catch (e) {
      el.classList.remove('online', 'stale');
      el.classList.add('offline');
      el.textContent = 'XTORE · sin red';
      el.title = String(e);
    }
  }

  function bindXtoreBadge() {
    const el = document.getElementById('xtoreStatus');
    if (!el) return;
    el.style.cursor = 'pointer';
    el.addEventListener('click', () => {
      window.open('signage.html', '_blank');
    });
    refreshXtoreStatus();
    setInterval(refreshXtoreStatus, 10000);
  }

  // ─── Importar desde URL (yt-dlp) ─────────────────────────────────
  // Dos backends posibles segun como se sirva la pagina:
  //   - localhost (suno-local :3777)  → audio mp3 + video mp4 (preferente cuando esta arriba)
  //   - HTTPS publico (admira-tube Funnel) → audio mp3 + video mp4
  // Whitelist de hosts en ambos: YouTube, Vimeo, Twitter/X, TikTok, Instagram.
  // Desde GitHub Pages (https://...) el browser bloquea fetch a http://localhost
  // por mixed-content, asi que routeamos al Funnel.
  // Backends posibles, en orden de preferencia. Cada uno con su health-check.
  // En https público el navegador bloquea fetch a http://localhost (mixed-content),
  // así que ahí solo está admira-tube. En local probamos suno-local y caemos a admira-tube.
  function importEndpoints() {
    const isLocalOrigin = location.protocol === 'http:'
      || location.hostname === 'localhost'
      || location.hostname === '127.0.0.1';
    const sunoLocal = {
      kind: 'suno-local',
      url: 'http://127.0.0.1:3777/yt/import',
      healthUrl: 'http://127.0.0.1:3777/healthz',
      bodyFor: (u, fmt) => ({ url: u, format: fmt }),
    };
    const admiraTube = {
      kind: 'admira-tube',
      url: 'https://macmini.tail48b61c.ts.net/admira/tube/download',
      healthUrl: 'https://macmini.tail48b61c.ts.net/admira/tube/health',
      jobBase: 'https://macmini.tail48b61c.ts.net/admira/tube',
      bodyFor: (u, fmt) => ({ url: u, format: fmt }),
    };
    // Backup/failover: si el Mac Mini no responde al health-check, pickHealthyEndpoint()
    // cae automáticamente a este nodo (MacBook Pro 16) expuesto por su propio Funnel.
    const admiraTubeBackup = {
      kind: 'admira-tube-backup',
      url: 'https://macbook-pro-16.tail48b61c.ts.net/admira/tube/download',
      healthUrl: 'https://macbook-pro-16.tail48b61c.ts.net/admira/tube/health',
      jobBase: 'https://macbook-pro-16.tail48b61c.ts.net/admira/tube',
      bodyFor: (u, fmt) => ({ url: u, format: fmt }),
    };
    return isLocalOrigin ? [sunoLocal, admiraTube, admiraTubeBackup] : [admiraTube, admiraTubeBackup];
  }

  function bindImportModal() {
    const dlg = document.getElementById('importModal');
    const open = document.getElementById('openImport');
    if (!dlg || !open) return;
    open.addEventListener('click', () => {
      const stat = document.getElementById('importStatus');
      if (stat) { stat.style.display = 'none'; stat.textContent = ''; }
      const progressWrap = document.getElementById('importProgress');
      const progressFill = document.getElementById('importProgressFill');
      if (progressWrap) progressWrap.hidden = true;
      if (progressFill) { progressFill.style.width = '0%'; progressFill.style.background = ''; }
      const cmt = document.getElementById('import-comment');
      if (cmt) cmt.value = '';
      const rb = document.getElementById('retryImport');
      if (rb) rb.hidden = true;
      dlg.showModal();
    });
    document.getElementById('closeImport')?.addEventListener('click', () => dlg.close());
    // Helpers para la barra de progreso del modal
    function importProgressStart(fmt) {
      const wrap = document.getElementById('importProgress');
      const kind = document.getElementById('importProgressKind');
      const stats = document.getElementById('importProgressStats');
      const fill = document.getElementById('importProgressFill');
      const indet = document.getElementById('importProgressIndet');
      if (!wrap) return null;
      wrap.hidden = false;
      wrap.dataset.kind = fmt; // for CSS styling (audio vs video)
      if (kind) kind.textContent = fmt === 'video' ? '🎬 VIDEO · descargando' : '🎵 AUDIO · descargando';
      if (stats) stats.textContent = '0 MB · 0.0s';
      if (fill) fill.style.width = '0%';
      if (indet) indet.hidden = false;
      return {
        update(receivedBytes, totalBytes, sec) {
          const mb = (receivedBytes / 1024 / 1024).toFixed(2);
          if (totalBytes > 0) {
            const pct = Math.min(100, (receivedBytes / totalBytes) * 100);
            if (fill) fill.style.width = pct.toFixed(1) + '%';
            if (indet) indet.hidden = true;
            if (stats) stats.textContent = `${mb} / ${(totalBytes / 1024 / 1024).toFixed(2)} MB · ${pct.toFixed(0)}% · ${sec.toFixed(1)}s`;
          } else {
            if (indet) indet.hidden = false;
            if (stats) stats.textContent = `${mb} MB · ${sec.toFixed(1)}s`;
          }
        },
        done(receivedBytes, sec) {
          const mb = (receivedBytes / 1024 / 1024).toFixed(2);
          if (fill) fill.style.width = '100%';
          if (indet) indet.hidden = true;
          if (kind) kind.textContent = (fmt === 'video' ? '🎬 VIDEO' : '🎵 AUDIO') + ' · ✅ listo';
          if (stats) stats.textContent = `${mb} MB · ${sec.toFixed(1)}s`;
        },
        error(msg) {
          if (kind) kind.textContent = (fmt === 'video' ? '🎬 VIDEO' : '🎵 AUDIO') + ' · ❌ error';
          if (indet) indet.hidden = true;
          if (fill) fill.style.background = '#ff6d6d';
          if (stats) stats.textContent = String(msg || '').slice(0, 80);
        },
        hide() { if (wrap) wrap.hidden = true; },
      };
    }

    // Streaming fetch: lee la respuesta como ReadableStream y va contando bytes
    // para alimentar la barra de progreso. Devuelve { blob, totalBytes, receivedBytes }.
    async function fetchWithProgress(response, onProgress) {
      const contentLength = parseInt(response.headers.get('Content-Length') || '0', 10);
      const reader = response.body?.getReader();
      if (!reader) {
        const blob = await response.blob();
        return { blob, totalBytes: blob.size, receivedBytes: blob.size };
      }
      const chunks = [];
      let received = 0;
      const t0 = performance.now();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.byteLength;
        if (onProgress) onProgress(received, contentLength, (performance.now() - t0) / 1000);
      }
      const blob = new Blob(chunks, { type: response.headers.get('Content-Type') || 'application/octet-stream' });
      return { blob, totalBytes: contentLength || received, receivedBytes: received };
    }

    // Sincroniza el highlight del chip de formato con el radio
    document.querySelectorAll('input[name="import-fmt"]').forEach(input => {
      input.addEventListener('change', () => {
        document.querySelectorAll('.import-fmt-chip').forEach(chip => {
          const ip = chip.querySelector('input[name="import-fmt"]');
          chip.classList.toggle('is-selected', !!(ip && ip.checked));
        });
      });
      // Init
      if (input.checked) {
        input.closest('.import-fmt-chip')?.classList.add('is-selected');
      }
    });

    // Botón de reintento: se inyecta junto a los demás y se muestra tras un fallo.
    let lastImportArgs = null;
    let importInFlight = false;
    const retryBtn = document.createElement('button');
    retryBtn.type = 'button';
    retryBtn.className = 'btn';
    retryBtn.id = 'retryImport';
    retryBtn.textContent = '↻ Reintentar';
    retryBtn.hidden = true;
    document.querySelector('#importModal .keys-actions')?.appendChild(retryBtn);

    // Plan B (fallback degradado): subir un archivo local directo al Stock.
    // El Stock (worker pixer-eleven en Cloudflare) está siempre encendido, así que
    // esto funciona aunque el Mac Mini (importador yt-dlp) esté dormido o apagado.
    const localInput = document.createElement('input');
    localInput.type = 'file';
    localInput.accept = 'audio/*,video/*,image/*';
    localInput.hidden = true;
    localInput.id = 'importLocalFile';
    dlg.appendChild(localInput);
    const localBtn = document.createElement('button');
    localBtn.type = 'button';
    localBtn.className = 'btn';
    localBtn.id = 'importLocalBtn';
    localBtn.textContent = '📂 Archivo local → Stock';
    localBtn.title = 'Sube un archivo desde este dispositivo directo al Stock (no depende del Mac Mini)';
    document.querySelector('#importModal .keys-actions')?.appendChild(localBtn);
    localBtn.addEventListener('click', () => localInput.click());
    localInput.addEventListener('change', () => {
      const file = localInput.files && localInput.files[0];
      if (file) publishLocalFile(file);
      localInput.value = '';
    });

    // Publica un archivo del dispositivo directo al Stock, sin pasar por el Mac.
    async function publishLocalFile(file) {
      if (importInFlight) return;
      const stat = document.getElementById('importStatus');
      stat.style.display = 'block';
      retryBtn.hidden = true;
      importInFlight = true;
      const mt = file.type || '';
      const type = mt.startsWith('video') ? 'video' : mt.startsWith('image') ? 'image' : 'audio';
      const progress = importProgressStart(type === 'video' ? 'video' : 'audio');
      try {
        const sizeMB = (file.size / 1024 / 1024).toFixed(2);
        stat.textContent = `// archivo local: ${file.name} · ${sizeMB} MB · subiendo al Stock…`;
        const dataUrl = await new Promise((res, rej) => {
          const fr = new FileReader();
          fr.onload = () => res(fr.result);
          fr.onerror = () => rej(fr.error || new Error('no se pudo leer el archivo'));
          fr.readAsDataURL(file);
        });
        const comment = (document.getElementById('import-comment')?.value || '').trim();
        const meta = {
          type, motor: 'local',
          prompt: file.name,
          title: file.name.replace(/\.[^.]+$/, ''),
          comment: comment || null,
          costEst: `local · ${sizeMB}MB`,
          url: dataUrl,
          mime: mt || null,
        };
        const result = await publishToStock(meta, null);
        if (result && result.ok) {
          progress?.done(file.size, 0);
          stat.textContent = `✓ ${file.name} · ✅ en Stock · saltando…`;
          const newId = result.id || '';
          setTimeout(() => {
            try { dlg.close(); } catch {}
            location.href = 'https://www.pixeria.com/stock.html' + (newId ? '?highlight=' + encodeURIComponent(newId) : '');
          }, 900);
        } else {
          progress?.error('fallo al publicar');
          stat.textContent = `❌ Stock: ${(result && result.error || 'fallo').slice(0, 140)}`;
        }
      } catch (e) {
        const msg = String(e && e.message || e);
        progress?.error(msg.slice(0, 80));
        stat.textContent = `// ERROR archivo local: ${msg}`;
      } finally {
        importInFlight = false;
      }
    }

    // Pre-chequeo de salud del backend (rápido, abortable). true = responde.
    async function importHealthOk(ep, ms = 4500) {
      if (!ep.healthUrl) return true;
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), ms);
      try {
        const r = await fetch(ep.healthUrl, { method: 'GET', signal: ctrl.signal, cache: 'no-store' });
        if (!r.ok) return false;
        try { const j = await r.json(); return j.ok !== false && j.available !== false; }
        catch { return true; }
      } catch { return false; }
      finally { clearTimeout(timer); }
    }

    // Elige el primer backend sano de la lista (fallback automático).
    async function pickHealthyEndpoint(stat) {
      for (const ep of importEndpoints()) {
        if (stat) stat.textContent = `// comprobando ${ep.kind}…`;
        if (await importHealthOk(ep)) return ep;
      }
      return null;
    }

    // Flujo asíncrono start → status → get: peticiones cortas para no disparar
    // el timeout del Funnel con descargas largas. Devuelve {blob, title}, o el
    // string 'fallback' si el server aún no tiene los endpoints nuevos (404).
    async function importViaJob(ep, url, fmt, progress, stat) {
      const startR = await fetch(ep.jobBase + '/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, format: fmt }),
      });
      // Cualquier respuesta no-OK o no-JSON ⇒ el server no tiene los endpoints
      // nuevos (404/HTML estático) o rechazó la URL ⇒ caemos al POST único, que
      // mostrará el error real (p. ej. host no permitido) si lo hubiera.
      if (!startR.ok) return 'fallback';
      let jobId;
      try { jobId = (await startR.json()).jobId; } catch { return 'fallback'; }
      if (!jobId) return 'fallback';
      const tPoll = Date.now();
      const MAX_MS = 6 * 60 * 1000;
      while (true) {
        await new Promise(r => setTimeout(r, 1500));
        if (Date.now() - tPoll > MAX_MS) throw new Error('timeout esperando al proxy (>6 min)');
        let st;
        try { st = await (await fetch(`${ep.jobBase}/status?id=${encodeURIComponent(jobId)}`, { cache: 'no-store' })).json(); }
        catch { continue; } // un poll fallido no aborta; reintenta en el siguiente ciclo
        if (st.state === 'running') {
          const mb = (st.size || 0) / 1024 / 1024;
          if (stat) stat.textContent = `// ${ep.kind} · descargando ${fmt}… ${mb.toFixed(1)} MB`;
          progress?.update(st.size || 0, 0, (Date.now() - tPoll) / 1000);
          continue;
        }
        if (st.state === 'done') break;
        throw new Error(st.error || st.state || 'estado desconocido del proxy');
      }
      const getR = await fetch(`${ep.jobBase}/get?id=${encodeURIComponent(jobId)}`, { cache: 'no-store' });
      if (!getR.ok) {
        let err = ''; try { err = JSON.stringify(await getR.json()); } catch { err = await getR.text(); }
        throw new Error(`get ${getR.status}: ${err.slice(0, 200)}`);
      }
      let title = ''; try { title = decodeURIComponent(getR.headers.get('X-Tube-Title') || ''); } catch {}
      const { blob } = await fetchWithProgress(getR, (received, total, sec) => progress?.update(received, total, sec));
      return { blob, title };
    }

    // Flujo de un solo POST (suno-local, o admira-tube antiguo como fallback).
    async function importOneShot(ep, url, fmt, progress) {
      const r = await fetch(ep.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ep.bodyFor(url, fmt)),
      });
      if (!r.ok) {
        let err = ''; try { err = JSON.stringify(await r.json()); } catch { err = await r.text(); }
        throw new Error(`ERROR ${r.status}: ${err.slice(0, 300)}`);
      }
      let title = ''; try { title = decodeURIComponent(r.headers.get('X-Tube-Title') || ''); } catch {}
      const { blob } = await fetchWithProgress(r, (received, total, sec) => progress?.update(received, total, sec));
      return { blob, title };
    }

    async function runImport() {
      if (importInFlight || !lastImportArgs) return;
      const { url, fmt, comment } = lastImportArgs;
      const stat = document.getElementById('importStatus');
      stat.style.display = 'block';
      retryBtn.hidden = true;
      importInFlight = true;
      try {
        // 1) Pre-chequeo: ¿hay backend vivo? Evita esperar a un timeout largo.
        const ep = await pickHealthyEndpoint(stat);
        if (!ep) {
          stat.textContent = `// El importador (Mac Mini) está dormido o apagado ahora mismo.\n`
            + `// PLAN B: pulsa «📂 Archivo local → Stock» para subir un archivo\n`
            + `//   desde este dispositivo directo al Stock (funciona sin el Mac).\n`
            + `// O reintenta (↻) en unos segundos por si el Mac despierta.`;
          retryBtn.hidden = false;
          try { localBtn.focus(); } catch {}
          return;
        }

        stat.textContent = `// ${ep.kind} OK · descargando ${fmt}…\n// puede tardar 10-60s según media`;
        const progress = importProgressStart(fmt);
        const t0 = Date.now();
        try {
          // admira-tube: flujo asíncrono (start→status→get) que evita el timeout
          // del Funnel. Si el server aún no tiene esos endpoints (404), cae al
          // POST único de siempre. suno-local usa siempre el POST único.
          let out = ep.jobBase ? await importViaJob(ep, url, fmt, progress, stat) : 'fallback';
          if (out === 'fallback') out = await importOneShot(ep, url, fmt, progress);
          const blob = out.blob;
          const importedTitle = out.title || '';
          const sec = ((Date.now() - t0) / 1000).toFixed(1);
          const sizeMB = (blob.size / 1024 / 1024).toFixed(2);
          progress?.done(blob.size, parseFloat(sec));
          const blobUrl = URL.createObjectURL(blob);
          const kind = fmt === 'video' ? 'video' : 'audio';
          const elTag = kind;
          const mime = fmt === 'video' ? 'video/mp4' : 'audio/mpeg';
          const ytMatch = url.match(/(?:youtube\.com\/.*[?&]v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([A-Za-z0-9_-]{11})/);
          const thumbnail = ytMatch ? `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg` : null;
          const importMeta = {
            type: kind,
            motor: 'yt-dlp',
            prompt: url,
            title: importedTitle || null,
            comment: comment || null,
            costEst: `gratis · ${sizeMB}MB · ${sec}s`,
            url: blobUrl,
            mime,
            thumbnail,
          };
          const player = document.getElementById('player');
          if (player) {
            player.hidden = false;
            player.innerHTML = `
              <div class="player-card">
                <div class="player-head">📥 IMPORTADO · ${kind.toUpperCase()} · ${sizeMB} MB · ${sec}s · ${ep.kind}</div>
                <${elTag} controls autoplay src="${blobUrl}" style="width:100%;${kind === 'video' ? 'max-height:55vh;' : ''}"></${elTag}>
                <pre class="player-body">${url.replace(/</g, '&lt;')}</pre>
                <a class="btn" download="import-${Date.now()}.${fmt === 'video' ? 'mp4' : 'mp3'}" href="${blobUrl}">⬇ Descargar</a>
                ${publishBtnHTML(importMeta)}
                <small class="player-foot">// vía yt-dlp (${ep.kind}) · publicando en Stock automáticamente...</small>
              </div>`;
          }
          stat.textContent = `✓ Importado (${sizeMB} MB en ${sec}s) · subiendo a Stock...`;
          // Auto-publicar en Stock al finalizar la importación
          const publishBtn = player?.querySelector('.publish-btn');
          const result = await publishToStock(importMeta, publishBtn);
          if (result && result.ok) {
            stat.textContent = `✓ Importado (${sizeMB} MB en ${sec}s) · ✅ en Stock · saltando…`;
            const newId = result.id || '';
            setTimeout(() => {
              try { dlg.close(); } catch {}
              const target = 'https://www.pixeria.com/stock.html' + (newId ? '?highlight=' + encodeURIComponent(newId) : '');
              location.href = target;
            }, 900);
          } else {
            stat.textContent = `✓ Importado (${sizeMB} MB en ${sec}s) · ❌ Stock: ${(result && result.error || 'fallo').slice(0, 120)}\n// el archivo sigue en el player; pulsa 📌 para reintentar`;
          }
        } catch (e) {
          const msg = String(e && e.message || e);
          progress?.error(msg.slice(0, 80));
          const isNetwork = /Failed to fetch|NetworkError|ERR_|load failed/i.test(msg);
          if (isNetwork && fmt === 'video') {
            stat.textContent = `// ERROR: ${msg}\n`
              + `// ${ep.kind} respondió al health-check → el proxy NO está caído.\n`
              + `// Probable timeout del Funnel con la descarga de vídeo.\n`
              + `// Reintenta (↻) o importa como AUDIO.`;
          } else if (isNetwork) {
            stat.textContent = `// ERROR: ${msg}\n// La conexión con ${ep.kind} se cortó. Reintenta (↻).`;
          } else {
            stat.textContent = `// ${msg}\n// Reintenta (↻).`;
          }
          retryBtn.hidden = false;
        }
      } finally {
        importInFlight = false;
      }
    }

    retryBtn.addEventListener('click', runImport);
    document.getElementById('doImport')?.addEventListener('click', () => {
      const url = document.getElementById('import-url').value.trim();
      const fmt = document.querySelector('input[name="import-fmt"]:checked')?.value || 'audio';
      const comment = (document.getElementById('import-comment')?.value || '').trim();
      if (!url) return;
      lastImportArgs = { url, fmt, comment };
      runImport();
    });
  }

  // Init por página
  document.addEventListener('DOMContentLoaded', () => {
    applyDefaults();
    bindImportModal();
    bindXtoreBadge();
    bindSettingsModal();
    renderMotorSelectors();
    renderMotorCatalog();
    const form = document.getElementById('briefForm');
    if (form) {
      hydrate(form);
      bindPersistence(form);
      bindCliente();
      const out = document.getElementById('briefOut');
      const page = document.body.dataset.page;
      const scopeMap = {
        audio: ['audio'],
        musica: ['musica'],
        imagenes: ['imagenes'],
        video: ['video'],
        publicidad: ['publicidad'],
        plataforma: ['audio', 'musica', 'imagenes', 'video'],
      };
      const scope = scopeMap[page] || null;
      if (out) bindBriefActions(out, scope);
      bindPlay(page);
      bindGenLyrics();
      bindSegmentedAds();
      bindSendToAdmiraXP();

      const demoBtn = document.getElementById('loadDemo');
      if (demoBtn && window.PIXER_DEMO) {
        demoBtn.addEventListener('click', () => loadDemo(window.PIXER_DEMO.fields, window.PIXER_DEMO.chips));
      }
    }
  });

  window.PIXER = { loadStore, saveStore, buildBrief, showToast, MOTORES };
})();
