/** Marco del visor: barra fija y tres paneles independientes (opciones, avanzado, experto). */
export const UI_KEYS = {left:'xpace_ui_left', right:'xpace_ui_right', bottom:'xpace_ui_bottom', nivel:'xpace_ui_nivel'};
export const LEVELS = [
  {id:'8', bits:'8 bits', name:'Good', ready:false},
  {id:'16', bits:'16 bits', name:'Better', ready:true},
  {id:'32', bits:'32 bits', name:'Best', ready:false},
  {id:'64', bits:'64 bits', name:'Matrix', ready:false},
];
const VISTAS = {iso:'home', isometrica:'home', planta:'floor', frontal:'front'};
const LUCES = {dia:'day', atardecer:'sunset', noche:'night'};
const norm = s => String(s||'').normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();

export function loadUi(storage) {
  const on = key => storage?.getItem?.(key) === '1';
  const nivel = storage?.getItem?.(UI_KEYS.nivel);
  return {
    left: on(UI_KEYS.left),
    right: on(UI_KEYS.right),
    bottom: on(UI_KEYS.bottom),
    nivel: LEVELS.some(level => level.id === nivel) ? nivel : '16',
  };
}

export function levelNote(id, en=false) {
  const level = LEVELS.find(item => item.id === id) || LEVELS[1];
  if (level.ready) return '';
  const name = level.id === '64' ? 'Matrix · hiperrealista' : level.name;
  return `${level.bits} · ${name} · ${en ? 'coming soon' : 'próximamente'}`;
}

export function helpText(en=false) {
  return en
    ? 'ver <id> · ficha <id> · vista iso|planta|frontal · luz dia|atardecer|noche · zoom +|- · mostrar|ocultar <id|categoría> · todo · nada · export json|csv · enlace · estado · nivel 8|16|32|64 · ayuda'
    : 'ver <id> · ficha <id> · vista iso|planta|frontal · luz dia|atardecer|noche · zoom +|- · mostrar|ocultar <id|categoría> · todo · nada · export json|csv · enlace · estado · nivel 8|16|32|64 · ayuda';
}

/** Traduce una línea a una acción. No toca el DOM: el visor ejecuta `run`. */
export function executeCommand(line, api, en=false) {
  const raw = String(line||'').trim();
  const parts = raw.split(/\s+/);
  const cmd = norm(parts[0]);
  const arg = parts.slice(1).join(' ').trim();
  if (!cmd || cmd === 'ayuda' || cmd === 'help') return helpText(en);
  if (cmd === 'ver' || cmd === 'ficha') {
    if (!arg) return en ? 'missing id' : 'falta el id';
    api[cmd](arg);
    return `${cmd} ${arg}`;
  }
  if (cmd === 'vista') {
    const preset = VISTAS[norm(arg)];
    if (!preset) return 'vista iso|planta|frontal';
    api.vista(preset);
    return `vista ${arg}`;
  }
  if (cmd === 'luz') {
    const light = LUCES[norm(arg)];
    if (!light) return 'luz dia|atardecer|noche';
    api.luz(light);
    return `luz ${arg}`;
  }
  if (cmd === 'zoom') {
    if (arg !== '+' && arg !== '-') return 'zoom +|-';
    api.zoom(arg);
    return `zoom ${arg}`;
  }
  if (cmd === 'mostrar' || cmd === 'ocultar') {
    if (!arg) return en ? 'missing id or category' : 'falta el id o la categoría';
    const n = api.mostrar(arg, cmd === 'mostrar');
    return n ? `${cmd} ${arg}` : (en ? 'not in the inventory' : 'no está en el inventario');
  }
  if (cmd === 'todo' || cmd === 'nada') { api[cmd](); return cmd; }
  if (cmd === 'export') {
    if (arg !== 'json' && arg !== 'csv') return 'export json|csv';
    api.export(arg);
    return `export ${arg}`;
  }
  if (cmd === 'enlace') { api.enlace(); return 'enlace'; }
  if (cmd === 'estado') return api.estado();
  if (cmd === 'nivel') {
    if (!LEVELS.some(level => level.id === arg)) return 'nivel 8|16|32|64';
    api.nivel(arg);
    return levelNote(arg, en) || `nivel ${arg}`;
  }
  return helpText(en);
}

export function cafeTitle(item) {
  if (item?.id === '1790375438696-1ladz7' || item?.id === '1790370079244-cv7t5i') return 'Cafebrería · Alsea';
  return item?.title || 'Xpacio';
}

