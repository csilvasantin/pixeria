import * as T from './engine/premium-three.mjs';
import {CAFE_ASSETS, EMISION, signageURL, pickFeedItem, bedVolume} from './emision-map.mjs?v=emision-4742';

export function serves(id) {
  return CAFE_ASSETS.has(id);
}

const VERTICAL = new Set(['PANTALLA_pizarra-2']);

function materialsNamed(root, name) {
  const found = [];
  root.traverse(node => {
    for (const material of [node.material].flat()) if (material?.name === name) found.push(material);
  });
  return found;
}

function paintStamp(ctx, width) {
  ctx.fillStyle = '#ffd766';
  ctx.fillRect(0, 0, width, 64);
  ctx.fillStyle = '#14221c';
  ctx.font = '700 32px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('EN ANTENA', 20, 32);
}

function createTexture(root, materialName) {
  const canvas = document.createElement('canvas');
  if (VERTICAL.has(materialName)) { canvas.width = 720; canvas.height = 1280; }
  else { canvas.width = 1280; canvas.height = 720; }
  const ctx = canvas.getContext('2d');
  const tex = new T.CanvasTexture(canvas);
  tex.flipY = false;
  if ('colorSpace' in tex && T.SRGBColorSpace) tex.colorSpace = T.SRGBColorSpace;
  const materials = materialsNamed(root, materialName);
  for (const material of materials) {
    material.map = tex;
    material.emissiveMap = tex;
    material.needsUpdate = true;
  }
  function draw(video, onAir, title) {
    const w = canvas.width, h = canvas.height;
    ctx.fillStyle = '#14221c';
    ctx.fillRect(0, 0, w, h);
    if (video && video.readyState >= 2 && video.videoWidth) {
      const scale = Math.max(w / video.videoWidth, h / video.videoHeight);
      const dw = video.videoWidth * scale, dh = video.videoHeight * scale;
      ctx.drawImage(video, (w - dw) / 2, (h - dh) / 2, dw, dh);
    } else if (title) {
      ctx.fillStyle = '#f3efe2';
      ctx.font = '600 42px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(title, w / 2, h / 2);
    }
    if (onAir) paintStamp(ctx, w);
    tex.needsUpdate = true;
  }
  return {materials, draw, dispose() { tex.dispose(); }};
}

function media(tag) {
  const el = document.createElement(tag);
  el.crossOrigin = 'anonymous';
  el.loop = true;
  el.playsInline = true;
  return el;
}

