import {mountXpace} from '/assets/xpaces/viewer.mjs?v=emision-4742';
import {EMISION, signageURL, pushBody} from '/assets/xpaces/emision-map.mjs?v=emision-4742';

const ITEM = {
  id:'1790375438696-1ladz7',
  title:'Cafebrería · Alsea',
  url:'https://api.admira.store/stock/asset/1790375438696-1ladz7',
};
const params = new URLSearchParams(location.search);
let selected = EMISION.some(row => row.id === params.get('pantalla')) ? params.get('pantalla') : 'cafebreria-pizarra-2';
const host = document.querySelector('#visor');
const estado = document.querySelector('#estado');
const censo = document.querySelector('#censo');
const grupo = document.querySelector('#pantallas');

for (const row of EMISION) {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.pantalla = row.id;
  button.textContent = row.material ? row.id + ' → ' + row.material : row.id + (row.kind === 'audio' ? ' · hilo' : ' · tele, sin malla');
  button.setAttribute('aria-pressed', String(row.id === selected));
  button.addEventListener('click', () => {
    selected = row.id;
    for (const other of grupo.querySelectorAll('button')) other.setAttribute('aria-pressed', String(other === button));
  });
  grupo.append(button);
}

document.querySelector('#poner').addEventListener('click', async () => {
  const body = pushBody(selected);
  estado.textContent = 'Enviando Tu pausa a ' + selected + '…';
  host.xpaceArm?.();
  try {
    const res = await fetch(signageURL('push'), {
      method:'POST',
      headers:{'content-type':'application/json'},
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
    await host.xpaceRefresh?.();
    const ver = host.querySelector('[data-ver="' + (EMISION.find(row => row.id === selected)?.inventory || '') + '"]');
    ver?.click();
    estado.textContent = 'Enviado ' + data.id + ' · ' + selected + '. El visor recoge el feed.';
  } catch (error) {
    estado.textContent = 'No se pudo enviar: ' + error.message;
  }
});

for (const button of document.querySelectorAll('[data-tier]')) {
  button.addEventListener('click', () => {
    const tier = host.xpaceSetTier?.(button.dataset.tier) || button.dataset.tier;
    for (const other of document.querySelectorAll('[data-tier]')) other.setAttribute('aria-pressed', String(other.dataset.tier === tier));
  });
}

function paintStatus() {
  const emision = host.xpaceState?.()?.emision;
  if (!emision) return;
  const lines = EMISION.map(row => {
    const slot = emision.screens[row.id];
    if (!slot) return '';
    if (slot.material && slot.materialFound === false) return row.id + ': el GLB no tiene ' + slot.material;
    if (!slot.onAir) return '';
    return 'EN ANTENA · ' + row.id + (slot.title ? ' · ' + slot.title : '');
  }).filter(Boolean);
  if (lines.length) estado.textContent = lines.join(' · ') + ' · hilo al ' + Math.round(emision.bed * 100) + '%';
  if (emision.census) censo.textContent = emision.census;
}

setInterval(paintStatus, 500);
mountXpace(host, ITEM).then(() => {
  const tier = params.get('tier');
  if (tier) host.xpaceSetTier?.(tier);
  if (host.dataset.ready === 'true') estado.textContent = 'Modelo listo. Elige una pantalla y pon Tu pausa.';
  if (host.dataset.error === 'true') estado.textContent = 'El visor no ha podido abrir el modelo.';
  paintStatus();
});
