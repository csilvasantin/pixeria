import test from 'node:test';
import assert from 'node:assert/strict';
import {
  blinkistSlug,
  blinkistCanonical,
  buildCapsulaPayload,
  CONSEJEROS,
  TEMAS,
} from '../assets/capsula-publicar.mjs';

test('slug y canon Blinkist desde variantes de URL', () => {
  assert.equal(blinkistSlug('https://www.blinkist.com/en/books/this-is-marketing-en'), 'this-is-marketing-en');
  assert.equal(blinkistSlug('https://www.blinkist.com/es/app/books/sapiens-en'), 'sapiens-en');
  assert.equal(blinkistSlug('https://www.blinkist.com/books/essentialism-en'), 'essentialism-en');
  assert.equal(
    blinkistCanonical('https://www.blinkist.com/es/app/books/sapiens-en?utm=x'),
    'https://www.blinkist.com/en/books/sapiens-en',
  );
});

test('payload capsula con URL: tags blinkist + comment con bloques', () => {
  const r = buildCapsulaPayload({
    url: 'https://www.blinkist.com/en/books/this-is-marketing-en',
    libro: 'This Is Marketing',
    autor: 'Seth Godin',
    tesis: 'This Is Marketing: no persuadas a la masa, lidera una tribu',
    consejeroId: 'georgelucas',
    tema: 'creativity',
    carbono: 'Una tribu pequeña y leal vale más que una masa indiferente.',
  });
  assert.equal(r.ok, true);
  assert.equal(r.payload.type, 'capsula');
  assert.equal(r.payload.motor, 'Lucas · Grok');
  assert.equal(r.payload.quality, 'good');
  assert.deepEqual(r.payload.tags, ['formacion', 'georgelucas', 'creativity', 'blinkist']);
  assert.equal(r.payload.prompt, 'https://www.blinkist.com/en/books/this-is-marketing-en');
  assert.match(r.payload.comment, /^PARA CARBONO\n/);
  assert.match(r.payload.comment, /\nPARA SILICIO\n/);
  assert.match(r.payload.comment, /\nAPLICACIÓN\n/);
  assert.match(r.payload.comment, /Fuente: This Is Marketing, de Seth Godin \(resumen Blinkist/);
  assert.equal(r.payload.skipVideo, true);
  // Sin url/base64: publishToStock + worker tratan comment como el asset.
  assert.equal(r.payload.url, undefined);
  assert.equal(r.payload.base64, undefined);
});

test('sin URL exige libro+autor; auto-rellena SILICIO y APLICACIÓN', () => {
  const r = buildCapsulaPayload({
    tesis: 'Essentialism: menos pero mejor',
    libro: 'Essentialism',
    autor: 'Greg McKeown',
    consejeroId: 'stevejobs',
    tema: 'business',
    carbono: 'Menos pero mejor es la única estrategia que escala sin quemar el equipo.',
  });
  assert.equal(r.ok, true);
  assert.match(r.payload.prompt, /^blinkist:manual:/);
  assert.match(r.payload.comment, /PARA SILICIO\nOpera con 3 criterios/);
  assert.match(r.payload.comment, /APLICACIÓN\nEn 48 h/);
  assert.equal(r.payload.motor, 'Jobs · Grok');
});

test('validación: falta carbono o consejero', () => {
  const r = buildCapsulaPayload({
    url: 'https://www.blinkist.com/en/books/x-en',
    tesis: 'T',
    consejeroId: 'nadie',
    tema: 'tech',
  });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /consejero/i.test(e)));
  assert.ok(r.errors.some((e) => /CARBONO/i.test(e)));
});

test('catálogo de consejeros y temas alineado con Cafebrería', () => {
  assert.ok(CONSEJEROS.some((c) => c.id === 'waltdisney'));
  assert.ok(CONSEJEROS.some((c) => c.id === 'elonmusk'));
  assert.deepEqual(TEMAS.map((t) => t.id), ['business', 'tech', 'creativity']);
});