export function mountEmision({host, root, stage, signal}) {
  const current = new Map();
  const screens = {};
  const state = {screens, heartbeat:[], bed:1, tier:'better', census:''};
  let frame = 0, timer = 0, stopped = false;
  const on = new AbortController();
  signal?.addEventListener('abort', () => dispose(), {once:true});

  for (const row of EMISION) {
    screens[row.id] = {id:row.id, kind:row.kind, material:row.material, onAir:false, title:'', materialFound:false, itemId:null};
  }

  const videos = new Map();
  for (const row of EMISION.filter(item => item.kind === 'video')) {
    const video = media('video');
    video.muted = true;
    const texture = createTexture(root, row.material);
    screens[row.id].materialFound = texture.materials.length > 0;
    videos.set(row.id, {video, texture, row});
  }

  const hilo = media('audio');
  hilo.volume = 1;
  host.append(hilo);

  const teleBox = document.createElement('aside');
  teleBox.hidden = true;
  teleBox.setAttribute('aria-label', 'Tele de la Cafebrería');
  teleBox.style.cssText = 'position:absolute;z-index:4;right:12px;bottom:12px;width:min(280px,40%);background:#0d1a16;color:#f3f5e7;border:1px solid #ffd766;border-radius:10px;padding:8px;font:13px/1.3 ui-sans-serif,system-ui';
  const teleNote = document.createElement('p');
  teleNote.style.margin = '0 0 6px';
  teleNote.textContent = 'Tele · no hay malla PANTALLA en el GLB';
  const teleVideo = media('video');
  teleVideo.muted = false;
  teleVideo.style.cssText = 'display:block;width:100%;background:#000;border-radius:6px';
  const teleStamp = document.createElement('b');
  teleStamp.textContent = 'EN ANTENA';
  teleStamp.style.cssText = 'display:inline-block;margin-top:6px;background:#ffd766;color:#14221c;padding:2px 6px';
  teleBox.append(teleNote, teleVideo, teleStamp);
  stage.append(teleBox);

  const tierNote = document.createElement('p');
  tierNote.hidden = true;
  tierNote.style.cssText = 'position:absolute;z-index:3;left:12px;top:12px;margin:0;padding:6px 8px;background:#142522;color:#ffd766;border:1px solid #ffd766;border-radius:6px;font:600 12px/1.3 ui-sans-serif,system-ui';
  stage.append(tierNote);

  function publish() {
    const onAir = EMISION.filter(row => screens[row.id].onAir).map(row => row.id);
    host.dataset.onair = onAir.join(',');
    host.dataset.bed = String(state.bed);
  }

  function show(row, item) {
    const slot = screens[row.id];
    slot.itemId = item?.id || null;
    slot.title = item?.title || '';
    slot.onAir = false;
    if (row.kind === 'video') {
      const rt = videos.get(row.id);
      if (!item) {
        rt.video.pause();
        rt.video.removeAttribute('src');
        rt.texture.draw(null, false, '');
        return;
      }
      if (rt.video.src !== item.src) rt.video.src = item.src;
      rt.video.play().catch(() => {});
      rt.texture.draw(rt.video, false, item.title || '');
    } else if (row.kind === 'audio') {
      if (!item) { hilo.pause(); hilo.removeAttribute('src'); return; }
      if (hilo.src !== item.src) hilo.src = item.src;
      hilo.play().then(() => { slot.onAir = true; publish(); }).catch(() => {});
    } else {
      teleBox.hidden = !item;
      if (!item) { teleVideo.pause(); teleVideo.removeAttribute('src'); return; }
      if (teleVideo.src !== item.src) teleVideo.src = item.src;
      teleVideo.play().then(() => { slot.onAir = true; publish(); }).catch(() => { slot.onAir = false; publish(); });
    }
  }

  function drawLoop() {
    if (stopped) return;
    let busy = false;
    for (const [id, rt] of videos) {
      const item = current.get(id);
      if (!item) continue;
      busy = true;
      const ready = rt.video.readyState >= 2 && rt.video.videoWidth > 0;
      screens[id].onAir = ready;
      rt.texture.draw(rt.video, ready, item.title || '');
    }
    publish();
    frame = busy ? requestAnimationFrame(drawLoop) : 0;
  }

  function kick() {
    if (!frame) frame = requestAnimationFrame(drawLoop);
  }

  async function poll() {
    if (stopped) return state;
    await Promise.all(EMISION.map(async row => {
      try {
        const res = await fetch(signageURL('feed?screen=' + encodeURIComponent(row.id) + '&limit=8'), {cache:'no-store', signal:on.signal});
        const payload = await res.json();
        const item = pickFeedItem(payload, row.id);
        const prev = current.get(row.id) || null;
        current.set(row.id, item);
        if ((prev?.id || null) !== (item?.id || null) || (prev?.src || '') !== (item?.src || '')) show(row, item);
      } catch {
        /* el siguiente ciclo reintenta; un fallo de red no tira el visor */
      }
    }));
    const byId = Object.fromEntries([...current.entries()]);
    state.bed = bedVolume(byId);
    hilo.volume = state.bed;
    kick();
    publish();
    return state;
  }

  let pending = null;
  function refresh() {
    if (pending) return pending;
    pending = poll().finally(() => { pending = null; });
    return pending;
  }

  async function announce() {
    const rows = [];
    for (const row of EMISION) {
      try {
        const res = await fetch(signageURL('heartbeat'), {
          method:'POST',
          headers:{'content-type':'application/json'},
          body: JSON.stringify({screen:row.id, role:'demo-cafebreria', version:'4742'}),
          signal: on.signal,
        });
        const body = await res.json().catch(() => ({}));
        rows.push({id:row.id, status:res.status, error:body.error || ''});
      } catch (error) {
        rows.push({id:row.id, status:0, error:String(error.message || error)});
      }
    }
    state.heartbeat = rows;
    const rejected = rows.length > 0 && rows.every(row => row.status === 400);
    state.census = rejected
      ? 'El censo exige screen-, xtore- o signage-. Estos ids fijos se quedan en el feed; el alta del censo responde 400.'
      : rows.map(row => row.id + ' ' + row.status).join(' · ');
    publish();
  }

  function setTier(viewer, tier) {
    const applied = viewer?.setDetail?.(tier) || (tier === 'good' || tier === 'best' ? tier : 'better');
    state.tier = applied;
    const labels = {
      good: 'Good · el mismo modelo, menos píxeles',
      better: 'Better · visor de producción',
      best: 'Best · el mismo modelo, más píxeles. No hay otro GLB.',
    };
    tierNote.hidden = applied === 'better';
    tierNote.textContent = labels[applied] || applied;
    host.dataset.tier = applied;
    return applied;
  }

  function arm() {
    hilo.play().catch(() => {});
    teleVideo.play().catch(() => {});
  }

  function dispose() {
    if (stopped) return;
    stopped = true;
    on.abort();
    cancelAnimationFrame(frame);
    clearInterval(timer);
    for (const rt of videos.values()) { rt.video.pause(); rt.texture.dispose(); }
    hilo.pause();
    teleVideo.pause();
    teleBox.remove();
    tierNote.remove();
    hilo.remove();
  }

  host.dataset.emision = '1';
  timer = setInterval(() => refresh(), 2000);
  refresh();
  announce();
  return {dispose, refresh, state:() => state, setTier, arm};
}
