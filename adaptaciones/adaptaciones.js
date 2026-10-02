// Pixeria · Adaptaciones (FLT-101349, 2-oct-2026): un vídeo → todas las pantallas.
// Render en vivo en canvas; las reglas son las del motor de signage de Pixeria.
// Reutiliza el motor de reglas real de Pixeria: assets/signage-perfiles.js
import { perfilDeSalida, planificar } from '/assets/signage-perfiles.js';

const $ = (s) => document.querySelector(s);
const FORMATOS = [
  { id: '9:16', nombre: 'Vertical 9:16', uso: 'tótem / escaparate', on: true },
  { id: '16:9', nombre: 'Horizontal 16:9', uso: 'mostrador / LED', on: true },
  { id: '1:1', nombre: 'Cuadrado 1:1', uso: 'pantalla cuadrada / redes', on: true },
  { id: '4:5', nombre: 'Retrato 4:5', uso: 'feed / mupi pequeño', on: true, custom: [1080, 1350] },
];
const MODOS = { auto: 'Auto (regla Pixeria)', cover: 'Recortar (llenar)', blur: 'Encajar + fondo desenfocado', contain: 'Encajar + negro' };
const state = { compat: 'fhd', modoGlobal: 'auto', fmt: {}, src: { ancho: 0, alto: 0, fps: 25, bitrateKbps: 0 }, srcName: '', isJti: true };
FORMATOS.forEach((f) => (state.fmt[f.id] = { modo: 'auto', fx: 0.5, fy: 0.5, zoom: 1 }));

const video = $('#src');
const cli = { log(t) { try { console.debug('[adaptaciones]', t); } catch (e) {} } };

// ── Perfil + plan (motor Pixeria) ───────────────────────────────────────────
function perfil(f) {
  return f.custom
    ? perfilDeSalida({ formato: 'custom', ancho: f.custom[0], alto: f.custom[1], compatibilidad: state.compat })
    : perfilDeSalida({ formato: f.id, compatibilidad: state.compat });
}
function plan(f) {
  if (!state.src.ancho) return null;
  try { return planificar(state.src, perfil(f)); } catch (e) { return { error: e.message }; }
}
function modoEfectivo(f) {
  const m = state.fmt[f.id].modo !== 'auto' ? state.fmt[f.id].modo : state.modoGlobal;
  if (m !== 'auto') return m;
  const p = plan(f); if (!p || p.error) return 'blur';
  // 'expandir' (laterales generativos con IA) existe en el motor, pero esta página
  // NO se usa IA de pago: se sustituye por fondo desenfocado del propio vídeo.
  return (p.encaje === 'recortar' || p.encaje === 'exacto') ? 'cover' : 'blur';
}

