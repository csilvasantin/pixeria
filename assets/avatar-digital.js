// Pixie: free local SVG helper, invoked explicitly from Expert. Every page starts hidden.
(function (root) {
  'use strict';

  const ON = /^(on|encender|mostrar|show)$/i;
  const OFF = /^(off|apagar|ocultar|hide)$/i;

  function pageLang() {
    try {
      const lang = String((root.document && root.document.documentElement.lang) || '').toLowerCase();
      if (lang.indexOf('en') === 0) return 'en';
      if (lang.indexOf('es') === 0) return 'es';
    } catch (_) {}
    return 'es';
  }

  function storageKey() {
    try { return 'da-avatar:' + ((root.location && root.location.host) || ''); } catch (_) { return 'da-avatar:'; }
  }

  // null si el texto no es el interruptor. 'toggle' | 'on' | 'off' | 'bad'.
  function decide(text) {
    const raw = String(text == null ? '' : text).trim();
    const m = raw.match(/^\/?([^\s@]+)(?:@\S+)?(?:\s+([\s\S]*))?$/);
    if (!m) return null;
    const verb = m[1].toLowerCase();
    let rest = (m[2] || '').trim();
    if (verb === 'cli') {
      const parts = rest.split(/\s+/);
      if (!/^(ayudante|helper)$/i.test(parts[0] || '')) return null;
      rest = parts.slice(1).join(' ');
    } else if (verb !== 'avatardigital' && verb !== 'digitalavatar') {
      return null;
    }
    const arg = rest.split(/\s+/).filter(Boolean)[0] || '';
    if (!arg) return 'toggle';
    if (ON.test(arg)) return 'on';
    if (OFF.test(arg)) return 'off';
    return 'bad';
  }

  function line(mode, lang) {
    const en = lang === 'en';
    if (mode === 'on') return en ? 'Digital avatar on' : 'Avatar digital activado';
    if (mode === 'off') return en ? 'Digital avatar off' : 'Avatar digital desactivado';
    return en
      ? 'Use on/off (show/hide) or no argument to toggle.'
      : 'Usa on/off (mostrar/ocultar, encender/apagar) o ningún argumento para alternar.';
  }

  const api = {decide, line, storageKey, pageLang};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof document === 'undefined') return;

  const doc = document;
  let active = false;
  let face = null;

  function storedOn() { return active; }
  function store(on) { active = on; }

  function ensureLift() {
    if (doc.getElementById('da-avatar-lift')) return;
    const style = doc.createElement('style');
    style.id = 'da-avatar-lift';
    // El embed fija bottom:20px y un z-index por encima de todo. Aquí se levanta
    // por encima de la barra Experto y se queda por debajo de las barras (z 40
    // pierde contra el shell en 9000 y contra el dock del gemelo en 30).
    style.textContent = '@keyframes pixie-bob{50%{transform:translateY(-5px) rotate(2deg)}}@media(prefers-reduced-motion:reduce){#da-av img{animation:none!important}}#da-av{right:16px !important;bottom:var(--da-lift,96px) !important;top:auto !important;z-index:25 !important}';
    doc.head.append(style);
  }

  function barHeight(el) {
    if (!el) return 0;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return 0;
    const r = el.getBoundingClientRect();
    if (r.height < 24 || r.bottom < root.innerHeight - 40) return 0;
    if (r.top > root.innerHeight - 8) return 0;
    return Math.round(root.innerHeight - r.top + 16);
  }

  function applyLift() {
    let h = 96;
    for (const id of ['xsExpert', 'telegramDock', 'expert-panel', 'yk-rail-bottom']) h = Math.max(h, barHeight(doc.getElementById(id)));
    doc.querySelectorAll('.xs-expert, .yk-rail-bottom, .pf-cli').forEach(el => { h = Math.max(h, barHeight(el)); });
    doc.documentElement.style.setProperty('--da-lift', h + 'px');
  }

  function watchLift() {
    ensureLift();
    applyLift();
    const mo = new MutationObserver(applyLift);
    for (const id of ['xsExpert', 'telegramDock', 'expertBar']) {
      const el = doc.getElementById(id);
      if (el) mo.observe(el, {attributes: true, attributeFilter: ['class', 'style']});
    }
    root.addEventListener('resize', applyLift);
  }

  async function ensureFace() {
    if (face) return face;
    const en = pageLang() === 'en';
    const wrap = doc.createElement('aside');
    wrap.id = 'da-av';
    wrap.setAttribute('aria-label', en ? 'Pixie · digital helper' : 'Pixie · ayudante digital');
    wrap.style.cssText = 'position:fixed;width:228px;padding:16px;border-radius:22px;background:#071c21;border:1px solid #71f4dc;color:#edfdf7;font:14px/1.5 system-ui;box-shadow:0 16px 40px #0008';
    const close = doc.createElement('button');
    close.textContent = '×';
    close.setAttribute('aria-label', en ? 'Hide helper' : 'Ocultar ayudante');
    close.style.cssText = 'float:right;color:inherit;background:transparent;border:0;font-size:24px;cursor:pointer';
    close.onclick = hide;
    const mascot = doc.createElement('img');
    mascot.src = '/assets/pixie.svg';
    mascot.alt = en ? 'Pixie, a smiling mint-green pixel creature' : 'Pixie, una criatura píxel verde menta sonriente';
    mascot.width = 150; mascot.height = 150;
    mascot.style.cssText = 'display:block;margin:auto;animation:pixie-bob 3s ease-in-out infinite';
    const title = doc.createElement('strong'); title.textContent = 'Pixie';
    const caption = doc.createElement('p');
    caption.textContent = en ? 'Hello! Choose your video in Adapter, select a format, then adjust its framing. The H.264 plan shows encoding settings.' : '¡Hola! Elige tu vídeo en Adaptador, selecciona un formato y ajusta su encuadre. El plan H.264 muestra la codificación.';
    const note = doc.createElement('small');
    note.textContent = en ? 'Local guide · no AI model or paid service.' : 'Guía local · sin modelo IA ni servicio de pago.';
    wrap.append(close, mascot, title, caption, note);
    doc.body.append(wrap);
    face = {open() {}, close() {}};
    applyLift();
    return face;
  }

  async function show() {
    store(true);
    await ensureFace();
    const node = doc.getElementById('da-av');
    if (node) node.style.display = '';
    try { if (face && face.open) face.open(); } catch (_) {}
    applyLift();
  }

  function hide() {
    store(false);
    const node = doc.getElementById('da-av');
    if (node) node.style.display = 'none';
    try { root.speechSynthesis && root.speechSynthesis.cancel(); } catch (_) {}
  }

  async function handle(text) {
    const mode = decide(text);
    const lang = pageLang();
    if (mode == null || mode === 'bad') return line('bad', lang);
    const next = mode === 'toggle' ? !storedOn() : mode === 'on';
    if (next) await show(); else hide();
    return line(next ? 'on' : 'off', lang);
  }

  root.AvatarDigital = {handle, show, hide, decide, storedOn};
  watchLift();
  // Every page starts hidden, regardless of previous preferences.
})(typeof window === 'undefined' ? globalThis : window);