export function viewerShell({en=false, title='Xpacio', stamp=''}={}) {
  const levels = LEVELS.map(level => {
    const soon = level.ready ? '' : (en ? ' · coming soon' : ' · próximamente');
    const name = level.id === '64' ? 'Matrix' : level.name;
    return `<button type="button" data-nivel="${level.id}" aria-pressed="false" title="${level.bits} · ${name}${soon}">${level.bits}</button>`;
  }).join('');
  const t = (es, eng) => en ? eng : es;
  return `<header class="xpace-top">
    <button type="button" data-xpace-toggle="left" aria-expanded="false" aria-label="${t('Opciones','Options')}" title="${t('Opciones','Options')}">☰</button>
    <div class="xpace-top-center"><strong>${title}</strong><span class="xpace-count" aria-live="polite">—</span><small class="xpace-stamp">${stamp}</small></div>
    <div class="xpace-levels" role="radiogroup" aria-label="${t('Nivel','Level')}">${levels}</div>
    <button type="button" data-xpace-toggle="right" aria-expanded="false" aria-label="${t('Avanzado','Advanced')}" title="${t('Avanzado','Advanced')}">▤</button>
    <button type="button" data-xpace-toggle="bottom" aria-pressed="false" aria-label="${t('Modo experto','Expert mode')}" title="${t('Modo experto','Expert mode')}">⌘</button>
  </header>
  <div class="xpace-frame">
    <aside class="xpace-rail xpace-rail-left" data-xpace-panel="left" aria-label="${t('Opciones','Options')}">
      <div class="xpace-rail-body">
        <p class="xpace-rail-title">${t('Opciones','Options')}</p>
        <div role="group" aria-label="${t('Vistas','Views')}"><button type="button" data-preset="home" aria-pressed="true">${t('Isométrica','Isometric')}</button><button type="button" data-preset="floor">${t('Planta','Floor plan')}</button><button type="button" data-preset="front">${t('Frontal','Front')}</button></div>
        <div role="group" aria-label="Zoom"><button type="button" data-zoom="0.8" aria-label="${t('Alejar','Zoom out')}">−</button><button type="button" data-zoom="1.25" aria-label="${t('Acercar','Zoom in')}">+</button><button type="button" data-pan aria-pressed="false">${t('Desplazar','Pan')}</button></div>
        <div role="group" aria-label="${t('Iluminación','Lighting')}"><button type="button" data-light="day" aria-pressed="true">☀ ${t('Día','Day')}</button><button type="button" data-light="sunset" aria-pressed="false">◒ ${t('Atardecer','Sunset')}</button><button type="button" data-light="night" aria-pressed="false">☾ ${t('Noche','Night')}</button></div>
        <div role="group" aria-label="${t('Filtros','Filters')}"><button type="button" data-all="yes">${t('Todo','All')}</button><button type="button" data-all="no">${t('Nada','None')}</button></div>
        <div class="xpace-filters"></div>
        <p class="xpace-help">${t('Arrastra para orbitar · rueda o pellizco para zoom · Desplazar + arrastrar para mover','Drag to orbit · wheel or pinch to zoom · Pan + drag to move')}</p>
        <p class="xpace-version">${stamp}</p>
      </div>
    </aside>
    <div class="xpace-stage"><canvas tabindex="0" aria-label="${t('Espacio 3D interactivo','Interactive 3D space')}"></canvas><p class="xpace-loading" role="status">${t('Cargando el espacio…','Loading space…')}</p><p class="xpace-nivel-nota" hidden></p></div>
    <aside class="xpace-rail xpace-rail-right" data-xpace-panel="right" aria-label="${t('Avanzado','Advanced')}"><div class="xpace-rail-body"></div></aside>
  </div>
  <form class="xpace-cli" data-xpace-panel="bottom" aria-label="${t('Modo experto','Expert mode')}">
    <label>⌘ <input name="cmd" aria-label="${t('Comando','Command')}" autocomplete="off" spellcheck="false"></label>
    <button type="submit">Enter</button>
    <pre class="xpace-cli-log" role="log"></pre>
  </form>`;
}

function safeStorage(storage) {
  if (storage) return storage;
  try { if (globalThis.localStorage) return globalThis.localStorage; } catch { /* privado */ }
  const mem = new Map();
  return {getItem:key => mem.has(key) ? mem.get(key) : null, setItem:(key,value) => mem.set(key, String(value))};
}