// ── Tarjetas de formato ─────────────────────────────────────────────────────
function buildGrid() {
  const g = $('#grid'); g.innerHTML = '';
  $('#fmt-checks').innerHTML = FORMATOS.map((f) => `<label style="display:block"><input type="checkbox" data-f="${f.id}" ${f.on ? 'checked' : ''}> ${f.nombre}</label>`).join('');
  FORMATOS.filter((f) => f.on).forEach((f) => {
    const p = perfil(f); const cw = p.ancho >= p.alto ? 384 : Math.round(384 * p.ancho / p.alto); const ch = Math.round(cw * p.alto / p.ancho);
    const el = document.createElement('div'); el.className = 'fmt'; el.dataset.f = f.id;
    el.innerHTML = `<h3>${f.nombre}</h3><div class="dims">${p.ancho}×${p.alto} · ${f.uso}</div>
      <div class="stage"><canvas width="${cw}" height="${ch}"></canvas></div>
      <div class="ctl"><span>Encaje</span><select data-k="modo">${Object.entries(MODOS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
      <span>Foco X</span><input type="range" data-k="fx" min="0" max="1" step="0.01" value="0.5">
      <span>Foco Y</span><input type="range" data-k="fy" min="0" max="1" step="0.01" value="0.5">
      <span>Zoom</span><input type="range" data-k="zoom" min="1" max="2" step="0.01" value="1"></div>
      <div class="aviso"></div>`;
    el.querySelectorAll('[data-k]').forEach((inp) => { inp.value = state.fmt[f.id][inp.dataset.k]; inp.oninput = () => { const k = inp.dataset.k; state.fmt[f.id][k] = k === 'modo' ? inp.value : +inp.value; refreshInfo(); }; });
    g.appendChild(el);
  });
  $('#fmt-checks').querySelectorAll('input').forEach((c) => (c.onchange = () => { FORMATOS.find((f) => f.id === c.dataset.f).on = c.checked; buildGrid(); }));
  refreshInfo();
}
function refreshInfo() {
  document.querySelectorAll('#grid .fmt[data-f]').forEach((el) => {
    const f = FORMATOS.find((x) => x.id === el.dataset.f); const p = plan(f); const m = modoEfectivo(f);
    el.querySelector('.aviso').textContent = p && !p.error ? `${MODOS[m]} · regla: ${p.encaje}${p.encaje === 'expandir' ? ' (sin IA generativa: fondo desenfocado)' : ''} · se pierde ${Math.round(p.recortePerdido * 100)}% si se recorta` : '';
  });
  const rows = FORMATOS.filter((f) => f.on).map((f) => {
    const p = plan(f); if (!p || p.error) return `<p>${f.nombre}: ${p ? p.error : 'sin vídeo'}</p>`;
    return `<div class="fmt" style="margin-bottom:8px"><h3>${f.nombre} · ${p.ancho}×${p.alto}</h3>
      <div class="dims">encaje <b>${p.encaje}</b> · adaptación <b>${p.adaptacion}</b> · recorte ${Math.round(p.recortePerdido * 100)}%<br>
      H.264 ${p.h264Perfil}@${p.h264Nivel} · ${p.bitrateKbps} kbps (${p.bitrateMotivo}) · ${p.fps} fps · GOP ${p.gopSegundos}s</div>
      <div class="aviso">${(p.avisos || []).join(' · ')}</div><pre style="white-space:pre-wrap;font-size:11px;color:#9fc3ff">${ffmpegCmd(f)}</pre></div>`;
  });
  $('#plan-tecnico').innerHTML = rows.join('');
}
function ffmpegCmd(f) {
  const p = perfil(f), W = p.ancho, H = p.alto, m = modoEfectivo(f), s = state.fmt[f.id];
  const enc = `-c:v libx264 -profile:v high -level 4.0 -pix_fmt yuv420p -r 25 -c:a aac -b:a 128k -movflags +faststart`;
  const name = `out/${(state.srcName || 'video').replace(/\.[^.]+$/, '')}-${f.id.replace(':', 'x')}-${W}x${H}.mp4`;
  if (m === 'cover') {
    const z = s.zoom.toFixed(2);
    return `ffmpeg -i ENTRADA -vf "scale=${W}*${z}:${H}*${z}:force_original_aspect_ratio=increase,crop=${W}:${H}:(iw-${W})*${s.fx.toFixed(2)}:(ih-${H})*${s.fy.toFixed(2)},setsar=1" ${enc} ${name}`;
  }
  const bg = m === 'blur' ? `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},boxblur=30:3,eq=brightness=-0.08` : `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},drawbox=c=black:t=fill`;
  return `ffmpeg -i ENTRADA -filter_complex "[0:v]split[a][b];[a]${bg}[bg];[b]scale=${W}:${H}:force_original_aspect_ratio=decrease[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1" ${enc} ${name}`;
}

// ── Render en vivo (canvas) ─────────────────────────────────────────────────
function drawInto(cv, f) {
  const ctx = cv.getContext('2d'), W = cv.width, H = cv.height, vw = video.videoWidth, vh = video.videoHeight;
  if (!vw) return;
  const m = modoEfectivo(f), s = state.fmt[f.id];
  const coverRect = (z = 1, fx = 0.5, fy = 0.5) => { const k = Math.max(W / vw, H / vh) * z, w = vw * k, h = vh * k; return [(W - w) * fx, (H - h) * fy, w, h]; };
  ctx.filter = 'none'; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  if (m === 'cover') { ctx.drawImage(video, ...coverRect(s.zoom, s.fx, s.fy)); return; }
  if (m === 'blur') { ctx.filter = 'blur(14px) brightness(0.85)'; ctx.drawImage(video, ...coverRect(1.1)); ctx.filter = 'none'; }
  const k = Math.min(W / vw, H / vh) * s.zoom, w = vw * k, h = vh * k;
  ctx.drawImage(video, (W - w) * s.fx, (H - h) * s.fy, w, h);
}
function loop() {
  document.querySelectorAll('.fmt[data-f]').forEach((el) => { const c = el.querySelector('canvas'); if (c) drawInto(c, FORMATOS.find((f) => f.id === el.dataset.f)); });
  if (!state.isJti) { drawInto($('#tw-cv-v'), FORMATOS[0]); drawInto($('#tw-cv-h'), FORMATOS[1]); }
  requestAnimationFrame(loop);
}

