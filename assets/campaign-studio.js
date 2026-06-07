(function () {
  var WORKER = 'https://pixer-eleven.csilvasantin.workers.dev';
  var STOCK_PUBLISH_URL = WORKER + '/stock/publish';
  var ADMIRA_BUY_URL = 'https://admira.app/';
  var $ = function (s) { return document.querySelector(s); };
  var params = new URLSearchParams(location.search);
  var state = {
    allStores: [],
    stores: [],
    store: null,
    screens: [],
    screen: null,
    date: '',
    campaign: null,
    filters: { circuit: 'all', locality: 'all' },
  };

  function slug(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  function todayMadrid() {
    var p = {};
    new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()).forEach(function (x) { p[x.type] = x.value; });
    return p.year + '-' + p.month + '-' + p.day;
  }

  function isScreen(sf) {
    return ['pantalla', 'escaparate', 'vending', 'mostrador'].indexOf(sf.surface) >= 0;
  }

  function screensOf(store) {
    return (store && Array.isArray(store.surfaces) ? store.surfaces : []).filter(isScreen).map(function (sf) {
      var surface = String(sf.surface || 'pantalla');
      return {
        id: slug(store.id) + '-' + slug(sf.name),
        name: sf.name + ' · ' + surface,
        rawName: sf.name,
        surface: surface,
        pixerScreens: Array.isArray(sf.pixerScreens) ? sf.pixerScreens : [],
      };
    });
  }

  function cityOf(store) {
    var explicit = store && (store.city || store.locality || store.municipality || store.town || (store.external && (store.external.city || store.external.locality)));
    if (explicit) return String(explicit).trim();
    var parts = String(store && store.addr || '').split('·').map(function (p) { return p.trim(); }).filter(Boolean);
    for (var i = 1; i < parts.length; i++) {
      var part = parts[i].replace(/\b\d{4,5}\b/g, '').replace(/\s+/g, ' ').trim();
      if (part && !/^(spain|espana|españa)$/i.test(part)) return part;
    }
    return 'Sin localidad';
  }

  function circuitOf(store) {
    var explicit = store && (store.circuit || store.network || store.brand || (store.external && store.external.brand));
    if (explicit) return String(explicit).trim();
    var name = String(store && store.name || '');
    if (/desigual/i.test(name)) return 'Desigual';
    if (/xtanco/i.test(name)) return 'Xtanco';
    if (/admira/i.test(name)) return 'Admira';
    if (/super|súper/i.test(name)) return 'Supermercados';
    var kind = String(store && store.kind || '').split('·')[0].trim();
    return kind || 'Otros';
  }

  function uniqueSorted(values) {
    return Array.from(new Set(values.filter(Boolean))).sort(function (a, b) { return a.localeCompare(b, 'es'); });
  }

  function filteredStores() {
    return state.allStores.filter(function (store) {
      return (state.filters.circuit === 'all' || circuitOf(store) === state.filters.circuit)
        && (state.filters.locality === 'all' || cityOf(store) === state.filters.locality);
    });
  }

  function setOptions(sel, options, preferred) {
    if (!sel) return;
    sel.innerHTML = '';
    options.forEach(function (item) {
      var o = document.createElement('option');
      o.value = item.value;
      o.textContent = item.label;
      sel.appendChild(o);
    });
    if (options.some(function (item) { return item.value === preferred; })) sel.value = preferred;
    else if (options.length) sel.value = options[0].value;
  }

  function renderCircuitOptions() {
    var circuits = uniqueSorted(state.allStores.map(circuitOf));
    var options = [{ value: 'all', label: 'Todos los circuitos' }].concat(circuits.map(function (name) {
      var count = state.allStores.filter(function (store) { return circuitOf(store) === name; }).length;
      return { value: name, label: name + ' · ' + count + ' puntos' };
    }));
    setOptions($('#circuitSel'), options, state.filters.circuit);
    state.filters.circuit = ($('#circuitSel') && $('#circuitSel').value) || 'all';
  }

  function renderLocalityOptions() {
    var base = state.allStores.filter(function (store) {
      return state.filters.circuit === 'all' || circuitOf(store) === state.filters.circuit;
    });
    var localities = uniqueSorted(base.map(cityOf));
    var options = [{ value: 'all', label: 'Todas las localidades' }].concat(localities.map(function (name) {
      var count = base.filter(function (store) { return cityOf(store) === name; }).length;
      return { value: name, label: name + ' · ' + count + ' puntos' };
    }));
    setOptions($('#localitySel'), options, state.filters.locality);
    state.filters.locality = ($('#localitySel') && $('#localitySel').value) || 'all';
  }

  function renderPointOptions(preferredStoreId) {
    state.stores = filteredStores();
    var options = state.stores.map(function (store) {
      return { value: store.id, label: store.name + ' · ' + cityOf(store) };
    });
    var fallback = state.stores.find(function (store) { return store.id === 'xtanco'; });
    setOptions($('#pointSel'), options, preferredStoreId || (fallback && fallback.id) || (state.stores[0] && state.stores[0].id));
    if ($('#pointSel')) $('#pointSel').disabled = !options.length;
    return ($('#pointSel') && $('#pointSel').value) || '';
  }

  async function loadCachedLocations() {
    try {
      var r = await fetch('/calendario/locations-cache.json', { cache: 'no-store' });
      if (!r.ok) return [];
      var data = await r.json();
      return Array.isArray(data) ? data : (data && data.locations) || [];
    } catch (e) {
      return [];
    }
  }

  async function loadStores() {
    var list = await loadCachedLocations();
    try {
      if (!list.length && window.loadOmnipLocationsAsync) {
        var r = await window.loadOmnipLocationsAsync();
        list = Array.isArray(r) ? r : (r && r.locations) || [];
      }
    } catch (e) {}
    if (!list.length && window.loadOmnipLocations) {
      try { list = window.loadOmnipLocations(); } catch (e) {}
    }
    if (!list.length) list = window.OMNIP_LOCATIONS_DEFAULT || [];
    state.allStores = list.filter(function (s) { return Array.isArray(s.surfaces) && s.surfaces.some(isScreen); });
  }

  function selectStore(id, preferredScreenId) {
    state.store = state.stores.find(function (s) { return s.id === id; }) || state.stores[0];
    state.screens = state.store ? screensOf(state.store) : [];
    var sel = $('#screenSel');
    if (sel) {
      sel.innerHTML = '';
      state.screens.forEach(function (sc) {
        var o = document.createElement('option');
        o.value = sc.id;
        o.textContent = sc.name;
        sel.appendChild(o);
      });
      sel.disabled = !state.screens.length;
      if (state.screens.some(function (s) { return s.id === preferredScreenId; })) sel.value = preferredScreenId;
    }
    selectScreen((sel && sel.value) || (state.screens[0] && state.screens[0].id));
  }

  function selectScreen(id) {
    state.screen = state.screens.find(function (s) { return s.id === id; }) || state.screens[0];
    resetCampaignPreview();
    updateCampaignContext();
    updateSelectionSummary();
  }

  function updateFromFilters(preferredStoreId, preferredScreenId) {
    renderCircuitOptions();
    renderLocalityOptions();
    var storeId = renderPointOptions(preferredStoreId);
    selectStore(storeId, preferredScreenId);
  }

  function applyInitialSelection() {
    state.date = params.get('date') || todayMadrid();
    if ($('#dateInp')) $('#dateInp').value = state.date;
    var preferredLoc = params.get('locationId') || params.get('pointId') || '';
    var preferredScreen = params.get('screenId') || '';
    var loc = preferredLoc ? state.allStores.find(function (store) { return store.id === preferredLoc; }) : null;
    if (loc) {
      state.filters.circuit = circuitOf(loc);
      state.filters.locality = cityOf(loc);
      updateFromFilters(loc.id, preferredScreen);
    } else {
      updateFromFilters('xtanco', preferredScreen);
    }
    var brand = $('#campaignBrand');
    var name = $('#campaignName');
    var msg = $('#campaignMessage');
    var tone = $('#campaignTone');
    if (brand && params.get('brand')) brand.value = params.get('brand');
    if (name && params.get('campaign')) {
      name.value = params.get('campaign');
      name.dataset.touched = '1';
    }
    if (msg && params.get('message')) {
      msg.value = params.get('message');
      msg.dataset.touched = '1';
    }
    if (tone && params.get('tone')) tone.value = params.get('tone');
    updateCampaignContext();
  }

  function escHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }

  function selectedCampaignContext() {
    return {
      store: state.store,
      screen: state.screen,
      city: state.store ? cityOf(state.store) : '',
      circuit: state.store ? circuitOf(state.store) : '',
      date: state.date || todayMadrid(),
    };
  }

  function isVerticalScreen(screen) {
    var text = String((screen && (screen.name + ' ' + screen.rawName + ' ' + screen.surface)) || '').toLowerCase();
    return /vertical|vending|1080×1920|1080x1920|reels|story/.test(text);
  }

  function defaultCampaignName() {
    return state.store ? 'Campaña ' + state.store.name : 'Campaña Pixeria';
  }

  function defaultCampaignMessage() {
    if (!state.store) return 'Nuevo lanzamiento disponible hoy';
    return 'Contenido contextual para ' + state.store.name + ' en ' + cityOf(state.store);
  }

  function resetCampaignPreview(text) {
    state.campaign = null;
    var img = $('#campaignPreviewImg');
    var empty = $('#campaignPreviewEmpty');
    var buy = $('#campaignBuy');
    if (img) {
      img.hidden = true;
      img.removeAttribute('src');
    }
    if (empty) {
      empty.hidden = false;
      empty.textContent = text || 'Genera el previo para esta selección.';
    }
    if (buy) buy.disabled = true;
  }

  function updateSelectionSummary() {
    var el = $('#campaignSelectionSummary');
    if (!el || !state.store || !state.screen) return;
    el.innerHTML = '<strong>' + escHtml(state.store.name) + '</strong> · ' + escHtml(cityOf(state.store)) + ' · ' + escHtml(state.screen.name) + ' · ' + escHtml(state.date || todayMadrid());
  }

  function updateCampaignContext() {
    var ctx = selectedCampaignContext();
    var box = $('#campaignContext');
    if (box) {
      box.innerHTML = [
        ctx.store && ctx.store.name,
        ctx.city,
        ctx.screen && ctx.screen.name,
        ctx.date,
      ].filter(Boolean).map(function (item) { return '<span>' + escHtml(item) + '</span>'; }).join('');
    }
    var name = $('#campaignName');
    if (name && (!name.dataset.touched || !name.value.trim())) {
      name.value = defaultCampaignName();
      name.dataset.autofill = '1';
    }
    var msg = $('#campaignMessage');
    if (msg && (!msg.dataset.touched || !msg.value.trim())) {
      msg.value = defaultCampaignMessage();
      msg.dataset.autofill = '1';
    }
    var frame = $('#campaignPreviewFrame');
    if (frame) frame.classList.toggle('is-vertical', isVerticalScreen(ctx.screen));
    updateSelectionSummary();
  }

  function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
    var words = String(text || '').split(/\s+/).filter(Boolean);
    var line = '';
    var lines = [];
    words.forEach(function (word) {
      var test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    });
    if (line) lines.push(line);
    lines.slice(0, maxLines).forEach(function (l, idx) {
      var out = idx === maxLines - 1 && lines.length > maxLines ? l.replace(/\s+\S+$/, '') + '...' : l;
      ctx.fillText(out, x, y + idx * lineHeight);
    });
    return Math.min(lines.length, maxLines) * lineHeight;
  }

  function generateCampaignCreative() {
    var ctx = selectedCampaignContext();
    if (!ctx.store || !ctx.screen) return null;
    var vertical = isVerticalScreen(ctx.screen);
    var canvas = document.createElement('canvas');
    canvas.width = vertical ? 1080 : 1920;
    canvas.height = vertical ? 1920 : 1080;
    var c = canvas.getContext('2d');
    var brand = ($('#campaignBrand') && $('#campaignBrand').value.trim()) || 'Pixeria';
    var campaign = ($('#campaignName') && $('#campaignName').value.trim()) || defaultCampaignName();
    var message = ($('#campaignMessage') && $('#campaignMessage').value.trim()) || defaultCampaignMessage();
    var tone = ($('#campaignTone') && $('#campaignTone').value) || 'premium';
    var palettes = {
      premium: ['#071018', '#68dce9', '#f4f0e8'],
      oferta: ['#190f0b', '#ff6b5c', '#f1c96a'],
      evento: ['#101022', '#a78bfa', '#68dce9'],
      informativo: ['#0c1711', '#6bd6a6', '#f4f0e8'],
    };
    var pal = palettes[tone] || palettes.premium;
    var g = c.createLinearGradient(0, 0, canvas.width, canvas.height);
    g.addColorStop(0, pal[0]);
    g.addColorStop(0.58, '#0b1117');
    g.addColorStop(1, pal[1]);
    c.fillStyle = g;
    c.fillRect(0, 0, canvas.width, canvas.height);
    c.save();
    c.globalAlpha = 0.16;
    c.strokeStyle = pal[1];
    c.lineWidth = vertical ? 3 : 4;
    for (var i = 0; i < 9; i++) {
      c.beginPath();
      c.moveTo(canvas.width * (0.54 + i * 0.06), canvas.height * 0.08);
      c.lineTo(canvas.width * (0.88 + i * 0.06), canvas.height * 0.92);
      c.stroke();
    }
    c.restore();
    c.fillStyle = 'rgba(244,240,232,0.08)';
    for (var j = 0; j < 5; j++) c.fillRect(canvas.width * (0.58 + j * 0.07), canvas.height * (0.16 + j * 0.12), canvas.width * 0.18, vertical ? 18 : 22);
    var pad = vertical ? 92 : 118;
    c.fillStyle = pal[1];
    c.fillRect(pad, pad, vertical ? 92 : 120, 10);
    c.fillStyle = pal[2];
    c.font = '700 ' + (vertical ? 54 : 68) + 'px Inter, system-ui, sans-serif';
    c.fillText(brand.toUpperCase(), pad, vertical ? 230 : 260);
    c.font = '800 ' + (vertical ? 92 : 124) + 'px Inter, system-ui, sans-serif';
    wrapCanvasText(c, campaign, pad, vertical ? 390 : 430, canvas.width - pad * 2, vertical ? 106 : 138, vertical ? 4 : 3);
    c.font = '500 ' + (vertical ? 48 : 58) + 'px Inter, system-ui, sans-serif';
    c.fillStyle = 'rgba(244,240,232,0.88)';
    wrapCanvasText(c, message, pad, vertical ? 860 : 710, canvas.width - pad * 2, vertical ? 62 : 74, vertical ? 5 : 3);
    c.fillStyle = 'rgba(11,17,23,0.72)';
    c.fillRect(pad, canvas.height - (vertical ? 250 : 190), canvas.width - pad * 2, vertical ? 132 : 92);
    c.fillStyle = pal[1];
    c.font = '700 ' + (vertical ? 30 : 34) + 'px ui-monospace, SFMono-Regular, Menlo, monospace';
    c.fillText((ctx.screen.rawName || ctx.screen.name).toUpperCase().slice(0, 42), pad + 34, canvas.height - (vertical ? 168 : 132));
    c.fillStyle = 'rgba(244,240,232,0.72)';
    c.font = '500 ' + (vertical ? 28 : 32) + 'px Inter, system-ui, sans-serif';
    c.fillText((ctx.store.name + ' · ' + ctx.city).slice(0, 58), pad + 34, canvas.height - (vertical ? 114 : 80));
    var dataUrl = canvas.toDataURL('image/png');
    state.campaign = {
      dataUrl: dataUrl,
      brand: brand,
      campaign: campaign,
      message: message,
      tone: tone,
      assetType: 'image',
      prompt: message + ' · ' + ctx.store.name + ' · ' + ctx.screen.name,
    };
    var img = $('#campaignPreviewImg');
    var empty = $('#campaignPreviewEmpty');
    if (img) {
      img.src = dataUrl;
      img.hidden = false;
    }
    if (empty) empty.hidden = true;
    var buy = $('#campaignBuy');
    if (buy) buy.disabled = false;
    return state.campaign;
  }

  function campaignTargetPayload() {
    var surface = String(state.screen && state.screen.surface || '').toLowerCase();
    return {
      placements: surface === 'escaparate' ? ['exterior'] : ['interior'],
      genders: ['hombre', 'mujer'],
      ages: ['adulto'],
      timeSlots: ['manana', 'mediodia', 'tarde'],
      locationId: state.store && state.store.id,
      screenId: state.screen && state.screen.id,
      pointName: state.store && state.store.name,
      screenName: state.screen && state.screen.name,
      date: state.date,
    };
  }

  async function publishCampaignCreative() {
    if (!state.campaign) generateCampaignCreative();
    if (!state.campaign || !state.campaign.dataUrl) return '';
    var comma = state.campaign.dataUrl.indexOf(',');
    var btn = $('#campaignBuy');
    var old = btn && btn.textContent;
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Preparando...';
    }
    try {
      var payload = {
        type: 'image',
        motor: 'Pixeria Campaign Studio',
        prompt: state.campaign.prompt,
        title: state.campaign.campaign,
        comment: 'Creatividad creada desde Crear campaña para ' + (state.store && state.store.name || ''),
        tags: ['pixeria', 'crear-campana', 'admira', 'xpaceos'],
        costEst: 0.02,
        mime: 'image/png',
        base64: state.campaign.dataUrl.substring(comma + 1),
        thumbnail: state.campaign.dataUrl,
      };
      var r = await fetch(STOCK_PUBLISH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      var data = await r.json().catch(function () { return {}; });
      if (r.ok && data.url) return data.url;
      throw new Error(data.error || r.statusText || 'stock-publish-failed');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = old || 'Comprar en Admira';
      }
    }
  }

  async function buyCampaignInAdmira() {
    try {
      if (!state.campaign) generateCampaignCreative();
      var assetUrl = await publishCampaignCreative();
      var draft = {
        id: 'PX-CAM-' + Date.now(),
        brand: state.campaign.brand,
        campaign: state.campaign.campaign,
        assetUrl: assetUrl,
        assetType: 'image',
        prompt: state.campaign.prompt,
        target: campaignTargetPayload(),
        locationId: state.store && state.store.id,
        screenId: state.screen && state.screen.id,
        pointName: state.store && state.store.name,
        screenName: state.screen && state.screen.name,
      };
      try { localStorage.setItem('pixeria-campaign-draft', JSON.stringify(draft)); } catch (_) {}
      var url = new URL(ADMIRA_BUY_URL);
      url.searchParams.set('draft', 'pixeria');
      url.searchParams.set('campaignId', draft.id);
      url.searchParams.set('brand', draft.brand);
      url.searchParams.set('campaign', draft.campaign);
      url.searchParams.set('assetUrl', draft.assetUrl);
      url.searchParams.set('assetType', draft.assetType);
      url.searchParams.set('prompt', draft.prompt);
      url.searchParams.set('target', JSON.stringify(draft.target));
      url.searchParams.set('locationId', draft.locationId || '');
      url.searchParams.set('screenId', draft.screenId || '');
      url.searchParams.set('pointName', draft.pointName || '');
      url.searchParams.set('screenName', draft.screenName || '');
      window.open(url.toString(), '_blank', 'noopener');
    } catch (err) {
      alert('No se pudo preparar la campaña para Admira: ' + err.message);
    }
  }

  function bindCampaignCreator() {
    ['campaignBrand', 'campaignName', 'campaignMessage'].forEach(function (id) {
      var el = $('#' + id);
      if (el) el.addEventListener('input', function () {
        el.dataset.touched = '1';
        resetCampaignPreview('Genera de nuevo para ver tus cambios.');
      });
    });
    var tone = $('#campaignTone');
    if (tone) tone.addEventListener('change', function () {
      resetCampaignPreview('Genera de nuevo para ver este estilo.');
    });
    if ($('#campaignGenerate')) $('#campaignGenerate').addEventListener('click', generateCampaignCreative);
    if ($('#campaignBuy')) $('#campaignBuy').addEventListener('click', buyCampaignInAdmira);
  }

  function bindSelectors() {
    if ($('#circuitSel')) $('#circuitSel').onchange = function (e) {
      state.filters.circuit = e.target.value || 'all';
      state.filters.locality = 'all';
      updateFromFilters();
    };
    if ($('#localitySel')) $('#localitySel').onchange = function (e) {
      state.filters.locality = e.target.value || 'all';
      updateFromFilters();
    };
    if ($('#pointSel')) $('#pointSel').onchange = function (e) { selectStore(e.target.value); };
    if ($('#screenSel')) $('#screenSel').onchange = function (e) { selectScreen(e.target.value); };
    if ($('#dateInp')) $('#dateInp').onchange = function (e) {
      state.date = e.target.value || todayMadrid();
      resetCampaignPreview();
      updateCampaignContext();
    };
  }

  function init() {
    loadStores().then(function () {
      bindSelectors();
      bindCampaignCreator();
      applyInitialSelection();
    });
  }

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