export function bindChrome(host, {storage, en=false}={}) {
  const store = safeStorage(storage);
  const ui = loadUi(store);
  let api = null;
  function write(name, open) {
    try { store.setItem(UI_KEYS[name], open ? '1' : '0'); } catch { /* la vista sigue */ }
  }
  function panel(name) { return host.querySelector(`[data-xpace-panel="${name}"]`); }
  function toggle(name) { return host.querySelector(`[data-xpace-toggle="${name}"]`); }
  function paint(name, open) {
    panel(name)?.classList.toggle('is-open', open);
    const button = toggle(name);
    if (!button) return;
    button.classList.toggle('is-active', open);
    if (name === 'bottom') button.setAttribute('aria-pressed', String(open));
    else button.setAttribute('aria-expanded', String(open));
  }
  function setOpen(name, open) { paint(name, open); write(name, open); }
  function setNivel(id) {
    const level = LEVELS.find(item => item.id === id) || LEVELS[1];
    try { store.setItem(UI_KEYS.nivel, level.id); } catch { /* sigue el botón */ }
    for (const button of host.querySelectorAll('[data-nivel]')) {
      const on = button.dataset.nivel === level.id;
      button.setAttribute('aria-pressed', String(on));
      button.classList.toggle('is-active', on);
    }
    const note = host.querySelector('.xpace-nivel-nota');
    if (note) { note.hidden = level.ready; note.textContent = levelNote(level.id, en); }
    return levelNote(level.id, en) || `nivel ${level.id}`;
  }
  paint('left', ui.left); paint('right', ui.right); paint('bottom', ui.bottom); setNivel(ui.nivel);
  for (const name of ['left','right','bottom']) {
    toggle(name)?.addEventListener('click', () => setOpen(name, !panel(name).classList.contains('is-open')));
  }
  for (const button of host.querySelectorAll('[data-nivel]')) {
    button.addEventListener('click', () => setNivel(button.dataset.nivel));
  }
  host.querySelector('.xpace-cli')?.addEventListener('submit', event => {
    event.preventDefault();
    const input = event.currentTarget.querySelector('input');
    const line = input.value;
    input.value = '';
    const log = host.querySelector('.xpace-cli-log');
    const answer = api ? executeCommand(line, api, en) : (en ? 'still loading' : 'aún cargando');
    if (log) log.textContent = (log.textContent ? log.textContent + '\n' : '') + '> ' + line + '\n' + answer;
  });
  function click(selector) { host.querySelector(selector)?.click(); }
  const chrome = {
    open(name) { setOpen(name, true); },
    setNivel,
    attach(next) {
      api = {
        ver: id => next.inventory?.view?.(id),
        ficha: id => { setOpen('right', true); next.inventory?.select?.(id); },
        vista: preset => click(`[data-preset="${preset}"]`),
        luz: light => click(`[data-light="${light}"]`),
        zoom: dir => click(`[data-zoom="${dir === '+' ? '1.25' : '0.8'}"]`),
        mostrar: (token, visible) => next.inventory?.showToken?.(token, visible) || 0,
        todo: () => click('.xpace-inventory [data-all="yes"]'),
        nada: () => click('.xpace-inventory [data-all="no"]'),
        export: fmt => click(`.xpace-inventory [data-export="${fmt}"]`),
        enlace: () => click('.xpace-inventory [data-share]'),
        estado: () => {
          const count = host.querySelector('.xpace-top .xpace-count')?.textContent || '';
          const selected = next.inventory?.state?.().selected;
          return [count, selected ? `ficha ${selected}` : ''].filter(Boolean).join(' · ') || (en ? 'no status' : 'sin estado');
        },
        nivel: setNivel,
      };
      for (const button of host.querySelectorAll('.xpace-rail-left [data-all]')) {
        button.addEventListener('click', () => click(`.xpace-inventory [data-all="${button.dataset.all}"]`));
      }
      const box = host.querySelector('.xpace-filters');
      if (box) {
        box.replaceChildren();
        for (const input of host.querySelectorAll('.xpace-category input')) {
          const filter = document.createElement('button');
          filter.type = 'button';
          filter.textContent = input.parentElement.textContent.replace(/\s+/g,' ').trim();
          filter.setAttribute('aria-pressed', String(input.checked));
          filter.addEventListener('click', () => input.click());
          input.addEventListener('change', () => filter.setAttribute('aria-pressed', String(input.checked)));
          box.append(filter);
        }
      }
    },
  };
  host.xpaceChrome = chrome;
  host.classList.add('xpace-ui');
  return chrome;
}