// ── Fuente ──────────────────────────────────────────────────────────────────
function setSource(url, name, isJti) {
  state.srcName = name; state.isJti = isJti; video.src = url; video.play().catch(() => {});
  document.querySelectorAll('#twin video').forEach((v) => (v.style.display = isJti ? '' : 'none'));
  document.querySelectorAll('#twin canvas').forEach((v) => (v.hidden = isJti));
}
video.addEventListener('loadedmetadata', () => {
  state.src = { ancho: video.videoWidth, alto: video.videoHeight, fps: 25, bitrateKbps: 0 };
  $('#src-info').textContent = `${state.srcName} · ${video.videoWidth}×${video.videoHeight} · ${video.duration.toFixed(1)} s`;
  refreshInfo();
});
$('#src-select').onchange = (e) => { const o = e.target.selectedOptions[0]; setSource(o.value, o.textContent.replace(/^Stock · /, ''), /jti-/.test(o.value)); };
$('#src-file').onchange = (e) => { const f = e.target.files[0]; if (f) setSource(URL.createObjectURL(f), f.name, false); };
$('#btn-play').onclick = () => (video.paused ? video.play() : video.pause());
$('#modo-global').onchange = (e) => { state.modoGlobal = e.target.value; refreshInfo(); };
$('#compat').onchange = (e) => { state.compat = e.target.value; buildGrid(); };

// ── Altadis: 9 estancos + gemelo + recorrido estilo CanalKiosk ─────────────
// Patrón copiado de admira.app (clearchannel-tv/app.js · startCircuitDemo /
// showCircuitDemoPoint): parada a parada, estado «i/N · nombre», dwell fijo y
// la siguiente parada precargada; el previo abre la pantalla sobre la fachada.
const TOUR_DWELL_MS = 8000;
let ESTANCOS = [], ORIGEN = null, cur = 0, tour = null;
async function loadEstancos() {
  const d = await (await fetch('/adaptaciones/altadis-bcn-9.json')).json();
  ESTANCOS = d.estancos; ORIGEN = d.origen;
  $('#lista-estancos').innerHTML = ESTANCOS.map((e, i) => `<li data-i="${i}"><b>${e.orden}. ${e.name}</b><small>${e.addr}<br>${e.dist_planeta7_m} m de Planeta 7 · OSM ${e.osm}</small></li>`).join('');
  $('#lista-estancos').querySelectorAll('li').forEach((li) => (li.onclick = () => { stopTour(); go(+li.dataset.i); }));
  drawMap(); go(0);
}
function proj(lat, lon) {
  const pts = ESTANCOS.map((e) => [e.lat, e.lon]).concat([[ORIGEN.lat, ORIGEN.lon]]);
  const la = pts.map((p) => p[0]), lo = pts.map((p) => p[1]);
  const [a0, a1, o0, o1] = [Math.min(...la), Math.max(...la), Math.min(...lo), Math.max(...lo)];
  const kx = Math.cos((a0 * Math.PI) / 180); const sx = 360 / ((o1 - o0) * kx), sy = 220 / (a1 - a0), s = Math.min(sx, sy);
  return [20 + (lon - o0) * kx * s, 240 - (lat - a0) * s];
}
function drawMap() {
  const svg = $('#minimap'); const P = ESTANCOS.map((e) => proj(e.lat, e.lon)); const o = proj(ORIGEN.lat, ORIGEN.lon);
  svg.innerHTML = `<text x="10" y="16" fill="#8a93a6" font-size="11">Circuito Altadis · Gràcia (ruta ${'≈'}${(ESTANCOS.reduce((a, e) => a + e.tramo_desde_anterior_m, 0) / 1000).toFixed(1)} km)</text>
    <polyline points="${P.map((p) => p.join(',')).join(' ')}" fill="none" stroke="#ff6a3d" stroke-width="2" stroke-dasharray="4 3"/>
    <rect x="${o[0] - 5}" y="${o[1] - 5}" width="10" height="10" fill="#3ddc97"/><text x="${o[0] + 8}" y="${o[1] + 4}" fill="#3ddc97" font-size="10">Planeta 7</text>
    ${P.map((p, i) => `<g data-i="${i}" style="cursor:pointer"><circle cx="${p[0]}" cy="${p[1]}" r="9" fill="#1b2030" stroke="#ff6a3d"/><text x="${p[0]}" y="${p[1] + 4}" text-anchor="middle" fill="#fff" font-size="10">${i + 1}</text></g>`).join('')}
    <circle id="mk" r="13" fill="none" stroke="#ffd84a" stroke-width="3" cx="${P[0][0]}" cy="${P[0][1]}" style="transition:cx 1.2s ease,cy 1.2s ease"/>`;
  svg.querySelectorAll('g[data-i]').forEach((g) => (g.onclick = () => { stopTour(); go(+g.dataset.i); }));
}
function go(i) {
  cur = (i + ESTANCOS.length) % ESTANCOS.length; const e = ESTANCOS[cur];
  document.querySelectorAll('#lista-estancos li').forEach((li) => li.classList.toggle('on', +li.dataset.i === cur));
  document.querySelector('#lista-estancos li.on')?.scrollIntoView({ block: 'nearest' });
  $('#twin-name').textContent = `Gemelo ${e.orden}/9 · ${e.name}`;
  $('#twin-addr').textContent = e.addr;
  $('#twin-ft').innerHTML = `Disposición: <b>P1 vertical 1080×1920</b> (escaparate) + <b>P2 horizontal 1920×1080</b> (sobre mostrador) · ${e.dist_planeta7_m} m de Planeta 7 · <a href="https://www.openstreetmap.org/${e.osm}" target="_blank" rel="noopener">OSM ${e.osm}</a>${e.opening_hours ? ' · ' + e.opening_hours : ''}${cur === 0 ? ' · <b style="color:#3ddc97">el más cercano a Planeta 7</b>' : ''}`;
  $('#link-gemelo').href = `https://www.xpaceos.com/admira-xp/?autostart=xtanco&loc=${e.id}`;
  const p = proj(e.lat, e.lon); const mk = $('#mk'); if (mk) { mk.setAttribute('cx', p[0]); mk.setAttribute('cy', p[1]); }
  const tw = $('#twin'); tw.animate([{ opacity: 0.25, transform: 'translateX(18px)' }, { opacity: 1, transform: 'none' }], { duration: 500, easing: 'ease-out' });
  $('#tour-status').textContent = tour ? `Recorrido · parada ${cur + 1}/${ESTANCOS.length} · ${e.name}` : `Parada ${cur + 1}/${ESTANCOS.length}`;
}
function startTour() { stopTour(); tour = { i: cur }; $('#tour').textContent = '■ Parar recorrido'; go(cur); tour.timer = setInterval(() => { if (cur === ESTANCOS.length - 1) { stopTour(); $('#tour-status').textContent = `Recorrido completado · ${ESTANCOS.length} estancos`; return; } go(cur + 1); }, TOUR_DWELL_MS); }
function stopTour() { if (tour) clearInterval(tour.timer); tour = null; $('#tour').textContent = '▶ Recorrido del circuito'; }
$('#prev').onclick = () => { stopTour(); go(cur - 1); };
$('#next').onclick = () => { stopTour(); go(cur + 1); };
$('#tour').onclick = () => (tour ? stopTour() : startTour());
document.addEventListener('keydown', (ev) => { if (ev.target.tagName === 'INPUT') return; if (ev.key === 'ArrowRight') $('#next').click(); if (ev.key === 'ArrowLeft') $('#prev').click(); });

buildGrid(); setSource('/adaptaciones/media/jti-tu-sitio-de-siempre-fuente.mp4', 'JTI «Tu sitio de siempre»', true); loadEstancos(); loop();
window.__pixAdapt = { go, startTour };
